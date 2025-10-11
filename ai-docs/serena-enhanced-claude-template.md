# Balanced CLAUDE.md Template (with Serena Support)

## Problem Statement

Development teams need a balanced CLAUDE.md template that leverages the right tools for the right tasks. Current project documentation often over-prescribes tool usage, leading to inefficient workflows where powerful native tools are ignored in favor of complex patterns.

## Objectives

- Create a reusable CLAUDE.md template that trusts Claude's tool selection
- Establish intelligent tool selection based on task requirements
- Provide guidance on when each tool shines (native vs Serena vs sub-agents)
- Include customizable sections for project-specific requirements
- Reduce cognitive load by removing unnecessary prescriptive rules

## Technical Approach

### Template Architecture

```
CLAUDE.md Template Structure:
├── Project Overview (customizable)
├── Serena-First Development Methodology (standard)
├── Core Commands (project-specific + Serena patterns)
├── Serena Workflow Guidelines (standard with examples)
├── Project Navigation (dynamic Serena patterns)
├── Technology Stack (customizable)
├── Domain-Specific Guidelines (placeholder)
└── Quality Standards (Serena-enhanced)
```

### Design Principles

1. **Right Tool, Right Task**: Trust Claude to select appropriate tools
2. **Template Variables**: Use placeholders for project customization
3. **Memory Persistence**: Emphasize cross-session knowledge retention
4. **Minimal Prescription**: Guide, don't dictate
5. **Project-Specific**: Focus on unique project needs, not generic workflows

## Step-by-Step Implementation

### Phase 1: Template Structure Creation

1. **Header Section**
   - Project name placeholder: `{PROJECT_NAME}`
   - Description placeholder: `{PROJECT_DESCRIPTION}`
   - Status tracking: `{PROJECT_STATUS}`

2. **Serena-First Methodology Section**
   - Core principles (standardized)
   - Workflow hierarchy: Explore → Understand → Modify
   - Anti-patterns to avoid (full file reading, blind navigation)

3. **Development Commands Section**
   - Serena workflow references (standard)
   - Core commands template: `{CORE_COMMANDS}`
   - Technology-specific commands: `{TECH_COMMANDS}`

### Phase 2: Tool Selection Guidance

1. **Quick Operations (Use Native Tools)**

   ```bash
   # Simple file operations - use Read/Write/Edit
   # Pattern searching - use Grep (it's ripgrep!)
   # File finding - use Glob
   ```

2. **When Serena Shines**

   ```bash
   # Memory persistence for project knowledge
   mcp__serena__write_memory --memory_name="{PROJECT_NAME}_insights"

   # Symbol navigation in large codebases
   mcp__serena__get_symbols_overview --relative_path="{LARGE_FILE}"

   # Impact analysis before changes
   mcp__serena__find_referencing_symbols --name_path="{CRITICAL_FUNCTION}"
   ```

3. **Trust Claude's Judgment**
   ```
   # Let Claude choose the right tool based on:
   - Task complexity
   - File size
   - Search scope
   - Performance needs
   ```

### Phase 3: Customization System

1. **Variable Replacement System**
   - `{PROJECT_NAME}`: Project display name
   - `{PROJECT_DESCRIPTION}`: Brief project summary
   - `{TECH_STACK}`: Primary technologies
   - `{SRC_DIR}`: Main source directory
   - `{MAIN_FILE_PATTERN}`: Primary file pattern (_.py, _.js, etc.)
   - `{DOMAIN_GUIDELINES}`: Project-specific business logic patterns

2. **Technology-Specific Sections**
   - Python projects: pandas, Django, FastAPI patterns
   - JavaScript projects: React, Node.js, Express patterns
   - General patterns: API development, testing, deployment

3. **Domain Adaptations**
   - Web applications: frontend/backend separation
   - Data science: data processing, analysis patterns
   - APIs: endpoint exploration, documentation
   - CLI tools: command structure, option handling

### Phase 4: Simplified Guidelines

1. **Search Efficiency**

   ```bash
   # Always use Grep tool, not bash grep
   # It's actually ripgrep under the hood!
   ```

2. **Memory Management**
   ```bash
   # Store important project insights
   mcp__serena__write_memory --memory_name="insights"
   ```

## CLAUDE.md Template Example

````markdown
# {PROJECT_NAME} - CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tool Selection Guidelines

