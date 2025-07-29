---
allowed-tools: Bash, Edit, Grep, MultiEdit, Read, TodoWrite, WebFetch, Write
description: Create pull requests for completed work with automatic context gathering
---

# Create PR

Use the pr-specialist sub-agent to create comprehensive pull requests for completed work with automatic context gathering. Parse $ARGUMENTS for title, branches, and Linear task ID, gather context from git history and changed files, validate readiness (commits, tests, linting), generate structured PR content with conventional format and checklist, create PR via gh CLI with labels and reviewers, and provide PR URL and next steps.
