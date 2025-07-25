---
allowed-tools: Bash, Read, Glob, Grep
description: Strict 100% validation of all parallel agent work completion and integration
---

# Agent Final Validation

This command performs an extremely strict final validation of all parallel agent work by analyzing git history, file existence, and task completion to ensure 100% integration success.

**variables:**
TaskIdOrOptions: $ARGUMENTS

**Usage Examples:**

- `/agent-final-validation` - Validate all agents from the most recent deployment plan
- `/agent-final-validation TASK-123` - Validate specific task's agent work
- `/agent-final-validation --strict` - Maximum validation strictness with detailed reporting

```yaml
# Protocol for validating completed agent work against deployment plans.
agent_work_validation_protocol:
  # The sequence of steps required to perform a comprehensive validation.
  validation_steps:
    - title: 'Discover Deployment Plans'
      description: 'Find all deployment plans in shared/deployment-plans/ to identify completed tasks and the responsible agents.'
    - title: 'Extract Task Requirements'
      description: 'For each agent, extract their original task requirements including files to create/modify, validation criteria, and test contracts.'
    - title: 'Verify File Commits'
      description: "Use 'git log' and 'git diff' to verify that every required file modification or creation was actually committed to the main branch."
    - title: 'Confirm Merges'
      description: "Cross-reference git commit messages to confirm that each agent's work was properly merged."
    - title: 'Validate File Contents'
      description: 'Perform a targeted analysis of file contents to ensure they align with the original requirements.'
    - title: 'Check Validation Criteria'
      description: "Confirm that all validation criteria specified in the agent's context were met."
    - title: 'Verify Test Contracts'
      description: 'Check that all specified test contracts exist in the codebase and are implemented correctly.'
    - title: 'Calculate Completion'
      description: 'Calculate a completion percentage for each agent and identify any missing deliverables.'
    - title: 'Generate Validation Report'
      description: 'Create a comprehensive validation report in JSON format with a clear pass/fail status for each agent.'
    - title: 'Enforce Pass/Fail'
      description: 'Fail the entire validation if any single agent has less than 100% completion.'
    - title: 'Provide Remediation'
      description: 'For any failures, include actionable remediation steps in the final report.'

  # The context, commands, and rules governing the validation process.
  protocol_context:
    data_gathering_commands:
      git_commit_history: 'git log --oneline -20 --grep="agent" --grep="TASK-" --grep="feat:" --grep="fix:"'
      recent_file_changes: 'git diff --name-only HEAD~5..HEAD'
      find_deployment_plans: 'find shared/deployment-plans -name "*.yaml" -exec basename {} .yaml \; 2>/dev/null || echo "no-plans"'
      current_branch_status: 'git status --porcelain'
      find_agent_contexts: 'find . -name "agent_context.yaml" -o -name "*-deployment-plan.yaml" 2>/dev/null | head -10'
      git_worktree_status: 'git worktree list 2>/dev/null || echo "no-worktrees"'

    data_formats:
      validation_criteria_structure:
        - taskId
        - agentId
        - filesToCreate[]
        - filesToModify[]
        - validationCriteria[]
        - testContracts[]

    validation_rules:
      - 'All required files must exist in the final commit.'
      - 'All specified commits from agent branches must be merged into the main branch.'
      - 'All validation criteria must be verifiably met.'
      - 'The pass threshold is 100% completion; no partial credit is given.'

    reporting:
      report_format: 'YAML'
      report_content: 'Detailed results with failure analysis and remediation steps.'
```
