---
allowed-tools: Bash, Edit, Glob, LS, Read, Write
description: Validates and enforcts clean root directory structure with automatic file organization
---

# Enforce Structure

This command is used to enforce the structure of the root directory.

##Instructions

- Use the structure-enforcer sub-agent to validate and enforce clean root directory structure with automatic file organization. 
- Parse $ARGUMENTS for operation mode (default: fix, --dry-run: preview, --report: detailed), deploy parallel scanning for misplaced files using coordinated root_scanner and deep_scanner agents, move files to appropriate directories (config/, scripts/, docs/, archive/) based on patterns, clean up temporary files and cache, and validate final state compliance with structure rules.

##Context
- Codebase structure all: !`eza . --tree`
- Documentation:
    - @ai-docs/structure-enforcement-system.md
