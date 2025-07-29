---
allowed-tools: Bash, Read, Write, Edit, MultiEdit, Grep, Task
description: Load workspace and run parallel sub-agent Explore-Plan-Test-Code workflow
---

# Agent Start

Use the agent-coordinator sub-agent to load workspace and orchestrate parallel development workflow. Read agent_context.yaml from $ARGUMENTS path, gather context from files_to_work_on.txt and validation_checklist.txt, then execute 7-phase workflow: Explore (codebase analysis), Plan (deployment strategy), Write Tests (TDD setup), Code (implementation), Refactor (optimization), Validate (comprehensive testing), Write-Up (PR documentation). Support --resume, --phase, and --validate-only flags for workflow control.
