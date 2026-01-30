#!/usr/bin/env bash
# sequencer.sh - Execution phase grouping for large tasks
# Usage: ./sequencer.sh <story-id> [phase-size]
#
# Groups subtasks into phases for more manageable execution.
# Each phase contains 3-5 subtasks that can be executed together.
# This prevents context overflow on large stories while maintaining coherence.

set -e

STORY_ID="${1:-}"
PHASE_SIZE="${2:-5}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ -z "$STORY_ID" ]; then
  echo -e "${RED}ERROR: Story ID required${NC}"
  echo "Usage: ./sequencer.sh <story-id> [phase-size]"
  echo ""
  echo "Arguments:"
  echo "  story-id    The parent bead ID for the story"
  echo "  phase-size  Number of subtasks per phase (default: 5)"
  exit 1
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  RBP Execution Sequencer${NC}"
echo -e "${CYAN}  Story: $STORY_ID${NC}"
echo -e "${CYAN}  Phase Size: $PHASE_SIZE subtasks${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"

# Get all subtasks for this story
echo -e "${YELLOW}Fetching subtasks for story...${NC}"
SUBTASKS=$(bd children "$STORY_ID" 2>/dev/null || echo "")

if [ -z "$SUBTASKS" ]; then
  echo -e "${RED}No subtasks found for story $STORY_ID${NC}"
  exit 1
fi

# Count subtasks
TOTAL_SUBTASKS=$(echo "$SUBTASKS" | wc -l | tr -d ' ')
echo -e "Found ${GREEN}$TOTAL_SUBTASKS${NC} subtasks\n"

# Calculate number of phases
TOTAL_PHASES=$(( (TOTAL_SUBTASKS + PHASE_SIZE - 1) / PHASE_SIZE ))
echo -e "Organizing into ${GREEN}$TOTAL_PHASES${NC} phases\n"

# Group subtasks into phases
CURRENT_PHASE=1
SUBTASK_COUNT=0

echo -e "${CYAN}Phase Organization:${NC}\n"

echo "$SUBTASKS" | while IFS= read -r subtask; do
  if [ $SUBTASK_COUNT -eq 0 ]; then
    echo -e "${GREEN}Phase $CURRENT_PHASE:${NC}"
  fi

  echo "  - $subtask"
  SUBTASK_COUNT=$((SUBTASK_COUNT + 1))

  if [ $SUBTASK_COUNT -ge $PHASE_SIZE ]; then
    echo ""
    CURRENT_PHASE=$((CURRENT_PHASE + 1))
    SUBTASK_COUNT=0
  fi
done

echo ""

# Get ready subtasks
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Ready subtasks (in execution order):${NC}\n"

READY_SUBTASKS=$(bd children "$STORY_ID" --ready 2>/dev/null || bd ready 2>/dev/null | grep "$STORY_ID" || echo "")

if [ -z "$READY_SUBTASKS" ]; then
  echo -e "${GREEN}No subtasks ready - all may be complete or blocked${NC}"
else
  # Show first phase of ready subtasks
  PHASE_READY=$(echo "$READY_SUBTASKS" | head -n "$PHASE_SIZE")
  echo "$PHASE_READY"

  READY_COUNT=$(echo "$READY_SUBTASKS" | wc -l | tr -d ' ')
  SHOWN_COUNT=$(echo "$PHASE_READY" | wc -l | tr -d ' ')

  if [ "$READY_COUNT" -gt "$SHOWN_COUNT" ]; then
    REMAINING=$((READY_COUNT - SHOWN_COUNT))
    echo -e "\n${YELLOW}... and $REMAINING more in subsequent phases${NC}"
  fi
fi

echo -e "\n${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Recommendation:${NC}"
echo -e "Execute one phase at a time. After completing phase 1,"
echo -e "run 'bd ready' to see the next batch of available tasks."
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
