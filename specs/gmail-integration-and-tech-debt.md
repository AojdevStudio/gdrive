---
status: partially_implemented
reviewer: GPT-5.2
date: 2026-01-12
grade: B
---

# Gmail Integration & Technical Debt Remediation Plan

**Created:** 2025-12-22
**Status:** Planning
**Version Target:** v3.2.0
**Scope:** Gmail API integration + Documentation updates + Technical debt cleanup

---

## Executive Summary

Add Gmail email functionality (read, compose, send) to the gdrive MCP server following the established operation-based architecture pattern. This includes updating all documentation and performing a comprehensive technical debt scan.

---

## Part 1: Gmail Integration

### 1.1 Problem Statement

The gdrive MCP server currently supports Drive, Sheets, Forms, and Docs APIs but lacks email functionality. Users need the ability to:
- Read emails and threads
- Compose new emails
- Send emails (with attachments)
- Search/filter emails
- Manage labels

### 1.2 Technical Approach

**Follow existing architecture pattern:**
- Single `gmail` tool with `operation` parameter
- Module structure in `src/modules/gmail/`
- Shared context pattern with `GmailContext`
- Progressive disclosure via `gdrive://tools` resource

### 1.3 OAuth Scope Addition

**File:** `index.ts` (lines 710-716)

```typescript
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/forms",
  "https://www.googleapis.com/auth/script.projects.readonly",
  // NEW: Gmail scopes
  "https://www.googleapis.com/auth/gmail.readonly",    // Read emails
  "https://www.googleapis.com/auth/gmail.send",        // Send emails
  "https://www.googleapis.com/auth/gmail.compose",     // Compose drafts
  "https://www.googleapis.com/auth/gmail.modify",      // Modify labels
];
```

**Note:** Users will need to re-authenticate after scope addition.

### 1.4 Gmail Module Structure

```
src/modules/gmail/
├── index.ts           # Barrel exports all operations
├── types.ts           # Gmail-specific interfaces
├── list.ts            # listMessages(), listThreads()
├── read.ts            # getMessage(), getThread()
├── search.ts          # searchMessages() with Gmail query syntax
├── compose.ts         # createDraft(), updateDraft()
├── send.ts            # sendMessage(), sendDraft()
├── labels.ts          # listLabels(), modifyLabels()
└── attachments.ts     # getAttachment(), addAttachment()
```

### 1.5 Gmail Operations (10 total)

| Operation | Description | Gmail API Method |
|-----------|-------------|------------------|
| `listMessages` | List messages with optional filters | `users.messages.list` |
| `listThreads` | List email threads | `users.threads.list` |
| `getMessage` | Get full message content | `users.messages.get` |
| `getThread` | Get full thread with messages | `users.threads.get` |
| `searchMessages` | Search with Gmail query syntax | `users.messages.list` with `q` |
| `createDraft` | Create email draft | `users.drafts.create` |
| `sendMessage` | Send new email | `users.messages.send` |
| `sendDraft` | Send existing draft | `users.drafts.send` |
| `listLabels` | List all labels | `users.labels.list` |
| `modifyLabels` | Add/remove labels from message | `users.messages.modify` |

### 1.6 Tool Registration

**File:** `index.ts` (add to ListToolsRequestSchema handler)

```typescript
{
  name: "gmail",
  description: "Google Gmail operations. Read gdrive://tools resource to see available operations.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: [
          "listMessages",
          "listThreads",
          "getMessage",
          "getThread",
          "searchMessages",
          "createDraft",
          "sendMessage",
          "sendDraft",
          "listLabels",
          "modifyLabels"
        ],
        description: "Operation to perform"
      },
      params: {
        type: "object",
        description: "Operation-specific parameters. See gdrive://tools for details."
      }
    },
    required: ["operation", "params"]
  }
}
```

### 1.7 Context Type Addition

**File:** `src/modules/types.ts`

```typescript
import type { gmail_v1 } from 'googleapis';

export interface GmailContext extends BaseContext {
  gmail: gmail_v1.Gmail;
}
```

### 1.8 Key Implementation Files

