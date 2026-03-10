# Email Outreach Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email outreach capabilities to gdrive MCP — template rendering, batch sending, dry-run preview, sheet-as-records, and tracking infrastructure.

**Architecture:** Thin wrappers over existing `buildEmailMessage()` + `sendMessage()` for P0. New CF Worker HTTP routes + KV schema for P1 tracking. All new operations follow the existing SDK pattern: types in module, function in module, spec in `src/sdk/spec.ts`, runtime registration in `src/sdk/runtime.ts`.

**Tech Stack:** TypeScript ES2022, Cloudflare Workers, KV, Gmail API, Sheets API, Jest

---

## Phase 1 — P0 Campaign Essentials

### Task 1: `sheets.readAsRecords` — Read Sheet as Keyed Objects

**Linear Issue:** `sheets.readAsRecords` — read Sheet as array of keyed objects (2 pts, High)

**Files:**
- Modify: `src/modules/sheets/read.ts` (add function + type after line 89)
- Modify: `src/modules/sheets/index.ts` (add export)
- Modify: `src/sdk/spec.ts` (add spec entry in sheets section)
- Modify: `src/sdk/runtime.ts` (add runtime registration in sheets section, after line 97)
- Create: `src/modules/sheets/__tests__/readAsRecords.test.ts`

**Step 1: Write the failing test**

Create `src/modules/sheets/__tests__/readAsRecords.test.ts`:

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { readAsRecords } from '../read.js';

describe('readAsRecords', () => {
  let mockContext: any;
  let mockSheetsApi: any;

  beforeEach(() => {
    mockSheetsApi = {
      spreadsheets: {
        values: {
          get: jest.fn(),
        },
      },
    };
    mockContext = {
      sheets: mockSheetsApi,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: { track: jest.fn() },
      startTime: Date.now(),
    };
  });

  test('zips headers with rows into keyed objects', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Contacts!A1:C3',
        values: [
          ['name', 'email', 'status'],
          ['Amy', 'amy@example.com', 'pending'],
          ['Bob', 'bob@example.com', 'sent'],
        ],
      },
    });

    const result = await readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Contacts!A:C',
    }, mockContext);

    expect(result.records).toEqual([
      { name: 'Amy', email: 'amy@example.com', status: 'pending' },
      { name: 'Bob', email: 'bob@example.com', status: 'sent' },
    ]);
    expect(result.count).toBe(2);
    expect(result.columns).toEqual(['name', 'email', 'status']);
  });

  test('returns empty records for header-only sheet', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Sheet1!A1:B1',
        values: [['name', 'email']],
      },
    });

    const result = await readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:B',
    }, mockContext);

    expect(result.records).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.columns).toEqual(['name', 'email']);
  });

  test('maps sparse rows to null for missing values', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Sheet1!A1:C2',
        values: [
          ['name', 'email', 'status'],
          ['Amy'],  // only 1 cell instead of 3
        ],
      },
    });

    const result = await readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:C',
    }, mockContext);

    expect(result.records).toEqual([
      { name: 'Amy', email: null, status: null },
    ]);
  });

  test('throws on empty sheet (no headers)', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: { range: 'Sheet1!A1:A1', values: [] },
    });

    await expect(readAsRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:C',
    }, mockContext)).rejects.toThrow('No header row found');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/modules/sheets/__tests__/readAsRecords.test.ts --no-coverage`
Expected: FAIL — `readAsRecords` is not exported from `../read.js`

**Step 3: Add types and implement `readAsRecords` in `src/modules/sheets/read.ts`**

Add after the existing `ReadSheetResult` interface (line 23):

```typescript
/**
 * Result of reading sheet as keyed records
 */
export interface ReadAsRecordsResult {
  records: Record<string, unknown>[];
  count: number;
  columns: string[];
}
```

Add after the existing `readSheet` function (after line 89):

```typescript
/**
 * Read sheet data as an array of keyed objects.
 * First row is treated as headers (keys). Each subsequent row becomes an object.
 *
 * @param options Read parameters (same as readSheet)
 * @param context Sheets API context
 * @returns Array of keyed objects with column names as keys
 */
export async function readAsRecords(
  options: ReadSheetOptions,
  context: SheetsContext
): Promise<ReadAsRecordsResult> {
  const { values } = await readSheet(options, context);

  if (!values || values.length === 0) {
    throw new Error('No header row found in the specified range');
  }

  const columns = (values[0] as string[]).map(h => String(h));
  const rows = values.slice(1);

  const records = rows.map(row => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      record[columns[i]] = i < row.length ? row[i] : null;
    }
    return record;
  });

  return { records, count: records.length, columns };
}
```

**Step 4: Export from `src/modules/sheets/index.ts`**

Update the read exports section (line 38-42):

```typescript
export {
  readSheet,
  readAsRecords,
  type ReadSheetOptions,
  type ReadSheetResult,
  type ReadAsRecordsResult,
} from './read.js';
```

**Step 5: Add SDK spec entry in `src/sdk/spec.ts`**

Add after the `appendRows` spec entry in the sheets section:

```typescript
    readAsRecords: {
      signature: "readAsRecords(options: { spreadsheetId: string, range: string, sheetName?: string }): Promise<{ records: Record<string, unknown>[], count: number, columns: string[] }>",
      description: "Read a Sheet range as an array of keyed objects. First row is treated as header row (keys). Each subsequent row becomes an object with header names as keys. Sparse rows map missing values to null.",
      example: "const { records } = await sdk.sheets.readAsRecords({ spreadsheetId: 'abc123', range: 'Contacts!A:G' });\nrecords.forEach(r => console.log(r.name, r.email));",
      params: {
        spreadsheetId: "string (required) — Google Sheets spreadsheet ID",
        range: "string (required) — A1 notation range (e.g., 'Contacts!A:G')",
        sheetName: "string (optional) — sheet name if not in range",
      },
      returns: "{ records: Record<string, unknown>[], count: number, columns: string[] }",
    },
```

**Step 6: Add runtime registration in `src/sdk/runtime.ts`**

Add after the `appendRows` entry (after line 97):

```typescript
      readAsRecords: limiter.wrap('sheets', async (opts: unknown) => {
        const { readAsRecords } = await import('../modules/sheets/index.js');
        return readAsRecords(opts as Parameters<typeof readAsRecords>[0], context);
      }),
```

**Step 7: Run tests to verify they pass**

Run: `npx jest src/modules/sheets/__tests__/readAsRecords.test.ts --no-coverage`
Expected: PASS (all 4 tests)

**Step 8: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 9: Commit**

```bash
git add src/modules/sheets/read.ts src/modules/sheets/index.ts src/sdk/spec.ts src/sdk/runtime.ts src/modules/sheets/__tests__/readAsRecords.test.ts
git commit -m "feat(sheets): add readAsRecords operation — read sheet as keyed objects"
```

---

### Task 2: `renderTemplate()` — Shared Template Rendering Utility

**Linear Issue:** (Part of `gmail.sendFromTemplate` — template rendering (subject + body) + send, 3 pts, Urgent)

**Files:**
- Create: `src/modules/gmail/templates.ts`
- Create: `src/modules/gmail/__tests__/templates.test.ts`
- Modify: `src/modules/gmail/index.ts` (add export)

**Step 1: Write the failing test**

Create `src/modules/gmail/__tests__/templates.test.ts`:

```typescript
import { describe, test, expect } from '@jest/globals';
import { renderTemplate } from '../templates.js';

