#!/usr/bin/env bash
# close-with-proof.sh - Test-gated bead closure
# Usage: ./close-with-proof.sh <bead-id> [--playwright]
#
# This script enforces the RBP verification protocol:
# 1. Run bun test
# 2. Run playwright test (if --playwright flag or UI task detected)
# 3. Only close bead if all tests pass
# 4. Record test output as proof in bead notes

set -e

BEAD_ID="${1:-}"
REQUIRE_PLAYWRIGHT=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source event emitter for observability (inherit session from Ralph if available)
if [ -f "$SCRIPT_DIR/emit-event.sh" ]; then
  source "$SCRIPT_DIR/emit-event.sh"
fi

# Parse arguments
for arg in "$@"; do
  case $arg in
    --playwright)
      REQUIRE_PLAYWRIGHT=true
      shift
      ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Validate bead ID
if [ -z "$BEAD_ID" ]; then
  echo -e "${RED}ERROR: Bead ID required${NC}"
  echo "Usage: ./close-with-proof.sh <bead-id> [--playwright]"
  exit 1
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  RBP Test-Gated Closure${NC}"
echo -e "${CYAN}  Bead: $BEAD_ID${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"

# Track test results
TESTS_PASSED=true
TEST_OUTPUT=""
PROOF_SUMMARY=""

# Step 1: Run typecheck
echo -e "${YELLOW}Step 1/3: Running typecheck...${NC}"

# Emit test run event for typecheck
emit_test_run 0 "$BEAD_ID" "bun run typecheck" 2>/dev/null || true

# Capture both output and exit code (disable set -e temporarily)
set +e
TYPECHECK_OUTPUT=$(bun run typecheck 2>&1)
TYPECHECK_EXIT_CODE=$?
set -e

# Emit test result event for typecheck
emit_test_result 0 "$BEAD_ID" "$TYPECHECK_EXIT_CODE" "$TYPECHECK_OUTPUT" 2>/dev/null || true

if [ $TYPECHECK_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}Typecheck passed${NC}\n"
  PROOF_SUMMARY+="typecheck: PASS (exit code 0)\n"
else
  echo -e "${RED}Typecheck FAILED (exit code $TYPECHECK_EXIT_CODE)${NC}"
  echo "$TYPECHECK_OUTPUT"
  TESTS_PASSED=false
  PROOF_SUMMARY+="typecheck: FAIL (exit code $TYPECHECK_EXIT_CODE)\n"
fi

# Step 2: Run unit tests
echo -e "${YELLOW}Step 2/3: Running tests...${NC}"

# Emit test run event for unit tests
emit_test_run 0 "$BEAD_ID" "bun run test" 2>/dev/null || true

# Capture both output and exit code (disable set -e temporarily)
set +e
TEST_OUTPUT=$(bun run test 2>&1)
TEST_EXIT_CODE=$?
set -e

# Emit test result event for unit tests
emit_test_result 0 "$BEAD_ID" "$TEST_EXIT_CODE" "$TEST_OUTPUT" 2>/dev/null || true

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}Tests passed${NC}\n"
  PROOF_SUMMARY+="bun test: PASS (exit code 0)\n"
else
  echo -e "${RED}Tests FAILED (exit code $TEST_EXIT_CODE)${NC}"
  echo "$TEST_OUTPUT"
  TESTS_PASSED=false
  PROOF_SUMMARY+="bun test: FAIL (exit code $TEST_EXIT_CODE)\n"
fi

# Step 3: Run Playwright (if required)
if [ "$REQUIRE_PLAYWRIGHT" = true ]; then
  echo -e "${YELLOW}Step 3/3: Running Playwright tests...${NC}"

  # Emit test run event for Playwright
  emit_test_run 0 "$BEAD_ID" "bunx playwright test" 2>/dev/null || true

  # Capture both output and exit code (disable set -e temporarily)
  set +e
  PLAYWRIGHT_OUTPUT=$(bunx playwright test 2>&1)
  PLAYWRIGHT_EXIT_CODE=$?
  set -e

  # Emit test result event for Playwright
  emit_test_result 0 "$BEAD_ID" "$PLAYWRIGHT_EXIT_CODE" "$PLAYWRIGHT_OUTPUT" 2>/dev/null || true

  if [ $PLAYWRIGHT_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}Playwright tests passed${NC}\n"
    PROOF_SUMMARY+="playwright: PASS (exit code 0)\n"
  else
    echo -e "${RED}Playwright tests FAILED (exit code $PLAYWRIGHT_EXIT_CODE)${NC}"
    echo "$PLAYWRIGHT_OUTPUT"
    TESTS_PASSED=false
    PROOF_SUMMARY+="playwright: FAIL (exit code $PLAYWRIGHT_EXIT_CODE)\n"
  fi
else
  echo -e "${YELLOW}Step 3/3: Playwright skipped (not required)${NC}\n"
  PROOF_SUMMARY+="playwright: SKIPPED\n"
fi

# Decision point
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"

if [ "$TESTS_PASSED" = true ]; then
  echo -e "${GREEN}All verifications PASSED${NC}"
  echo -e "${GREEN}Closing bead with proof...${NC}\n"

  # Generate proof timestamp
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  PROOF_NOTE="Verified: $TIMESTAMP\n$PROOF_SUMMARY"

  # Close the bead with verification note - MUST SUCCEED or we fail
  if bd close "$BEAD_ID" --note "$(echo -e "$PROOF_NOTE")" 2>/dev/null; then
    :
  elif bd close "$BEAD_ID" 2>/dev/null; then
    :
  else
    echo -e "${RED}ERROR: Failed to close bead $BEAD_ID${NC}"
    echo -e "${RED}Tests passed but bead closure failed - this is a critical error${NC}"
    echo ""
    echo "<rbp:error>Bead close failed - closure blocked</rbp:error>"
    exit 1
  fi

  # Force sync to avoid stale JSONL/git state (critical for multi-agent coordination)
  # In a git repo, sync failure blocks completion for strict auditability
  if command -v git &>/dev/null && {
    [ -d "$PROJECT_ROOT/.git" ] || git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1
  }; then
    # We're in a git repo - sync is mandatory for auditability
    if ! bd sync 2>/dev/null; then
      echo -e "${RED}ERROR: bd sync failed in git repo${NC}"
      echo -e "${RED}Bead closed but state not synced - this breaks auditability${NC}"
      echo ""
      echo "<rbp:error>Bead closed but sync failed - auditability compromised</rbp:error>"
      exit 1
    fi
    echo -e "${GREEN}Beads synced to git${NC}"
  else
    # Not in a git repo (or git not installed) - sync is optional
    bd sync 2>/dev/null || echo -e "${YELLOW}Note: bd sync skipped (not a git repo)${NC}"
  fi

  echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  Bead $BEAD_ID closed with verification proof     ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"

  # Output success signal for Ralph
  echo ""
  echo "<rbp:complete/>"

  exit 0
else
  echo -e "${RED}Verification FAILED${NC}"
  echo -e "${RED}Bead NOT closed - fix failing tests first${NC}\n"

  echo -e "Summary:"
  echo -e "$PROOF_SUMMARY"

  echo -e "\n${RED}╔═══════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  CLOSURE BLOCKED - Tests must pass                   ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════╝${NC}"

  # Output error signal for Ralph
  echo ""
  echo "<rbp:error>Tests failed - bead closure blocked</rbp:error>"

  exit 1
fi
