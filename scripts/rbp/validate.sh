#!/usr/bin/env bash
# RBP Stack Validator
# Usage: ./validate.sh
#
# Validates that the RBP Stack is properly installed and configured.
# Run this after installation to verify everything is set up correctly.

set -e

# Get project root (parent of scripts/rbp)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine if we're in scripts/rbp or the rbp package root
if [[ "$SCRIPT_DIR" == */scripts/rbp ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
elif [[ "$SCRIPT_DIR" == */rbp ]]; then
  PROJECT_ROOT="$SCRIPT_DIR"
else
  PROJECT_ROOT="$(pwd)"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

check_pass() {
  echo -e "  ${GREEN}[✓]${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

check_fail() {
  echo -e "  ${RED}[✗]${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

check_warn() {
  echo -e "  ${YELLOW}[!]${NC} $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════"
echo "           RBP Stack Validation"
echo "═══════════════════════════════════════════════════════"
echo -e "${NC}"
echo "Project: $PROJECT_ROOT"
echo ""

# Prerequisites
echo -e "${YELLOW}Prerequisites:${NC}"

if command -v bd &>/dev/null; then
  check_pass "bd (beads) installed"
else
  check_fail "bd (beads) not installed"
fi

if command -v bun &>/dev/null; then
  check_pass "bun installed"
else
  check_fail "bun not installed"
fi

if command -v claude &>/dev/null; then
  check_pass "claude CLI installed"
else
  check_fail "claude CLI not installed"
fi

echo ""

# Directory Structure
echo -e "${YELLOW}Directory Structure:${NC}"

if [ -d "$PROJECT_ROOT/scripts/rbp" ]; then
  check_pass "scripts/rbp/ exists"
else
  check_fail "scripts/rbp/ missing"
fi

if [ -d "$PROJECT_ROOT/.claude/commands/rbp" ]; then
  check_pass ".claude/commands/rbp/ exists"
else
  check_fail ".claude/commands/rbp/ missing"
fi

if [ -d "$PROJECT_ROOT/.beads" ]; then
  check_pass ".beads/ initialized"
else
  check_fail ".beads/ not initialized (run 'bd init')"
fi

echo ""

# Scripts
echo -e "${YELLOW}Scripts:${NC}"

REQUIRED_SCRIPTS=(
  "ralph.sh"
  "prompt.md"
  "close-with-proof.sh"
  "sequencer.sh"
  "parse-story-to-beads.sh"
  "show-active-task.sh"
  "save-progress-to-beads.sh"
  "parse-spec-to-beads.sh"
  "ralph-execute.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
  if [ -f "$PROJECT_ROOT/scripts/rbp/$script" ]; then
    check_pass "$script"
  else
    check_fail "$script missing"
  fi
done

echo ""

# Commands
echo -e "${YELLOW}Slash Commands:${NC}"

REQUIRED_COMMANDS=(
  "start.md"
  "status.md"
  "validate.md"
)

for cmd in "${REQUIRED_COMMANDS[@]}"; do
  if [ -f "$PROJECT_ROOT/.claude/commands/rbp/$cmd" ]; then
    check_pass "$cmd"
  else
    check_fail "$cmd missing"
  fi
done

echo ""

# Configuration
echo -e "${YELLOW}Configuration:${NC}"

if [ -f "$PROJECT_ROOT/rbp-config.yaml" ]; then
  check_pass "rbp-config.yaml exists"
else
  check_warn "rbp-config.yaml missing (optional but recommended)"
fi

if [ -f "$PROJECT_ROOT/.claude/settings.json" ]; then
  if grep -q "show-active-task\|save-progress-to-beads" "$PROJECT_ROOT/.claude/settings.json" 2>/dev/null; then
    check_pass "hooks configured in settings.json"
  else
    check_warn "hooks may not be configured in settings.json"
  fi
else
  check_warn ".claude/settings.json missing (hooks not configured)"
fi

echo ""

# Test Infrastructure
echo -e "${YELLOW}Test Infrastructure:${NC}"

if [ -f "$PROJECT_ROOT/package.json" ]; then
  if grep -q '"test"' "$PROJECT_ROOT/package.json"; then
    check_pass "test script defined in package.json"
  else
    check_warn "no test script in package.json"
  fi

  if grep -q '"typecheck"' "$PROJECT_ROOT/package.json"; then
    check_pass "typecheck script defined in package.json"
  else
    check_warn "no typecheck script in package.json"
  fi
else
  check_warn "package.json not found"
fi

echo ""

# Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
  if [ $WARN_COUNT -eq 0 ]; then
    echo -e "${GREEN}RBP Stack: READY${NC}"
    echo -e "All $PASS_COUNT checks passed"
  else
    echo -e "${YELLOW}RBP Stack: READY (with warnings)${NC}"
    echo -e "$PASS_COUNT passed, $WARN_COUNT warnings"
  fi
  echo ""
  echo "You can now use either workflow:"
  echo ""
  echo "  Workflow A - BMAD Stories:"
  echo "    1. Create stories: /bmad:bmm:workflows:create-story"
  echo "    2. Convert: ./scripts/rbp/parse-story-to-beads.sh <story.md>"
  echo "    3. Execute: ./scripts/rbp/ralph.sh"
  echo ""
  echo "  Workflow B - Quick-Plan Specs:"
  echo "    1. Create spec: /quick-plan \"feature description\""
  echo "    2. Execute: ./scripts/rbp/ralph-execute.sh specs/<spec>.md"
else
  echo -e "${RED}RBP Stack: NOT READY${NC}"
  echo -e "$PASS_COUNT passed, ${RED}$FAIL_COUNT failed${NC}, $WARN_COUNT warnings"
  echo ""
  echo "Fix the failed checks above and run validation again."
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"

# Exit with error if failures
[ $FAIL_COUNT -eq 0 ] || exit 1
