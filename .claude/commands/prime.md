---
allowed-tools: Bash, Read
description: Load essential project context by analyzing codebase structure and core docs
---

# Prime

This command provides a lean, focused overview of the project by examining the codebase structure and core documentation for efficient context loading.

**Usage Examples:**

- `/prime` - Load project context and provide overview

```yaml
# Task definition for analyzing a software project codebase
task_definition:
  # Specific steps to be executed for the analysis
  instructions:
    - description: 'Run `git ls-files` to understand the codebase structure and file organization.'
      command: 'git ls-files'
    - description: 'Read the README.md to understand the project purpose, setup instructions, and key information.'
      file: 'README.md'
    - description: 'Read the CHANGELOG.md to understand recent changes and version history.'
      file: 'CHANGELOG.md'
    - description: 'Provide a concise overview of the project structure and purpose.'
      outcome: 'Concise overview document'

  # The primary focus of the analysis report
  analysis_focus:
    - 'Focus on what the codebase contains rather than how to work with it (CLAUDE.md handles that).'

  # Input sources providing context for the analysis task
  context_sources:
    - type: 'Codebase Structure'
      source_command: '!`git ls-files`'
    - type: 'Project Overview'
      source_file: '@README.md'
    - type: 'Recent Changes'
      source_file: '@CHANGELOG.md'

  # Important notes regarding the operational workflow
  workflow_notes:
    - 'Parallel development workflows are loaded via CLAUDE.md automatically.'
```
