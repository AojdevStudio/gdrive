# Gmail Attachment Workflow

AOJ Workbench exposes Gmail through the remote Cloudflare Workers `/mcp` endpoint. Google Workspace is the upstream API surface; clients still connect only to the deployed Worker URL.

```text
https://your-worker.workers.dev/mcp
```

Do not configure MCP clients to use local stdio, local HTTP, Docker, or local bootstrap flows.

## Workflow

1. Search for messages likely to have attachments.

```json
{
  "service": "gmail",
  "operation": "searchMessages",
  "args": {
    "query": "has:attachment subject:report",
    "maxResults": 10
  }
}
```

`searchMessages` returns message IDs and thread IDs only. It does not include attachment metadata or message bodies.

2. Read message headers/body when needed.

```json
{
  "service": "gmail",
  "operation": "getMessage",
  "args": {
    "id": "MESSAGE_ID",
    "format": "full"
  }
}
```

`getMessage` returns parsed headers, snippet, labels, size estimate, and body text when Gmail includes body parts. Attachment metadata is intentionally separate.

3. List attachment metadata.

```json
{
  "service": "gmail",
  "operation": "listAttachments",
  "args": {
    "messageId": "MESSAGE_ID"
  }
}
```

**Attachment metadata** is the safe listing contract: opaque `attachmentId`, `filename`, `mimeType`, and `size`. Use the returned `attachmentId` with the next operations.

4. Download raw attachment content when exact bytes are required.

```json
{
  "service": "gmail",
  "operation": "downloadAttachment",
  "args": {
    "messageId": "MESSAGE_ID",
    "attachmentId": "ATTACHMENT_ID",
    "maxBytes": 10485760
  }
}
```

**Attachment content** is returned as raw Gmail `data` with `dataEncoding: "base64url"`. The default `maxBytes` guardrail is 10 MiB. Logs and predictable errors do not include raw attachment bytes.

5. Read decoded text when the format is supported.

```json
{
  "service": "gmail",
  "operation": "readAttachmentText",
  "args": {
    "messageId": "MESSAGE_ID",
    "attachmentId": "ATTACHMENT_ID",
    "maxBytes": 10485760,
    "maxCharacters": 200000,
    "pdfMaxPages": 50,
    "docxMaxXmlBytes": 2097152
  }
}
```

**Decoded attachment text** is UTF-8 text extracted from supported formats:

- text-like files, including `.txt`, `.csv`, `.json`, `.md`, `.xml`, `.html`, `.tsv`, `.yaml`, and `text/*`
- PDFs that already contain extractable text
- Word `.docx` files

The operation returns a typed `status`:

- `decoded`: `text` is present
- `unsupported`: the format is intentionally not parsed
- `oversize`: the attachment exceeded configured limits
- `extraction_failed`: the file claimed a supported format but could not be decoded or parsed

## Deferred Formats

AOJ Workbench does not implement OCR in this slice. Scanned PDFs, images, legacy `.doc`, non-docx Office files, and unknown binary formats return a typed unsupported/extraction result. Issue #103 remains the place to decide future OCR and broader binary parsing behavior.

## OAuth Scope Expectations

Gmail attachment reads use the same Gmail message-read access needed for message search, message retrieval, and attachment download through the Gmail API. If `searchMessages`, `getMessage`, or attachment operations return Google authorization errors, verify the deployed Worker Google OAuth state through the remote setup status route and reauthorize the Google Workspace API surface with the required Gmail scopes.
