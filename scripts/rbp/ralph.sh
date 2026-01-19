#!/usr/bin/env bash
# Ralph - Beads-driven autonomous execution loop
# Usage: ./ralph.sh [max_iterations]
#
# RBP Stack v2.0 - Uses Beads as source of truth, Claude Code as execution engine
# Queries `bd ready` for next task, executes via Claude, requires test-gated closure

set -e

# Configuration
MAX_ITERATIONS=${1:-50}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RBP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Generate session ID for observability
RBP_SESSION_ID=$(uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "ralph-$$-$(date +%s)")
export RBP_SESSION_ID

# Source event emitter for observability
if [ -f "$SCRIPT_DIR/emit-event.sh" ]; then
  source "$SCRIPT_DIR/emit-event.sh"
fi

# Auto-detect PROJECT_ROOT: prefer RBP_ROOT if it has beads (development mode),
# otherwise use parent directory (installed mode)
if [ -d "$RBP_ROOT/.beads" ]; then
  PROJECT_ROOT="$RBP_ROOT"
elif [ -d "$RBP_ROOT/../.beads" ]; then
  PROJECT_ROOT="$(cd "$RBP_ROOT/.." && pwd)"
else
  # No beads found - assume installed mode (parent directory)
  PROJECT_ROOT="$(cd "$RBP_ROOT/.." && pwd)"
fi

CONFIG_FILE="$PROJECT_ROOT/rbp-config.yaml"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

# Load observability configuration
load_observability_config() {
  # Default: enabled
  RBP_OBSERVABILITY_ENABLED="true"

  if [ ! -f "$CONFIG_FILE" ]; then
    return
  fi

  # Use yq if available (preferred - handles all YAML edge cases)
  if command -v yq &>/dev/null; then
    local value=$(yq -r '.observability.enabled // "true"' "$CONFIG_FILE" 2>/dev/null)
    if [ "$value" = "false" ]; then
      RBP_OBSERVABILITY_ENABLED="false"
    fi
    return
  fi

  # Fallback: python yaml parser
  if command -v python3 &>/dev/null; then
    local value=$(python3 -c "
import yaml
try:
    with open('$CONFIG_FILE') as f:
        cfg = yaml.safe_load(f)
    obs = cfg.get('observability', {})
    print('false' if obs.get('enabled') == False else 'true')
except: print('true')
" 2>/dev/null)
    if [ "$value" = "false" ]; then
      RBP_OBSERVABILITY_ENABLED="false"
    fi
    return
  fi

  # Last resort: grep (limited but works for simple cases)
  if grep -q 'enabled:[[:space:]]*false' "$CONFIG_FILE" 2>/dev/null; then
    RBP_OBSERVABILITY_ENABLED="false"
  fi
}

# Initialize observability
load_observability_config
export RBP_OBSERVABILITY_ENABLED

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
print_banner() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║          Ralph - Autonomous Execution Loop                ║"
  echo "║                  RBP Stack v2.0                           ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
  local missing=()

  command -v bd &>/dev/null || missing+=("bd (beads)")
  command -v claude &>/dev/null || missing+=("claude (Claude Code CLI)")
  command -v bun &>/dev/null || missing+=("bun")

  # jq is recommended for reliable JSON parsing
  if ! command -v jq &>/dev/null; then
    echo -e "${YELLOW}WARNING: jq not found - JSON parsing may be unreliable${NC}"
    echo -e "${YELLOW}Install with: brew install jq${NC}"
    echo ""
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}ERROR: Missing prerequisites:${NC}"
    for item in "${missing[@]}"; do
      echo -e "  - $item"
    done
    exit 1
  fi

  # Check if beads is initialized
  if [ ! -d "$PROJECT_ROOT/.beads" ]; then
    echo -e "${RED}ERROR: Beads not initialized. Run 'bd init' first.${NC}"
    exit 1
  fi
}

# Get next ready task from beads (using --json for reliable parsing)
get_next_task() {
  cd "$PROJECT_ROOT"
  # Get first ready task in JSON format
  # Use jq to handle any JSON formatting (pretty-printed or compact)
  local ready_json=$(bd ready --json --limit 1 2>/dev/null || echo "[]")

  # Check if jq is available for reliable parsing
  if command -v jq &>/dev/null; then
    # Use jq to check if array is empty and extract first element
    local count=$(echo "$ready_json" | jq 'length' 2>/dev/null || echo "0")
    if [ "$count" = "0" ] || [ -z "$count" ]; then
      echo ""
    else
      # Return the first task as compact JSON
      echo "$ready_json" | jq -c '.[0]' 2>/dev/null
    fi
  else
    # Fallback: compact the JSON and do string check
    local compact=$(echo "$ready_json" | tr -d '[:space:]')
    if [ "$compact" = "[]" ] || [ -z "$compact" ]; then
      echo ""
    else
      echo "$ready_json"
    fi
  fi
}

# Check if all tasks are complete
all_tasks_complete() {
  cd "$PROJECT_ROOT"
  # Use --json and check if array is empty
  local ready_json=$(bd ready --json 2>/dev/null || echo "[]")

  # Check if jq is available for reliable parsing
  if command -v jq &>/dev/null; then
    local count=$(echo "$ready_json" | jq 'length' 2>/dev/null || echo "0")
    [ "$count" = "0" ] || [ -z "$count" ]
  else
    # Fallback: compact the JSON and compare
    local compact=$(echo "$ready_json" | tr -d '[:space:]')
    [ "$compact" = "[]" ] || [ -z "$compact" ]
  fi
}

