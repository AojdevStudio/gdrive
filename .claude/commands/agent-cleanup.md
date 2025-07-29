---
allowed-tools: Bash, Read, Glob
description: Generate cleanup script for completed parallel agent workflows
---

# Agent Cleanup

Analyze completed parallel agent workflows for task $ARGUMENTS and generate a safe cleanup script. Check git worktrees, merged branches, and coordination files, then create a script to remove integrated worktrees and obsolete files with built-in safety checks.
