# AOJ Workbench API

AOJ Workbench exposes a remote MCP endpoint for Drive, Sheets, Forms, Docs, Gmail, and Calendar. Google Workspace is the upstream API surface.

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
| `gmail` | `listMessages`, `listThreads`, `getMessage`, `getThread`, `searchMessages`, `createDraft`, `sendMessage`, `sendDraft`, `listLabels`, `createLabel`, `modifyLabels`, `listAttachments`, `downloadAttachment`, `readAttachmentText`, `sendWithAttachments`, and other Gmail management operations |
| `calendar` | `listCalendars`, `getCalendar`, `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`, `quickAdd`, `checkFreeBusy` |

Use `search` for exact signatures and examples before calling `execute`.

## Gmail Attachments

AOJ Workbench separates attachment handling into three contracts:

- **Attachment metadata**: `gmail.listAttachments({ messageId })` returns `attachmentId`, `filename`, `mimeType`, and `size`.
- **Attachment content**: `gmail.downloadAttachment({ messageId, attachmentId, maxBytes? })` returns raw Gmail content as `data` with `dataEncoding: "base64url"`.
- **Decoded attachment text**: `gmail.readAttachmentText({ messageId, attachmentId, maxBytes?, maxCharacters?, pdfMaxPages?, docxMaxXmlBytes? })` returns UTF-8 text for text-like files, PDFs with extractable text, and Word `.docx` files.

`gmail.getMessage` returns message headers/body when available, but it does not embed attachment metadata. `gmail.searchMessages` returns message IDs/thread IDs; use `listAttachments` after search results with `has:attachment`.