describe('renderTemplate', () => {
  test('replaces {{variable}} placeholders in text', () => {
    const result = renderTemplate(
      'Hey {{firstName}}, this is about {{topic}}.',
      { firstName: 'Amy', topic: 'claims' }
    );
    expect(result).toBe('Hey Amy, this is about claims.');
  });

  test('replaces variables in subject line', () => {
    const result = renderTemplate(
      '{{firstName}}, quick follow-up on {{topic}}',
      { firstName: 'Amy', topic: 'claims' }
    );
    expect(result).toBe('Amy, quick follow-up on claims');
  });

  test('throws on missing variable', () => {
    expect(() => renderTemplate(
      'Hey {{firstName}}, your {{plan}} is ready.',
      { firstName: 'Amy' }
    )).toThrow("Missing template variable: 'plan'");
  });

  test('handles multiple occurrences of same variable', () => {
    const result = renderTemplate(
      '{{name}} said hi. Hi {{name}}!',
      { name: 'Amy' }
    );
    expect(result).toBe('Amy said hi. Hi Amy!');
  });

  test('HTML-escapes values when isHtml is true', () => {
    const result = renderTemplate(
      '<p>Hey {{name}}, check this: {{note}}</p>',
      { name: 'Amy & Co', note: '<script>alert("xss")</script>' },
      { isHtml: true }
    );
    expect(result).toBe('<p>Hey Amy &amp; Co, check this: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
  });

  test('does NOT HTML-escape values when isHtml is false', () => {
    const result = renderTemplate(
      'Hey {{name}}',
      { name: 'Amy & Co' },
      { isHtml: false }
    );
    expect(result).toBe('Hey Amy & Co');
  });

  test('handles template with no variables', () => {
    const result = renderTemplate(
      'No variables here.',
      {}
    );
    expect(result).toBe('No variables here.');
  });

  test('handles whitespace in variable names', () => {
    const result = renderTemplate(
      'Hey {{ firstName }}',
      { firstName: 'Amy' }
    );
    expect(result).toBe('Hey Amy');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/modules/gmail/__tests__/templates.test.ts --no-coverage`
Expected: FAIL — `../templates.js` does not exist

**Step 3: Implement `renderTemplate` in `src/modules/gmail/templates.ts`**

```typescript
/**
 * Gmail template rendering utilities
 *
 * Shared by sendFromTemplate, sendBatch, and dryRun operations.
 * Handles {{variable}} replacement with optional HTML escaping.
 */

/**
 * Escape HTML special characters to prevent XSS when injecting into HTML templates.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a template string by replacing {{variable}} placeholders with values.
 *
 * @param template Template string with {{variable}} placeholders
 * @param variables Key-value pairs for replacement
 * @param options.isHtml When true, HTML-escapes variable values before insertion
 * @returns Rendered string with all placeholders replaced
 * @throws Error if a placeholder has no matching variable
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>,
  options: { isHtml?: boolean } = {}
): string {
  const { isHtml = false } = options;

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Missing template variable: '${key}'`);
    }
    const value = variables[key];
    return isHtml ? escapeHtml(value) : value;
  });
}
```

**Step 4: Export from `src/modules/gmail/index.ts`**

Add after the send exports section (after line 84):

```typescript
// Template utilities
export { renderTemplate } from './templates.js';
```

**Step 5: Run tests to verify they pass**

Run: `npx jest src/modules/gmail/__tests__/templates.test.ts --no-coverage`
Expected: PASS (all 8 tests)

**Step 6: Commit**

```bash
git add src/modules/gmail/templates.ts src/modules/gmail/__tests__/templates.test.ts src/modules/gmail/index.ts
git commit -m "feat(gmail): add renderTemplate utility for {{variable}} replacement"
```

---

### Task 3: `gmail.dryRun` — Preview Rendered Email Without Sending

**Linear Issue:** `gmail.dryRun` — preview rendered email without sending (1 pt, High)

**Files:**
- Modify: `src/modules/gmail/compose.ts` (add dryRunMessage function)
- Modify: `src/modules/gmail/types.ts` (add types)
- Modify: `src/modules/gmail/index.ts` (add exports)
- Modify: `src/sdk/spec.ts` (add spec entry)
- Modify: `src/sdk/runtime.ts` (add runtime registration)
- Create: `src/modules/gmail/__tests__/dryRun.test.ts`

**Step 1: Write the failing test**

Create `src/modules/gmail/__tests__/dryRun.test.ts`:

```typescript
import { describe, test, expect } from '@jest/globals';
import { dryRunMessage } from '../compose.js';

describe('dryRunMessage', () => {
  test('renders template variables in subject and body', () => {
    const result = dryRunMessage({
      to: ['amy@example.com'],
      subject: '{{firstName}}, quick follow-up',
      template: 'Hey {{firstName}},\n\n{{personalNote}}\n\nBest regards',
      variables: { firstName: 'Amy', personalNote: 'We met at the conference' },
    });

    expect(result.to).toEqual(['amy@example.com']);
    expect(result.subject).toBe('Amy, quick follow-up');
    expect(result.body).toBe('Hey Amy,\n\nWe met at the conference\n\nBest regards');
    expect(result.isHtml).toBe(false);
    expect(result.wouldSend).toBe(false);
  });

  test('HTML-escapes variables when isHtml is true', () => {
    const result = dryRunMessage({
      to: ['bob@example.com'],
      subject: 'Hello {{name}}',
      template: '<p>{{note}}</p>',
      variables: { name: 'Bob', note: 'Tom & Jerry <friends>' },
      isHtml: true,
    });

    expect(result.subject).toBe('Hello Bob');
    expect(result.body).toBe('<p>Tom &amp; Jerry &lt;friends&gt;</p>');
    expect(result.isHtml).toBe(true);
  });

  test('throws on missing template variable', () => {
    expect(() => dryRunMessage({
      to: ['amy@example.com'],
      subject: '{{firstName}}, follow-up',
      template: 'Hey {{firstName}}, about {{topic}}',
      variables: { firstName: 'Amy' },
    })).toThrow("Missing template variable: 'topic'");
  });

  test('validates email addresses', () => {
    expect(() => dryRunMessage({
      to: ['not-an-email'],
      subject: 'Test',
      template: 'Body',
      variables: {},
    })).toThrow('Invalid email address in to');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/modules/gmail/__tests__/dryRun.test.ts --no-coverage`
Expected: FAIL — `dryRunMessage` is not exported from `../compose.js`

**Step 3: Add types in `src/modules/gmail/types.ts`**

Add at the end of the file (after line 619):

```typescript
// ============================================================================
// Template & Outreach Operations
// ============================================================================

/**
 * Options for dry-running a templated email (preview without sending)
 */
export interface DryRunOptions {
  /** Recipient email addresses */
  to: string[];
  /** Subject template with {{variable}} placeholders */
  subject: string;
  /** Body template with {{variable}} placeholders */
  template: string;
  /** Variables to replace in subject and body */
  variables: Record<string, string>;
  /** Whether the template is HTML (default: false) */
  isHtml?: boolean;
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
}

/**
 * Result of a dry run — rendered email without sending
 */
export interface DryRunResult {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml: boolean;
  wouldSend: false;
}

/**
 * Options for sending a templated email
 */
export interface SendFromTemplateOptions {
  /** Recipient email addresses */
  to: string[];
  /** Subject template with {{variable}} placeholders */
  subject: string;
  /** Body template with {{variable}} placeholders */
  template: string;
  /** Variables to replace in subject and body */
  variables: Record<string, string>;
  /** Whether the template is HTML (default: false) */
  isHtml?: boolean;
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Send from a different email address (send-as alias) */
  from?: string;
}

/**
 * Result of sending a templated email
 */
export interface SendFromTemplateResult {
  messageId: string;
  threadId: string;
  rendered: true;
}

/**
 * Per-recipient entry in a batch send
 */
export interface BatchRecipient {
  /** Recipient email address */
  to: string;
  /** Per-recipient template variables */
  variables: Record<string, string>;
  /** CC recipients for this message */
  cc?: string[];
  /** BCC recipients for this message */
  bcc?: string[];
}

/**
 * Options for batch sending templated emails
 */
export interface BatchSendOptions {
  /** Body template with {{variable}} placeholders */
  template: string;
  /** Subject template with {{variable}} placeholders */
  subject: string;
  /** Array of recipients with per-recipient variables */
  recipients: BatchRecipient[];
  /** Delay between sends in ms (default: 5000) */
  delayMs?: number;
  /** Whether the template is HTML (default: false) */
  isHtml?: boolean;
  /** Send from a different email address (send-as alias) */
  from?: string;
  /** When true, return previews without sending (default: false) */
  dryRun?: boolean;
}

/**
 * Per-recipient result in a batch send
 */
export interface BatchSendItemResult {
  to: string;
  messageId: string;
  threadId: string;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * Per-recipient preview in a batch dry run
 */
export interface BatchPreviewItem {
  to: string;
  subject: string;
  body: string;
  wouldSend: false;
}

/**
 * Result of a batch send operation
 */
export interface BatchSendResult {
  sent: number;
  failed: number;
  results?: BatchSendItemResult[];
  previews?: BatchPreviewItem[];
}
```

**Step 4: Implement `dryRunMessage` in `src/modules/gmail/compose.ts`**

Add these imports at the top (after existing imports):

```typescript
import type { DryRunOptions, DryRunResult } from './types.js';
import { renderTemplate } from './templates.js';
import { validateAndSanitizeRecipients } from './utils.js';
```

Add after the `createDraft` function (after line 68):

```typescript
/**
 * Preview a templated email without sending.
 * Renders variables in subject and body, validates recipients, returns the result.
 *
 * @param options Template and variables
 * @returns Rendered email preview with wouldSend: false
 */
export function dryRunMessage(options: DryRunOptions): DryRunResult {
  const { to, subject, template, variables, isHtml = false, cc, bcc } = options;

  // Validate recipients
  validateAndSanitizeRecipients(to, 'to');
  if (cc) validateAndSanitizeRecipients(cc, 'cc');
  if (bcc) validateAndSanitizeRecipients(bcc, 'bcc');

  const renderedSubject = renderTemplate(subject, variables);
  const renderedBody = renderTemplate(template, variables, { isHtml });

  return {
    to,
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    subject: renderedSubject,
    body: renderedBody,
    isHtml,
    wouldSend: false,
  };
}
```

**Step 5: Export from `src/modules/gmail/index.ts`**

Update the compose exports section and add types:

```typescript
// Compose operations
export { createDraft, dryRunMessage } from './compose.js';
```

Add to the type exports block:

```typescript
  // Template & Outreach types
  DryRunOptions,
  DryRunResult,
  SendFromTemplateOptions,
  SendFromTemplateResult,
  BatchRecipient,
  BatchSendOptions,
  BatchSendItemResult,
  BatchPreviewItem,
  BatchSendResult,
```

**Step 6: Add SDK spec entry in `src/sdk/spec.ts`**

Add after the `archiveMessage` spec entry in the gmail section:

```typescript
    dryRun: {
      signature: "dryRun(options: { to: string[], subject: string, template: string, variables: Record<string, string>, isHtml?: boolean, cc?: string[], bcc?: string[] }): Promise<{ to, subject, body, isHtml, wouldSend: false }>",
      description: "Preview a templated email without sending. Renders {{variable}} placeholders in both subject and body. Use to review before sending.",
      example: "const preview = await sdk.gmail.dryRun({\n  to: ['amy@example.com'],\n  subject: '{{firstName}}, quick follow-up',\n  template: 'Hey {{firstName}},\\n\\n{{personalNote}}',\n  variables: { firstName: 'Amy', personalNote: 'Great meeting you' },\n});\nconsole.log(preview.subject, preview.body);",
      params: {
        to: "string[] (required) — recipient emails",
        subject: "string (required) — subject template with {{variable}} placeholders",
        template: "string (required) — body template with {{variable}} placeholders",
        variables: "Record<string, string> (required) — key-value pairs for placeholder replacement",
        isHtml: "boolean (optional, default false) — whether template is HTML (enables HTML escaping of variable values)",
        cc: "string[] (optional)",
        bcc: "string[] (optional)",
      },
      returns: "{ to, cc?, bcc?, subject, body, isHtml, wouldSend: false }",
    },
```

**Step 7: Add runtime registration in `src/sdk/runtime.ts`**

Add after the `archiveMessage` entry in the gmail section (after line 230):

```typescript
      dryRun: limiter.wrap('gmail', async (opts: unknown) => {
        const { dryRunMessage } = await import('../modules/gmail/index.js');
        return dryRunMessage(opts as Parameters<typeof dryRunMessage>[0]);
      }),
```

Note: `dryRunMessage` does NOT need context — it's a pure function (no API calls).

**Step 8: Run tests to verify they pass**

Run: `npx jest src/modules/gmail/__tests__/dryRun.test.ts --no-coverage`
Expected: PASS (all 4 tests)

**Step 9: Run type-check and full test suite**

Run: `npm run type-check && npm test`
Expected: PASS

**Step 10: Commit**

```bash
git add src/modules/gmail/compose.ts src/modules/gmail/types.ts src/modules/gmail/index.ts src/modules/gmail/__tests__/dryRun.test.ts src/sdk/spec.ts src/sdk/runtime.ts
git commit -m "feat(gmail): add dryRun operation — preview templated email without sending"
```

---

### Task 4: `gmail.sendFromTemplate` — Template Rendering + Send

**Linear Issue:** `gmail.sendFromTemplate` — template rendering (subject + body) + send (3 pts, Urgent)

**Files:**
- Modify: `src/modules/gmail/send.ts` (add sendFromTemplate function)
- Modify: `src/modules/gmail/index.ts` (add export)
- Modify: `src/sdk/spec.ts` (add spec entry)
- Modify: `src/sdk/runtime.ts` (add runtime registration)
- Create: `src/modules/gmail/__tests__/sendFromTemplate.test.ts`

**Step 1: Write the failing test**

Create `src/modules/gmail/__tests__/sendFromTemplate.test.ts`:

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { sendFromTemplate } from '../send.js';

describe('sendFromTemplate', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        messages: {
          send: jest.fn().mockResolvedValue({
            data: { id: 'msg123', threadId: 'thread123', labelIds: ['SENT'] },
          }),
        },
      },
    };
    mockContext = {
      gmail: mockGmailApi,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: { track: jest.fn() },
      startTime: Date.now(),
    };
  });

  test('renders template and sends email', async () => {
    const result = await sendFromTemplate({
      to: ['amy@example.com'],
      subject: '{{firstName}}, quick follow-up',
      template: 'Hey {{firstName}},\n\n{{personalNote}}',
      variables: { firstName: 'Amy', personalNote: 'Great meeting you' },
    }, mockContext);

    expect(result.messageId).toBe('msg123');
    expect(result.threadId).toBe('thread123');
    expect(result.rendered).toBe(true);

    // Verify the rendered content was sent
    const call = mockGmailApi.users.messages.send.mock.calls[0][0];
    const raw = Buffer.from(call.requestBody.raw, 'base64').toString();
    expect(raw).toContain('Amy, quick follow-up');
    expect(raw).toContain('Hey Amy,');
    expect(raw).toContain('Great meeting you');
  });

  test('throws on missing template variable', async () => {
    await expect(sendFromTemplate({
      to: ['amy@example.com'],
      subject: '{{firstName}}, follow-up',
      template: 'Hey {{firstName}}, about {{topic}}',
      variables: { firstName: 'Amy' },
    }, mockContext)).rejects.toThrow("Missing template variable: 'topic'");
  });

  test('sends HTML email with escaped variables', async () => {
    await sendFromTemplate({
      to: ['bob@example.com'],
      subject: 'Hello {{name}}',
      template: '<p>{{note}}</p>',
      variables: { name: 'Bob', note: 'Tom & Jerry' },
      isHtml: true,
    }, mockContext);

    const call = mockGmailApi.users.messages.send.mock.calls[0][0];
    const raw = Buffer.from(call.requestBody.raw, 'base64').toString();
    expect(raw).toContain('text/html');
    expect(raw).toContain('Tom &amp; Jerry');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/modules/gmail/__tests__/sendFromTemplate.test.ts --no-coverage`
Expected: FAIL — `sendFromTemplate` is not exported

**Step 3: Implement `sendFromTemplate` in `src/modules/gmail/send.ts`**

Add imports at the top:

```typescript
import type { SendFromTemplateOptions, SendFromTemplateResult } from './types.js';
import { renderTemplate } from './templates.js';
```

Add after `sendDraft` function (after line 143):

```typescript
/**
 * Render a template with variables and send the email.
 *
 * @param options Template, variables, and recipients
 * @param context Gmail API context
 * @returns Sent message info with rendered: true
 */
export async function sendFromTemplate(
  options: SendFromTemplateOptions,
  context: GmailContext
): Promise<SendFromTemplateResult> {
  const { to, subject, template, variables, isHtml = false, cc, bcc, from } = options;

  const renderedSubject = renderTemplate(subject, variables);
  const renderedBody = renderTemplate(template, variables, { isHtml });

  const result = await sendMessage({
    to,
    subject: renderedSubject,
    body: renderedBody,
    isHtml,
    cc,
    bcc,
    from,
  }, context);

  return {
    messageId: result.messageId,
    threadId: result.threadId,
    rendered: true,
  };
}
```

**Step 4: Export from `src/modules/gmail/index.ts`**

Update the send exports:

```typescript
export { sendMessage, sendDraft, sendFromTemplate } from './send.js';
```

**Step 5: Add SDK spec entry in `src/sdk/spec.ts`**

Add after the `dryRun` spec entry:

```typescript
    sendFromTemplate: {
      signature: "sendFromTemplate(options: { to: string[], subject: string, template: string, variables: Record<string, string>, isHtml?: boolean, cc?: string[], bcc?: string[], from?: string }): Promise<{ messageId, threadId, rendered: true }>",
      description: "Render a template with {{variable}} placeholders (both subject and body), then send the email. Use dryRun() first to preview.",
      example: "const result = await sdk.gmail.sendFromTemplate({\n  to: ['amy@example.com'],\n  subject: '{{firstName}}, quick follow-up on claims',\n  template: 'Hey {{firstName}},\\n\\n{{personalNote}}\\n\\nBest regards',\n  variables: { firstName: 'Amy', personalNote: 'We met at the dental conference' },\n});\nreturn result.messageId;",
      params: {
        to: "string[] (required) — recipient emails",
        subject: "string (required) — subject template with {{variable}} placeholders",
        template: "string (required) — body template with {{variable}} placeholders",
        variables: "Record<string, string> (required) — key-value pairs for placeholder replacement",
        isHtml: "boolean (optional, default false)",
        cc: "string[] (optional)",
        bcc: "string[] (optional)",
        from: "string (optional) — send-as alias",
      },
      returns: "{ messageId, threadId, rendered: true }",
    },
```

**Step 6: Add runtime registration in `src/sdk/runtime.ts`**

Add after the `dryRun` runtime entry:

```typescript
      sendFromTemplate: limiter.wrap('gmail', async (opts: unknown) => {
        const { sendFromTemplate } = await import('../modules/gmail/index.js');
        return sendFromTemplate(opts as Parameters<typeof sendFromTemplate>[0], context);
      }),
```

**Step 7: Run tests**

Run: `npx jest src/modules/gmail/__tests__/sendFromTemplate.test.ts --no-coverage`
Expected: PASS (all 3 tests)

**Step 8: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 9: Commit**

```bash
git add src/modules/gmail/send.ts src/modules/gmail/index.ts src/sdk/spec.ts src/sdk/runtime.ts src/modules/gmail/__tests__/sendFromTemplate.test.ts
git commit -m "feat(gmail): add sendFromTemplate operation — template rendering + send"
```

---

### Task 5: `gmail.sendBatch` — Batch Send with Throttling + Dry Run

**Linear Issue:** `gmail.sendBatch` — batch send with throttling, dryRun flag, structured results (3 pts, High)

**Files:**
- Modify: `src/modules/gmail/send.ts` (add sendBatch function)
- Modify: `src/modules/gmail/index.ts` (add export)
- Modify: `src/sdk/spec.ts` (add spec entry)
- Modify: `src/sdk/runtime.ts` (add runtime registration)
- Create: `src/modules/gmail/__tests__/sendBatch.test.ts`

**Step 1: Write the failing test**

Create `src/modules/gmail/__tests__/sendBatch.test.ts`:

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { sendBatch } from '../send.js';

describe('sendBatch', () => {
  let mockContext: any;
  let mockGmailApi: any;
  let callCount: number;

  beforeEach(() => {
    callCount = 0;
    mockGmailApi = {
      users: {
        messages: {
          send: jest.fn().mockImplementation(() => {
            callCount++;
            return Promise.resolve({
              data: { id: `msg${callCount}`, threadId: `thread${callCount}`, labelIds: ['SENT'] },
            });
          }),
        },
      },
    };
    mockContext = {
      gmail: mockGmailApi,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: { track: jest.fn() },
      startTime: Date.now(),
    };
  });

  test('sends to all recipients with rendered templates', async () => {
    const result = await sendBatch({
      template: 'Hey {{firstName}}, {{note}}',
      subject: '{{firstName}}, follow-up',
      recipients: [
        { to: 'amy@example.com', variables: { firstName: 'Amy', note: 'great chat' } },
        { to: 'bob@example.com', variables: { firstName: 'Bob', note: 'nice meeting' } },
      ],
      delayMs: 0,  // no delay in tests
    }, mockContext);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results![0].to).toBe('amy@example.com');
    expect(result.results![0].status).toBe('sent');
    expect(result.results![1].to).toBe('bob@example.com');
    expect(mockGmailApi.users.messages.send).toHaveBeenCalledTimes(2);
  });

  test('returns previews when dryRun is true', async () => {
    const result = await sendBatch({
      template: 'Hey {{firstName}}',
      subject: '{{firstName}}, hi',
      recipients: [
        { to: 'amy@example.com', variables: { firstName: 'Amy' } },
        { to: 'bob@example.com', variables: { firstName: 'Bob' } },
      ],
      dryRun: true,
    }, mockContext);

    expect(result.sent).toBe(0);
    expect(result.previews).toHaveLength(2);
    expect(result.previews![0].to).toBe('amy@example.com');
    expect(result.previews![0].subject).toBe('Amy, hi');
    expect(result.previews![0].body).toBe('Hey Amy');
    expect(result.previews![0].wouldSend).toBe(false);
    expect(mockGmailApi.users.messages.send).not.toHaveBeenCalled();
  });

  test('continues on individual send failure', async () => {
    mockGmailApi.users.messages.send
      .mockRejectedValueOnce(new Error('Rate limit'))
      .mockResolvedValueOnce({
        data: { id: 'msg2', threadId: 'thread2', labelIds: ['SENT'] },
      });

    const result = await sendBatch({
      template: 'Hey {{name}}',
      subject: 'Hi {{name}}',
      recipients: [
        { to: 'fail@example.com', variables: { name: 'Fail' } },
        { to: 'ok@example.com', variables: { name: 'OK' } },
      ],
      delayMs: 0,
    }, mockContext);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results![0].status).toBe('failed');
    expect(result.results![0].error).toBe('Rate limit');
    expect(result.results![1].status).toBe('sent');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/modules/gmail/__tests__/sendBatch.test.ts --no-coverage`
Expected: FAIL — `sendBatch` is not exported

**Step 3: Implement `sendBatch` in `src/modules/gmail/send.ts`**

Add to the existing imports:

```typescript
import type {
  SendFromTemplateOptions,
  SendFromTemplateResult,
  BatchSendOptions,
  BatchSendResult,
  BatchSendItemResult,
  BatchPreviewItem,
} from './types.js';
```

Add after `sendFromTemplate` function:

```typescript
/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send templated emails to multiple recipients with configurable delay.
 * Supports dryRun mode to preview all rendered emails without sending.
 *
 * @param options Batch send parameters
 * @param context Gmail API context
 * @returns Aggregate results with per-recipient status
 */
export async function sendBatch(
  options: BatchSendOptions,
  context: GmailContext
): Promise<BatchSendResult> {
  const { template, subject, recipients, delayMs = 5000, isHtml = false, from, dryRun = false } = options;

  // Dry run mode — return previews without sending
  if (dryRun) {
    const previews: BatchPreviewItem[] = recipients.map(recipient => ({
      to: recipient.to,
      subject: renderTemplate(subject, recipient.variables),
      body: renderTemplate(template, recipient.variables, { isHtml }),
      wouldSend: false as const,
    }));
    return { sent: 0, failed: 0, previews };
  }

  // Send mode — sequential sends with delay
  const results: BatchSendItemResult[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    try {
      const renderedSubject = renderTemplate(subject, recipient.variables);
      const renderedBody = renderTemplate(template, recipient.variables, { isHtml });

      const sendResult = await sendMessage({
        to: [recipient.to],
        subject: renderedSubject,
        body: renderedBody,
        isHtml,
        cc: recipient.cc,
        bcc: recipient.bcc,
        from,
      }, context);

      results.push({
        to: recipient.to,
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
        status: 'sent',
      });
      sent++;
    } catch (err) {
      results.push({
        to: recipient.to,
        messageId: '',
        threadId: '',
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
      context.logger.error('Batch send failed for recipient', { to: recipient.to, error: err });
    }

    // Delay between sends (skip after last one)
    if (delayMs > 0 && i < recipients.length - 1) {
      await delay(delayMs);
    }
  }

  return { sent, failed, results };
}
```

**Step 4: Export from `src/modules/gmail/index.ts`**

Update the send exports:

```typescript
export { sendMessage, sendDraft, sendFromTemplate, sendBatch } from './send.js';
```

**Step 5: Add SDK spec entry in `src/sdk/spec.ts`**

Add after the `sendFromTemplate` spec entry:

```typescript
    sendBatch: {
      signature: "sendBatch(options: { template: string, subject: string, recipients: BatchRecipient[], delayMs?: number, isHtml?: boolean, from?: string, dryRun?: boolean }): Promise<{ sent, failed, results?, previews? }>",
      description: "Send templated emails to multiple recipients with configurable delay between sends. Set dryRun: true to preview all rendered emails without sending. Each recipient has their own variables for personalization.",
      example: "const result = await sdk.gmail.sendBatch({\n  template: 'Hey {{firstName}},\\n\\n{{personalNote}}',\n  subject: '{{firstName}}, quick follow-up',\n  recipients: [\n    { to: 'amy@example.com', variables: { firstName: 'Amy', personalNote: 'Great chat' } },\n    { to: 'bob@example.com', variables: { firstName: 'Bob', personalNote: 'Nice meeting' } },\n  ],\n  delayMs: 5000,\n  dryRun: false,\n});\nconsole.log(`Sent: ${result.sent}, Failed: ${result.failed}`);",
      params: {
        template: "string (required) — body template with {{variable}} placeholders",
        subject: "string (required) — subject template with {{variable}} placeholders",
        recipients: "BatchRecipient[] (required) — [{ to: string, variables: Record<string, string>, cc?: string[], bcc?: string[] }]",
        delayMs: "number (optional, default 5000) — delay between sends in milliseconds",
        isHtml: "boolean (optional, default false)",
        from: "string (optional) — send-as alias",
        dryRun: "boolean (optional, default false) — when true, returns previews without sending",
      },
      returns: "{ sent: number, failed: number, results?: BatchSendItemResult[], previews?: BatchPreviewItem[] }",
    },
```

**Step 6: Add runtime registration in `src/sdk/runtime.ts`**

Add after the `sendFromTemplate` runtime entry:

```typescript
      sendBatch: limiter.wrap('gmail', async (opts: unknown) => {
        const { sendBatch } = await import('../modules/gmail/index.js');
        return sendBatch(opts as Parameters<typeof sendBatch>[0], context);
      }),
```

**Step 7: Run tests**

Run: `npx jest src/modules/gmail/__tests__/sendBatch.test.ts --no-coverage`
Expected: PASS (all 3 tests)

**Step 8: Run full test suite and type-check**

Run: `npm run type-check && npm test`
Expected: PASS

**Step 9: Commit**

```bash
git add src/modules/gmail/send.ts src/modules/gmail/index.ts src/sdk/spec.ts src/sdk/runtime.ts src/modules/gmail/__tests__/sendBatch.test.ts
git commit -m "feat(gmail): add sendBatch operation — batch send with throttling and dryRun"
```

---

## Phase 2 — P1 Tracking Infrastructure

### Task 6: CF Worker Tracking Pixel Endpoint + KV Schema

**Linear Issue:** CF Worker tracking pixel endpoint + KV schema (2 pts, Medium)

**Files:**
- Create: `src/server/tracking.ts` (tracking handler + KV schema)
- Modify: `worker.ts` (route `/track/*` to tracking handler)
- Create: `src/server/__tests__/tracking.test.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/tracking.test.ts`:

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { handleTrackingRequest, TRANSPARENT_GIF } from '../tracking.js';

describe('tracking pixel endpoint', () => {
  let mockKV: any;

  beforeEach(() => {
    mockKV = {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('returns 1x1 transparent GIF with correct headers', async () => {
    const request = new Request('https://example.com/track/campaign1/recipient1/pixel.gif');
    const response = await handleTrackingRequest(request, mockKV);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/gif');
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');

    const body = await response.arrayBuffer();
    expect(new Uint8Array(body)).toEqual(TRANSPARENT_GIF);
  });

  test('writes open event to KV summary record', async () => {
    const request = new Request('https://example.com/track/campaign1/recipient1/pixel.gif');
    await handleTrackingRequest(request, mockKV);

    expect(mockKV.get).toHaveBeenCalledWith('tracking:summary:campaign1', 'json');
    expect(mockKV.put).toHaveBeenCalledWith(
      'tracking:summary:campaign1',
      expect.any(String),
      { expirationTtl: 7776000 }  // 90 days
    );

    const putCall = mockKV.put.mock.calls[0];
    const summary = JSON.parse(putCall[1]);
    expect(summary.campaignId).toBe('campaign1');
    expect(summary.recipients.recipient1.opens).toBe(1);
    expect(summary.recipients.recipient1.firstOpen).toBeDefined();
  });

  test('increments open count on subsequent hits', async () => {
    mockKV.get.mockResolvedValue({
      campaignId: 'campaign1',
      recipients: {
        recipient1: { opens: 2, firstOpen: '2026-03-10T00:00:00Z', lastOpen: '2026-03-10T01:00:00Z' },
      },
    });

    const request = new Request('https://example.com/track/campaign1/recipient1/pixel.gif');
    await handleTrackingRequest(request, mockKV);

    const putCall = mockKV.put.mock.calls[0];
    const summary = JSON.parse(putCall[1]);
    expect(summary.recipients.recipient1.opens).toBe(3);
  });

  test('returns 404 for malformed tracking URL', async () => {
    const request = new Request('https://example.com/track/invalid-path');
    const response = await handleTrackingRequest(request, mockKV);

    expect(response.status).toBe(404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/server/__tests__/tracking.test.ts --no-coverage`
Expected: FAIL — `../tracking.js` does not exist

**Step 3: Implement tracking handler in `src/server/tracking.ts`**

```typescript
/**
 * CF Worker tracking pixel endpoint.
 * Serves a 1x1 transparent GIF and records open events in KV.
 *
 * URL pattern: /track/:campaignId/:recipientId/pixel.gif
 *
 * KV schema: summary record at tracking:summary:{campaignId}
 * - Aggregated per-recipient open counts (single KV read to query)
 * - 90-day TTL
 */

/** Minimal 1x1 transparent GIF (43 bytes) */
export const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

/** 90 days in seconds */
const TTL_90_DAYS = 90 * 24 * 60 * 60;

/** Per-recipient tracking data */
interface RecipientTracking {
  opens: number;
  firstOpen: string;
  lastOpen: string;
}

/** Summary record stored in KV */
interface TrackingSummary {
  campaignId: string;
  recipients: Record<string, RecipientTracking>;
}

/** KV namespace interface (subset of CF KVNamespace) */
interface KVLike {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Parse tracking URL path into campaignId and recipientId.
 * Expected: /track/:campaignId/:recipientId/pixel.gif
 */
function parseTrackingPath(url: string): { campaignId: string; recipientId: string } | null {
  const path = new URL(url).pathname;
  const match = path.match(/^\/track\/([^/]+)\/([^/]+)\/pixel\.gif$/);
  if (!match) return null;
  return { campaignId: match[1], recipientId: match[2] };
}

/**
 * Handle a tracking pixel request.
 * Returns a 1x1 GIF and records the open event in KV.
 */
export async function handleTrackingRequest(
  request: Request,
  kv: KVLike
): Promise<Response> {
  const parsed = parseTrackingPath(request.url);
  if (!parsed) {
    return new Response('Not found', { status: 404 });
  }

  const { campaignId, recipientId } = parsed;
  const now = new Date().toISOString();
  const summaryKey = `tracking:summary:${campaignId}`;

  // Read-modify-write the summary record
  const existing = (await kv.get(summaryKey, 'json')) as TrackingSummary | null;

  const summary: TrackingSummary = existing || { campaignId, recipients: {} };

  if (summary.recipients[recipientId]) {
    summary.recipients[recipientId].opens++;
    summary.recipients[recipientId].lastOpen = now;
  } else {
    summary.recipients[recipientId] = { opens: 1, firstOpen: now, lastOpen: now };
  }

  await kv.put(summaryKey, JSON.stringify(summary), { expirationTtl: TTL_90_DAYS });

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': String(TRANSPARENT_GIF.byteLength),
    },
  });
}
```

**Step 4: Update `worker.ts` to route `/track/*` requests**

In `worker.ts`, modify the fetch handler (line 159-166). Replace the existing path check:

```typescript
    // Route tracking requests
    if (url.pathname.startsWith('/track/')) {
      const { handleTrackingRequest } = await import('./src/server/tracking.js');
      return handleTrackingRequest(request, env.GDRIVE_KV as unknown as Parameters<typeof handleTrackingRequest>[1]);
    }

    // Only handle POST requests to /mcp (or root)
    if (request.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '/mcp')) {
```

**Step 5: Run tests**

Run: `npx jest src/server/__tests__/tracking.test.ts --no-coverage`
Expected: PASS (all 4 tests)

**Step 6: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 7: Commit**

```bash
git add src/server/tracking.ts src/server/__tests__/tracking.test.ts worker.ts
git commit -m "feat(tracking): add CF Worker tracking pixel endpoint with KV summary records"
```

---

### Task 7: `gmail.getTrackingData` — Query Open Events by Campaign

**Linear Issue:** `gmail.getTrackingData` — query open events by campaign, Worker-only (1 pt, Medium)

**Files:**
- Modify: `src/server/tracking.ts` (add getTrackingData function)
- Modify: `src/sdk/spec.ts` (add spec entry)
- Modify: `src/sdk/runtime.ts` (add runtime registration)
- Modify: `src/modules/gmail/index.ts` (add re-export)
- Add test to: `src/server/__tests__/tracking.test.ts`

**Step 1: Write the failing test**

Add to `src/server/__tests__/tracking.test.ts`:

```typescript
describe('getTrackingData', () => {
  let mockKV: any;

  beforeEach(() => {
    mockKV = {
      get: jest.fn(),
      put: jest.fn(),
    };
  });

  test('returns tracking data for a campaign', async () => {
    const { getTrackingData } = await import('../tracking.js');

    mockKV.get.mockResolvedValue({
      campaignId: 'test-campaign',
      recipients: {
        amy: { opens: 3, firstOpen: '2026-03-10T09:00:00Z', lastOpen: '2026-03-11T14:00:00Z' },
        bob: { opens: 0, firstOpen: '', lastOpen: '' },
      },
    });

    const result = await getTrackingData('test-campaign', mockKV);

    expect(result.campaignId).toBe('test-campaign');
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[0]).toEqual({
      recipientId: 'amy',
      opens: 3,
      firstOpen: '2026-03-10T09:00:00Z',
      lastOpen: '2026-03-11T14:00:00Z',
    });
  });

  test('returns empty recipients for unknown campaign', async () => {
    const { getTrackingData } = await import('../tracking.js');

    mockKV.get.mockResolvedValue(null);

    const result = await getTrackingData('nonexistent', mockKV);

    expect(result.campaignId).toBe('nonexistent');
    expect(result.recipients).toEqual([]);
  });
});
```

**Step 2: Implement `getTrackingData` in `src/server/tracking.ts`**

Add to the end of the file:

```typescript
/** Result of querying tracking data */
export interface TrackingDataResult {
  campaignId: string;
  recipients: Array<{
    recipientId: string;
    opens: number;
    firstOpen?: string;
    lastOpen?: string;
  }>;
}

/**
 * Query tracking data for a campaign.
 * Worker-only — KV is not available on Node.js stdio runtime.
 *
 * @param campaignId The campaign to query
 * @param kv KV namespace
 * @returns Per-recipient open data
 */
export async function getTrackingData(
  campaignId: string,
  kv: KVLike
): Promise<TrackingDataResult> {
  const summary = (await kv.get(`tracking:summary:${campaignId}`, 'json')) as TrackingSummary | null;

  if (!summary) {
    return { campaignId, recipients: [] };
  }

  const recipients = Object.entries(summary.recipients).map(([recipientId, data]) => ({
    recipientId,
    opens: data.opens,
    ...(data.firstOpen ? { firstOpen: data.firstOpen } : {}),
    ...(data.lastOpen ? { lastOpen: data.lastOpen } : {}),
  }));

  return { campaignId, recipients };
}
```

**Step 3: Add SDK spec entry and runtime registration**

SDK spec (add after `sendBatch`):

```typescript
    getTrackingData: {
      signature: "getTrackingData(options: { campaignId: string }): Promise<{ campaignId, recipients: TrackingRecipient[] }>",
      description: "Query email open tracking data by campaign ID. Returns per-recipient open counts and timestamps. WORKER-ONLY — requires CF Worker deployment with KV. Returns error on Node.js stdio runtime.",
      example: "const data = await sdk.gmail.getTrackingData({ campaignId: 'clarte-warm-v1' });\ndata.recipients.forEach(r => console.log(r.recipientId, r.opens));",
      params: {
        campaignId: "string (required) — campaign identifier used when sending tracked emails",
      },
      returns: "{ campaignId, recipients: [{ recipientId, opens, firstOpen?, lastOpen? }] }",
    },
```

Runtime registration — this is Worker-only, so the runtime handler must check for KV availability:

```typescript
      getTrackingData: limiter.wrap('gmail', async (opts: unknown) => {
        const options = opts as { campaignId: string };
        if (!context.kv) {
          throw new Error('getTrackingData is Worker-only — KV is not available on Node.js stdio runtime');
        }
        const { getTrackingData } = await import('../server/tracking.js');
        return getTrackingData(options.campaignId, context.kv);
      }),
```

> **Note:** This requires `kv` to be available on the `FullContext` type. Check `src/sdk/types.ts` — if `kv` is not on the context, add it as an optional property: `kv?: KVLike`. The Worker path in `worker.ts` passes the KV binding; the stdio path does not.

**Step 4: Run tests**

Run: `npx jest src/server/__tests__/tracking.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/tracking.ts src/server/__tests__/tracking.test.ts src/sdk/spec.ts src/sdk/runtime.ts src/sdk/types.ts
git commit -m "feat(tracking): add getTrackingData — query open events by campaign (Worker-only)"
```

---

### Task 8: `gmail.detectReplies` — Find Replies by ThreadId Array

**Linear Issue:** `gmail.detectReplies` — find replies by threadId array (2 pts, Medium)

**Files:**
- Create: `src/modules/gmail/detect-replies.ts`
- Create: `src/modules/gmail/__tests__/detectReplies.test.ts`
- Modify: `src/modules/gmail/index.ts` (add export)
- Modify: `src/sdk/spec.ts` (add spec entry)
- Modify: `src/sdk/runtime.ts` (add runtime registration)

**Step 1: Write the failing test**

Create `src/modules/gmail/__tests__/detectReplies.test.ts`:

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { detectReplies } from '../detect-replies.js';

describe('detectReplies', () => {
  let mockContext: any;
  let mockGmailApi: any;

  beforeEach(() => {
    mockGmailApi = {
      users: {
        threads: {
          get: jest.fn(),
        },
        getProfile: jest.fn().mockResolvedValue({
          data: { emailAddress: 'me@example.com' },
        }),
      },
    };
    mockContext = {
      gmail: mockGmailApi,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: { track: jest.fn() },
      startTime: Date.now(),
    };
  });

  test('detects replies from other participants', async () => {
    mockGmailApi.users.threads.get.mockResolvedValue({
      data: {
        id: 'thread1',
        messages: [
          {
            id: 'msg1',
            payload: { headers: [{ name: 'From', value: 'me@example.com' }] },
            internalDate: '1710000000000',
          },
          {
            id: 'msg2',
            payload: { headers: [{ name: 'From', value: 'amy@example.com' }] },
            internalDate: '1710100000000',
          },
        ],
      },
    });

    const result = await detectReplies({ threadIds: ['thread1'] }, mockContext);

    expect(result.threads).toHaveLength(1);
    expect(result.threads[0].threadId).toBe('thread1');
    expect(result.threads[0].hasReply).toBe(true);
    expect(result.threads[0].replies).toHaveLength(1);
    expect(result.threads[0].replies[0].from).toBe('amy@example.com');
  });

  test('returns hasReply false for no external replies', async () => {
    mockGmailApi.users.threads.get.mockResolvedValue({
      data: {
        id: 'thread2',
        messages: [
          {
            id: 'msg1',
            payload: { headers: [{ name: 'From', value: 'me@example.com' }] },
            internalDate: '1710000000000',
          },
        ],
      },
    });

    const result = await detectReplies({ threadIds: ['thread2'] }, mockContext);

    expect(result.threads[0].hasReply).toBe(false);
    expect(result.threads[0].replies).toHaveLength(0);
  });
});
```

**Step 2: Implement `detectReplies` in `src/modules/gmail/detect-replies.ts`**

```typescript
/**
 * Gmail reply detection — find replies by thread IDs
 *
 * Composes existing getThread + getProfile to identify replies from
 * participants other than the authenticated user.
 */

import type { GmailContext } from '../types.js';

export interface DetectRepliesOptions {
  /** Array of Gmail thread IDs to check for replies */
  threadIds: string[];
}

interface ReplyInfo {
  messageId: string;
  from: string;
  date: string;
}

interface ThreadReplyResult {
  threadId: string;
  hasReply: boolean;
  replies: ReplyInfo[];
}

export interface DetectRepliesResult {
  threads: ThreadReplyResult[];
}

/**
 * Check threads for replies from external participants.
 * Filters out messages from the authenticated user (sender).
 *
 * @param options Thread IDs to check
 * @param context Gmail API context
 * @returns Per-thread reply data
 */
export async function detectReplies(
  options: DetectRepliesOptions,
  context: GmailContext
): Promise<DetectRepliesResult> {
  // Get authenticated user email
  const profile = await context.gmail.users.getProfile({ userId: 'me' });
  const myEmail = (profile.data.emailAddress || '').toLowerCase();

  const threads: ThreadReplyResult[] = [];

  for (const threadId of options.threadIds) {
    try {
      const threadData = await context.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['From'],
      });

      const messages = threadData.data.messages || [];
      const replies: ReplyInfo[] = [];

      for (const msg of messages) {
        const fromHeader = msg.payload?.headers?.find(
          (h: { name?: string }) => h.name?.toLowerCase() === 'from'
        );
        const from = fromHeader?.value || '';
        const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;

        if (fromEmail.toLowerCase() !== myEmail) {
          replies.push({
            messageId: msg.id || '',
            from,
            date: msg.internalDate
              ? new Date(Number(msg.internalDate)).toISOString()
              : '',
          });
        }
      }

      threads.push({ threadId, hasReply: replies.length > 0, replies });
    } catch (err) {
      context.logger.error('Failed to check thread for replies', { threadId, error: err });
      threads.push({ threadId, hasReply: false, replies: [] });
    }
  }

  context.performanceMonitor.track('gmail:detectReplies', Date.now() - context.startTime);
  return { threads };
}
```

**Step 3: Export, add spec, add runtime registration**

Export from `src/modules/gmail/index.ts`:

```typescript
// Reply detection
export { detectReplies } from './detect-replies.js';
export type { DetectRepliesOptions, DetectRepliesResult } from './detect-replies.js';
```

SDK spec (add after `getTrackingData`):

```typescript
    detectReplies: {
      signature: "detectReplies(options: { threadIds: string[] }): Promise<{ threads: ThreadReplyResult[] }>",
      description: "Check threads for replies from external participants. Returns per-thread reply data. Use with threadIds from sendBatch results.",
      example: "const data = await sdk.gmail.detectReplies({ threadIds: ['thread1', 'thread2'] });\ndata.threads.filter(t => t.hasReply).forEach(t => console.log(t.threadId, t.replies));",
      params: {
        threadIds: "string[] (required) — Gmail thread IDs to check (from sendBatch/sendFromTemplate results)",
      },
      returns: "{ threads: [{ threadId, hasReply, replies: [{ messageId, from, date }] }] }",
    },
```

Runtime registration:

```typescript
      detectReplies: limiter.wrap('gmail', async (opts: unknown) => {
        const { detectReplies } = await import('../modules/gmail/index.js');
        return detectReplies(opts as Parameters<typeof detectReplies>[0], context);
      }),
```

**Step 4: Run tests, type-check, commit**

```bash
npx jest src/modules/gmail/__tests__/detectReplies.test.ts --no-coverage
npm run type-check
git add src/modules/gmail/detect-replies.ts src/modules/gmail/__tests__/detectReplies.test.ts src/modules/gmail/index.ts src/sdk/spec.ts src/sdk/runtime.ts
git commit -m "feat(gmail): add detectReplies — find external replies by thread IDs"
```

---

### Task 9: `sheets.updateRecords` — Update Sheet Rows by Key Match

**Linear Issue:** `sheets.updateRecords` — update Sheet rows by key column match (2 pts, Medium)

**Files:**
- Modify: `src/modules/sheets/update.ts` (add updateRecords function + types)
- Modify: `src/modules/sheets/index.ts` (add export)
- Modify: `src/sdk/spec.ts` (add spec entry)
- Modify: `src/sdk/runtime.ts` (add runtime registration)
- Create: `src/modules/sheets/__tests__/updateRecords.test.ts`

**Step 1: Write the failing test**

Create `src/modules/sheets/__tests__/updateRecords.test.ts`:

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { updateRecords } from '../update.js';

describe('updateRecords', () => {
  let mockContext: any;
  let mockSheetsApi: any;

  beforeEach(() => {
    mockSheetsApi = {
      spreadsheets: {
        values: {
          get: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
        },
      },
    };
    mockContext = {
      sheets: mockSheetsApi,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      cacheManager: {
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: { track: jest.fn() },
      startTime: Date.now(),
    };
  });

  test('updates cells by matching key column', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Contacts!A1:D3',
        values: [
          ['email', 'name', 'status', 'sentDate'],
          ['amy@example.com', 'Amy', 'pending', ''],
          ['bob@example.com', 'Bob', 'pending', ''],
        ],
      },
    });

    const result = await updateRecords({
      spreadsheetId: 'abc123',
      range: 'Contacts!A:D',
      keyColumn: 'email',
      updates: [
        { key: 'amy@example.com', values: { status: 'sent', sentDate: '2026-03-10' } },
      ],
    }, mockContext);

    expect(result.updated).toBe(1);
    // Should have called update for the matching row
    expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalled();
  });

  test('reports not found keys', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        range: 'Sheet1!A1:B2',
        values: [
          ['email', 'status'],
          ['amy@example.com', 'pending'],
        ],
      },
    });

    const result = await updateRecords({
      spreadsheetId: 'abc123',
      range: 'Sheet1!A:B',
      keyColumn: 'email',
      updates: [
        { key: 'nonexistent@example.com', values: { status: 'sent' } },
      ],
    }, mockContext);

    expect(result.updated).toBe(0);
    expect(result.notFound).toEqual(['nonexistent@example.com']);
  });
});
```

**Step 2: Implement `updateRecords` in `src/modules/sheets/update.ts`**

Add after the `appendRows` function:

```typescript
/**
 * Options for updating records by key column match
 */
export interface UpdateRecordsOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Range in A1 notation covering all columns (e.g., "Contacts!A:G") */
  range: string;
  /** Header name of the key column to match against */
  keyColumn: string;
  /** Array of updates: each has a key to match and values to set */
  updates: Array<{
    key: string;
    values: Record<string, unknown>;
  }>;
  /** Optional sheet name (if not in range) */
  sheetName?: string;
}

