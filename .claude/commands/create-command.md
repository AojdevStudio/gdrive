---
allowed-tools: Read, Write, Glob, Grep
description: Create new custom Claude commands following project conventions
---

# Create Command

This command helps create new custom Claude commands or edit existing commands by understanding requirements, determining patterns, and generating well-structured command files following our template conventions.

**variables:**
CommandRequest: $ARGUMENTS

**Usage Examples:**

- `/create-command` - Interactive command creation wizard
- `/create-command "search" for finding code patterns` - Create a search command
- `/create-command "validate-api" project analysis` - Create project-specific validator
- `/create-command "format" user utility` - Create personal utility command

```yaml
# A protocol for a command that creates other custom commands, either interactively or via arguments.
create_command_protocol:
  # The sequence of actions the command should perform upon execution.
  execution_flow:
    - Read: '@ai-docs/custom-command-template.yaml'
    - 'Parse `$ARGUMENTS` to extract the command name, type (project/user), and category.'
    - "If no arguments are provided, initiate an interactive mode that prompts the user for the command's details (name, type, category, description, etc.)."
    - 'Study existing commands in the target directory (`.claude/commands/` or `~/.claude/commands/`) to understand local patterns and conventions.'
    - "Generate the new command's content by following the standard 6-part template structure."
    - 'Save the generated command file to the appropriate location based on the specified type (project or user).'
    - 'Provide the user with usage examples for the new command and suggest next steps, such as testing or sharing.'

  # Defines the context, references, and definitions required for the command's operation.
  operational_context:
    reference_documents:
      - '@ai-docs/custom-command-template.yaml'
      - '@ai-docs/command-creation-guide.yaml'
    data_sources:
      - name: 'Project Commands'
        command: 'ls -la .claude/commands/ 2>/dev/null || echo "No project commands yet"'
      - name: 'User Commands'
        command: 'ls -la ~/.claude/commands/ 2>/dev/null || echo "No user commands yet"'
    definitions:
      command_categories:
        - 'planning (for multi-stage workflows)'
        - 'implementation (for action-focused tasks)'
        - 'analysis (for review and auditing)'
        - 'workflow (for orchestrating multiple steps)'
        - 'utility (for simple tools and helpers)'
      naming_conventions:
        - 'Use lowercase-hyphenated names (e.g., `analyze-code`).'
        - 'Use descriptive verbs (e.g., `generate`, `validate`).'
        - 'Use an optional numeric prefix for commands in an ordered workflow (e.g., `01-plan`).'
      key_patterns:
        - 'Use `$ARGUMENTS` to capture user input from the command line.'
```
