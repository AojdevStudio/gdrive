---
allowed-tools: Read, Write, Edit, MultiEdit, Bash, Grep, Task
description: Load workspace and run parallel-sub-agent Explore–Plan–Test–Code workflow
---

# Agent Start

This command parses an **agent_context.yaml** task file and orchestrates a **parallel-sub-agent** workflow —  
**Explore → Plan → Write Tests → Code → Refactor → Validate → Write-Up** — to ship fast, high-quality implementations.

**variables:**  
AgentContextPath: $ARGUMENTS <!-- default: ./agent_context.yaml -->

**Usage Examples:**

- `/agent-start` — run in current directory (default agent_context.yaml)
- `/agent-start ../ticket_742/ctx.yaml` — open a specific task file
- `/agent-start . --phase=plan` — start at a given phase
- `/agent-start . --resume` — continue from last completed phase
- `/agent-start . --validate-only` — skip directly to Validate phase

---

```yaml
# A multi-phase protocol for an autonomous AI agent system to perform complex tasks.
multi_agent_workflow_protocol:
  # Top-level instructions and rules governing the entire workflow.
  general_instructions:
    - 'Read the context from the path specified in `$AgentContextPath` before starting.'
    - 'Launch all sub-agents using the `Task` tool, providing a bounded goal for each.'
    - 'Ensure all sub-agents terminate upon completion to avoid context clashes.'

  # Rules for how sub-agents should manage resources and outputs.
  sub_agent_resource_rules:
    - 'Launch sub-agents only for clearly scoped, independent subtasks.'
    - 'Each sub-agent must write its temporary output to `/shared/coordination/` (scratchpad).'
    - 'Each sub-agent must write its final artifact to the phase-specific folder.'
    - 'Do not leave idle or persistent sub-agents running after their task is complete.'

  # Logic for resuming or starting the workflow from specific points.
  phase_recovery_logic:
    - flag: '--resume'
      action: 'Read `/shared/coordination/phase_state.yaml` and jump to the next uncompleted phase.'
    - flag: '--validate-only'
      action: 'Execute Phase 6 (Validate) directly and skip all preceding phases.'
    - flag: '--phase='
      action: 'Honor the specified phase number to start from.'
    - flag: 'default'
      action: 'If no flags are provided, start at Phase 1 (Explore).'

  # The sequence of phases that define the agent's workflow.
  phases:
    - phase_number: 1
      name: 'Explore'
      description: 'Perform a broad analysis of the codebase by launching up to 6 sub-agents, each focused on a specific directory bucket. Aggregate findings before proceeding.'
      actions:
        - 'Launch one sub-agent per directory bucket to analyze the code.'
        - 'Each sub-agent produces an `explore-<bucket>.md` file.'
        - 'After all agents complete, aggregate highlights into `explore_summary.md`.'
        - 'Echo the top findings from the summary.'
      output_location: '/shared/coordination/'
      confirmation_prompt: 'Confirm exploration findings before proceeding to the planning phase.'
      output_template: |
        ## Explore Output
        **File**: `path/to/file.ts`
        **Purpose**: One-line description
        **Key Patterns**: • pattern 1 • pattern 2
        **Integration Notes**: Relevance to task

    - phase_number: 2
      name: 'Plan'
      description: 'Launch sub-agents to draft different segments of the deployment plan, such as testing strategies, refactoring paths, and dependency management.'
      actions:
        - 'Launch sub-agents to draft plan segments (tests, refactor, dependencies, etc.).'
        - 'Each sub-agent saves its segment to a `plan-<agent-name>.md` file.'
        - 'Optionally, merge key points from all segments into a `plan_master.md`.'
        - 'Ask clarifying questions if blockers arise.'
        - 'Commit the final plan artifacts.'
      output_location: '/shared/deployment-plans/'

    - phase_number: 3
      name: 'Write Tests'
      description: 'Spawn component-focused sub-agents to create a suite of failing tests that define the requirements for the new code.'
      actions:
        - 'Spawn sub-agents to create failing tests for each component.'
        - "Run the project's test runner to confirm the tests fail correctly."
        - 'Store the test failure log as `red_test_log.txt`.'
        - 'Commit the newly created tests.'
      output_location: '/shared/coordination/tests/'
      report_location: '/shared/reports/'
      confirmation_prompt: 'Confirm failing tests before proceeding to code implementation.'

    - phase_number: 4
      name: 'Code to Pass Tests'
      description: 'Fork sub-agents for each component to implement the minimum amount of code required to make the failing tests pass.'
      actions:
        - 'Fork sub-agents per component to implement code.'
        - 'Ensure the implementation makes the test suite pass.'
        - 'Run the linter and/or formatter on the new code.'
        - 'Save linting results to `lint_results.txt`.'
        - 'Commit the implementation code.'
      report_location: '/shared/reports/'

    - phase_number: 5
      name: 'Refactor'
      description: 'Launch review-focused sub-agents to improve the clarity, performance, and security of the newly added code, relying on the test suite to prevent regressions.'
      actions:
        - 'Launch sub-agents focused on clarity, performance, and security reviews.'
        - 'Apply safe edits based on the review findings.'
        - 'Rely on the existing test suite to ensure no functionality is broken.'
        - 'Commit the refactored code.'

    - phase_number: 6
      name: 'Validate'
      description: 'Perform a final, comprehensive validation using parallel sub-agents. This phase is also the direct entry point for the `--validate-only` flag.'
      actions:
        - 'Launch parallel validation sub-agents for:'
        - '1. Full unit and integration tests.'
        - '2. UX checks (using a tool like Puppeteer).'
        - '3. Static analysis.'
        - 'Save all validation artifacts.'
        - "If validation fails, loop back to the 'Plan' phase with enhanced thinking."
        - 'Summarize the final validation results in 150 tokens or less.'
      output_location: '/shared/reports/validation/'

    - phase_number: 7
      name: 'Write-Up'
      description: 'Collect all relevant artifacts from the previous phases to generate a final report and a pull request description.'
      actions:
        - 'Collect `plan_master.md`, commit hashes, code coverage reports, and screenshots.'
        - 'Generate a comprehensive `pr_description.md`.'
        - 'Present a summary of the write-up in the chat.'
        - "Return 'OK' on success or 'FAIL' with a reason on failure."
      output_location: '/shared/reports/'

  # Commands to gather context from the local environment before starting the workflow.
  context_gathering_commands:
    - name: 'Agent Context'
      command: '!`cat agent_context.yaml 2>/dev/null || echo "No agent context found"`'
    - name: 'File List'
      command: '!`cat files_to_work_on.txt 2>/dev/null || echo "No file list found"`'
    - name: 'Checklist'
      command: '!`cat validation_checklist.txt 2>/dev/null || echo "No checklist found"`'
    - name: 'Test Contracts'
      command: '!`cat test_contracts.txt 2>/dev/null || echo "No test contracts"`'
    - name: 'Present Working Directory'
      command: '!`pwd`'
    - name: 'Current Git Branch'
      command: '!`git branch --show-current 2>/dev/null || echo "Not in git repo"`'
```
