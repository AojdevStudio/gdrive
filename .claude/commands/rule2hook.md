---
allowed-tools: Bash, Read, Write
description: Convert project rules to executable hooks using modern patterns
---

# Rule to Hook

Convert natural language project rules into Claude Code hook configurations using modern uv scripting patterns. Read CLAUDE.md files for rules, determine appropriate hook events and tool matchers, generate JSON configurations using jq or uv scripts as needed, and save to ~/.claude/hooks.json with implementation summary. Use $ARGUMENTS to specify hook event and rule text, or process all rules if no arguments provided.
