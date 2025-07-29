# [TYPE] Brief descriptive title

## Metadata
- **Priority:** [Urgent | High | Medium | Low]
- **Status:** [Backlog | Todo | In Progress | In Review | Done]
- **Assignee:** [AI Agent | Human | Unassigned]
- **Estimate:** [Story Points/Hours]
- **Issue ID:** [ENG-XXX] or [#XXX]
- **Labels:** 
  - type:feature
  - priority:high
  - agent-ready
  - frontend

## Problem Statement

### What
Clear description of what needs to be built or fixed

### Why
Business justification or user impact

### Context
Relevant background without overwhelming detail

## Acceptance Criteria
- [ ] **AC1:** Specific, testable outcome that defines success
- [ ] **AC2:** Specific, testable outcome that defines success
- [ ] **AC3:** Specific, testable outcome that defines success

## Technical Requirements

### Implementation Notes
- Key technical constraints or patterns to follow
- Integration points with existing code
- Performance or security considerations
- Architecture decisions that must be respected

### Testing Requirements
- [ ] **Unit Tests** - Framework: [Framework], Coverage: [%], Location: [path]
- [ ] **Integration Tests** - Framework: [Framework], Location: [path]
- [ ] **E2E Tests** - Framework: [Framework], Location: [path]

### Dependencies
- **Blockers:** Issues that must be completed first
- **Related:** Connected but not blocking issues
- **Files to Modify:** Specific file paths if known

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Tests written and passing (per testing requirements)
- [ ] Documentation updated (if applicable)
- [ ] Deployed to [environment]
- [ ] Manual verification completed

## Agent Context

### Reference Materials
- API documentation links
- Design files or mockups
- Relevant code examples or patterns
- Architecture documents (if needed)

### Integration Points
- Database schema considerations
- API endpoints affected
- UI components involved
- External service integrations

## Validation Steps

### Automated Verification
- [ ] Build pipeline passes
- [ ] All tests green
- [ ] Code quality checks pass
- [ ] Security scans clean

### Manual Verification
1. **Step 1:** Specific testing instruction
2. **Step 2:** Expected behavior description
3. **Step 3:** Edge cases to verify
4. **Step 4:** How to confirm AC completion

## Agent Execution Record

### Branch Strategy
- **Name Format:** feature/[issue-id]-brief-description
- **Linear Example:** feature/ENG-123-user-auth
- **GitHub Example:** feature/#45-dashboard-fix

### PR Strategy
Link to this issue using magic words in PR description

### Implementation Approach
[Brief description of solution approach]

### Completion Notes
- Key implementation decisions made
- Any deviations from original requirements
- Lessons learned or improvements identified

### PR Integration
- **Linear Magic Words:** Fixes ENG-XXX
- **GitHub Magic Words:** Closes #XXX
- **Auto Close Trigger:** PR merge to main/master branch
- **Status Automation:** Issue will auto-move from 'In Progress' to 'Done'

### Debug References
- Link to debug logs (if applicable)
- Performance metrics captured
- Error handling validation

### Change Log
[Track changes made during implementation]

## Bot Automation Integration

### Branch Naming for Auto-Linking

#### Linear Examples
- feature/ENG-123-brief-description
- bugfix/ENG-456-fix-login

#### GitHub Examples
- feature/#78-user-dashboard
- hotfix/#91-security-patch

### PR Description Template
```markdown
## Description
Brief description of changes

**Linked Issues:**
- Fixes ENG-123
- Resolves ENG-456
- Closes ENG-789

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
```
