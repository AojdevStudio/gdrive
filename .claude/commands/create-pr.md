---
allowed-tools: Read, Bash, Write, Edit, MultiEdit, Grep, TodoWrite, WebFetch
description: Create pull requests for completed work with automatic context gathering
---

# Create PR

This command creates comprehensive pull requests for completed work, automatically gathering context from git history, validating changes, and generating structured PR descriptions following project conventions.

**variables:**
Arguments: $ARGUMENTS

**Usage Examples:**

- `/create-pr` - Interactive PR creation with automatic context detection
- `/create-pr "feat: add authentication"` - Create PR with custom title
- `/create-pr --from feature/auth --to main` - Specify source and target branches
- `/create-pr --task PROJ-123` - Link to specific Linear task

```yaml
# Protocol for creating well-structured pull requests with comprehensive context
pull_request_creation_protocol:
  execution_flow:
    - step: parse_arguments
      action: 'Extract options from $ARGUMENTS (title, branches, task ID)'
      validation: 'Ensure valid branch names and proper formatting'

    - step: gather_context
      action: 'Collect comprehensive information about changes'
      details:
        - 'Run git status to check current state'
        - 'Identify current branch and target branch'
        - 'Get commit history since branch diverged'
        - 'Analyze changed files and modifications'
        - 'Extract Linear task details if task ID provided'

    - step: validate_readiness
      action: 'Ensure changes are ready for PR'
      checks:
        - 'All changes committed'
        - 'Branch up to date with target'
        - 'No merge conflicts'
        - 'Tests passing (if configured)'
        - 'Linting/formatting clean'

    - step: generate_pr_content
      action: 'Create structured PR title and description'
      format:
        title: '<type>(<scope>): <description> [<task-id>]'
        body:
          - summary: 'What changes and why'
          - changes: 'Detailed list of modifications'
          - testing: 'How to test the changes'
          - checklist: 'PR readiness checklist'
          - related: 'Related issues/PRs'

    - step: create_pull_request
      action: 'Use gh CLI to create the PR'
      command: 'gh pr create with generated content'
      options:
        - 'Add appropriate labels'
        - 'Request reviewers if specified'
        - 'Set as draft if work in progress'

    - step: post_creation
      action: 'Provide next steps and PR link'
      output:
        - 'PR URL for review'
        - 'CI/CD status link'
        - 'Suggested reviewers'
        - 'Next workflow steps'

  operational_context:
    git_conventions:
      commit_types:
        - 'feat: New feature'
        - 'fix: Bug fix'
        - 'docs: Documentation'
        - 'style: Formatting'
        - 'refactor: Code restructuring'
        - 'test: Test additions'
        - 'chore: Maintenance'

      pr_requirements:
        - 'Descriptive title with type and scope'
        - 'Linear task ID in brackets'
        - 'Comprehensive description'
        - 'Testing instructions'
        - 'Breaking changes noted'

    validation_criteria:
      code_quality:
        - 'npm run lint passes'
        - 'npm run typecheck passes'
        - 'npm run test passes'
        - 'No console.log statements'
        - 'No commented code'

      pr_checklist:
        - 'Self-reviewed code'
        - 'Added/updated tests'
        - 'Updated documentation'
        - 'Considered edge cases'
        - 'Checked performance impact'

    data_sources:
      - command: 'git log --oneline --graph --decorate'
        purpose: 'Understand commit history'
      - command: 'git diff --stat origin/main...HEAD'
        purpose: 'Summary of changes'
      - command: 'git diff origin/main...HEAD'
        purpose: 'Detailed changes for description'
```

**Implementation Flow:**

1. **Parse Arguments**: Extract any custom title, branch specifications, or Linear task ID
2. **Validate State**: Ensure working directory is clean and branch is ready
3. **Gather Context**: Collect commit messages, changed files, and task details
4. **Generate Content**: Create structured PR title and comprehensive description
5. **Create PR**: Use gh CLI with all gathered information
6. **Provide Feedback**: Share PR link and next steps

**Key Features:**

- Automatic context gathering from git history
- Linear task integration
- Comprehensive PR templates
- Validation before creation
- Clear next steps guidance
