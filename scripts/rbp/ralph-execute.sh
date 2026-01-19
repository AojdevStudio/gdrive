#!/usr/bin/env bash
# ralph-execute.sh - Execute quick-plan specs with RBP verification
# Usage: ./ralph-execute.sh [spec-file.md] [--skip-review]
#
# Workflow:
# 1. (Optional) Run Codex pre-flight review on spec
# 2. Parse spec to Beads if not already done
# 3. Execute Ralph loop until all tasks complete with test verification

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Generate session ID for observability (share with Ralph)
RBP_SESSION_ID=$(uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "ralph-exec-$$-$(date +%s)")
export RBP_SESSION_ID
export RBP_SOURCE_APP="RBP-QuickPlan"

# Source event emitter for observability
if [ -f "$SCRIPT_DIR/emit-event.sh" ]; then
  source "$SCRIPT_DIR/emit-event.sh"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration defaults
MAX_ITERATIONS=50
SPEC_FILE=""
SKIP_REVIEW=false

# Load config from rbp-config.yaml if available
CONFIG_FILE="$PROJECT_ROOT/rbp-config.yaml"
if [ -f "$CONFIG_FILE" ]; then
  # Read paths.specs (default: specs)
  SPECS_DIR=$(grep -A5 '^paths:' "$CONFIG_FILE" 2>/dev/null | grep 'specs:' | sed 's/.*specs:[[:space:]]*"\?\([^"]*\)"\?.*/\1/' | head -1)
  SPECS_DIR="${SPECS_DIR:-specs}"

  # Read verification.test_command
  CONFIG_TEST_CMD=$(grep -A10 '^verification:' "$CONFIG_FILE" 2>/dev/null | grep 'test_command:' | sed 's/.*test_command:[[:space:]]*"\?\([^"]*\)"\?.*/\1/' | head -1)

  # Read codex settings
  CODEX_ENABLED=$(grep -A10 '^codex:' "$CONFIG_FILE" 2>/dev/null | grep 'enabled:' | sed 's/.*enabled:[[:space:]]*//' | head -1)
  CODEX_MODEL=$(grep -A10 '^codex:' "$CONFIG_FILE" 2>/dev/null | grep 'model:' | sed 's/.*model:[[:space:]]*"\?\([^"]*\)"\?.*/\1/' | head -1)
  CODEX_REASONING=$(grep -A10 '^codex:' "$CONFIG_FILE" 2>/dev/null | grep 'reasoning_effort:' | sed 's/.*reasoning_effort:[[:space:]]*"\?\([^"]*\)"\?.*/\1/' | head -1)
  CODEX_SKIP_DEFAULT=$(grep -A10 '^codex:' "$CONFIG_FILE" 2>/dev/null | grep 'skip_by_default:' | sed 's/.*skip_by_default:[[:space:]]*//' | head -1)

  # Apply codex skip_by_default if set
  if [ "$CODEX_SKIP_DEFAULT" = "true" ]; then
    SKIP_REVIEW=true
  fi
else
  SPECS_DIR="specs"
  CONFIG_TEST_CMD=""
  CODEX_ENABLED="true"
  CODEX_MODEL="gpt-5-codex"
  CODEX_REASONING="high"
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-review)
      SKIP_REVIEW=true
      shift
      ;;
    --max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./ralph-execute.sh [spec-file.md] [options]"
      echo ""
      echo "Execute a quick-plan spec with RBP test-gated verification."
      echo ""
      echo "Options:"
      echo "  --skip-review       Skip Codex pre-flight review"
      echo "  --max-iterations N  Maximum iterations (default: 50)"
      echo "  -h, --help          Show this help"
      echo ""
      echo "Workflow:"
      echo "  1. Codex reviews spec for missed items (unless --skip-review)"
      echo "  2. Parse spec to Beads task graph"
      echo "  3. Ralph loop: bd ready → implement → test → close"
      echo "  4. Repeat until all tasks verified"
      exit 0
      ;;
    *)
      SPEC_FILE="$1"
      shift
      ;;
  esac
done

# Print banner
print_banner() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║       Ralph Execute - Quick-Plan Spec Runner              ║"
  echo "║                    RBP Stack v2.0                         ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# Find spec file if not provided
