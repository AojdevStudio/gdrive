---
allowed-tools: mcp__linear__create_issue, mcp__linear__update_issue, mcp__linear__list_teams, mcp__linear__get_team, mcp__linear__list_users, mcp__linear__get_user, mcp__linear__list_issue_statuses, mcp__linear__list_issue_labels, mcp__linear__list_projects, mcp__linear__get_project, Read
description: Create well-structured Linear issues for parallel development workflow
---

# Write Linear Issue

This command creates well-structured Linear issues that work optimally with the parallel development workflow's semantic analysis and decomposition system using Linear MCP tools.

**variables:**
IssueDescription: $ARGUMENTS

**Usage Examples:**

- `/write-linear-issue` - Interactive issue creation with team/project selection
- `/write-linear-issue "Add user authentication"` - Create issue with basic title
- `/write-linear-issue "Implement OAuth system" "AUTH-TEAM"` - Create issue for specific team

```yaml
# Defines the configuration and rules for a utility that automates Linear issue creation.
linear_issue_generator:
  # Core instructions for the script's execution flow.
  instructions:
    - "If $ARGUMENTS are provided, use the first as the feature description and the second as the team identifier."
    - "If no arguments are given, interactively prompt the user for the feature description and requirements."
    - "Use Linear MCP tools (e.g., list_teams, list_projects) to gather necessary context for issue creation."
    - "Structure the issue using the exact template format, replacing any existing content entirely."
    - "Use only the three specified template sections: numbered description, acceptance criteria, and technical constraints."
    - "Do not preserve existing sections or add new ones like 'Overview' or 'Requirements'."
    - "Incorporate specific technologies, action verbs, and complexity indicators into the issue content."
    - "Create the issue in Linear using mcp__linear__create_issue with the correct team and project assignment."
    - "Output the created issue ID and URL for immediate user access."

  # Operational context providing metadata, tools, and formatting guidelines.
  operational_context:
    linear_teams_command:
      description: "Command to fetch the list of available Linear teams."
      command: "echo 'Will fetch via mcp__linear__list_teams'"
    issue_template_path: "ai-docs/linear-issue-template.yaml"
    semantic_analysis_patterns:
      description: "Keywords used to analyze input and structure the issue."
      actions:
        - "implement"
        - "create"
        - "build"
        - "add"
      technologies:
        - "React"
        - "Node.js"
        - "Docker"
      complexity_levels:
        - "basic"
        - "enhanced"
        - "enterprise"
    optimal_structure:
      description: "Guidelines for creating well-formed, actionable tasks."
      requirements_count: "2-6 numbered requirements"
      task_duration_minutes: "30-60 minutes each"
      complexity_progression:
        - "infrastructure"
        - "backend"
        - "frontend"
        - "testing"
    required_elements:
      description: "Specific formatting requirements for the issue body."
      - "Numbered lists for tasks (parsed by /^\\s*\\d+\\.\\s*(.+)/)."
      - "Inclusion of specific technologies and action verbs."
      - "Mentions of relevant file operations."
      - "Clear and testable acceptance criteria."
    available_tools:
      description: "List of available Linear MCP tools for interacting with the API."
      - "create_issue"
      - "update_issue"
      - "list_teams"
      - "get_team"
      - "list_users"
      - "list_issue_statuses"
      - "list_projects"
    issue_format:
      description: "Rules for formatting the issue title and body."
      title_template: "[Action] [Technology/System] - [Key Capability/Feature]"
      body_template_sections:
        - "1. A numbered list of tasks to be performed."
        - "2. A bulleted list of acceptance criteria."
        - "3. A bulleted list of technical constraints or notes."
    content_validation:
      description: "Strict rules for ensuring the final output matches the required format."
      - "Final output must match the template exactly."
      - "When editing existing issues, the entire content must be replaced with the template structure."
```
