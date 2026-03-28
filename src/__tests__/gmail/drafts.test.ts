/**
 * Unit tests for Gmail draft management operations:
 * listDrafts, getDraft, updateDraft, deleteDraft
 */

import { describe, it, expect, jest } from '@jest/globals';
import type { GmailContext } from '../../modules/types.js';
import { listDrafts, getDraft, updateDraft, deleteDraft } from '../../modules/gmail/drafts.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeContext(gmailOverride: unknown): GmailContext {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as GmailContext['logger'],
    cacheManager: {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn() as unknown as GmailContext['cacheManager']['invalidate'],
    } as unknown as GmailContext['cacheManager'],
    performanceMonitor: {
      track: jest.fn(),
    } as unknown as GmailContext['performanceMonitor'],
    startTime: Date.now(),
    gmail: gmailOverride as GmailContext['gmail'],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// listDrafts
// ──────────────────────────────────────────────────────────────────────────────

describe('listDrafts', () => {
  it('returns paginated draft summaries with subject and snippet', async () => {
    const gmail = {
      users: {
        drafts: {
          list: jest.fn().mockImplementation(async () => ({
            data: {
              drafts: [{ id: 'draft1' }],
              nextPageToken: 'token123',
              resultSizeEstimate: 1,
            },
          })),
          get: jest.fn().mockImplementation(async () => ({
            data: {
              message: {
                id: 'msg1',
                snippet: 'Hello there',
                payload: {
                  headers: [
                    { name: 'Subject', value: 'Test Subject' },
                    { name: 'To', value: 'recipient@example.com' },
                  ],
                },
              },
            },
          })),
        },
      },
    };

    const context = makeContext(gmail);
    const result = await listDrafts({ maxResults: 5 }, context);

    expect(result.drafts).toHaveLength(1);
    const draft = result.drafts[0];
    expect(draft).toBeDefined();
    expect(draft!.draftId).toBe('draft1');
    expect(draft!.messageId).toBe('msg1');
    expect(draft!.subject).toBe('Test Subject');
    expect(draft!.to).toBe('recipient@example.com');
    expect(draft!.snippet).toBe('Hello there');
    expect(result.nextPageToken).toBe('token123');
    expect(result.resultSizeEstimate).toBe(1);
  });

  it('returns empty array when no drafts exist', async () => {
    const gmail = {
      users: {
        drafts: {
          list: jest.fn().mockImplementation(async () => ({
            data: {
              drafts: [],
              resultSizeEstimate: 0,
            },
          })),
          get: jest.fn(),
        },
      },
    };

    const context = makeContext(gmail);
    const result = await listDrafts({}, context);

    expect(result.drafts).toHaveLength(0);
    expect(result.nextPageToken).toBeUndefined();
    expect(result.resultSizeEstimate).toBe(0);
  });

  it('falls back gracefully when individual draft fetch fails', async () => {
    const gmail = {
      users: {
        drafts: {
          list: jest.fn().mockImplementation(async () => ({
            data: {
              drafts: [{ id: 'draft1' }],
              resultSizeEstimate: 1,
            },
          })),
          get: jest.fn().mockImplementation(async () => {
            throw new Error('Fetch failed');
          }),
        },
      },
    };

    const context = makeContext(gmail);
    const result = await listDrafts({}, context);

    // Should still return the draft with fallback values
    expect(result.drafts).toHaveLength(1);
    const draft = result.drafts[0];
    expect(draft).toBeDefined();
    expect(draft!.draftId).toBe('draft1');
    expect(draft!.subject).toBe('(unavailable)');
  });

  it('uses default maxResults of 10', async () => {
    const listFn = jest.fn().mockImplementation(async () => ({
      data: { drafts: [], resultSizeEstimate: 0 },
    }));

    const gmail = {
      users: {
        drafts: {
          list: listFn,
          get: jest.fn(),
        },
      },
    };

    const context = makeContext(gmail);
    await listDrafts({}, context);

    expect(listFn).toHaveBeenCalledWith(
      expect.objectContaining({ maxResults: 10 })
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getDraft
// ──────────────────────────────────────────────────────────────────────────────

describe('getDraft', () => {
  it('returns full draft content with parsed headers and body', async () => {
    const gmail = {
      users: {
        drafts: {
          get: jest.fn().mockImplementation(async () => ({
            data: {
              message: {
                id: 'msg1',
                threadId: 'thread1',
                snippet: 'Hello world',
                payload: {
                  mimeType: 'text/plain',
                  headers: [
                    { name: 'Subject', value: 'My Draft Subject' },
                    { name: 'To', value: 'to@example.com' },
                    { name: 'From', value: 'from@example.com' },
                    { name: 'Cc', value: 'cc@example.com' },
                    { name: 'Bcc', value: '' },
                    { name: 'Date', value: 'Mon, 1 Jan 2026 00:00:00 +0000' },
                  ],
                  body: {
                    data: Buffer.from('Hello world').toString('base64'),
                  },
                },
              },
            },
          })),
        },
      },
    };

    const context = makeContext(gmail);
    const result = await getDraft({ draftId: 'draft1' }, context);

    expect(result.draftId).toBe('draft1');
    expect(result.messageId).toBe('msg1');
    expect(result.threadId).toBe('thread1');
    expect(result.subject).toBe('My Draft Subject');
    expect(result.to).toBe('to@example.com');
    expect(result.from).toBe('from@example.com');
    expect(result.cc).toBe('cc@example.com');
    expect(result.body).toBe('Hello world');
    expect(result.isHtml).toBe(false);
    expect(result.snippet).toBe('Hello world');
  });

  it('parses HTML body and sets isHtml=true', async () => {
    const htmlBody = '<p>Hello world</p>';
    const gmail = {
      users: {
        drafts: {
          get: jest.fn().mockImplementation(async () => ({
            data: {
              message: {
                id: 'msg1',
                threadId: 'thread1',
                snippet: '',
                payload: {
                  mimeType: 'text/html',
                  headers: [{ name: 'Subject', value: 'HTML Draft' }],
                  body: {
                    data: Buffer.from(htmlBody).toString('base64'),
                  },
                },
              },
            },
          })),
        },
      },
    };

    const context = makeContext(gmail);
    const result = await getDraft({ draftId: 'draft1' }, context);

    expect(result.body).toBe(htmlBody);
    expect(result.isHtml).toBe(true);
  });

  it('handles multipart messages, preferring plain text', async () => {
    const plainBody = 'Hello from plain text part';
    const htmlBody = '<p>Hello from HTML part</p>';
    const gmail = {
      users: {
        drafts: {
          get: jest.fn().mockImplementation(async () => ({
            data: {
              message: {
                id: 'msg1',
                threadId: 'thread1',
                snippet: '',
                payload: {
                  mimeType: 'multipart/alternative',
                  headers: [{ name: 'Subject', value: 'Multipart Draft' }],
                  parts: [
                    {
                      mimeType: 'text/plain',
                      body: { data: Buffer.from(plainBody).toString('base64') },
                    },
                    {
                      mimeType: 'text/html',
                      body: { data: Buffer.from(htmlBody).toString('base64') },
                    },
                  ],
                },
              },
            },
          })),
        },
      },
    };

    const context = makeContext(gmail);
    const result = await getDraft({ draftId: 'draft1' }, context);

    expect(result.body).toBe(plainBody);
    expect(result.isHtml).toBe(false);
  });

  it('falls back to (no subject) when Subject header is missing', async () => {
    const gmail = {
      users: {
        drafts: {
          get: jest.fn().mockImplementation(async () => ({
            data: {
              message: {
                id: 'msg1',
                threadId: 'thread1',
                snippet: '',
                payload: {
                  mimeType: 'text/plain',
                  headers: [],
                  body: { data: Buffer.from('body').toString('base64') },
                },
              },
            },
          })),
        },
      },
    };

    const context = makeContext(gmail);
    const result = await getDraft({ draftId: 'draft1' }, context);

    expect(result.subject).toBe('(no subject)');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// updateDraft
// ──────────────────────────────────────────────────────────────────────────────

describe('updateDraft', () => {
  it('calls drafts.update with encoded message and returns updated draft info', async () => {
    const updateFn = jest.fn().mockImplementation(async () => ({
      data: {
        id: 'draft1',
        message: { id: 'newMsg1', threadId: 'thread1' },
      },
    }));

    const gmail = {
      users: {
        drafts: {
          update: updateFn,
        },
      },
    };

    const context = makeContext(gmail);
    const result = await updateDraft(
      {
        draftId: 'draft1',
        to: ['recipient@example.com'],
        subject: 'Updated Subject',
        body: 'Updated body.',
      },
      context
    );

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'me',
        id: 'draft1',
        requestBody: expect.objectContaining({
          message: expect.objectContaining({ raw: expect.any(String) }),
        }),
      })
    );

    expect(result.draftId).toBe('draft1');
    expect(result.messageId).toBe('newMsg1');
    expect(result.threadId).toBe('thread1');
    expect(result.message).toBe('Draft updated successfully');
  });

  it('invalidates cache after update', async () => {
    const gmail = {
      users: {
        drafts: {
          update: jest.fn().mockImplementation(async () => ({
            data: { id: 'draft1', message: { id: 'msg1', threadId: 'thread1' } },
          })),
        },
      },
    };

    const context = makeContext(gmail);
    await updateDraft(
      { draftId: 'draft1', to: ['r@example.com'], subject: 'S', body: 'B' },
      context
    );

    expect(context.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// deleteDraft
// ──────────────────────────────────────────────────────────────────────────────

describe('deleteDraft', () => {
  it('calls drafts.delete and returns confirmation', async () => {
    const deleteFn = jest.fn().mockImplementation(async () => ({ data: {} }));

    const gmail = {
      users: {
        drafts: {
          delete: deleteFn,
        },
      },
    };

    const context = makeContext(gmail);
    const result = await deleteDraft({ draftId: 'draft1' }, context);

    expect(deleteFn).toHaveBeenCalledWith({
      userId: 'me',
      id: 'draft1',
    });

    expect(result.draftId).toBe('draft1');
    expect(result.message).toBe('Draft draft1 deleted');
  });

  it('invalidates cache after deletion', async () => {
    const gmail = {
      users: {
        drafts: {
          delete: jest.fn().mockImplementation(async () => ({ data: {} })),
        },
      },
    };

    const context = makeContext(gmail);
    await deleteDraft({ draftId: 'draft1' }, context);

    expect(context.cacheManager.invalidate).toHaveBeenCalledWith('gmail:list');
  });

  it('propagates errors from the Gmail API', async () => {
    const gmail = {
      users: {
        drafts: {
          delete: jest.fn().mockImplementation(async () => {
            throw new Error('Draft not found');
          }),
        },
      },
    };

    const context = makeContext(gmail);

    await expect(deleteDraft({ draftId: 'missing-draft' }, context)).rejects.toThrow(
      'Draft not found'
    );
  });
});
