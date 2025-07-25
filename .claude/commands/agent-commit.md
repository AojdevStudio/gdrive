---
allowed-tools: Read, Bash, Write, Edit, MultiEdit
description: Commit and merge completed agent work with validation checks
---

# Agent Commit

This command commits completed agent work and merges the worktree back to main branch with comprehensive validation and safety checks.

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
      details: 'Create a structured commit message using the defined format or use the custom message if provided.'
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

    safety_requirements:
      - 'The main branch must be clean (no uncommitted changes).'
      - 'All items in the validation_checklist.txt must be complete.'
```