find_spec_file() {
  if [ -n "$SPEC_FILE" ]; then
    if [ ! -f "$SPEC_FILE" ]; then
      # Try in specs directory (from config)
      if [ -f "$PROJECT_ROOT/$SPECS_DIR/$SPEC_FILE" ]; then
        SPEC_FILE="$PROJECT_ROOT/$SPECS_DIR/$SPEC_FILE"
      elif [ -f "$PROJECT_ROOT/$SPECS_DIR/${SPEC_FILE}.md" ]; then
        SPEC_FILE="$PROJECT_ROOT/$SPECS_DIR/${SPEC_FILE}.md"
      else
        echo -e "${RED}ERROR: Spec file not found: $SPEC_FILE${NC}"
        exit 1
      fi
    fi
    return
  fi

  # List available specs
  echo -e "${YELLOW}No spec file provided. Available specs:${NC}\n"
  local specs=()
  local i=1

  for f in "$PROJECT_ROOT/$SPECS_DIR/"*.md; do
    if [ -f "$f" ]; then
      local name=$(basename "$f" .md)
      specs+=("$f")
      echo "  $i) $name"
      i=$((i + 1))
    fi
  done

  if [ ${#specs[@]} -eq 0 ]; then
    echo -e "${RED}No specs found in $PROJECT_ROOT/$SPECS_DIR/${NC}"
    echo -e "Run /quick-plan to create a spec first."
    exit 1
  fi

  echo ""
  read -p "Select spec (1-${#specs[@]}): " selection

  if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#specs[@]} ]; then
    SPEC_FILE="${specs[$((selection - 1))]}"
  else
    echo -e "${RED}Invalid selection${NC}"
    exit 1
  fi
}

# Run Codex pre-flight review
run_codex_review() {
  if [ "$SKIP_REVIEW" = true ]; then
    echo -e "${YELLOW}Skipping Codex pre-flight review (--skip-review)${NC}\n"
    return 0
  fi

  if [ "$CODEX_ENABLED" = "false" ]; then
    echo -e "${YELLOW}Codex review disabled in config${NC}\n"
    return 0
  fi

  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Step 1: Codex Pre-Flight Review${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

  if ! command -v codex &>/dev/null; then
    echo -e "${YELLOW}Codex CLI not found. Skipping pre-flight review.${NC}"
    echo -e "Install Codex to enable spec review: https://codex.openai.com"
    echo ""
    return 0
  fi

  local model="${CODEX_MODEL:-gpt-5-codex}"
  local reasoning="${CODEX_REASONING:-high}"
  echo -e "${CYAN}Running $model review on spec (reasoning: $reasoning)...${NC}\n"

  # Emit Codex review start event
  emit_codex_review "start" "$SPEC_FILE" "" 2>/dev/null || true

  local review_prompt="Review this implementation spec for:
1. Missing edge cases that could cause bugs
2. Wrong technical approaches or anti-patterns
3. Missing dependencies between tasks
4. Incomplete testing strategy
5. Security concerns
6. Tasks that are too large and should be split

Spec file: $SPEC_FILE

$(cat "$SPEC_FILE")

Provide specific, actionable improvements. Be concise."

  # Run Codex in read-only mode with configured settings
  local review_output
  review_output=$(echo "$review_prompt" | codex exec --skip-git-repo-check \
    -m "$model" \
    --config model_reasoning_effort="$reasoning" \
    --sandbox read-only \
    2>&1) || {
      echo -e "${YELLOW}Codex review failed or unavailable. Continuing without review.${NC}"
      emit_codex_review "failed" "$SPEC_FILE" "Codex unavailable or failed" 2>/dev/null || true
      return 0
    }

  echo "$review_output"
  echo ""
  echo -e "${GREEN}Codex review complete.${NC}"
  echo ""

  # Emit Codex review complete event (truncate findings for event)
  local findings_summary=$(echo "$review_output" | head -c 500 | tr '\n' ' ')
  emit_codex_review "complete" "$SPEC_FILE" "$findings_summary" 2>/dev/null || true

  # Auto-accept and continue: Codex findings are informational
  # The spec's purpose is to satisfy acceptance criteria - if Codex found issues,
  # they should be addressed in the spec before running this command.
  # At runtime, we trust the spec is ready and proceed.
  echo -e "${CYAN}Codex findings noted. Proceeding with execution...${NC}"
  echo -e "${YELLOW}(If critical issues were found, Ctrl+C now and update the spec)${NC}\n"
  sleep 2  # Brief pause to allow abort if needed
}

# Parse spec to Beads
parse_spec_to_beads() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Step 2: Parse Spec to Beads${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

  # Check if already parsed (look for spec bead)
  local spec_name=$(basename "$SPEC_FILE" .md)

  # Run the parser
  "$SCRIPT_DIR/parse-spec-to-beads.sh" "$SPEC_FILE"

  # Count created tasks for observability event
  local task_count=0
  if command -v bd &>/dev/null; then
    task_count=$(bd list --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
  fi

  # Emit spec parsed event
  emit_spec_parsed "$SPEC_FILE" "$task_count" 2>/dev/null || true

  echo ""
}

# Get test command from spec or config
get_test_command() {
  # Priority: 1) .rbp/test-command (from spec), 2) rbp-config.yaml, 3) auto-detect

  local spec_config="$PROJECT_ROOT/.rbp/test-command"

  # Check spec-specific override first
  if [ -f "$spec_config" ]; then
    cat "$spec_config"
    return
  fi

  # Check rbp-config.yaml
  if [ -n "$CONFIG_TEST_CMD" ]; then
    echo "$CONFIG_TEST_CMD"
    return
  fi

  # Auto-detect from package.json
  if [ -f "$PROJECT_ROOT/package.json" ]; then
    if grep -q '"test"' "$PROJECT_ROOT/package.json"; then
      if grep -q '"bun' "$PROJECT_ROOT/package.json"; then
        echo "bun test"
      elif grep -q '"vitest' "$PROJECT_ROOT/package.json"; then
        echo "npx vitest run"
      else
        echo "npm test"
      fi
      return
    fi
  fi

  # Default fallback
  echo "bun test"
}

# Run the execution loop
run_execution_loop() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Step 3: Ralph Execution Loop${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

  local test_command=$(get_test_command)
  echo -e "${GREEN}Test Command:${NC} $test_command"
  echo -e "${GREEN}Max Iterations:${NC} $MAX_ITERATIONS"
  echo ""

  # Run the existing ralph.sh with our configuration
  export RBP_TEST_COMMAND="$test_command"
  "$SCRIPT_DIR/ralph.sh" "$MAX_ITERATIONS"
}

# Main
main() {
  print_banner
  find_spec_file

  echo -e "${GREEN}Spec File:${NC} $SPEC_FILE"
  echo ""

  run_codex_review
  parse_spec_to_beads
  run_execution_loop
}

main