#### `src/modules/gmail/types.ts`
```typescript
export interface ListMessagesOptions {
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

export interface MessageResult {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  from: string;
  to: string[];
  subject: string;
  date: string;
  body?: {
    plain?: string;
    html?: string;
  };
  attachments?: AttachmentMeta[];
}

export interface SendMessageOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: AttachmentInput[];
  replyTo?: string;
  inReplyTo?: string;  // For threading
  references?: string; // For threading
}

export interface AttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface AttachmentInput {
  filename: string;
  mimeType: string;
  content: string;  // Base64 encoded
}
```

#### `src/modules/gmail/send.ts` (Example)
```typescript
import type { GmailContext } from '../types.js';
import type { SendMessageOptions, MessageResult } from './types.js';

export async function sendMessage(
  options: SendMessageOptions,
  context: GmailContext
): Promise<MessageResult> {
  const { to, cc, bcc, subject, body, isHtml, attachments, replyTo, inReplyTo, references } = options;

  // Build RFC 2822 email message
  const boundary = `boundary_${Date.now()}`;
  const hasAttachments = attachments && attachments.length > 0;

  let email = [
    `To: ${to.join(', ')}`,
    cc ? `Cc: ${cc.join(', ')}` : '',
    bcc ? `Bcc: ${bcc.join(', ')}` : '',
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : '',
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    references ? `References: ${references}` : '',
    `MIME-Version: 1.0`,
  ].filter(Boolean);

  if (hasAttachments) {
    email.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    email.push('');
    email.push(`--${boundary}`);
  }

  email.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
  email.push('');
  email.push(body);

  // Add attachments
  if (hasAttachments) {
    for (const attachment of attachments!) {
      email.push(`--${boundary}`);
      email.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
      email.push('Content-Transfer-Encoding: base64');
      email.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      email.push('');
      email.push(attachment.content);
    }
    email.push(`--${boundary}--`);
  }

  const rawMessage = Buffer.from(email.join('\r\n')).toString('base64url');

  const response = await context.gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMessage },
  });

  context.performanceMonitor.track('gmail:sendMessage', Date.now() - context.startTime);

  // Fetch full message to return
  const fullMessage = await context.gmail.users.messages.get({
    userId: 'me',
    id: response.data.id!,
    format: 'full',
  });

  return parseMessage(fullMessage.data);
}

function parseMessage(message: gmail_v1.Schema$Message): MessageResult {
  // Parse headers and body
  // ... implementation
}
```

### 1.9 Dispatch Handler Addition

**File:** `index.ts` (add to CallToolRequestSchema handler)

```typescript
case "gmail": {
  const gmailModule = await import('./src/modules/gmail/index.js');

  switch (operation) {
    case "listMessages":
      result = await gmailModule.listMessages(params as ListMessagesOptions, gmailContext);
      break;
    case "listThreads":
      result = await gmailModule.listThreads(params as ListThreadsOptions, gmailContext);
      break;
    case "getMessage":
      result = await gmailModule.getMessage(params as GetMessageOptions, gmailContext);
      break;
    case "getThread":
      result = await gmailModule.getThread(params as GetThreadOptions, gmailContext);
      break;
    case "searchMessages":
      result = await gmailModule.searchMessages(params as SearchOptions, gmailContext);
      break;
    case "createDraft":
      result = await gmailModule.createDraft(params as CreateDraftOptions, gmailContext);
      break;
    case "sendMessage":
      result = await gmailModule.sendMessage(params as SendMessageOptions, gmailContext);
      break;
    case "sendDraft":
      result = await gmailModule.sendDraft(params as SendDraftOptions, gmailContext);
      break;
    case "listLabels":
      result = await gmailModule.listLabels(params as ListLabelsOptions, gmailContext);
      break;
    case "modifyLabels":
      result = await gmailModule.modifyLabels(params as ModifyLabelsOptions, gmailContext);
      break;
    default:
      throw new Error(`Unknown gmail operation: ${operation}`);
  }
  break;
}
```

---

## Part 2: Documentation Updates

### 2.1 Files to Update

