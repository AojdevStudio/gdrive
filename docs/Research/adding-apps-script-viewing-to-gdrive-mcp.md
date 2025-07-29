# Adding Google Apps Script Viewing to gdrive MCP

## Research Summary: Implementing Apps Script Code Viewing

**Date:** 2025-07-29  
**Objective:** Add read-only Apps Script code viewing capability to the existing gdrive MCP

## Current State Analysis

The existing gdrive MCP provides comprehensive Google Workspace functionality:
- ✅ File/folder operations (read, write, create, update, delete)
- ✅ Spreadsheet data manipulation (read/write cells, sheets)
- ✅ Google Forms management (create, manage)
- ✅ Google Docs editing (create, edit, format)
- ✅ Search and batch operations

**Missing:** Apps Script code viewing functionality

## Technical Requirements

### Authentication & Authorization

**Required OAuth Scopes:**
```
https://www.googleapis.com/auth/script.projects.readonly
```

This scope provides read-only access to Apps Script projects and is the minimum permission needed for viewing script code.

**Alternative Full Access Scope:**
```
https://www.googleapis.com/auth/script.projects
```

### Google Apps Script API Integration

**Primary API Endpoint:**
```
GET https://script.googleapis.com/v1/projects/{scriptId}/content
```

**Key API Methods Needed:**
- `projects.get` - Retrieve project metadata
- `projects.getContent` - Get all script files and their source code
- `projects.list` - List available script projects (optional)

### Implementation Approaches

#### Approach 1: Script ID Direct Access
```javascript
// Proposed function signature
"gdrive:getAppScript": {
  "parameters": {
    "scriptId": "string" // Direct script project ID
  }
}
```

#### Approach 2: Spreadsheet-Attached Script Discovery
```javascript
// Alternative function signature  
"gdrive:getAppScriptFromSpreadsheet": {
  "parameters": {
    "spreadsheetId": "string" // Get script attached to spreadsheet
  }
}
```

## API Response Structure

**Script Content Response:**
```json
{
  "scriptId": "abc123...",
  "files": [
    {
      "name": "Code",
      "type": "SERVER_JS", 
      "source": "function myFunction() {\n  // JavaScript code here\n}"
    },
    {
      "name": "appsscript",
      "type": "JSON",
      "source": "{\"timeZone\":\"America/New_York\",\"dependencies\":{}}"
    }
  ]
}
```

## MCP Implementation Strategy

### Step 1: Extend OAuth Configuration
Add the read-only Apps Script scope to the existing authentication flow:

```typescript
const ADDITIONAL_SCOPES = [
  'https://www.googleapis.com/auth/script.projects.readonly'
];
```

### Step 2: Add New MCP Function
Implement the new function following the existing gdrive MCP patterns:

```typescript
server.addTool({
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
});
```

### Step 3: Script ID Discovery Methods

**From Google Sheets:**
- Bound scripts can be accessed via the Sheets API
- Look for container-bound script references in spreadsheet metadata

**From Drive Search:**
- Apps Script projects appear as files with MIME type: `application/vnd.google-apps.script`
- Can be discovered through existing `gdrive:search` functionality

## Development Workflow

### Phase 1: Basic Implementation (1-2 hours)
1. Add OAuth scope to authentication configuration
2. Implement basic `getAppScript` function 
3. Handle API response parsing and formatting
4. Add error handling for invalid script IDs

### Phase 2: Enhanced Discovery (1 hour)
1. Add function to get script from spreadsheet ID
2. Integrate with existing search functionality
3. Add script project listing capability

### Phase 3: Testing & Documentation (30 minutes)
1. Test with various script types (standalone, bound to sheets)
2. Verify error handling scenarios
3. Update MCP documentation

## Technical Considerations

### Security
- **Read-only scope:** Ensures no modification capabilities
- **Script visibility:** Only scripts the authenticated user has access to
- **No execution:** Viewing code only, no script execution

### Error Handling
- Invalid script IDs
- Permission denied scenarios  
- Network/API failures
- Malformed script content

### Performance
- Apps Script API has standard quotas (100 requests/100 seconds/user)
- Consider caching for frequently accessed scripts
- Batch requests not available for this endpoint

## Integration Points

### With Existing gdrive MCP Functions
- Leverage existing OAuth client setup
- Reuse error handling patterns
- Follow existing function naming conventions
- Integrate with current logging/debugging

### User Experience
- Seamless integration with current gdrive commands
- Consistent response formatting
- Clear error messages for troubleshooting

## Expected Benefits

1. **Complete Google Workspace Coverage:** Fills the Apps Script gap in current functionality
2. **Development Workflow Enhancement:** Enable Claude to read and understand automation scripts
3. **Debugging Support:** View script source when troubleshooting spreadsheet automations
4. **Documentation Generation:** Automatically analyze and document script functionality

## Implementation Complexity: LOW

- **Effort:** ~3-4 hours total development time
- **Risk:** Minimal - read-only operations with well-documented API
- **Dependencies:** Existing gdrive MCP infrastructure
- **Testing:** Straightforward with readily available Apps Script projects

## Next Steps

1. **Proof of Concept:** Create standalone test script to verify API access
2. **MCP Integration:** Add function to existing gdrive MCP codebase  
3. **Authentication Update:** Extend OAuth scopes
4. **Testing:** Validate with real-world Apps Script projects
5. **Documentation:** Update MCP function reference

---

## Resources Referenced

- **Context7 MCP:** Google Apps Script API documentation and examples
- **EXA Research:** MCP development patterns and Node.js Google API integration
- **Google Apps Script API:** Official REST API documentation
- **Node.js Google APIs Client:** Authentication and API calling patterns

*This research provides a clear roadmap for implementing Apps Script viewing functionality with minimal development effort and maximum integration with existing systems.*