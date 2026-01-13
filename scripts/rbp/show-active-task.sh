#!/usr/bin/env bash
# show-active-task.sh - SessionStart hook helper
# Displays current RBP task context when a Claude Code session begins
#
# This script runs automatically via Claude Code's SessionStart hook
# to give the agent immediate context about the current task.

# Colors (may not display in all contexts)
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if beads is available
if ! command -v bd &>/dev/null; then
  exit 0  # Silently exit if beads not installed
fi

# Check if we're in an RBP-enabled project
if [ ! -d ".beads" ]; then
  exit 0  # Not an RBP project
fi

# Get ready tasks
READY_TASK=$(bd ready 2>/dev/null | head -1 || echo "")

if [ -z "$READY_TASK" ]; then
  # Check if there are any tasks at all
  TOTAL_TASKS=$(bd list 2>/dev/null | wc -l | tr -d ' ' || echo "0")
  COMPLETED_TASKS=$(bd list --closed 2>/dev/null | wc -l | tr -d ' ' || echo "0")

  if [ "$TOTAL_TASKS" = "0" ]; then
    exit 0  # No tasks, no message
  fi

  echo ""
  echo "RBP Status: All $COMPLETED_TASKS/$TOTAL_TASKS tasks complete"
  echo ""
  exit 0
fi

# Display current task context
echo ""
echo "════════════════════════════════════════════════════════"
echo "  RBP Active Task"
echo "════════════════════════════════════════════════════════"
echo ""
echo "$READY_TASK"
echo ""

# Show brief status
OPEN_COUNT=$(bd list --open 2>/dev/null | wc -l | tr -d ' ' || echo "?")
TOTAL_COUNT=$(bd list 2>/dev/null | wc -l | tr -d ' ' || echo "?")

echo "Progress: $((TOTAL_COUNT - OPEN_COUNT))/$TOTAL_COUNT tasks complete"
echo ""
echo "Commands:"
echo "  Start loop:  ./scripts/rbp/ralph.sh"
echo "  View status: bd status"
echo "════════════════════════════════════════════════════════"
echo ""
