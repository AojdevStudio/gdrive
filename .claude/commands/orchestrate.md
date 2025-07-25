---
allowed-tools: Read, Task, TodoWrite
description: Transform tasks into parallel sub-agents using native tool invocation
---

# Orchestrate

Transform any task format into parallel sub-agents using Claude's native parallel tool invocation for maximum efficiency.

**variables:**
Input: $ARGUMENTS

**Usage Examples:**

- `/orchestrate` - Auto-detect tasks from current directory
- `/orchestrate tasks.md` - Parse markdown checklist into parallel sub-agents
- `/orchestrate "task1, task2, task3"` - Direct text input with parallel execution
- `/orchestrate LINEAR-123` - Decompose Linear issue into concurrent sub-agents

```yaml
orchestrate_configuration:
  instructions:
    - step: 1
      action: 'Parse input to identify tasks'
      details: |
        # Detect input format and extract tasks
        - Check if input is a file path, Linear ID, or direct text
        - Parse markdown checklists, YAML files, or text lists
        - Extract individual tasks with their requirements

    - step: 2
      action: 'Analyze tasks for parallelization opportunities'
      details: |
        # Identify which tasks can run concurrently
        - Group independent tasks that can execute in parallel
        - Identify dependencies between tasks
        - Create execution phases based on dependencies

    - step: 3
      action: 'Invoke multiple Task tools simultaneously'
      details: |
        # KEY: Use Claude's native parallel tool invocation
        # Instead of sequential calls, invoke all independent Task tools in ONE response
        # This provides automatic parallelism and is more efficient
        # All tasks execute concurrently!
        #
        # See @ai-docs/tool-use.yaml for parallel_tool_use best practices:
        # - Claude 4 models (Opus 4, Sonnet 4) excel at parallel tool use
        # - Use explicit prompting: "invoke all relevant tools simultaneously"
        # - All parallel tools return results together in one response

    - step: 4
      action: 'Process results from parallel execution'
      details: |
        # Aggregate results from all sub-agents
        - Collect outputs from each Task tool
        - Identify any failures or issues
        - Generate summary report

  context:
    reference_docs:
      - '@ai-docs/tool-use.yaml'

    parallel_execution_principles:
      - name: 'Maximize Parallel Tool Use'
        description: 'Invoke all independent tools simultaneously for efficiency'
        guidance: |
          Claude 4 models naturally support parallel tool calls.
          When you have multiple independent tasks, invoke all Task tools
          in a single response for automatic parallel execution.

          From @ai-docs/tool-use.yaml - Recommended approach:
          "For maximum efficiency, whenever you perform multiple independent
          operations, invoke all relevant tools simultaneously rather than
          sequentially. Prioritize calling tools in parallel whenever possible."

      - name: 'Complete Context in Each Task'
        description: 'Each Task tool must have all info needed to work independently'
        guidance: |
          Every Task invocation should include:
          - Clear role description
          - Specific tasks to complete
          - Success criteria
          - Any necessary context or constraints

      - name: 'Minimize Dependencies'
        description: 'Structure tasks to reduce inter-agent dependencies'
        guidance: |
          Tasks that depend on each other should be in separate phases.
          Within a phase, all tasks should be truly independent.

    task_tool_structure:
      description: 'Standard structure for each Task tool invocation'
      template: |
        Task({
          description: "[Role] - [Focus Area]",
          prompt: `You are a specialized sub-agent.
          
          Your specific role: [Detailed role description]
          
          Tasks to complete:
          - [Task 1 with clear requirements]
          - [Task 2 with success criteria]
          - [Task 3 with expected output]
          
          Context and constraints:
          - Work independently without relying on other agents
          - Return structured results in YAML format
          - Report completion status and any issues
          - [Any specific constraints for this agent]
          
          Please complete these tasks and return a structured report.`
        })

    parallel_tool_optimization:
      description: 'Key strategies from @ai-docs/tool-use.yaml for maximizing parallel execution'
      strategies:
        - name: 'Model Selection'
          guidance: 'Claude Opus 4 and Sonnet 4 excel at complex tools and parallel execution'
        - name: 'Explicit Prompting'
          guidance: "Use phrases like 'simultaneously', 'at the same time', 'in parallel'"
        - name: 'Batch Operations'
          guidance: 'Group independent operations to invoke multiple Task tools at once'
        - name: 'Result Handling'
          guidance: 'All parallel tool results return together - process them as a batch'

    execution_phases:
      - phase: 1
        description: 'Initial independent tasks'
        pattern: 'All tasks with no dependencies'
      - phase: 2
        description: 'Dependent tasks'
        pattern: 'Tasks that require phase 1 outputs'
      - phase: 3
        description: 'Final integration'
        pattern: 'Tasks that aggregate or finalize work'

  examples:
    simple_parallel_execution:
      input: '"Run tests, fix linting, update docs"'
      execution: |
        # Claude will invoke these 3 Task tools simultaneously:
        <function_calls>
          <invoke name="Task">
            <parameter name="description">Testing Sub-agent</parameter>
            <parameter name="prompt">Run all tests and report results...</parameter>
          </invoke>
          <invoke name="Task">
            <parameter name="description">Linting Sub-agent</parameter>
            <parameter name="prompt">Fix all linting issues...</parameter>
          </invoke>
          <invoke name="Task">
            <parameter name="description">Documentation Sub-agent</parameter>
            <parameter name="prompt">Update relevant documentation...</parameter>
          </invoke>
        </function_calls>

    phased_execution:
      input: 'Complex task with dependencies'
      phase1: 'Launch independent analysis agents in parallel'
      phase2: 'After phase 1 completes, launch synthesis agent'
      phase3: 'Final validation agent after synthesis'

  validation:
    pre_conditions:
      - 'Input tasks are clearly defined'
      - 'Task independence is properly analyzed'
    post_conditions:
      - 'All sub-agents complete successfully'
      - 'Results are aggregated and reported'
      - 'Any failures are clearly identified'

  error_handling:
    - error: 'Task parse failure'
      action: 'Report parsing error and request clarification'
    - error: 'Sub-agent failure'
      action: 'Continue with other agents, report failure in summary'
    - error: 'Dependency conflict'
      action: 'Re-analyze and adjust execution phases'
    - error: 'Parallel tools not executing'
      action: 'Check @ai-docs/tool-use.yaml troubleshooting - ensure proper formatting'
      details: |
        Common causes per tool-use.yaml:
        - Tool results not formatted correctly
        - Weak prompting (add 'simultaneously' keywords)
        - Model-specific behavior (Sonnet 3.7 needs stronger prompting)
```
