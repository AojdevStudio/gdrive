---
allowed-tools: Read, Write, Bash
description: Convert project rules to executable hooks using modern patterns
---

# Rule to Hook

This command converts natural language project rules into Claude Code hook configurations, leveraging modern uv scripting patterns for sophisticated implementations.

**variables:**
RuleText: $ARGUMENTS

**Usage Examples:**

- `/rule2hook` - Convert all rules from CLAUDE.md files
- `/rule2hook PreToolUse "validate bash commands for security"` - Create specific PreToolUse hook
- `/rule2hook PostToolUse "format code after file changes"` - Create PostToolUse hook

```yaml
# Defines the workflow for generating Claude CLI hook configurations.
hook_configuration_workflow:
  description: 'A process to automatically generate hook configurations based on project rules or direct arguments.'

  # The primary execution logic for the workflow.
  execution_flow:
    # Defines the two main conditional paths for the script.
    conditional_paths:
      - condition: 'Arguments are provided to the script.'
        steps:
          - 'Use the provided $ARGUMENTS to get the hook_event and rule_text.'
      - condition: 'No arguments are provided.'
        steps:
          - "Read and analyze the project's CLAUDE.md files for rules."

    # The core generation and finalization steps.
    generation_steps:
      - 'Determine appropriate hook events and tool matchers based on rule keywords.'
      - 'Generate hook configurations using `jq` for simple cases.'
      - 'Generate hook configurations using `uv` scripts for complex logic.'
      - 'Create a complete JSON configuration.'
      - 'Save the final configuration to the specified output file.'

    # The final output of the workflow.
    output:
      target_file: '~/.claude/hooks.json'
      summary: 'Provide an implementation summary with usage examples.'

  # Reference materials and definitions for the workflow.
  context_references:
    # Source files for rules and existing configurations.
    configuration_sources:
      - name: 'Current Hooks Configuration'
        source_command: '!`cat ~/.claude/hooks.json 2>/dev/null || echo "{}"`'
      - name: 'Project Rules'
        source_file: '@CLAUDE.md'
      - name: 'Local Project Rules'
        source_file: '@CLAUDE.local.md'
      - name: 'User Rules'
        source_file: '@~/.claude/CLAUDE.md'

    # Documentation for tools and concepts used in the workflow.
    documentation:
      - topic: 'Hook System'
        source_file: '@ai_docs/claude-code-hooks-documentation.yaml'
      - topic: 'uv Scripting'
        source_file: '@ai_docs/astral-uv-scripting-documentation.yaml'

    # Core definitions for hooks and matchers.
    definitions:
      hook_events:
        - name: 'PreToolUse'
          description: 'Runs before a tool is used and can block its execution.'
        - name: 'PostToolUse'
          description: 'Runs after a tool has been used.'
        - name: 'Stop'
          description: 'Runs at the end of the session.'
        - name: 'Notification'
          description: 'Used for sending alerts.'
      common_matchers:
        - 'Bash'
        - 'Write|Edit|MultiEdit'
        - 'Read'
        - 'WebFetch|WebSearch'
        - '.*' # Wildcard matcher
      exit_codes:
        - code: 0
          action: 'Continue execution.'
        - code: 2
          action: 'Block tool execution.'
        - code: 'other'
          action: 'Log an error and continue.'
```
