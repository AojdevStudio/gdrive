---
allowed-tools: Task, Read, Glob
description: Intelligently select and use appropriate sub-agent based on task requirements
---

# Use Agent

Analyze $ARGUMENTS to determine the most appropriate sub-agent from the .claude/agents directory and use it to handle the specified task.

$ARGUMENTS: [task description or agent:task format]

## Instructions

- Parse $ARGUMENTS to identify task type, domain, and requirements
- If format is "agent:task", use specified agent for the task
- Otherwise, analyze task keywords to select appropriate agent:
  - "coordinate", "parallel", "multiple" → agent-coordinator
  - "changelog", "release notes" → changelog-writer
  - "review", "code review", "check code" → code-reviewer
  - "search", "find", "locate" → deep-searcher
  - "document", "docs", "readme" → doc-curator
  - "count", "statistics", "files" → file-counter
  - "frontend", "ui", "verify" → frontend-verifier
  - "git", "commit", "branch" → git-flow-manager
  - "pr", "pull request" → pr-specialist
  - "prd", "requirements" → prd-writer
  - "python", "py", "script" → python-pro
  - "quality", "validate" → quality-guardian
  - "clean", "organize", "structure" → repo-cleaner
  - "roadmap", "plan", "timeline" → roadmap-architect
  - "social", "marketing", "announce" → social-media-marketer
  - "orchestrate", "decompose" → task-orchestrator
  - "test", "testing", "coverage" → test-automator
  - "typescript", "ts", "types" → typescript-expert
  - "meta", "agent", "create" → meta-agent
- Use the Task tool to spawn the selected sub-agent with appropriate parameters

## Context

Available sub-agents in @.claude/agents/:
- agent-coordinator: Parallel development workflow coordination
- changelog-writer: Generate changelog entries from commits
- code-reviewer: Expert code review specialist
- deep-searcher: Comprehensive code search across large codebases
- doc-curator: Documentation creation and maintenance
- file-counter: File statistics and directory analysis
- frontend-verifier: Browser automation and UI testing
- git-flow-manager: Git operations and workflow management
- meta-agent: Sub-agent creation and modification
- pr-specialist: Pull request creation assistance
- prd-writer: Product requirements documentation
- python-pro: Python development expert with advanced features
- quality-guardian: Code quality validation
- repo-cleaner: Repository cleanup and organization
- roadmap-architect: Strategic planning and roadmaps
- social-media-marketer: Marketing content generation
- task-orchestrator: Complex task decomposition
- test-automator: Comprehensive test suite creation
- typescript-expert: TypeScript development specialist

## Output

- Selected sub-agent name and rationale
- Task execution through the chosen sub-agent
- Results from the sub-agent's processing

**variables:**
TaskRequirements: $ARGUMENTS

**Usage Examples:**

- `/use-agent implement authentication system` - Auto-selects task-orchestrator
- `/use-agent quality-guardian:validate recent changes` - Uses specified agent
- `/use-agent find all API endpoints` - Auto-selects deep-searcher
- `/use-agent create roadmap for Q1` - Auto-selects roadmap-architect
- `/use-agent review the user service code` - Auto-selects code-reviewer
- `/use-agent write tests for payment module` - Auto-selects test-automator
- `/use-agent python-pro:optimize data processing script` - Uses specified agent
- `/use-agent add typescript types to API` - Auto-selects typescript-expert

```yaml
command_configuration:
  instructions:
    - step: 1
      action: "Parse $ARGUMENTS to extract task requirements and optional agent specification"
      details: "Support both 'agent:task' format and natural language task descriptions"
    
    - step: 2
      action: "Determine the most appropriate sub-agent based on task analysis"
      details: "Match task keywords and requirements to agent capabilities"
    
    - step: 3
      action: "Use the Task tool to invoke the selected sub-agent"
      details: "Pass the task requirements to the chosen sub-agent for execution"
  
  context:
    input_analysis:
      - name: "Parse Arguments"
        description: "Extract agent name if specified, otherwise analyze task type"
    
    agent_selection:
      - name: "Match Task to Agent"
        description: "Use keyword mapping and task domain to select best agent"
    
    reference_docs:
      - "@.claude/agents/*.md"
```