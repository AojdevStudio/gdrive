---
allowed-tools: Bash, Read, Write, Edit
description: Commit and merge completed agent work
---

# Agent Commit

Use the git-flow-manager sub-agent to commit and merge completed agent work from workspace $ARGUMENTS. Validate checklist completion, generate structured commit message from agent_context.json with issue linking support, merge to main branch with --no-ff, and clean up worktree after successful integration.

**variables:**
WorkspacePath: $ARGUMENTS

**Usage Examples:**

- `/agent-commit workspaces/AOJ-100-backend_api_agent` - Standard commit with auto-generated message
- `/agent-commit workspaces/AOJ-100-backend_api_agent "feat: custom integration"` - Custom commit message
- `/agent-commit workspaces/AOJ-100-frontend_agent --dry-run` - Validate only, no commit

```yaml
# Workflow for finalizing and merging an agent's work from a Git worktree.
agent_work_completion_workflow:
  # A sequential list of steps to be executed to complete the workflow.
  workflow_steps:
    - action: 'Parse arguments'
      details: 'Extract the workspace path and an optional custom message from the $ARGUMENTS.'
    - action: 'Verify workspace'
      details: 'Confirm the provided path is a valid Git worktree and extract its branch information.'
    - action: 'Validate checklist'
      details: 'Ensure all checklist items in validation_checklist.txt are marked as completed.'
    - action: 'Extract context'
      details: 'Read agent_context.json to get agentId, taskId, and agentRole for commit metadata.'
    - action: 'Perform safety checks'
      details: 'On the main branch, stash any local changes and pull the latest updates to ensure a clean state.'
    - action: 'Generate commit message'
      details: 'Create a structured commit message using the defined format or use the custom message if provided. Include issue references (e.g., Closes #123, Fixes ENG-456) in the commit body for GitHub/Linear integration.'
    - action: 'Commit changes'
      details: "Stage and commit all changes within the agent's worktree."
    - action: 'Merge to main'
      details: "Merge the agent's branch into the main branch using the --no-ff flag to preserve a clear history."
    - action: 'Update coordination status'
      details: "Modify the coordination status file to mark the agent's task as completed."
    - action: 'Cleanup'
      details: 'Remove the Git worktree and delete the now-merged agent branch.'

  # Contextual information, configurations, and requirements for the workflow.
  workflow_context:
    data_sources:
      - file: 'agent_context.json'
        purpose: 'Contains metadata for the commit message (agentId, taskId, agentRole).'
      - file: 'validation_checklist.txt'
        purpose: 'Tracks completion criteria that must be met before merging.'

    directories_and_patterns:
      coordination_directory: '../paralell-development-claude-work-trees/coordination/'
      worktree_patterns_reference: '@ai-docs/mastering-git-worktrees.yaml'

    git_configuration:
      commit_format: 'feat(agentId): taskTitle with statistics and metadata'
      merge_strategy: '--no-ff' # Creates a merge commit, even if the merge could be resolved as a fast-forward.
      push_policy: 'Local merge only; user must push manually.'
      cleanup_rules:
        - 'Remove the worktree after a successful merge.'
        - 'Delete the local branch after it has been merged.'
      
      issue_linking:
        description: 'Include issue references in commit messages for GitHub/Linear integration'
        closing_keywords:
          - 'Closes' # Auto-closes when PR merges
          - 'Fixes'
          - 'Resolves'
        referencing_keywords:
          - 'Part of' # Links without closing
          - 'Related to'
          - 'Contributes to'
        format_guidelines:
          - 'Place issue references in commit body, not subject'
          - 'Use format: Closes #123 for GitHub issues'
          - 'Use format: Fixes ENG-123 for Linear issues'
          - 'Multiple issues: Fixes ENG-123, ENG-124'
        example_commit_message: |
          feat(backend-api): implement authentication endpoints
          
          Added JWT token generation and validation with refresh token support.
          Includes rate limiting and secure password hashing.
          
          Closes #42
          Fixes CDE-2

    safety_requirements:
      - 'The main branch must be clean (no uncommitted changes).'
      - 'All items in the validation_checklist.txt must be complete.'
```