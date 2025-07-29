# Feature: Google Apps Script Viewing Capability

## Metadata
- **Priority:** Medium
- **Status:** Backlog
- **Assignee:** AI Agent
- **Estimate:** 4 hours
- **Issue ID:** [TBD]
- **Labels:** 
  - type:feature
  - priority:medium
  - agent-ready
  - backend
  - api-integration

## Problem Statement

### What
Add read-only Google Apps Script code viewing capability to the existing gdrive MCP server. This will enable users to retrieve and view the source code of Apps Script projects through new MCP tools.

### Why
Currently, the gdrive MCP provides comprehensive Google Workspace functionality but lacks the ability to view Apps Script code. This creates a gap in development workflows when users need to understand, debug, or document automation scripts attached to Google Sheets, Docs, or standalone projects.

### Context
Google Apps Script is widely used for automating Google Workspace tasks. The ability to view script code would complete the MCP's Google Workspace coverage and enable better debugging, documentation generation, and understanding of automated workflows.

## Acceptance Criteria
- [ ] **AC1:** New MCP tool `gdrive:getAppScript` successfully retrieves Apps Script code by script ID
- [ ] **AC2:** OAuth scope `https://www.googleapis.com/auth/script.projects.readonly` is properly integrated into authentication flow
- [ ] **AC3:** Script content is returned in a structured format with all files and their source code
- [ ] **AC4:** Error handling properly manages invalid script IDs, permission errors, and API failures
- [ ] **AC5:** Optional: Tool to discover Apps Script projects attached to spreadsheets
- [ ] **AC6:** Performance remains within API quota limits (100 requests/100 seconds/user)

## Technical Requirements

### Implementation Notes
- Integrate Google Apps Script API v1 into existing gdrive MCP infrastructure
- Follow existing patterns for OAuth client setup and error handling
- Use read-only scope to ensure security (no script execution or modification)
- Maintain consistency with current function naming conventions and response formats
- Consider Redis caching for frequently accessed scripts

### Testing Requirements
- [ ] **Unit Tests** - Framework: Jest, Coverage: 80%, Location: `tests/apps-script.test.ts`
- [ ] **Integration Tests** - Framework: Jest, Location: `tests/integration/apps-script-api.test.ts`
- [ ] **Manual Tests** - Test with various script types (standalone, container-bound)

### Dependencies
- **Blockers:** None
- **Related:** Existing OAuth authentication system
- **Files to Modify:** 
  - `src/index.ts` - Add new tool and OAuth scope
  - `src/types.ts` - Add Apps Script response types
  - `README.md` - Document new functionality
  - `package.json` - Ensure Google APIs client includes Apps Script API

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Tests written and passing (per testing requirements)
- [ ] Documentation updated (README and inline comments)
- [ ] OAuth scope added without breaking existing authentication
- [ ] Manual verification completed with real Apps Script projects

## Agent Context

### Reference Materials
- Google Apps Script API v1 documentation: https://developers.google.com/apps-script/api/reference/rest
- OAuth scope reference: https://developers.google.com/identity/protocols/oauth2/scopes#script
- Existing gdrive MCP patterns in `src/index.ts`
- Node.js Google APIs client documentation

### Integration Points
- Google Apps Script API endpoints:
  - `GET /v1/projects/{scriptId}/content` - Get script content
  - `GET /v1/projects/{scriptId}` - Get project metadata
- OAuth2 client in existing authentication flow
- Error handling middleware
- Redis cache manager (optional enhancement)

## Validation Steps

### Automated Verification
- [ ] Build pipeline passes
- [ ] All tests green
- [ ] TypeScript compilation successful
- [ ] ESLint checks pass

### Manual Verification
1. **Step 1:** Authenticate with updated OAuth scope
2. **Step 2:** Create test Apps Script project in Google Drive
3. **Step 3:** Use `gdrive:getAppScript` with valid script ID - verify code retrieval
4. **Step 4:** Test with invalid script ID - verify error handling
5. **Step 5:** Test with script user doesn't have access to - verify permission error
6. **Step 6:** Test with container-bound script (attached to Sheet) if implemented

## Agent Execution Record

### Branch Strategy
- **Name Format:** feature/apps-script-viewing
- **Linear Example:** feature/ENG-XXX-apps-script-viewing
- **GitHub Example:** feature/#XXX-apps-script-viewing

### PR Strategy
Link to this issue using magic words in PR description

### Implementation Approach
1. Extend OAuth scopes in authentication configuration
2. Add new `getAppScript` tool following existing MCP patterns
3. Implement Google Apps Script API client calls
4. Add comprehensive error handling
5. Optional: Add script discovery from spreadsheets
6. Update documentation and add tests

### Completion Notes
[To be filled during implementation]

### PR Integration
- **Linear Magic Words:** Fixes ENG-XXX
- **GitHub Magic Words:** Closes #XXX
- **Auto Close Trigger:** PR merge to main/master branch
- **Status Automation:** Issue will auto-move from 'In Progress' to 'Done'

### Debug References
[To be filled during implementation]

### Change Log
[Track changes made during implementation]

## Bot Automation Integration

### Branch Naming for Auto-Linking

#### Linear Examples
- feature/ENG-XXX-apps-script-viewing
- feature/ENG-XXX-script-viewer

#### GitHub Examples
- feature/#XXX-apps-script-viewing
- feature/#XXX-script-viewer

### PR Description Template
```markdown
## Description
Add Google Apps Script viewing capability to gdrive MCP server

**Linked Issues:**
- Fixes ENG-XXX

## Changes
- Added new OAuth scope for Apps Script read-only access
- Implemented `gdrive:getAppScript` tool
- Added comprehensive error handling
- Updated documentation

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing with real Apps Script projects completed
```