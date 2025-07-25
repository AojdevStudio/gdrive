# Custom Command Template

This template provides the standard structure for creating custom Claude Code slash commands.

## Required Structure

### 1. YAML Frontmatter

```yaml
---
allowed-tools: Tool1, Tool2, Tool3
description: Brief one-line description of what the command does
---
```

### 2. Main Heading

```markdown
# Command Name
```

### 3. Brief Description

Single sentence explaining the command's purpose and benefit.

### 4. Arguments Section (if needed)

```markdown
**variables:**
[VariableName]: $ARGUMENTS

**Usage Examples:**

- `/command` - Default behavior
- `/command value1` - With argument
```

### 5. YAML Configuration Section

````yaml
```yaml
command_configuration:
  instructions:
    - step: 1
      action: "What to do first"
      details: "Specific implementation details"

  context:
    current_state:
      - name: "State Check Name"
        command: "!`command to check current state`"
        description: "What this state check reveals"
    input_files:
      - "@file1.md"
    reference_docs:
      - "@path/to/documentation.md"
````

```

## Key Requirements

- Keep descriptions under 80 characters
- Use action verbs (analyze, convert, generate)
- Use `!`command`` for shell commands
- Use `@filename` for file references
- Include validation and error handling
- Structure data hierarchically in YAML

## Best Practices

- Self-contained commands that work independently
- Consistent markdown + YAML structure
- Clear, actionable instructions
- Comprehensive context information
- Proper error handling
```
