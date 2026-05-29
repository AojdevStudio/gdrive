# Google Workspace MCP API

Google Workspace MCP exposes a remote MCP endpoint for Drive, Sheets, Forms, Docs, Gmail, and Calendar.

## MCP Endpoint

```text
https://your-worker.workers.dev/mcp
```

Clients connect over Streamable HTTP. Local stdio and local HTTP are not supported MCP runtime modes.

## Tools

### `search`

Discover services, operations, signatures, parameters, and examples.

```json
{
  "tool": "search",
  "args": {
    "service": "gmail",
    "operation": "sendMessage"
  }
}
```

### `execute`

Run a specific Workspace operation.

```json
{
  "tool": "execute",
  "args": {
    "service": "gmail",
    "operation": "sendMessage",
    "args": {
      "to": "team@example.com",
      "subject": "Status",
      "body": "The update is ready."
    }
  }
}
```

## Services

| Service | Operations |
|---------|------------|
| `drive` | `search`, `enhancedSearch`, `read`, `createFile`, `createFolder`, `updateFile`, `batchOperations` |
| `sheets` | `listSheets`, `readSheet`, `createSheet`, `renameSheet`, `deleteSheet`, `updateCells`, `updateFormula`, `formatCells`, `addConditionalFormat`, `freezeRowsColumns`, `setColumnWidth`, `appendRows` |
| `forms` | `createForm`, `readForm`, `addQuestion`, `listResponses` |
| `docs` | `createDocument`, `insertText`, `replaceText`, `applyTextStyle`, `insertTable` |
| `gmail` | `listMessages`, `listThreads`, `getMessage`, `getThread`, `searchMessages`, `createDraft`, `sendMessage`, `sendDraft`, `listLabels`, `createLabel`, `modifyLabels` |
| `calendar` | `listCalendars`, `getCalendar`, `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`, `quickAdd`, `checkFreeBusy` |

Use `search` for exact signatures and examples before calling `execute`.
