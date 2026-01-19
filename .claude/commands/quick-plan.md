---
description: Creates implementation specs through deep codebase analysis and exhaustive questioning
argument-hint: <feature-description>
allowed-tools: Read, Write, Edit, Grep, Glob, MultiEdit, AskUserQuestion
model: opusplan
---

# Quick Plan

Create a comprehensive implementation spec for `USER_PROMPT` by first analyzing the codebase deeply, then conducting an exhaustive interview to close all gaps and make all decisions. The final spec in `PLAN_OUTPUT_DIRECTORY` should have ZERO open questions.

## Variables

USER_PROMPT: $ARGUMENTS
PLAN_OUTPUT_DIRECTORY: specs/
MAX_QUESTIONS_PER_ROUND: 4

## Workflow

### Phase 1: Deep Codebase Analysis

1. Parse `USER_PROMPT` to identify the feature area
2. Scan project structure to understand overall architecture
3. Search for files related to the feature area (grep for keywords, glob for patterns)
4. Read key files to understand:
   - Current architecture and patterns in use
   - Existing similar features to follow as templates
   - Integration points the new feature will touch
   - Testing patterns used in the project
5. Build mental model of how this feature fits into the existing codebase

### Phase 2: Big-Picture Interview (Upfront)

Before drafting any spec sections, ask clarifying questions about:

**Vision & Constraints**
- What specific problem is this solving and for whom?
- What would make you consider this feature a failure?
- What's explicitly out of scope?
- What's the minimum viable version vs the ideal version?

Use AskUserQuestion with 2-4 questions. Challenge vague answers - push for specifics.

### Phase 3: Section-by-Section Drafting with Questions

For each spec section, draft what you know from the codebase analysis, then ask questions to fill gaps.

**Section 1: Problem Statement**
- Draft based on Phase 2 answers
- Ask: What triggered this need? What's the cost of NOT doing this?

**Section 2: Technical Requirements**
- Draft based on codebase analysis (patterns found, integration points)
- Ask: What performance constraints exist? What data models are involved?
- If multiple approaches exist, present 2-3 options with tradeoffs and a recommended default

**Section 3: Edge Cases & Error Handling**
- Draft common edge cases based on similar features in codebase
- Ask: What happens when [specific failure mode]? What's the recovery path?
- Challenge assumptions: "You said X, but what if Y happens?"

**Section 4: User Experience**
- Ask: What's the user's mental model? Where might they get confused?
- Ask: What feedback do they need at each step?

**Section 5: Scope & Tradeoffs**
- Draft based on Phase 2 scope answers
- Ask: What technical debt are you knowingly accepting?
- Present tradeoff decisions with recommended defaults

**Section 6: Integration Requirements**
- Draft based on codebase integration points found
- Ask: What other systems need to know about this?
- Ask: What's the migration path for existing data/users?

**Section 7: Security & Compliance**
- Ask: What sensitive data does this touch?
- Ask: What authentication/authorization is required?

**Section 8: Success Criteria & Testing**
- Draft based on testing patterns found in codebase
- Ask: How do you know when this is done?
- Ask: What are the acceptance criteria?

**Section 9: Testing Strategy (MANDATORY for RBP)**
- Identify test framework used in project (check package.json for jest, vitest, bun test, etc.)
- Draft unit tests required for each component/function
- Draft integration tests for system interactions
- If UI involved, note Playwright/E2E test requirements
- Specify the exact test command to run

**Section 10: Implementation Tasks (MANDATORY for RBP)**
- Break down the feature into discrete, ordered tasks
- Each task must have: ID, title, dependencies, files, acceptance criteria, and associated tests
- Order by dependency (foundation first, features second)
- Each task should be completable in a single focused session
- Tag UI tasks with `[UI]` for Playwright auto-detection

### Phase 4: Resolution Loop

After all sections are drafted:
1. Review for any remaining ambiguities or open questions
2. Use AskUserQuestion to resolve EVERY remaining unknown
3. When you don't know the answer and user is uncertain:
   - Present 2-3 concrete options with tradeoffs
   - Recommend a default option
   - Wait for confirmation before proceeding
4. Continue until the spec has ZERO open questions

### Phase 5: Write Final Spec

Generate filename from topic (kebab-case) and write to `PLAN_OUTPUT_DIRECTORY`.

## Spec Document Format

```markdown
# [Feature Name] Specification

**Generated:** [timestamp]
**Status:** Ready for Implementation
**RBP Compatible:** Yes

## Problem Statement
[Why this exists, who it's for, cost of not doing it]

## Technical Requirements
[Architecture decisions, data models, performance constraints]
[Decisions made with rationale]

## Edge Cases & Error Handling
[Specific failure modes and recovery paths]

## User Experience
[Mental model, confusion points, feedback requirements]

## Scope & Tradeoffs
[What's in/out, technical debt accepted, MVP vs ideal]

## Integration Requirements
[Systems affected, migration path]

## Security & Compliance
[Sensitive data, auth requirements]

## Success Criteria & Testing
[Acceptance criteria, test approach]

## Testing Strategy

### Test Framework
[Framework detected: jest/vitest/bun test/etc.]

### Test Command
`[exact command to run tests]`

### Unit Tests
- [ ] Test: [description] → File: `[path/to/test.test.ts]`
- [ ] Test: [description] → File: `[path/to/test.test.ts]`

### Integration Tests
- [ ] Test: [description] → File: `[path/to/test.test.ts]`

### E2E/Playwright Tests (if UI)
- [ ] Test: [description] → File: `[path/to/test.spec.ts]`

## Implementation Tasks

<!-- RBP-TASKS-START -->
### Task 1: [Title]
- **ID:** task-001
- **Dependencies:** none
- **Files:** `[file1.ts]`, `[file2.ts]`
- **Acceptance:** [What must be true when done]
- **Tests:** `[test file that validates this task]`

### Task 2: [Title]
- **ID:** task-002
- **Dependencies:** task-001
- **Files:** `[file3.ts]`
- **Acceptance:** [What must be true when done]
- **Tests:** `[test file that validates this task]`

### Task 3: [Title] [UI]
- **ID:** task-003
- **Dependencies:** task-002
- **Files:** `[component.tsx]`
- **Acceptance:** [What must be true when done]
- **Tests:** `[playwright test file]`
<!-- RBP-TASKS-END -->

## Implementation Notes
[Codebase-specific guidance: files to modify, patterns to follow]
```

## Questioning Rules

- NEVER leave questions in the spec - resolve them via AskUserQuestion
- CHALLENGE vague answers: "fast" must become "< 100ms p99"
- PROBE assumptions: "You said X works - what if it doesn't?"
- QUANTIFY everything: users, requests/sec, data volume
- When uncertain, SUGGEST 2-3 options with a recommended default
- WAIT for confirmation on suggested defaults before finalizing

## Report

After creating and saving the implementation plan:

```
Implementation Plan Created

File: PLAN_OUTPUT_DIRECTORY/<filename.md>
Topic: <brief description>
Open Questions: 0 (all resolved via interview)
Key Decisions Made:
- <decision 1>
- <decision 2>
- <decision 3>
```
