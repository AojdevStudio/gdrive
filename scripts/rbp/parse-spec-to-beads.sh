#!/usr/bin/env bash
# parse-spec-to-beads.sh - Convert quick-plan spec to Beads
# Usage: ./scripts/rbp/parse-spec-to-beads.sh <spec-file.md>
#
# Parses a quick-plan specification markdown file and creates corresponding beads:
# 1. Parent bead for the spec itself
# 2. Child beads for each implementation task
# 3. Sets up dependencies between tasks
# 4. Auto-detects UI tasks and sets requires-playwright flag

set -e

SPEC_FILE="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# UI detection keywords
UI_KEYWORDS="\[UI\]|component|visual|browser|render|display|click|button|form|modal|sidebar|header|page|screen|responsive|mobile|desktop|layout|style|CSS|frontend|playwright"

if [ -z "$SPEC_FILE" ]; then
  echo -e "${RED}ERROR: Spec file required${NC}"
  echo "Usage: ./parse-spec-to-beads.sh <spec-file.md>"
  exit 1
fi

if [ ! -f "$SPEC_FILE" ]; then
  echo -e "${RED}ERROR: File not found: $SPEC_FILE${NC}"
  exit 1
fi

# Check if spec is RBP compatible
if ! grep -q "RBP Compatible: Yes" "$SPEC_FILE" 2>/dev/null; then
  echo -e "${YELLOW}WARNING: Spec may not be RBP compatible (missing 'RBP Compatible: Yes' header)${NC}"
  echo -e "Continuing anyway..."
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  RBP Spec to Beads Converter${NC}"
echo -e "${CYAN}  File: $SPEC_FILE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"

# Extract spec title (first H1)
SPEC_TITLE=$(grep -m1 "^# " "$SPEC_FILE" | sed 's/^# //' | sed 's/ Specification$//' || echo "Untitled Spec")
echo -e "${GREEN}Spec Title:${NC} $SPEC_TITLE"

