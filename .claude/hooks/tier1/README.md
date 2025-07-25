# Tier 1 - Critical Hooks

This directory contains critical security and validation hooks that are essential for project integrity.

## Hooks in this tier:

- **notification.py**: Sends notifications for various events
- **stop.py**: Handles stop events
- **subagent_stop.py**: Handles subagent stop events
- **pre_tool_use.py**: Runs before tool usage
- **post_tool_use.py**: Runs after tool usage

## Characteristics:

- Security-focused
- Validation and enforcement
- Required for all projects
- Cannot be disabled without explicit override

## Usage:

These hooks are automatically included in all project setups unless explicitly excluded.
