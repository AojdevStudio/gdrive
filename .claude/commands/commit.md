---
allowed-tools: Bash, Read, Write
description: Create well-formatted commits with conventional messages and emoji
---

# Commit

Use the git-flow-manager sub-agent to create well-formatted Git commits with conventional messages and emoji. Parse $ARGUMENTS for commit options and --no-verify flag, run pre-commit checks (lint, build, tests) unless skipped, validate .gitignore configuration, auto-stage modified files if none staged, analyze changes for atomic commit splitting, generate conventional commit messages with appropriate emoji from ai-docs/emoji-commit-ref.yaml, execute commits, and display summary.

**🤖 Sub-Agent Integration:** This command leverages the specialized `git-flow-manager` sub-agent for optimal git workflow management. The sub-agent will be automatically invoked to handle complex git operations, commit message generation, and repository state management.

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
    - 'Use the git-flow-manager sub-agent to handle comprehensive git workflow management including argument parsing, pre-commit validation, staging analysis, commit generation, and execution.'
    - 'The git-flow-manager will check if the `--no-verify` flag is present in `$ARGUMENTS`.'
    - 'If `--no-verify` is not present, the sub-agent will run all pre-commit checks (e.g., `pnpm lint`, `pnpm build`, `pnpm generate:docs`).'
    - 'The sub-agent will validate the `.gitignore` configuration by checking for tracked files that should be ignored and ensuring common patterns are present.'
    - 'Alert the user if any large files (>1MB) are being tracked that should potentially be ignored.'
    - 'Check the `git status`. If no files are staged, automatically stage all modified and new files using `git add .`, excluding common ignore patterns.'
    - 'Perform a `git diff --staged` to analyze the changes being committed.'
    - 'Analyze the diff to determine if multiple distinct logical changes are present. Use the commit splitting guidelines.'
    - 'If multiple logical changes are detected, suggest splitting them into separate atomic commits.'
    - 'For multiple commits, coordinate with additional git-flow-manager instances in parallel to handle the generation and execution of each commit simultaneously.'
    - 'For each commit, determine the appropriate conventional commit type and emoji based on the changes.'
    - 'Create a conventional commit message using the format: `<emoji> <type>: <description>`.'
    - 'Include issue references in the commit body when applicable (e.g., Closes #123, Fixes ENG-456) for GitHub/Linear integration.'
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

  # Guidelines for linking issues in commit messages for GitHub and Linear integration
  issue_linking_guidelines:
    overview:
      - 'Link issues to automatically close them when PRs merge or to reference related work'
      - 'GitHub and Linear both support automatic issue closing through commit messages'
      - 'Place issue references in the commit body, not the subject line'
    
    closing_keywords:
      description: 'These keywords will automatically close the referenced issue when the PR is merged'
      keywords:
        - 'close / closes / closed'
        - 'fix / fixes / fixed'
        - 'resolve / resolves / resolved'
        - 'complete / completes / completed'
        - 'closing / fixing / resolving / completing'
      examples:
        - 'Closes #42'
        - 'Fixes ENG-123'
        - 'Resolves #100, #101'
        - 'Fixes ENG-456, ENG-457'
    
    referencing_keywords:
      description: 'These keywords link to issues without closing them'
      keywords:
        - 'ref / references'
        - 'part of'
        - 'related to'
        - 'contributes to'
        - 'towards'
      examples:
        - 'Part of #200'
        - 'Related to ENG-789'
        - 'Contributes to #300'
    
    format_patterns:
      github_issues:
        - pattern: '#<issue-number>'
          example: 'Closes #42'
          description: 'References issue in current repository'
        - pattern: '<org>/<repo>#<issue-number>'
          example: 'Fixes octocat/Hello-World#123'
          description: 'References issue in another repository'
      
      linear_issues:
        - pattern: '<team-key>-<issue-number>'
          example: 'Fixes ENG-123'
          description: 'Team key format (e.g., ENG, CDE, PROJ)'
        - pattern: 'Multiple issues'
          example: 'Fixes ENG-123, ENG-124, ENG-125'
          description: 'Comma-separated for multiple issues'
    
    best_practices:
      - 'Verify issue numbers before committing to avoid incorrect linking'
      - 'Use closing keywords only when the commit fully resolves the issue'
      - 'Use referencing keywords for partial implementations or related work'
      - 'For Linear: ensure your team key matches your Linear workspace'
      - 'Test the integration by checking if issues are properly linked after pushing'

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
    
    commit_messages_with_issue_links:
      - |
        ✨ feat: implement JWT authentication system
        
        Added secure token generation with refresh token support.
        Includes rate limiting and password strength validation.
        
        Closes #123
        Fixes ENG-456
      - |
        🐛 fix: resolve race condition in data fetching
        
        Prevents duplicate API calls during rapid navigation.
        
        Fixes #89
      - |
        ♻️ refactor: optimize database query performance
        
        Reduced query time by 60% through proper indexing.
        
        Part of #200
        Related to ENG-789
      - |
        📝 docs: add GitHub/Linear issue linking guide
        
        Documents magic words and formatting for auto-closing issues.
        
        Closes #5
        Fixes CDE-2
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