## When to Use Each Tool:
- **Native Read/Write/Edit**: Simple file operations, quick edits
- **Grep (ripgrep-powered)**: Fast pattern searching across files
- **Glob**: Finding files by name patterns
- **Serena**: Symbol-based navigation, impact analysis, memory persistence
- **Task with sub-agents**: Complex multi-step operations

## Memory Management Reminder:
Use Serena's memory features to store important project insights that should persist across sessions.

## Requirements – Important:
- Do **not** clutter the `CLAUDE.md` file with transient notes or dev context. Instead, use the `serena_mcp.write_memory` function to persist information, ensuring accessibility for future development without bloating main documentation files.

## Project Overview
{PROJECT_DESCRIPTION}

**Status**: {PROJECT_STATUS}
**Tech Stack**: {TECH_STACK}

## Project Structure

📁 **For detailed project structure, see**: [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md)

**Key directories:**

## Development Commands

### Best Practices
- **Use Grep tool for searches** (never bash grep/find)
- **Store key insights** with Serena memory for future sessions
- **Choose tools based on task**: Simple → Native, Search → Grep, Symbols → Serena
- **Let Claude decide**: Trust the AI's tool selection judgment

## When to Use Serena MCP

Serena excels at surgical symbol-based operations and cross-session memory. Use it when these capabilities add value, not as a default for everything.

### Primary Use Case: Cross-Session Memory
Store project insights that persist between sessions - architectural decisions, key patterns, important context that future Claude instances should know.

### Secondary Use Cases:
- **Large unfamiliar codebases**: Get symbol overviews instead of reading entire files
- **Impact analysis**: Find all references before making breaking changes
- **Surgical edits**: Replace specific functions without touching surrounding code

**Let Claude decide when these add value over native tools.**

## {DOMAIN_NAME} Guidelines

## Instruction for Code Comments (All Languages)

- YOU MUST comment code for readability and intent, NOT for restating the obvious. Every file must start with a short header comment describing its purpose. Every public function, class, or API must have a docblock that explains what it does, its inputs, its outputs, and edge cases.

**JavaScript/TypeScript**: Use JSDoc/TSDoc format with @fileoverview, @param, @returns, @example.
**Python**: Use PEP 257 docstrings with triple quotes; include a one-line summary, parameters, returns, and example usage.
**All languages**: Explain why a decision was made, list invariants/assumptions, and add examples where useful. Keep comments updated when code changes.

**Rule of thumb**: ALWAYS comment intent, constraints, and non-obvious logic. Code shows “what,” comments explain “why.”

## Compatibility & Migration Policy (Out-with-the-old)

**Default stance:** We do **not** preserve backward compatibility. When a change is requested, replace the old behavior with the new approach. Remove obsolete code, flags, and interfaces immediately unless the request explicitly says "keep legacy support."

### Rules for Agents & Tools

- **BREAK-FIRST mindset:** Prefer deletion and simplification over shims/adapters. No polyfills, toggles, or compatibility layers unless explicitly requested.
- **Single source of truth:** The **latest** interface/spec supersedes all prior versions. Do not consult or retain deprecated variants.
- **Migration over coexistence:** Write **forward-only** migrations. Do **not** add down-migrations unless explicitly requested.
- **Delete deprecated code now:** No deprecation windows. Remove old functions, types, env vars, config keys, and documentation in the same change.
- **Update all call sites:** Rename/replace and fix usages across the repo; do not leave aliases.
- **Tests follow the new world:** Update or replace tests to encode the new behavior. Delete tests that only assert legacy behavior.


### Versioning & Communication

- **Docs header:** Update the HTML header stamp on modified docs: `<!-- vMAJOR.MINOR | YYYY-MM-DD -->` and increment **MAJOR** on any breaking change.
- **Commit prefix:** Start the commit title with `BREAKING:` when the change removes/renames public symbols, config, or endpoints.
- **Changelog note:** Add a concise migration note (what changed, one-liner on how to migrate) in the relevant README or module doc.

### Examples (apply literally)

- **API surface:** If `getPatient()` becomes `fetchPatient()`, **remove** `getPatient()` and update all imports/usages; **no wrappers**.
- **Config keys:** If `RECALL_WINDOW_DAYS` becomes `RECALL_WINDOW`, migrate values and **delete** the old key and its references.
- **Data models:** If a column is renamed, write a one-off script to migrate; **do not** keep both columns.

> If you need compatibility, the request must say so explicitly. Otherwise, assume **out with the old, in with the new**.

```
