# AOJ Workbench API

AOJ Workbench exposes a remote MCP endpoint for knowledge-work provider toolkits. The target provider layer is Composio SDK sessions with managed auth.

## MCP Endpoint

```text
https://your-worker.workers.dev/mcp
```

Clients connect over Streamable HTTP. Local stdio and local HTTP are not supported MCP runtime modes.

## Tools

### `search`

Discover provider/toolkit capabilities, schemas, auth status, and execution guidance.

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

Run a selected provider toolkit operation.

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

## Legacy Direct-Google Services

The services below are the current direct-Google provider path. They are migration scaffolding and should be removed through provider replacement slices after equivalent Composio-backed behavior is green.

| Service | Operations |
|---------|------------|
| `drive` | `search`, `enhancedSearch`, `read`, `createFile`, `createFolder`, `updateFile`, `batchOperations` |
| `sheets` | `listSheets`, `readSheet`, `createSheet`, `renameSheet`, `deleteSheet`, `updateCells`, `updateFormula`, `formatCells`, `addConditionalFormat`, `freezeRowsColumns`, `setColumnWidth`, `appendRows` |
| `forms` | `createForm`, `readForm`, `addQuestion`, `listResponses` |
| `docs` | `createDocument`, `insertText`, `replaceText`, `applyTextStyle`, `insertTable` |
| `gmail` | `listMessages`, `listThreads`, `getMessage`, `getThread`, `searchMessages`, `createDraft`, `sendMessage`, `sendDraft`, `listLabels`, `createLabel`, `modifyLabels` |
| `calendar` | `listCalendars`, `getCalendar`, `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`, `quickAdd`, `checkFreeBusy` |

Use `search` for exact signatures and examples before calling `execute`.