# Log progress
log_progress() {
  local message="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] $message" >> "$PROGRESS_FILE"
}

# Initialize progress file
init_progress() {
  if [ ! -f "$PROGRESS_FILE" ]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "Project: $PROJECT_ROOT" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
}

# Run single iteration
run_iteration() {
  local iteration=$1

  echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Ralph Iteration $iteration of $MAX_ITERATIONS${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

  # Get next task
  local task=$(get_next_task)

  if [ -z "$task" ]; then
    echo -e "${GREEN}No more tasks ready. Checking if all complete...${NC}"
    return 1
  fi

  # Extract task ID and title for observability (using jq if available)
  local task_id=""
  local task_title=""
  if command -v jq &>/dev/null; then
    task_id=$(echo "$task" | jq -r '.id // "unknown"' 2>/dev/null || echo "unknown")
    task_title=$(echo "$task" | jq -r '.title // "Untitled"' 2>/dev/null || echo "Untitled")
  fi

  echo -e "${CYAN}Current Task:${NC}"
  echo "$task"
  echo ""

  log_progress "Iteration $iteration: Starting task $task_id"

  # Emit task start event
  emit_task_start "$iteration" "$task_id" "$task_title" 2>/dev/null || true

  # Build the prompt with current task context
  local prompt=$(cat "$SCRIPT_DIR/prompt.md")
  prompt="$prompt

## Current Task from Beads

\`\`\`
$task
\`\`\`

Execute this task following the RBP Protocol. When complete, use close-with-proof.sh to close the bead with test verification."

  # Execute via Claude Code
  echo -e "${YELLOW}Executing via Claude Code...${NC}\n"

  # Emit task progress event
  emit_task_progress "$iteration" "$task_id" "executing" 2>/dev/null || true

  local output
  output=$(echo "$prompt" | claude --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$output" | grep -q "<rbp:complete/>"; then
    echo -e "\n${GREEN}Task marked complete with verification.${NC}"
    log_progress "Iteration $iteration: Task completed with verification"
    # Emit task complete event
    emit_task_complete "$iteration" "$task_id" "closed" 2>/dev/null || true
    return 0
  fi

  # Check for error signal
  if echo "$output" | grep -q "<rbp:error>"; then
    echo -e "\n${RED}Task encountered an error.${NC}"
    log_progress "Iteration $iteration: Task failed"
    # Extract error message if possible
    local error_msg=$(echo "$output" | grep -o '<rbp:error>[^<]*</rbp:error>' | sed 's/<[^>]*>//g' || echo "Unknown error")
    emit_error "$iteration" "$task_id" "$error_msg" 2>/dev/null || true
    return 0  # Continue to next iteration
  fi

  log_progress "Iteration $iteration: Completed iteration"
  emit_task_progress "$iteration" "$task_id" "iteration_complete" 2>/dev/null || true
  return 0
}

# Main execution loop
main() {
  print_banner
  check_prerequisites
  init_progress

  echo -e "${GREEN}Starting Ralph execution loop${NC}"
  echo -e "Max iterations: $MAX_ITERATIONS"
  echo -e "Project root: $PROJECT_ROOT"
  if [ "$RBP_OBSERVABILITY_ENABLED" = "true" ]; then
    echo -e "Observability: enabled (session: ${RBP_SESSION_ID:0:8}...)"
  fi
  echo ""

  log_progress "=== Ralph session started ==="

  # Emit loop start event
  emit_loop_start 1 "$MAX_ITERATIONS" 2>/dev/null || true

  for i in $(seq 1 $MAX_ITERATIONS); do
    # Check if all tasks are complete before starting iteration
    if all_tasks_complete; then
      echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
      echo -e "${GREEN}║              ALL TASKS COMPLETE!                      ║${NC}"
      echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
      log_progress "=== All tasks complete at iteration $i ==="
      # Emit loop end event
      emit_loop_end "$i" "all_complete" 2>/dev/null || true
      exit 0
    fi

    run_iteration $i

    # Brief pause between iterations
    sleep 2
  done

  echo -e "\n${YELLOW}Ralph reached max iterations ($MAX_ITERATIONS).${NC}"
  echo -e "Check progress: $PROGRESS_FILE"
  echo -e "Run 'bd status' to see remaining tasks."

  log_progress "=== Reached max iterations ==="
  # Emit loop end event
  emit_loop_end "$MAX_ITERATIONS" "max_iterations_reached" 2>/dev/null || true
  exit 1
}

# Handle script arguments
case "${1:-}" in
  --help|-h)
    echo "Usage: ./ralph.sh [max_iterations]"
    echo ""
    echo "Ralph - Beads-driven autonomous execution loop"
    echo ""
    echo "Options:"
    echo "  max_iterations  Maximum number of iterations (default: 50)"
    echo "  --help, -h      Show this help message"
    echo "  --status        Show current beads status"
    echo ""
    echo "Examples:"
    echo "  ./ralph.sh          # Run with default 50 iterations"
    echo "  ./ralph.sh 100      # Run with 100 iterations"
    exit 0
    ;;
  --status)
    cd "$PROJECT_ROOT"
    bd status
    exit 0
    ;;
  *)
    main
    ;;
esac
