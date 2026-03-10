/**
 * Tests for CF Worker tracking pixel endpoint and getTrackingData.
 *
 * Task 6: handleTrackingRequest — serves 1x1 GIF, writes to KV
 * Task 7: getTrackingData — queries open events by campaign
 */

import {
  handleTrackingRequest,
  getTrackingData,
  TRANSPARENT_GIF,
  type KVLike,
  type TrackingSummary,
} from '../tracking.js';

/** In-memory KV mock that satisfies KVLike */
function createMockKV(): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      store.set(key, value);
    },
  };
}

function makeRequest(path: string): Request {
  return new Request(`https://worker.example.com${path}`, { method: 'GET' });
}

// ─── Task 6: handleTrackingRequest ───────────────────────────

describe('handleTrackingRequest', () => {
  it('returns a 1x1 transparent GIF with correct headers', async () => {
    const kv = createMockKV();
    const request = makeRequest('/track/campaign-1/recipient-a/pixel.gif');

    const response = await handleTrackingRequest(request, kv);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/gif');
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');

    const body = new Uint8Array(await response.arrayBuffer());
    expect(body).toEqual(TRANSPARENT_GIF);
  });

  it('writes tracking data to KV on first open', async () => {
    const kv = createMockKV();
    const request = makeRequest('/track/campaign-1/recipient-a/pixel.gif');

    await handleTrackingRequest(request, kv);

    const raw = kv.store.get('tracking:summary:campaign-1');
    expect(raw).toBeDefined();

    const summary: TrackingSummary = JSON.parse(raw!);
    expect(summary.campaignId).toBe('campaign-1');
    expect(summary.totalOpens).toBe(1);
    expect(summary.uniqueOpens).toBe(1);
    expect(summary.recipients['recipient-a']).toBeDefined();
    expect(summary.recipients['recipient-a']!.openCount).toBe(1);
    expect(summary.recipients['recipient-a']!.firstOpenedAt).toBeTruthy();
    expect(summary.recipients['recipient-a']!.lastOpenedAt).toBeTruthy();
  });

  it('increments counts on subsequent hits from the same recipient', async () => {
    const kv = createMockKV();
    const request1 = makeRequest('/track/campaign-1/recipient-a/pixel.gif');
    const request2 = makeRequest('/track/campaign-1/recipient-a/pixel.gif');

    await handleTrackingRequest(request1, kv);
    await handleTrackingRequest(request2, kv);

    const summary: TrackingSummary = JSON.parse(
      kv.store.get('tracking:summary:campaign-1')!
    );
    expect(summary.totalOpens).toBe(2);
    expect(summary.uniqueOpens).toBe(1); // same recipient, still 1 unique
    expect(summary.recipients['recipient-a']!.openCount).toBe(2);
  });

  it('returns 404 for malformed tracking URLs', async () => {
    const kv = createMockKV();

    // Missing recipient
    const resp1 = await handleTrackingRequest(
      makeRequest('/track/campaign-1/pixel.gif'),
      kv
    );
    expect(resp1.status).toBe(404);

    // Missing pixel.gif
    const resp2 = await handleTrackingRequest(
      makeRequest('/track/campaign-1/recipient-a'),
      kv
    );
    expect(resp2.status).toBe(404);

    // Completely wrong path
    const resp3 = await handleTrackingRequest(
      makeRequest('/track/'),
      kv
    );
    expect(resp3.status).toBe(404);
  });
});

// ─── Task 7: getTrackingData ─────────────────────────────────

describe('getTrackingData', () => {
  it('returns tracking data for a known campaign', async () => {
    const kv = createMockKV();

    // Simulate two opens from two different recipients
    await handleTrackingRequest(makeRequest('/track/camp-x/user-1/pixel.gif'), kv);
    await handleTrackingRequest(makeRequest('/track/camp-x/user-2/pixel.gif'), kv);

    const result = await getTrackingData({ campaignId: 'camp-x' }, kv);

    expect(result.campaignId).toBe('camp-x');
    expect(result.totalOpens).toBe(2);
    expect(result.uniqueOpens).toBe(2);
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients.map(r => r.recipientId).sort()).toEqual(['user-1', 'user-2']);
  });

  it('returns empty result for an unknown campaign', async () => {
    const kv = createMockKV();

    const result = await getTrackingData({ campaignId: 'nonexistent' }, kv);

    expect(result.campaignId).toBe('nonexistent');
    expect(result.totalOpens).toBe(0);
    expect(result.uniqueOpens).toBe(0);
    expect(result.recipients).toHaveLength(0);
  });
});
