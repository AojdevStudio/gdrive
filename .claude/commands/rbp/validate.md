---
allowed-tools: Bash, Read
description: Validate RBP Stack installation and configuration
---

# /rbp:validate

Verify the RBP Stack is properly installed with all prerequisites, scripts, and configuration.

## Variables

SCRIPTS_DIR: scripts/rbp
VALIDATOR: scripts/rbp/validate.sh
CONFIG_FILE: rbp-config.yaml

## Workflow

1. Check if `VALIDATOR` exists:
   - If yes, run `./`VALIDATOR`` to perform full validation
   - If no, perform manual checks (steps 2-5)
2. Check prerequisites with `command -v`:
   - `bd` (beads CLI)
   - `bun` (JavaScript runtime)
   - `claude` (Claude Code CLI)
3. Check directory structure:
   - `SCRIPTS_DIR` exists
   - `.claude/commands/rbp/` exists
   - `.beads/` exists
4. Check configuration:
   - `CONFIG_FILE` exists
   - Read `CONFIG_FILE` to verify structure
5. Report validation results with pass/fail for each check

## Report

RBP Validation Complete

Prerequisites:
- [✓/✗] bd (beads)
- [✓/✗] bun
- [✓/✗] claude CLI

Structure:
- [✓/✗] `SCRIPTS_DIR`
- [✓/✗] .claude/commands/rbp/
- [✓/✗] .beads/

Configuration:
- [✓/✗] `CONFIG_FILE`

Status: READY / ISSUES FOUND

If issues found, recommend:
- Missing tool: Install instructions
- Missing directory: Re-run installer
- Missing config: Copy from template
