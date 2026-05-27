# Google Workspace MCP API (v4.0.0-alpha)

## Overview

The v4 server exposes a minimal MCP API with **two tools only**:

- `search` - discover available SDK services and operations
- `execute` - run a specific Google Workspace operation with structured arguments

The runtime provides **47 operations** across:

- `drive` (7)
- `sheets` (12)
- `forms` (4)
- `docs` (5)
- `gmail` (10)
- `calendar` (9)

## Architecture Shift (v2/v3 -> v4)

v4 replaces both:

- operation-routed tools (`{ name: "sheets", operation: "..." }`)
- import-based code execution examples (`import { readSheet } from ...`)

with a single pattern:

1. discover via `search`
2. execute via `execute` using `{ "service": "...", "operation": "...", "args": ... }`

## Tool Reference

## `search`

Returns operation metadata from `src/sdk/spec.ts`.

### Input

```json
{
  "service": "drive | sheets | forms | docs | gmail | calendar (optional)",
  "operation": "string (optional)"
}
```

### Behavior

- `{}` -> returns summary of all services and operation names
- `{ "service": "drive" }` -> returns all Drive operation specs
- `{ "service": "drive", "operation": "search" }` -> returns one operation spec

### Example

```json
{
  "name": "search",
  "arguments": {
    "service": "sheets",
    "operation": "readSheet"
  }
}
```

## `execute`

Runs one Google Workspace operation through the Worker runtime.

### Input

```json
{
  "service": "drive",
  "operation": "search",
  "args": {
    "query": "budget"
  }
}
```

### Output

```json
{
  "result": {},
  "result": {}
}
```

On failure, returns an error payload (`isError: true`) with a message.

## Recommended Usage Flow

### Step 1: Discover

```json
{
  "name": "search",
  "arguments": {
    "service": "calendar"
  }
}
```

### Step 2: Execute

```json
{
  "name": "execute",
  "arguments": {
    "service": "calendar",
    "operation": "listEvents",
    "args": {
      "calendarId": "primary",
      "maxResults": 10
    }
  }
}
```

## SDK Operation Catalog

## Drive (7)

- `search`
- `enhancedSearch`
- `read`
- `createFile`
- `createFolder`
- `updateFile`
- `batchOperations`

## Sheets (12)

- `listSheets`
- `readSheet`
- `createSheet`
- `renameSheet`
- `deleteSheet`
- `updateCells`
- `updateFormula`
- `formatCells`
- `addConditionalFormat`
- `freezeRowsColumns`
- `setColumnWidth`
- `appendRows`

## Forms (4)

- `createForm`
- `readForm`
- `addQuestion`
- `listResponses`

## Docs (5)

- `createDocument`
- `insertText`
- `replaceText`
- `applyTextStyle`
- `insertTable`

## Gmail (10)

- `listMessages`
- `listThreads`
- `getMessage`
- `getThread`
- `searchMessages`
- `createDraft`
- `sendMessage`
- `sendDraft`
- `listLabels`
- `modifyLabels`

## Calendar (9)

- `listCalendars`
- `getCalendar`
- `listEvents`
- `getEvent`
- `createEvent`
- `updateEvent`
- `deleteEvent`
- `quickAdd`
- `checkFreeBusy`

## Practical Examples

### Drive search and read

```json
{
  "name": "execute",
  "arguments": {
    "code": "const files = await sdk.drive.search({ query: 'Q4 budget', pageSize: 5 }); if (!files.files.length) return null; const first = files.files[0]; const content = await sdk.drive.read({ fileId: first.id }); return { file: first, contentPreview: content.content.slice(0, 500) };"
  }
}
```

### Sheets conditional formatting

```json
{
  "name": "execute",
  "arguments": {
    "code": "return await sdk.sheets.addConditionalFormat({ spreadsheetId: 'YOUR_SHEET_ID', range: 'Sheet1!B2:B100', rule: { condition: { type: 'NUMBER_GREATER', values: ['90'] }, format: { backgroundColor: { red: 0.7, green: 1, blue: 0.7 }, bold: true } } });"
  }
}
```

### Send email

```json
{
  "name": "execute",
  "arguments": {
    "service": "gmail",
    "operation": "sendMessage",
    "args": {
      "to": "recipient@example.com",
      "subject": "Status update",
      "body": "All checks passed."
    }
  }
}
```

### Calendar free/busy

```json
{
  "name": "execute",
  "arguments": {
    "service": "calendar",
    "operation": "checkFreeBusy",
    "args": {
      "timeMin": "2026-05-27T09:00:00Z",
      "timeMax": "2026-05-28T09:00:00Z",
      "items": [{ "id": "primary" }]
    }
  }
}
```

## Authentication and Scopes

Required OAuth scopes are configured in the Worker remote OAuth setup handler:

- Drive: `https://www.googleapis.com/auth/drive`
- Sheets: `https://www.googleapis.com/auth/spreadsheets`
- Docs: `https://www.googleapis.com/auth/documents`
- Forms: `https://www.googleapis.com/auth/forms`
- Script readonly: `https://www.googleapis.com/auth/script.projects.readonly`
- Gmail:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/gmail.compose`
  - `https://www.googleapis.com/auth/gmail.modify`
- Calendar:
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/calendar.events`

## Error Handling Guidance

When calling `execute`:

- validate the operation arguments before sending the MCP request
- use `search` to inspect required parameters and examples
- handle `isError: true` responses as operation failures
- use `console.error(...)` for debugging context (captured in `logs`)

Example:

```js
const result = await sdk.drive.search({ query: "invoice 2026", pageSize: 10 });
if (!result.files.length) {
  return { status: "empty", message: "No matching files" };
}
return { status: "ok", files: result.files };
```

## Performance Notes

- prefer one `execute` block for multi-step workflows instead of many small calls
- filter/transform data inside execute code before returning
- use `pageSize` intentionally on list/search operations
- use operation-level filters and page sizes to keep Worker responses bounded

## Migration Notes

When migrating legacy prompts or integrations:

- replace old tool names with `search` + `execute`
- replace operation payloads with `sdk.<service>.<operation>` calls
- replace legacy Sheets names:
  - `updateCellsWithFormula` -> `updateFormula`
  - `addConditionalFormatting` -> `addConditionalFormat`

## Related Docs

- `docs/Architecture/ARCHITECTURE.md`
- `docs/Deployment/DOCKER.md`
- `docs/Examples/README.md`
- `docs/Guides/README.md`
