# Developer Checklist: Google Apps Script Viewing Feature

**PRD Reference:** [Apps Script Viewing Feature PRD](/Users/ossieirondi/Projects/local-mcps/gdrive/docs/PRDs/apps-script-viewing-feature.md)
**Issue ID:** [TBD]
**Priority:** Medium
**Estimated Time:** 4 hours

## Pre-Development Setup
- [ ] Review PRD and acceptance criteria
- [ ] Set up development branch: `feature/apps-script-viewing`
- [ ] Review existing code and patterns in: `src/index.ts`, authentication flow, error handling
- [ ] Familiarize with Google Apps Script API v1 documentation
- [ ] Verify local development environment has necessary credentials

## Implementation Tasks

### Backend Development

#### 1. OAuth Scope Integration (30 minutes)
- [ ] Locate OAuth scope configuration in `src/index.ts`
- [ ] Add Apps Script read-only scope to SCOPES array:
  ```typescript
  'https://www.googleapis.com/auth/script.projects.readonly'
  ```
- [ ] Test authentication flow still works with new scope
- [ ] Verify no breaking changes to existing functionality

#### 2. Type Definitions (20 minutes)
- [ ] Create/update type definitions in `src/types.ts`:
  ```typescript
  interface AppsScriptFile {
    name: string;
    type: 'SERVER_JS' | 'HTML' | 'JSON';
    source: string;
  }
  
  interface AppsScriptContent {
    scriptId: string;
    files: AppsScriptFile[];
  }
  ```
- [ ] Add error type definitions for Apps Script API errors

#### 3. Core Tool Implementation (1.5 hours)
- [ ] Import Google Apps Script API client:
  ```typescript
  import { google } from 'googleapis';
  const script = google.script('v1');
  ```
- [ ] Add `getAppScript` tool definition in server.addTool():
  ```typescript
  {
    name: "gdrive:getAppScript",
    description: "Get Google Apps Script code by script ID",
    inputSchema: {
      type: "object",
      properties: {
        scriptId: {
          type: "string",
          description: "The Google Apps Script project ID"
        }
      },
      required: ["scriptId"]
    }
  }
  ```
- [ ] Implement tool handler with:
  - [ ] API call to retrieve script content
  - [ ] Response parsing and formatting
  - [ ] Proper error handling for all failure scenarios

#### 4. Error Handling (30 minutes)
- [ ] Handle invalid script ID errors (404)
- [ ] Handle permission denied errors (403)
- [ ] Handle API quota exceeded errors (429)
- [ ] Handle network/timeout errors
- [ ] Return consistent error format matching existing patterns

#### 5. Optional: Spreadsheet Script Discovery (45 minutes)
- [ ] Add `getAppScriptFromSpreadsheet` tool (if time permits)
- [ ] Implement logic to find container-bound scripts
- [ ] Handle cases where no script is attached
- [ ] Add appropriate error handling

### Integration Tasks
- [ ] Ensure new tools appear in MCP tool list
- [ ] Verify OAuth client properly includes new scope
- [ ] Test integration with existing error handling middleware
- [ ] Confirm logging works for new operations

## Testing Tasks

### Unit Tests
- [ ] Create `tests/apps-script.test.ts`
- [ ] Test successful script retrieval
- [ ] Test error scenarios:
  - [ ] Invalid script ID
  - [ ] Permission denied
  - [ ] Network errors
- [ ] Test response formatting
- [ ] Achieve minimum 80% code coverage
- [ ] Run: `npm run test -- apps-script.test.ts`

### Integration Tests
- [ ] Create `tests/integration/apps-script-api.test.ts`
- [ ] Test actual API calls with mock responses
- [ ] Test OAuth scope integration
- [ ] Test rate limiting handling
- [ ] Run: `npm run test:integration`

### Manual Testing
- [ ] Create test Apps Script project in Google Drive
- [ ] Test with standalone script project
- [ ] Test with script bound to Google Sheets
- [ ] Test with script containing multiple files
- [ ] Test with script user doesn't have access to
- [ ] Verify error messages are clear and helpful

## Documentation Tasks
- [ ] Update `README.md` with new tool documentation:
  - [ ] Add to tools list
  - [ ] Include usage examples
  - [ ] Document required OAuth scope
- [ ] Add inline code comments explaining:
  - [ ] API integration approach
  - [ ] Error handling logic
  - [ ] Any non-obvious implementation details
- [ ] Update `CLAUDE.md` if needed

## Review & Deployment
- [ ] Self-review code changes
- [ ] Ensure no console.log statements left in code
- [ ] Run all quality checks:
  - [ ] `npm run build`
  - [ ] `npm run test`
  - [ ] `npm run lint`
- [ ] Create PR with proper description using template
- [ ] Link PR to issue using magic words
- [ ] Address code review feedback
- [ ] Verify CI/CD pipeline passes
- [ ] Test in staging environment (if applicable)

## Post-Deployment
- [ ] Verify feature works in production
- [ ] Monitor for any error spikes in logs
- [ ] Update issue status to Done
- [ ] Document any lessons learned or follow-up improvements needed
- [ ] Consider adding Redis caching in future iteration

## Potential Challenges & Solutions

### Challenge 1: OAuth Scope Changes
- **Issue:** Adding new scope might require re-authentication
- **Solution:** Document this in release notes, provide clear re-auth instructions

### Challenge 2: API Quota Limits
- **Issue:** Apps Script API has 100 requests/100s/user limit
- **Solution:** Implement proper rate limiting, consider caching for future

### Challenge 3: Script Access Permissions
- **Issue:** Users may try to access scripts they don't have permission for
- **Solution:** Clear error messages, suggest checking script sharing settings

### Challenge 4: Large Script Files
- **Issue:** Some scripts may be very large
- **Solution:** Consider pagination or file size limits in future iteration