# Generate spec ID from filename
SPEC_ID=$(basename "$SPEC_FILE" .md | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
echo -e "${GREEN}Spec ID:${NC} $SPEC_ID"

# Extract test command from spec
TEST_COMMAND=$(grep -A1 "### Test Command" "$SPEC_FILE" | grep '`' | tr -d '`' | head -1 || echo "bun test")
echo -e "${GREEN}Test Command:${NC} $TEST_COMMAND"

echo ""

# Create parent bead for the spec
echo -e "${YELLOW}Creating parent bead for spec...${NC}"

# Extract problem statement as description
DESCRIPTION=$(sed -n '/## Problem Statement/,/^## /p' "$SPEC_FILE" | grep -v "^##" | head -10 | tr '\n' ' ' | sed 's/  */ /g' | head -c 500)

PARENT_BEAD=$(bd create "$SPEC_TITLE" -l "spec" -l "rbp" --notes "$DESCRIPTION" --silent 2>/dev/null || echo "")

if [ -z "$PARENT_BEAD" ]; then
  echo -e "${RED}Failed to create parent bead${NC}"
  PARENT_BEAD=$(bd create "$SPEC_TITLE" -l "spec" --silent 2>/dev/null || echo "$SPEC_ID")
fi

echo -e "${GREEN}Parent Bead:${NC} $PARENT_BEAD"
echo ""

# Extract tasks from between RBP-TASKS markers
echo -e "${YELLOW}Parsing implementation tasks...${NC}"

# Extract the tasks section
TASKS_SECTION=$(sed -n '/<!-- RBP-TASKS-START -->/,/<!-- RBP-TASKS-END -->/p' "$SPEC_FILE" 2>/dev/null)

if [ -z "$TASKS_SECTION" ]; then
  # Fallback: look for ## Implementation Tasks section
  TASKS_SECTION=$(sed -n '/## Implementation Tasks/,/^## /p' "$SPEC_FILE" 2>/dev/null)
fi

if [ -z "$TASKS_SECTION" ]; then
  echo -e "${RED}ERROR: No implementation tasks found in spec${NC}"
  echo -e "Make sure the spec has an 'Implementation Tasks' section with the RBP format:"
  echo -e "  <!-- RBP-TASKS-START -->"
  echo -e "  ### Task 1: Title"
  echo -e "  - **ID:** task-001"
  echo -e "  - **Dependencies:** none"
  echo -e "  ..."
  echo -e "  <!-- RBP-TASKS-END -->"
  exit 1
fi

# Declare associative array for task ID to bead ID mapping
declare -A TASK_TO_BEAD

# Parse each task block
TASK_COUNT=0
CURRENT_TASK=""
CURRENT_ID=""
CURRENT_DEPS=""
CURRENT_FILES=""
CURRENT_ACCEPTANCE=""
CURRENT_TESTS=""

process_task() {
  if [ -z "$CURRENT_TASK" ] || [ -z "$CURRENT_ID" ]; then
    return
  fi

  TASK_COUNT=$((TASK_COUNT + 1))
  echo -e "\n  ${CYAN}Task $TASK_COUNT:${NC} $CURRENT_TASK"
  echo -e "    ID: $CURRENT_ID"
  echo -e "    Dependencies: $CURRENT_DEPS"

  # Detect if UI task
  IS_UI="false"
  if echo "$CURRENT_TASK $CURRENT_FILES $CURRENT_TESTS" | grep -qiE "$UI_KEYWORDS"; then
    IS_UI="true"
    echo -e "    ${YELLOW}UI Task: Yes (Playwright required)${NC}"
  fi

  # Build note with metadata
  NOTE="Files: $CURRENT_FILES | Acceptance: $CURRENT_ACCEPTANCE | Tests: $CURRENT_TESTS"

  # Determine parent bead
  TASK_PARENT="$PARENT_BEAD"
  if [ "$CURRENT_DEPS" != "none" ] && [ -n "$CURRENT_DEPS" ]; then
    # Get the bead ID for the dependency
    DEP_BEAD="${TASK_TO_BEAD[$CURRENT_DEPS]}"
    if [ -n "$DEP_BEAD" ]; then
      TASK_PARENT="$DEP_BEAD"
      echo -e "    Parent: $DEP_BEAD (from dependency)"
    fi
  fi

  # Create the bead
  if [ "$IS_UI" = "true" ]; then
    BEAD_ID=$(bd create "$CURRENT_TASK" --parent "$TASK_PARENT" -l "task" -l "ui" -l "requires-playwright" --notes "$NOTE" --silent 2>/dev/null || \
              bd create "$CURRENT_TASK" --parent "$TASK_PARENT" --silent 2>/dev/null || echo "")
  else
    BEAD_ID=$(bd create "$CURRENT_TASK" --parent "$TASK_PARENT" -l "task" --notes "$NOTE" --silent 2>/dev/null || \
              bd create "$CURRENT_TASK" --parent "$TASK_PARENT" --silent 2>/dev/null || echo "")
  fi

  if [ -n "$BEAD_ID" ]; then
    TASK_TO_BEAD[$CURRENT_ID]="$BEAD_ID"
    echo -e "    ${GREEN}Created:${NC} $BEAD_ID"
  else
    echo -e "    ${RED}Failed to create bead${NC}"
  fi

  # Reset for next task
  CURRENT_TASK=""
  CURRENT_ID=""
  CURRENT_DEPS=""
  CURRENT_FILES=""
  CURRENT_ACCEPTANCE=""
  CURRENT_TESTS=""
}

# Parse tasks line by line
while IFS= read -r line; do
  # Check for task header
  if echo "$line" | grep -qE "^### Task [0-9]+:"; then
    # Process previous task if exists
    process_task

    # Extract new task title
    CURRENT_TASK=$(echo "$line" | sed 's/^### Task [0-9]*: //')
  fi

  # Parse task attributes
  if echo "$line" | grep -qE "^\s*-\s*\*\*ID:\*\*"; then
    CURRENT_ID=$(echo "$line" | sed 's/.*\*\*ID:\*\*\s*//' | tr -d ' ')
  fi

  if echo "$line" | grep -qE "^\s*-\s*\*\*Dependencies:\*\*"; then
    CURRENT_DEPS=$(echo "$line" | sed 's/.*\*\*Dependencies:\*\*\s*//' | tr -d ' ')
  fi

  if echo "$line" | grep -qE "^\s*-\s*\*\*Files:\*\*"; then
    CURRENT_FILES=$(echo "$line" | sed 's/.*\*\*Files:\*\*\s*//')
  fi

  if echo "$line" | grep -qE "^\s*-\s*\*\*Acceptance:\*\*"; then
    CURRENT_ACCEPTANCE=$(echo "$line" | sed 's/.*\*\*Acceptance:\*\*\s*//')
  fi

  if echo "$line" | grep -qE "^\s*-\s*\*\*Tests:\*\*"; then
    CURRENT_TESTS=$(echo "$line" | sed 's/.*\*\*Tests:\*\*\s*//')
  fi

done <<< "$TASKS_SECTION"

# Process the last task
process_task

# Save test command to a config file for ralph-execute.sh to use
CONFIG_DIR="$(dirname "$SPEC_FILE")/../.rbp"
mkdir -p "$CONFIG_DIR" 2>/dev/null || true
echo "$TEST_COMMAND" > "$CONFIG_DIR/test-command" 2>/dev/null || true
echo "$PARENT_BEAD" > "$CONFIG_DIR/current-spec-bead" 2>/dev/null || true

# Sync beads to git (flush changes immediately)
echo ""
echo -e "${YELLOW}Syncing beads to git...${NC}"
bd sync 2>/dev/null && echo -e "${GREEN}Beads synced${NC}" || echo -e "${YELLOW}Note: bd sync skipped (may need git repo)${NC}"

# Summary
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Conversion Complete${NC}"
echo -e "  Spec Bead: $PARENT_BEAD"
echo -e "  Tasks Created: $TASK_COUNT"
echo -e "  Test Command: $TEST_COMMAND"
echo ""
echo -e "View structure: ${CYAN}bd tree $PARENT_BEAD${NC}"
echo -e "View ready tasks: ${CYAN}bd ready${NC}"
echo -e "Start execution: ${CYAN}./ralph-execute.sh${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