/**
 * Result of updating records
 */
export interface UpdateRecordsResult {
  updated: number;
  notFound: string[];
  message: string;
}

/**
 * Convert a 0-based column index to A1 notation letter(s).
 * 0 → A, 1 → B, 25 → Z, 26 → AA, etc.
 */
function columnToLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Update cells in a Sheet by matching a key column.
 * Reads the sheet, finds rows matching the key, computes cell ranges, and updates.
 *
 * @param options Update parameters with key column and values
 * @param context Sheets API context
 * @returns Update confirmation with counts
 */
export async function updateRecords(
  options: UpdateRecordsOptions,
  context: SheetsContext
): Promise<UpdateRecordsResult> {
  const { spreadsheetId, range, keyColumn, updates, sheetName } = options;

  // Build resolved range
  let resolvedRange = range;
  if (sheetName && !range.includes('!')) {
    resolvedRange = `${sheetName}!${range}`;
  }

  // Read existing data
  const response = await context.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: resolvedRange,
  });

  const values = (response.data.values ?? []) as unknown[][];
  if (values.length === 0) {
    throw new Error('No data found in the specified range');
  }

  const headers = (values[0] as string[]).map(h => String(h));
  const keyColIndex = headers.indexOf(keyColumn);
  if (keyColIndex === -1) {
    throw new Error(`Key column '${keyColumn}' not found in headers: ${headers.join(', ')}`);
  }

  // Extract sheet name prefix from the resolved range for building cell references
  const sheetPrefix = resolvedRange.includes('!') ? resolvedRange.split('!')[0] + '!' : '';

  let updated = 0;
  const notFound: string[] = [];

  for (const update of updates) {
    // Find matching row (1-indexed: row 1 = headers, data starts at row 2)
    const rowIndex = values.findIndex((row, i) => i > 0 && String(row[keyColIndex]) === update.key);

    if (rowIndex === -1) {
      notFound.push(update.key);
      continue;
    }

    // Update each specified column
    for (const [colName, value] of Object.entries(update.values)) {
      const colIndex = headers.indexOf(colName);
      if (colIndex === -1) continue; // skip unknown columns

      const cellRef = `${sheetPrefix}${columnToLetter(colIndex)}${rowIndex + 1}`;

      await context.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellRef,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
      });
    }

    updated++;
  }

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);
  context.performanceMonitor.track('sheets:updateRecords', Date.now() - context.startTime);

  return {
    updated,
    notFound,
    message: `Updated ${updated} records. ${notFound.length > 0 ? `Not found: ${notFound.join(', ')}` : ''}`.trim(),
  };
}
```

**Step 3: Export, add spec, add runtime registration**

Export from `src/modules/sheets/index.ts` (add to update exports):

```typescript
export {
  updateCells,
  updateFormula,
  appendRows,
  updateRecords,
  type UpdateCellsOptions,
  type UpdateCellsResult,
  type UpdateFormulaOptions,
  type UpdateFormulaResult,
  type AppendRowsOptions,
  type AppendRowsResult,
  type UpdateRecordsOptions,
  type UpdateRecordsResult,
} from './update.js';
```

SDK spec (add after `appendRows` in sheets section):

```typescript
    updateRecords: {
      signature: "updateRecords(options: { spreadsheetId: string, range: string, keyColumn: string, updates: UpdateEntry[] }): Promise<{ updated, notFound, message }>",
      description: "Update cells by matching a key column. Reads the sheet, finds rows where keyColumn matches, and updates specified columns. Closes the outreach loop: send emails → get results → write status back to Sheet.",
      example: "await sdk.sheets.updateRecords({\n  spreadsheetId: 'abc123',\n  range: 'Contacts!A:G',\n  keyColumn: 'email',\n  updates: [\n    { key: 'amy@example.com', values: { status: 'sent', sentDate: '2026-03-10' } },\n  ],\n});",
      params: {
        spreadsheetId: "string (required) — Google Sheets spreadsheet ID",
        range: "string (required) — A1 notation range covering all columns",
        keyColumn: "string (required) — header name of the column to match against",
        updates: "UpdateEntry[] (required) — [{ key: string, values: Record<string, unknown> }]",
        sheetName: "string (optional) — sheet name if not in range",
      },
      returns: "{ updated: number, notFound: string[], message: string }",
    },
