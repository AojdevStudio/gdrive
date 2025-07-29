---
allowed-tools: Read, Task, TodoWrite
description: Transform tasks into parallel sub-agents using native tool invocation
---

# Orchestrate

Use the task-orchestrator sub-agent to transform any task format into parallel sub-agents using Claude's native parallel tool invocation for maximum efficiency. Parse $ARGUMENTS input (file paths, Linear IDs, or direct text), identify and group independent tasks that can execute concurrently, create execution phases based on dependencies, invoke multiple Task tools simultaneously in one response using parallel execution principles from ai-docs/tool-use.yaml, and process aggregated results from all sub-agents with summary reporting.