| File | Updates Required |
|------|------------------|
| `README.md` | Add Gmail to features, commands, examples |
| `CLAUDE.md` | Add Gmail to key commands, architecture section |
| `docs/index.md` | Add Gmail section to index |
| `docs/Architecture/ARCHITECTURE.md` | Add Gmail module to architecture diagram |
| `docs/Developer-Guidelines/API.md` | Add complete Gmail API reference |
| `docs/Guides/` | Create `gmail-setup.md` guide |
| `docs/Troubleshooting/` | Add Gmail-specific troubleshooting |
| `src/tools/listTools.ts` | Add Gmail operations to tool discovery |
| `package.json` | Update description to include Gmail |

### 2.2 New Documentation Files

#### `docs/Guides/gmail-setup.md`
```markdown
# Gmail Integration Setup Guide

## Prerequisites
- Existing gdrive MCP authentication
- Gmail API enabled in Google Cloud Console

## Re-authentication Required
After updating to v3.2.0, users must re-authenticate to grant Gmail permissions:
\`\`\`bash
node ./dist/index.js auth
\`\`\`

## Gmail Query Syntax
The searchMessages operation supports Gmail's native query syntax:
- `from:user@example.com` - Filter by sender
- `to:me` - Messages sent to you
- `subject:meeting` - Search subjects
- `has:attachment` - Messages with attachments
- `after:2025/01/01` - Date filtering
- `is:unread` - Unread messages
- `label:inbox` - Label filtering

## Examples
[Include 5-10 practical examples]
```

### 2.3 Tool Discovery Update

**File:** `src/tools/listTools.ts`

Add Gmail operations to the hardcoded structure:

```typescript
gmail: [
  {
    name: "listMessages",
    signature: "listMessages({ maxResults?: number, labelIds?: string[], pageToken?: string })",
    description: "List messages in user's mailbox with optional filters",
    example: "gmail.listMessages({ maxResults: 10, labelIds: ['INBOX'] })"
  },
  {
    name: "getMessage",
    signature: "getMessage({ id: string, format?: 'minimal' | 'full' | 'raw' })",
    description: "Get a specific message by ID with full content",
    example: "gmail.getMessage({ id: '18c123abc', format: 'full' })"
  },
  {
    name: "searchMessages",
    signature: "searchMessages({ query: string, maxResults?: number })",
    description: "Search messages using Gmail query syntax",
    example: "gmail.searchMessages({ query: 'from:boss@company.com is:unread' })"
  },
  {
    name: "sendMessage",
    signature: "sendMessage({ to: string[], subject: string, body: string, ... })",
    description: "Compose and send a new email message",
    example: "gmail.sendMessage({ to: ['user@example.com'], subject: 'Hello', body: 'Hi there!' })"
  },
  // ... other operations
]
```

---

## Part 3: Technical Debt Remediation

### 3.1 Identified Technical Debt Items

| Item | Location | Severity | Action |
|------|----------|----------|--------|
| Deprecated listTools function | `src/tools/listTools.ts:147` | Low | Remove deprecated code block |
| Skipped integration tests | `src/__tests__/integration/addQuestion-integration.test.ts` | Medium | Rewrite or remove |
| TODO: Rewrite for v2.0.0 | `src/__tests__/integration/addQuestion-integration.test.ts:4,39,61` | Medium | Complete rewrite |
| Legacy handler files | `src/drive/`, `src/sheets/`, `src/forms/`, `src/docs/` | High | Archive or remove (superseded by modules/) |
| Potential duplicate exports | `src/modules/` vs legacy handlers | Medium | Consolidate |

### 3.2 Legacy Handler Cleanup

**Current State:** Both legacy handlers (`src/drive/`, `src/sheets/`, etc.) and new modules (`src/modules/`) exist.

**Action:** Verify legacy handlers are not imported, then archive:
```bash
mkdir -p archive/legacy-handlers-v2
mv src/drive src/sheets src/forms src/docs archive/legacy-handlers-v2/
```

### 3.3 Test Suite Cleanup

**File:** `src/__tests__/integration/addQuestion-integration.test.ts`

Options:
1. **Delete** if v3.x has equivalent coverage
2. **Rewrite** to match v3.x operation-based pattern
3. **Archive** for reference

**Recommended:** Delete and add new Gmail-focused integration tests.

