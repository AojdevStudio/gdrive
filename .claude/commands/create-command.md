---
allowed-tools: Glob, Grep, Read, Write
description: Create new custom Claude commands following project conventions
---

# Create Command

Create new custom Claude commands that are instructional, not explanatory. Parse $ARGUMENTS for command name and details, read @ai-docs/custom-command-template.md, study existing commands in .claude/commands/ for patterns, generate new command using INSTRUCTIONAL format with action verbs and $ARGUMENTS usage, save to appropriate location (.claude/commands/ or ~/.claude/commands/), and provide usage examples.
