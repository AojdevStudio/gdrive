---
allowed-tools: Bash, Read, Write
description: Create well-formatted commits with conventional messages and emoji
---

# Commit

This command creates well-formatted Git commits using conventional commit messages with emoji, automated quality checks, and intelligent change analysis.

**variables:**
CommitOptions: $ARGUMENTS

**Usage Examples:**

- `/commit` - Full commit workflow with pre-commit checks
- `/commit --no-verify` - Skip pre-commit checks and commit directly
- `/commit "fix: resolve authentication bug"` - Commit with specific message

```yaml
# A protocol for an intelligent git commit command that handles pre-commit checks,
# atomic commit suggestions, and conventional commit message generation.
intelligent_commit_protocol:
  # The primary sequence of actions the command should execute.
  process_flow:
    - 'Check if the `--no-verify` flag is present in `$ARGUMENTS`.'
    - 'If `--no-verify` is not present, run all pre-commit checks (e.g., `pnpm lint`, `pnpm build`, `pnpm generate:docs`).'
    - 'Validate the `.gitignore` configuration by checking for tracked files that should be ignored and ensuring common patterns are present.'
    - 'Alert the user if any large files (>1MB) are being tracked that should potentially be ignored.'
    - 'Check the `git status`. If no files are staged, automatically stage all modified and new files using `git add .`, excluding common ignore patterns.'
    - 'Perform a `git diff --staged` to analyze the changes being committed.'
    - 'Analyze the diff to determine if multiple distinct logical changes are present. Use the commit splitting guidelines.'
    - 'If multiple logical changes are detected, suggest splitting them into separate atomic commits.'
    - 'For multiple commits, use sub-agents in parallel to handle the generation and execution of each commit simultaneously.'
    - 'For each commit, determine the appropriate conventional commit type and emoji based on the changes.'
    - 'Create a conventional commit message using the format: `<emoji> <type>: <description>`.'
    - 'Execute the `git commit` with the generated message.'
    - 'Display a summary of the commit using `git log --oneline -1`.'

  # Guidelines for determining when to split changes into multiple commits.
  commit_splitting_guidelines:
    - criteria: 'Different Concerns'
      description: 'Changes affect unrelated parts of the codebase (e.g., authentication logic and UI styling).'
    - criteria: 'Different Types of Changes'
      description: 'Mixing new features, bug fixes, and refactoring in a single commit.'
    - criteria: 'File Patterns'
      description: 'Changes affect different types of files (e.g., source code vs. documentation vs. configuration).'
    - criteria: 'Logical Grouping'
      description: 'Changes that would be easier to understand, review, or revert if they were separate.'
    - criteria: 'Size'
      description: 'Very large changes that are difficult to review and would be clearer if broken down into smaller, logical parts.'

  # Defines the context, data sources, and key definitions for the command's operation.
  operational_context:
    data_sources:
      - name: 'Current Git Status'
        command: '!`git status --porcelain`'
      - name: 'Staged Changes'
        command: '!`git diff --staged --name-status`'
      - name: 'Recent Commits'
        command: '!`git log --oneline -5`'
      - name: 'Current Branch'
        command: '!`git branch --show-current`'
    staging_exclusions:
      - 'cache files'
      - '.DS_Store'
      - 'node_modules'
      - '.env files'
      - 'build artifacts'
      - 'temporary files'
    files_to_ignore:
      log_files:
        - 'logs/'
        - '*.log'
        - 'npm-debug.log*'
      dependencies:
        - 'node_modules/'
        - '.pnp'
        - '.pnp.js'
      environment_files:
        - '.env'
        - '.env.local'
        - '.env.*.local'
      build_outputs:
        - 'dist/'
        - 'build/'
        - 'dist-manifest.json'
      lock_files:
        - 'package-lock.json'
        - 'yarn.lock'
        - 'pnpm-lock.yaml'
      ide_editor_configs:
        - '.vscode/'
        - '.idea/'
        - '*.swp'
        - '*.swo'
      os_files:
        - '.DS_Store'
        - 'Thumbs.db'
      cache_files:
        - '.cache/'
        - '.linear-cache/'
        - '*.tmp'
        - '*.temp'
    emoji_reference:
      source: "Read from '@ai-docs/emoji-commit-ref.yaml'"

  # Provides examples of good commit messages and how to split changes.
  examples:
    good_commit_messages:
      - '✨ feat: add user authentication system'
      - '🐛 fix: resolve memory leak in rendering process'
      - '📝 docs: update API documentation with new endpoints'
      - '♻️ refactor: simplify error handling logic in parser'
      - '🚨 fix: resolve linter warnings in component files'
      - '🚑️ fix: patch critical security vulnerability in auth flow'
      - '🎨 style: reorganize component structure for better readability'
      - '🦺 feat: add input validation for user registration form'
      - '💚 fix: resolve failing CI pipeline tests'
      - '📈 feat: implement analytics tracking for user engagement'
      - '🔒️ fix: strengthen authentication password requirements'
      - '♿️ feat: improve form accessibility for screen readers'
    commit_splitting_example:
      description: 'A single set of file changes can be broken down into multiple atomic commits.'
      commits:
        - '✨ feat: add new solc version type definitions'
        - '📝 docs: update documentation for new solc versions'
        - '🔧 chore: update package.json dependencies'
        - '🏷️ feat: add type definitions for new API endpoints'
        - '🧵 feat: improve concurrency handling in worker threads'
        - '🚨 fix: resolve linting issues in new code'
        - '✅ test: add unit tests for new solc version features'
        - '🔒️ fix: update dependencies with security vulnerabilities'
```