```

Runtime registration (add after `appendRows` in sheets section):

```typescript
      updateRecords: limiter.wrap('sheets', async (opts: unknown) => {
        const { updateRecords } = await import('../modules/sheets/index.js');
        return updateRecords(opts as Parameters<typeof updateRecords>[0], context);
      }),
```

**Step 4: Run tests, type-check, commit**

```bash
npx jest src/modules/sheets/__tests__/updateRecords.test.ts --no-coverage
npm run type-check
git add src/modules/sheets/update.ts src/modules/sheets/index.ts src/modules/sheets/__tests__/updateRecords.test.ts src/sdk/spec.ts src/sdk/runtime.ts
git commit -m "feat(sheets): add updateRecords — update rows by key column match"
```

---

## Linear Issues Summary

### P0 (GDRIVE team) — Phase 1

| # | Title | Priority | Estimate | Labels |
|---|-------|----------|----------|--------|
| 1 | `gmail.sendFromTemplate` — template rendering (subject + body) + send | Urgent | 3 pts | feat, gmail, outreach |
| 2 | `gmail.dryRun` — preview rendered email without sending | High | 1 pt | feat, gmail, outreach |
| 3 | `sheets.readAsRecords` — read Sheet as array of keyed objects | High | 2 pts | feat, sheets, outreach |
| 4 | `gmail.sendBatch` — batch send with throttling, dryRun flag, structured results | High | 3 pts | feat, gmail, outreach |

### P1 (GDRIVE team) — Phase 2

| # | Title | Priority | Estimate | Labels |
|---|-------|----------|----------|--------|
| 5 | CF Worker tracking pixel endpoint + KV schema | Medium | 2 pts | feat, tracking, infra |
| 6 | `gmail.getTrackingData` — query open events by campaign (Worker-only) | Medium | 1 pt | feat, tracking |
| 7 | `gmail.detectReplies` — find replies by threadId array | Medium | 2 pts | feat, gmail, outreach |
| 8 | `sheets.updateRecords` — update Sheet rows by key column match | Medium | 2 pts | feat, sheets, outreach |

### Pre-req (triage before P1)

| # | Title | Priority | Estimate | Labels |
|---|-------|----------|----------|--------|
| — | Triage GDRIVE-10 monitoring alert | High | 1 pt | bug, ops |
| — | Triage GDRIVE-13 monitoring alert | High | 1 pt | bug, ops |

**Total:** 17 pts across 10 issues

---

## Dependency Graph

```
Task 1 (readAsRecords) ─────────────────────── independent
Task 2 (renderTemplate) ──┐
Task 3 (dryRun) ──────────┤── depends on Task 2
Task 4 (sendFromTemplate) ┤
Task 5 (sendBatch) ───────┘── depends on Task 2 + Task 4
Task 6 (tracking pixel) ──┐
Task 7 (getTrackingData) ─┘── depends on Task 6
Task 8 (detectReplies) ─────── independent
Task 9 (updateRecords) ──────── independent
```

**Parallelizable:** Tasks 1, 2, 8, 9 can all be built concurrently.
