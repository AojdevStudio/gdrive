---
allowed-tools: Bash(git worktree:list), Bash(git branch:*), Bash(git log:*), Bash(git status:*), Bash(ls:*), Bash(cat:*), Bash(find:*)
description: Analyze parallel agent integration and generate cleanup plan (read-only analysis)
---

# Parallel Agent Cleanup

This command analyzes completed parallel agent workflows and generates a cleanup script to remove integrated worktrees, branches, and coordination files safely.

**variables:**
TaskIdFilter: $ARGUMENTS

**Usage Examples:**

- `/agent-cleanup` - Analyze all parallel agent work and generate cleanup script
- `/agent-cleanup AOJ-100` - Focus cleanup analysis on specific task ID
- `/agent-cleanup --dry-run` - Show what would be cleaned without generating script

```yaml
# Plan for cleaning up Git repository after parallel agent work
git_cleanup_plan:
  # The high-level objectives for the cleanup process.
  analysis_steps:
    - 'Analyze git worktrees to identify completed parallel agent work.'
    - 'Check the merge status of all agent branches against the main branch.'
    - 'Identify obsolete coordination files and deployment plans.'
    - 'Generate a comprehensive cleanup script with built-in safety checks.'
    - 'Provide clear explanations for each recommended cleanup action within the script.'

  # The environment and conventions used in the development workflow.
  environment_context:
    # Commands used to gather information about the repository state.
    data_gathering_commands:
      git_status: 'git status'
      current_branch: 'git branch --show-current'
      list_worktrees: 'git worktree list'
      list_all_branches: 'git branch -a'
      recent_commits: 'git log --oneline -10'
      find_coordination_files: "ls -la ../*/coordination/ 2>/dev/null || echo 'No coordination directories found'"

    # Naming conventions to identify agent-related work.
    naming_conventions:
      agent_worktree_pattern: '_-work-trees/_-agent'
      agent_branch_pattern: 'TASK-ID-*_agent'
      task_id_formats:
        - 'AOJ-100'
        - 'AOJ-99'
        - 'PROJ-123'

    # Critical safety rules to prevent accidental data loss.
    safety_requirements:
      - 'The analysis must be read-only.'
      - 'The final output should be a cleanup script, not direct execution of commands.'

    # Specific items to be targeted for cleanup.
    cleanup_targets:
      - 'Git worktrees'
      - 'Git branches'
      - 'Coordination files'
      - 'Deployment plans'
```
