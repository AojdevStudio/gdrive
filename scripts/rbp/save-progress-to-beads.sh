#!/usr/bin/env bash
# save-progress-to-beads.sh - PreCompact hook helper
# Saves current progress state to beads before context compaction
#
# This script runs automatically via Claude Code's PreCompact hook
# to preserve progress information before the context window is compacted.

# Check if beads is available
if ! command -v bd &>/dev/null; then
  exit 0
fi

# Check if we're in an RBP-enabled project
if [ ! -d ".beads" ]; then
  exit 0
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
PROGRESS_FILE="scripts/rbp/progress.txt"

# Ensure progress file exists
if [ ! -f "$PROGRESS_FILE" ]; then
  mkdir -p "$(dirname "$PROGRESS_FILE")"
  echo "# RBP Progress Log" > "$PROGRESS_FILE"
  echo "Created: $TIMESTAMP" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# Log the compaction event
echo "[$TIMESTAMP] Context compaction - progress checkpoint" >> "$PROGRESS_FILE"

# Get current status
OPEN_COUNT=$(bd list --open 2>/dev/null | wc -l | tr -d ' ' || echo "?")
TOTAL_COUNT=$(bd list 2>/dev/null | wc -l | tr -d ' ' || echo "?")
CURRENT_TASK=$(bd ready 2>/dev/null | head -1 || echo "None")

# Log status
echo "  Open tasks: $OPEN_COUNT" >> "$PROGRESS_FILE"
echo "  Total tasks: $TOTAL_COUNT" >> "$PROGRESS_FILE"
echo "  Current task: $CURRENT_TASK" >> "$PROGRESS_FILE"
echo "" >> "$PROGRESS_FILE"

# Output for Claude Code to include in compaction summary
echo ""
echo "RBP Progress Saved:"
echo "  Tasks: $((TOTAL_COUNT - OPEN_COUNT))/$TOTAL_COUNT complete"
echo "  Current: $CURRENT_TASK"
echo ""
