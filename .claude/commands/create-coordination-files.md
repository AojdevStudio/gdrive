---
allowed-tools: Read, Write, Bash, Edit
description: Generate coordination files for parallel workflow integration
---

# Create Coordination Files

This command generates integration coordination files for parallel development workflow compatibility by creating status files, deployment plans, and completion reports.

**variables:**
AgentWorkspace: $ARGUMENTS

**Usage Examples:**

- `/create-coordination-files workspaces/AOJ-100-backend_api_agent` - Generate coordination for specific agent
- `/create-coordination-files ./` - Use current directory as agent workspace
- `/create-coordination-files ../agent-workspace` - Generate from relative path

```yaml
# Protocol for preparing an agent's completed work for integration.
agent_pre_merge_protocol:
  # The sequence of steps to validate and prepare the agent's workspace.
  protocol_steps:
    - action: 'Parse Arguments'
      description: 'Extract the agent workspace path from the $ARGUMENTS.'
    - action: 'Validate Workspace'
      description: 'Verify that the workspace contains all required files (agent_context.yaml, validation_checklist.txt, etc.).'
    - action: 'Extract Metadata'
      description: "Read agent_context.yaml to get the agent's ID, role, and task information."
    - action: 'Calculate Completion'
      description: 'Determine the validation completion percentage from the validation_checklist.txt file.'
    - action: 'Prepare Coordination Directory'
      description: 'Create the shared coordination directory structure if it does not already exist.'
    - action: 'Generate Status Files'
      description: 'Create validation-status.json and integration-status.json with relevant metrics and compatibility info.'
    - action: 'Create Deployment Plan'
      description: 'Generate a new deployment plan JSON file for use by downstream integration scripts.'
    - action: 'Archive Workspace'
      description: "Preserve the agent's workspace by moving it to a dedicated 'workspaces' directory."
    - action: 'Generate Report'
      description: "Create a YAML completion report summarizing the agent's work and validation status."

  # The context, commands, and file structure for the protocol.
  protocol_context:
    data_gathering_commands:
      get_agent_context: 'cat agent_context.yaml 2>/dev/null || echo "{}"'
      get_validation_status: 'grep -c "\\[x\\]" validation_checklist.txt 2>/dev/null || echo "0"'
      get_total_criteria: 'grep -c "\\[.\\]" validation_checklist.txt 2>/dev/null || echo "0"'
      get_current_branch: 'git branch --show-current'

    file_and_directory_layout:
      required_files:
        - 'agent_context.yaml'
        - 'validation_checklist.txt'
        - 'files_to_work_on.txt'
      coordination_directory: 'shared/coordination/'
      deployment_plans_directory: 'shared/deployment-plans/'
      reports_directory: 'shared/reports/'

    output_artifacts:
      - 'validation-status.yaml'
      - 'integration-status.yaml'
      - 'A new deployment plan YAML file'
      - 'A YAML completion report'

    integration_compatibility:
      - 'Supports parallel workflow scripts.'
```
