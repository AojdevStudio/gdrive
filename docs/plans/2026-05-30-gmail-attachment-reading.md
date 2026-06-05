# AOJ Workbench Gmail Attachment Reading Implementation Plan

**Goal:** Implement end-to-end Gmail attachment discovery, raw download, and decoded text reading for AOJ Workbench issues #97, #98, #99, #100, and #102 while leaving #103 deferred.

**Architecture:** Keep the remote-only Cloudflare Workers `/mcp` boundary and the existing operation-based SDK model. Preserve `downloadAttachment` callers by adding optional guardrail/contract fields, then add `readAttachmentText` as the text-decoding operation for text-like content, extractable PDFs, and `.docx` files.

**Tech Stack:** TypeScript, Jest, googleapis Gmail v1, Cloudflare Workers with `nodejs_compat`, `pdfjs-dist`, `jszip`, `@xmldom/xmldom`.

---

### Task 1: Lock The Existing Attachment Discovery Contract

**Files:**
- Modify: `src/sdk/spec.ts`
- Modify: `src/tools/listTools.ts`
- Modify: `docs/Developer-Guidelines/API.md`
- Test: `src/modules/gmail/__tests__/attachments.test.ts`

**Steps:**
1. Add tests showing `listAttachments` returns metadata for messages with and without attachments.
2. Update SDK spec text so `getMessage` returns message body/header details and does not claim `attachments?`.
3. Update SDK spec text so `searchMessages` returns message summaries only and tells callers to use `getMessage` and `listAttachments`.
4. Update list-tools search output for the same contract.
5. Run `npm test -- src/modules/gmail/__tests__/attachments.test.ts src/__tests__/tools/listTools.test.ts`.

### Task 2: Harden Raw Attachment Download

**Files:**
- Modify: `src/modules/gmail/types.ts`
- Modify: `src/modules/gmail/attachments.ts`
- Test: `src/modules/gmail/__tests__/attachments.test.ts`

**Steps:**
1. Extend `DownloadAttachmentOptions` with optional `maxBytes`.
2. Extend `DownloadAttachmentResult` with `dataEncoding: 'base64url'` and `maxBytes`.
3. Add default size guardrails before and after Gmail attachment fetch.
4. Throw predictable, non-content-bearing errors for missing metadata, oversize data, and Gmail API failures.
5. Verify existing `messageId` + `attachmentId` callers still receive `data`.

### Task 3: Add Decoded Attachment Text

**Files:**
- Modify: `src/modules/gmail/types.ts`
- Modify: `src/modules/gmail/attachments.ts`
- Modify: `src/modules/gmail/index.ts`
- Modify: `src/sdk/types.ts`
- Modify: `src/sdk/runtime.ts`
- Modify: `src/sdk/spec.ts`
- Modify: `src/tools/listTools.ts`
- Test: `src/modules/gmail/__tests__/attachments.test.ts`
- Test: `src/__tests__/sdk/runtime-rate-limiter-scope.test.ts`

**Steps:**
1. Add `readAttachmentText` options/result types.
2. Decode text-like MIME types as UTF-8 with explicit truncation metadata.
3. Extract PDF text with `pdfjs-dist` under `pdfMaxPages`.
4. Extract `.docx` text by reading `word/document.xml` from the zip and parsing WordprocessingML text nodes.
5. Return typed unsupported/oversize/extraction-failed results for binary, scanned/OCR, legacy `.doc`, non-docx Office, malformed base64url, and unknown binary inputs.
6. Add SDK runtime/spec/search output coverage.

### Task 4: Document The Workflow And Naming Boundary

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/Developer-Guidelines/API.md`
- Create: `docs/Guides/09-gmail-attachment-workflow.md`

**Steps:**
1. Align edited docs on **AOJ Workbench** as canonical product name.
2. Document search -> metadata -> raw content -> decoded text.
3. Distinguish attachment metadata, attachment content, and decoded attachment text.
4. Document Gmail OAuth scope expectations and unsupported #103 formats.
5. Preserve remote-only `/mcp` guidance and avoid local stdio/local HTTP/Docker/bootstrap instructions.

### Task 5: Verify And Ship

**Commands:**
- `npm test -- src/modules/gmail/__tests__/attachments.test.ts src/__tests__/sdk/runtime-rate-limiter-scope.test.ts src/__tests__/tools/listTools.test.ts`
- `npm run type-check`
- `npm run build`
- MCP search output and execute smoke calls against the deployed Worker `/mcp`.
- Live Worker smoke against disposable labeled text, PDF, and DOCX Gmail attachments.
- Local `/review`; resolve all P0/P1/P2 findings.
- Push branch, open PR, monitor CI/review requirements, and merge only when allowed.
