#!/usr/bin/env bash
# parse-story-to-beads.sh - Convert BMAD story to Beads
# Usage: ./parse-story-to-beads.sh <story-file.md>
#
# Parses a BMAD story markdown file and creates corresponding beads:
# 1. Parent bead for the story itself
# 2. Child beads for each subtask/acceptance criterion
# 3. Auto-detects UI tasks and sets requires_playwright flag

set -e

STORY_FILE="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# UI detection keywords
UI_KEYWORDS="UI|component|visual|browser|render|display|click|button|form|modal|sidebar|header|page|screen|responsive|mobile|desktop|layout|style|CSS|frontend"

if [ -z "$STORY_FILE" ]; then
  echo -e "${RED}ERROR: Story file required${NC}"
  echo "Usage: ./parse-story-to-beads.sh <story-file.md>"
  exit 1
fi

if [ ! -f "$STORY_FILE" ]; then
  echo -e "${RED}ERROR: File not found: $STORY_FILE${NC}"
  exit 1
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  RBP Story to Beads Converter${NC}"
echo -e "${CYAN}  File: $STORY_FILE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"

# Extract story title (first H1)
STORY_TITLE=$(grep -m1 "^# " "$STORY_FILE" | sed 's/^# //' || echo "Untitled Story")
echo -e "${GREEN}Story Title:${NC} $STORY_TITLE"

# Extract story ID from filename if present (e.g., story-001-feature-name.md)
STORY_ID=$(basename "$STORY_FILE" .md | grep -oE '^story-[0-9]+' || echo "")
if [ -z "$STORY_ID" ]; then
  STORY_ID="story-$(date +%Y%m%d%H%M%S)"
fi
echo -e "${GREEN}Story ID:${NC} $STORY_ID"

# Detect if this is a UI story
detect_ui_story() {
  if grep -iE "$UI_KEYWORDS" "$STORY_FILE" | grep -qiE "(acceptance|criteria|AC|task|subtask)"; then
    echo "true"
  else
    echo "false"
  fi
}

IS_UI_STORY=$(detect_ui_story)
echo -e "${GREEN}UI Story:${NC} $IS_UI_STORY"

if [ "$IS_UI_STORY" = "true" ]; then
  echo -e "${YELLOW}Note: Playwright tests will be required for closure${NC}"
fi

echo ""

# Create parent bead for the story
echo -e "${YELLOW}Creating parent bead for story...${NC}"

# Extract description (content after title, before first ##)
DESCRIPTION=$(sed -n '/^# /,/^## /p' "$STORY_FILE" | grep -v "^#" | head -20 | tr '\n' ' ' | sed 's/  */ /g' | head -c 500)

PARENT_BEAD=$(bd create "$STORY_TITLE" --tag "story" --note "$DESCRIPTION" 2>/dev/null || echo "")

if [ -z "$PARENT_BEAD" ]; then
  echo -e "${RED}Failed to create parent bead${NC}"
  # Try without note
  PARENT_BEAD=$(bd create "$STORY_TITLE" --tag "story" 2>/dev/null || echo "$STORY_ID")
fi

echo -e "${GREEN}Parent Bead:${NC} $PARENT_BEAD"
echo ""

# Parse subtasks (look for task lists: - [ ] items)
echo -e "${YELLOW}Parsing subtasks...${NC}"

# Extract acceptance criteria and tasks
SUBTASKS=$(grep -E "^\s*-\s*\[[ x]\]" "$STORY_FILE" | sed 's/^\s*-\s*\[[ x]\]\s*//' || echo "")

if [ -z "$SUBTASKS" ]; then
  # Try alternative format: numbered lists or bullet points under "Tasks" or "Acceptance Criteria"
  SUBTASKS=$(sed -n '/\(Tasks\|Acceptance Criteria\|Subtasks\)/,/^##/p' "$STORY_FILE" | grep -E "^\s*[-*0-9]" | sed 's/^\s*[-*0-9.]*\s*//' || echo "")
fi

if [ -z "$SUBTASKS" ]; then
  echo -e "${YELLOW}No subtasks found in story file${NC}"
  echo -e "The story bead was created. Add subtasks manually with:"
  echo -e "  bd create \"<subtask>\" --parent $PARENT_BEAD"

  # Sync even with no subtasks - the parent bead still needs to be synced
  echo ""
  echo -e "${YELLOW}Syncing beads to git...${NC}"
  bd sync 2>/dev/null && echo -e "${GREEN}Beads synced${NC}" || echo -e "${YELLOW}Note: bd sync skipped (may need git repo)${NC}"

  exit 0
fi

SUBTASK_COUNT=0
echo "$SUBTASKS" | while IFS= read -r subtask; do
  # Skip empty lines
  [ -z "$subtask" ] && continue

  SUBTASK_COUNT=$((SUBTASK_COUNT + 1))

  # Detect if this specific subtask is UI-related
  SUBTASK_IS_UI="false"
  if echo "$subtask" | grep -qiE "$UI_KEYWORDS"; then
    SUBTASK_IS_UI="true"
  fi

  # Create child bead
  echo -e "  Creating: $subtask"

  if [ "$SUBTASK_IS_UI" = "true" ]; then
    bd create "$subtask" --parent "$PARENT_BEAD" --tag "ui" --tag "requires-playwright" 2>/dev/null || \
      bd create "$subtask" --parent "$PARENT_BEAD" 2>/dev/null || \
      echo -e "    ${RED}Failed to create bead${NC}"
  else
    bd create "$subtask" --parent "$PARENT_BEAD" 2>/dev/null || \
      echo -e "    ${RED}Failed to create bead${NC}"
  fi
done

# Sync beads to git (flush changes immediately)
echo ""
echo -e "${YELLOW}Syncing beads to git...${NC}"
bd sync 2>/dev/null && echo -e "${GREEN}Beads synced${NC}" || echo -e "${YELLOW}Note: bd sync skipped (may need git repo)${NC}"

# Summary
CREATED_COUNT=$(bd children "$PARENT_BEAD" 2>/dev/null | wc -l | tr -d ' ' || echo "0")

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Conversion Complete${NC}"
echo -e "  Story Bead: $PARENT_BEAD"
echo -e "  Subtasks Created: $CREATED_COUNT"
echo -e "  UI Story: $IS_UI_STORY"
echo ""
echo -e "View structure: ${CYAN}bd tree $PARENT_BEAD${NC}"
echo -e "Start execution: ${CYAN}./ralph.sh${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
