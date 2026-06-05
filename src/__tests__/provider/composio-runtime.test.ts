import { describe, expect, it, jest } from '@jest/globals';
import { SDKComposioProviderRuntime } from '../../provider/composio/runtime.js';

function makeRuntime() {
  const execute = jest.fn(async () => ({
    data: {
      files: [
        {
          id: 'file-1',
          name: 'Smoke Doc',
          mime_type: 'application/vnd.google-apps.document',
          created_time: '2026-06-01T00:00:00Z',
          modified_time: '2026-06-02T00:00:00Z',
          web_view_link: 'https://drive.example/file-1',
        },
      ],
    },
  }));
  const toolkits = jest.fn(async () => ({
    items: [
      {
        slug: 'googledrive',
        name: 'Google Drive',
        connection: {
          isActive: true,
          authConfig: {
            isComposioManaged: true,
            mode: 'OAUTH2',
          },
          connectedAccount: {
            status: 'ACTIVE',
            id: 'redacted',
          },
        },
      },
    ],
  }));
  const create = jest.fn(async () => ({
    sessionId: 'session-1',
    execute,
    toolkits,
  }));

  const runtime = new SDKComposioProviderRuntime(
    { apiKey: 'test-key', userId: 'aoj-workbench-test' },
    () => ({ create })
  );

  return { runtime, create, execute, toolkits };
}

describe('SDKComposioProviderRuntime', () => {
  it('discovers AOJ Workbench operations without exposing raw Composio tool slugs', async () => {
    const { runtime } = makeRuntime();

    const discovery = await runtime.discover('drive', 'search');

    expect(discovery.provider).toBe('composio');
    expect(discovery.configured).toBe(true);
    expect(discovery.operations.search).toEqual(
      expect.objectContaining({
        service: 'drive',
        operation: 'search',
        provider: 'composio',
        toolkit: 'googledrive',
      })
    );
    expect(JSON.stringify(discovery.operations.search)).not.toContain('GOOGLEDRIVE_FIND_FILE');
    expect(JSON.stringify(discovery.operations.search)).not.toContain('connectedAccount');
  });

  it('rejects invalid drive.search arguments before provider execution', async () => {
    const { runtime, execute } = makeRuntime();

    await expect(runtime.execute({
      service: 'drive',
      operation: 'search',
      args: { query: '' },
    })).rejects.toThrow('drive.search requires a non-empty query string');

    expect(execute).not.toHaveBeenCalled();
  });

  it('executes drive.search through the session and normalizes bounded results', async () => {
    const { runtime, create, execute } = makeRuntime();

    const result = await runtime.execute({
      service: 'drive',
      operation: 'search',
      args: { query: 'smoke', pageSize: 5 },
    });

    expect(create).toHaveBeenCalledWith('aoj-workbench-test', expect.objectContaining({
      toolkits: { enable: expect.arrayContaining(['googledrive', 'gmail', 'googlecalendar']) },
      workbench: { enable: false },
    }));
    expect(execute).toHaveBeenCalledWith('GOOGLEDRIVE_FIND_FILE', {
      q: 'smoke',
      pageSize: 5,
      page_size: 5,
    });
    expect(result).toEqual({
      query: 'smoke',
      totalResults: 1,
      files: [
        {
          id: 'file-1',
          name: 'Smoke Doc',
          mimeType: 'application/vnd.google-apps.document',
          createdTime: '2026-06-01T00:00:00Z',
          modifiedTime: '2026-06-02T00:00:00Z',
          webViewLink: 'https://drive.example/file-1',
        },
      ],
    });
  });

  it('fails closed when Composio credentials are missing', async () => {
    const runtime = new SDKComposioProviderRuntime({});

    await expect(runtime.execute({
      service: 'drive',
      operation: 'search',
      args: { query: 'smoke' },
    })).rejects.toThrow('Composio provider runtime is not configured');
  });
});
