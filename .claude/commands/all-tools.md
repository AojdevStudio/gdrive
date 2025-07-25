---
allowed-tools: None
description: List all available tools in TypeScript function signature format
---

# All Tools

This command displays all available tools in TypeScript function signature format with their purposes for easy reference and understanding.

**Usage Examples:**

- `/all-tools` - Display all available tools with signatures and descriptions

---

```yaml
# A protocol for generating a quick reference guide of available tool capabilities.
tool_signature_generator_protocol:
  # The sequence of actions to perform to generate the output.
  instructions:
    - 'List all tools available from the system prompt configuration.'
    - 'Format each tool as a TypeScript function signature.'
    - 'Include the purpose or a brief description of each tool as a comment or suffix.'
    - 'Use double line breaks between each tool signature for improved readability.'
    - 'Group related tools together by functionality where it makes sense.'
    - 'Ensure consistent formatting, including parameter types and return types, across all signatures.'

  # Specifications and requirements for the final output.
  output_specifications:
    tool_source: 'System prompt configuration'
    format_style: 'TypeScript function signatures'
    organization: 'Grouped by functionality when relevant'
    purpose: 'To serve as a quick reference for available system capabilities.'
    output_format: 'A bulleted list containing the formatted signatures and their descriptions.'
```
