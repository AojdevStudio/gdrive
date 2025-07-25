---
allowed-tools: Read, Bash, Grep, Task
description: Check status of all agent worktrees and their progress
---

# Agent Status

This command discovers and analyzes all agent workspaces to provide comprehensive status reporting, progress tracking, and workflow recommendations.

**variables:**
FilterOption: $ARGUMENTS

**Usage Examples:**

- `/agent-status` - Show status of all agents
- `/agent-status complete` - Show only finished agents
- `/agent-status ready` - Show agents ready to start or commit
- `/agent-status blocked` - Show dependency-blocked agents
- `/agent-status TASK-123` - Filter by specific task ID

```yaml
# A protocol for an agent status reporter command.
# This command discovers and analyzes multiple parallel agent workspaces
# to generate a comprehensive status report.
agent_status_reporter_protocol:
  # The sequence of actions the command should perform.
  instructions:
    - "Parse the command's `$ARGUMENTS` to extract the filter option, which can be 'complete', 'ready', 'blocked', or a specific task ID."
    - 'Discover all active agent workspaces by using both `git worktree list` and a file system scan.'
    - 'For each discovered agent, read the `agent_context.yaml` file to retrieve its metadata.'
    - 'Analyze the `validation_checklist.txt` file for each agent to calculate its completion percentage.'
    - "Check the `git status` within each agent's worktree to determine if uncommitted changes exist."
    - 'Map the dependencies between agents using the information found in their context files.'
    - 'Apply the user-requested filter to the list of agents.'
    - 'Generate a comprehensive status report that includes progress indicators for each agent.'
    - 'Provide actionable recommendations for the next steps based on the current status of all agents.'

  # Defines the context, data sources, and key definitions for the command's operation.
  context_and_definitions:
    # Commands used to gather necessary data from the environment.
    data_sources:
      - name: 'Git Worktrees'
        command: '!`git worktree list`'
      - name: 'Agent Workspaces'
        command: '!`find .. -name "*-agent" -type d 2>/dev/null | grep -E "work-trees|workspaces" | head -20`'
      - name: 'Coordination Status'
        command: '!`cat ../paralell-development-claude-work-trees/coordination/parallel-agent-status.json 2>/dev/null || echo "{}"`'
      - name: 'Current Directory'
        command: '!`pwd`'

    # Key patterns and logic used for analysis.
    definitions:
      agent_patterns:
        - '_-work-trees/_-agent'
        - 'workspaces/*-agent'
      context_files:
        - name: 'metadata'
          file: 'agent_context.yaml'
        - name: 'progress'
          file: 'validation_checklist.txt'
      progress_calculation:
        description: 'Count the number of checked boxes `[x]` versus unchecked boxes `[ ]` in the validation checklist file.'
      status_categories:
        - 'Complete: 100% progress'
        - 'In Progress: 1-99% progress'
        - 'Blocked: 0% progress with unmet dependencies'
      filter_keywords:
        - 'complete'
        - 'ready'
        - 'blocked'
        - 'task ID pattern (regex)'
```