### 3.4 Code Quality Improvements

| Area | Current State | Improvement |
|------|---------------|-------------|
| Error messages | Generic | Add operation-specific error codes |
| Logging | Inconsistent | Standardize log format across modules |
| Cache keys | String concatenation | Use structured cache key builder |
| Type exports | Mixed | Consolidate all types in types.ts |

### 3.5 Full Repository Scan Checklist

- [ ] Remove all `// TODO` comments or convert to issues
- [ ] Remove all `// FIXME` comments or fix
- [ ] Remove all `describe.skip` tests or enable
- [ ] Remove deprecated code blocks
- [ ] Update all version references to v3.2.0
- [ ] Verify no unused imports
- [ ] Run ESLint with `--fix`
- [ ] Update all documentation dates

---

## Implementation Steps

### Phase 1: Gmail Foundation (Days 1-2)
1. Add Gmail OAuth scope to `index.ts`
2. Create `src/modules/gmail/types.ts` with all interfaces
3. Create `src/modules/gmail/index.ts` barrel export
4. Add `GmailContext` to `src/modules/types.ts`
5. Initialize Gmail API client in `index.ts`

### Phase 2: Gmail Operations (Days 3-5)
1. Implement `list.ts` (listMessages, listThreads)
2. Implement `read.ts` (getMessage, getThread)
3. Implement `search.ts` (searchMessages)
4. Implement `compose.ts` (createDraft, updateDraft)
5. Implement `send.ts` (sendMessage, sendDraft)
6. Implement `labels.ts` (listLabels, modifyLabels)

### Phase 3: Integration (Day 6)
1. Add gmail tool registration
2. Add dispatch handler cases
3. Update `gdrive://tools` resource
4. Test all 10 operations manually

### Phase 4: Documentation (Day 7)
1. Update README.md
2. Update CLAUDE.md
3. Create gmail-setup.md guide
4. Update API.md with Gmail reference
5. Update ARCHITECTURE.md

### Phase 5: Technical Debt (Day 8)
1. Run full repository scan
2. Remove deprecated code
3. Archive legacy handlers
4. Fix or remove skipped tests
5. Run ESLint --fix

### Phase 6: Testing & Release (Days 9-10)
1. Write unit tests for all Gmail operations
2. Write integration tests
3. Update CHANGELOG.md
4. Bump version to 3.2.0
5. Create release

---

## Testing Strategy

### Unit Tests
- Test each Gmail operation in isolation
- Mock Gmail API responses
- Test error handling for common failures
- Test RFC 2822 message building

### Integration Tests
- Test full flow: compose -> send -> read
- Test attachment handling
- Test threading (replies)
- Test label management

### Manual Testing Checklist
- [ ] List inbox messages
- [ ] Search with complex query
- [ ] Read full message with attachments
- [ ] Send plain text email
- [ ] Send HTML email with attachment
- [ ] Reply to thread
- [ ] Create and send draft
- [ ] Add/remove labels

---

## Success Criteria

1. **Gmail Operations:** All 10 operations functional and tested
2. **Documentation:** All docs updated with Gmail references
3. **Tech Debt:** All identified items resolved
4. **Tests:** 90%+ coverage on new Gmail code
5. **Breaking Changes:** None (additive only, existing tools unchanged)
6. **Re-auth Flow:** Clear instructions for scope upgrade

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OAuth scope rejection | Medium | High | Document re-auth clearly |
| Rate limiting | Low | Medium | Implement exponential backoff |
| Attachment size limits | Medium | Medium | Document 25MB Gmail limit |
| Threading complexity | Medium | Low | Start with simple reply-to |

---

## Approval Required

**Before proceeding, confirm:**
- [ ] Gmail scope addition acceptable
- [ ] Re-authentication requirement acceptable
- [ ] 10 operations scope correct
- [ ] Tech debt cleanup scope approved

**Approved by:** _________________
**Date:** _________________

---

## Questions for Clarification

1. Should we support Gmail send-as (sending from aliases)?
2. Should we support Gmail signatures?
3. Should we support draft scheduling?
4. Priority: Gmail attachments vs. simplicity first?
5. Should Calendar API be considered for future scope?
