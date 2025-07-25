---
allowed-tools: Bash(git:*), Read
description: Understand the current state of the git repository
---

# Git Status

This command provides a comprehensive summary of the current git repository state including status, branch information, and differences from remote.

**Usage Examples:**

- `/git-status` - Show current repository state and summary

```yaml
# A protocol for a command that summarizes the current Git repository status.
git_status_summary_protocol:
  # The sequence of actions the command should perform to gather and present information.
  execution_flow:
    - 'Run `git status` to check the state of the working directory.'
    - 'Get the current branch name and its upstream tracking information.'
    - 'Check for differences (commits ahead or behind) between the local and remote branches.'
    - 'Read key project files, such as `README.md`, to provide high-level context.'
    - 'Summarize all findings in a clear, actionable format.'
    - 'Explicitly highlight any uncommitted changes or divergence from the remote branch.'

  # Defines the context, data sources, and key definitions for the command's operation.
  operational_context:
    # Commands used to gather necessary data from the Git repository.
    data_sources:
      - name: 'Current Status'
        command: '!`git status`'
      - name: 'Current Branch'
        command: '!`git branch --show-current`'
      - name: 'Remote Tracking Branch'
        command: '!`git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "No upstream branch"`'
      - name: 'Local vs Remote Divergence'
        command: '!`git rev-list --left-right --count HEAD...@{u} 2>/dev/null || echo "0 0"`'
      - name: 'Recent Commits'
        command: '!`git log --oneline -5`'
      - name: 'Project Overview'
        file: '@README.md'

    # Key terms and their meanings within the context of the summary.
    key_definitions:
      repository_state_indicators:
        - 'clean'
        - 'changes staged'
        - 'changes unstaged'
        - 'untracked files'
      branch_divergence: 'The number of commits the local branch is ahead or behind the remote tracking branch.'
      summary_focus: 'To provide actionable status information, helping the user understand the current state and what actions might be needed next.'
```
