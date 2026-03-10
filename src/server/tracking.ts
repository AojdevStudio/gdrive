/**
 * CF Worker tracking pixel endpoint and tracking data query.
 *
 * Handles GET /track/:campaignId/:recipientId/pixel.gif
 * - Serves a 1x1 transparent GIF
 * - Writes open events to KV with summary record pattern
 *
 * KV key pattern: tracking:summary:{campaignId}
 * TTL: 90 days (7_776_000 seconds)
 *
 * No googleapis imports — this module only uses KV.
 */

// ─── Types ───────────────────────────────────────────────────

/** Minimal KV interface compatible with CF Workers KVNamespace. */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/** Per-recipient tracking data stored within a campaign summary. */
export interface RecipientTracking {
  openCount: number;
  firstOpenedAt: string;
  lastOpenedAt: string;
}

/** Summary record stored in KV for each campaign. */
export interface TrackingSummary {
  campaignId: string;
  totalOpens: number;
  uniqueOpens: number;
  recipients: Record<string, RecipientTracking>;
  updatedAt: string;
}

/** Result type for getTrackingData(). */
export interface TrackingDataResult {
  campaignId: string;
  totalOpens: number;
  uniqueOpens: number;
  recipients: Array<{
    recipientId: string;
    openCount: number;
    firstOpenedAt: string;
    lastOpenedAt: string;
  }>;
}

// ─── Constants ───────────────────────────────────────────────

/** 1x1 transparent GIF — 43 bytes. */
export const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, 0x01, 0x00,             // 1x1
  0x80, 0x00, 0x00,                   // GCT flag, 2 colors
  0xff, 0xff, 0xff,                   // Color 0: white
  0x00, 0x00, 0x00,                   // Color 1: black
  0x21, 0xf9, 0x04,                   // GCE header
  0x01, 0x00, 0x00, 0x00, 0x00,       // GCE: transparent index 0
  0x2c, 0x00, 0x00, 0x00, 0x00,       // Image descriptor
  0x01, 0x00, 0x01, 0x00, 0x00,       // 1x1, no local CT
  0x02, 0x02, 0x44, 0x01, 0x00,       // LZW min code size 2, data
  0x3b,                               // Trailer
]);

const KV_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days = 7_776_000s

// ─── URL Parsing ─────────────────────────────────────────────

interface TrackingParams {
  campaignId: string;
  recipientId: string;
}

/**
 * Parses /track/:campaignId/:recipientId/pixel.gif from a URL pathname.
 * Returns null if the path doesn't match the expected pattern.
 */
function parseTrackingPath(pathname: string): TrackingParams | null {
  // Expected: /track/<campaignId>/<recipientId>/pixel.gif
  const parts = pathname.split('/').filter(Boolean);
  // parts should be: ['track', campaignId, recipientId, 'pixel.gif']
  if (parts.length !== 4) {
    return null;
  }
  if (parts[0] !== 'track') {
    return null;
  }
  if (parts[3] !== 'pixel.gif') {
    return null;
  }

  const campaignId = parts[1];
  const recipientId = parts[2];

  if (!campaignId || !recipientId) {
    return null;
  }

  return { campaignId, recipientId };
}

// ─── Request Handler ─────────────────────────────────────────

/**
 * Handles a tracking pixel request.
 * Serves the 1x1 GIF and records the open event in KV.
 */
export async function handleTrackingRequest(
  request: Request,
  kv: KVLike
): Promise<Response> {
  const url = new URL(request.url);
  const params = parseTrackingPath(url.pathname);

  if (!params) {
    return new Response('Not Found', { status: 404 });
  }

  const { campaignId, recipientId } = params;
  const now = new Date().toISOString();
  const kvKey = `tracking:summary:${campaignId}`;

  // Read existing summary (or start fresh)
  // NOTE: This is a read-modify-write on KV. Two concurrent pixel hits may read
  // the same snapshot, causing one write to overwrite the other's increment.
  // For email open tracking this is an acceptable approximation — exact counts
  // are not critical, and the race window is small relative to open frequency.
  const raw = await kv.get(kvKey);
  const summary: TrackingSummary = raw
    ? JSON.parse(raw)
    : {
        campaignId,
        totalOpens: 0,
        uniqueOpens: 0,
        recipients: {},
        updatedAt: now,
      };

  // Update recipient tracking
  const existing = summary.recipients[recipientId];
  if (existing) {
    existing.openCount += 1;
    existing.lastOpenedAt = now;
  } else {
    summary.recipients[recipientId] = {
      openCount: 1,
      firstOpenedAt: now,
      lastOpenedAt: now,
    };
    summary.uniqueOpens += 1;
  }

  summary.totalOpens += 1;
  summary.updatedAt = now;

  // Write back to KV with 90-day TTL
  await kv.put(kvKey, JSON.stringify(summary), { expirationTtl: KV_TTL_SECONDS });

  // Return the transparent GIF
  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.byteLength),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

// ─── Query Function ──────────────────────────────────────────

/**
 * Query open events for a campaign from KV.
 * Returns structured tracking data or an empty result if not found.
 */
export async function getTrackingData(
  opts: { campaignId: string },
  kv: KVLike
): Promise<TrackingDataResult> {
  const { campaignId } = opts;
  const raw = await kv.get(`tracking:summary:${campaignId}`);

  if (!raw) {
    return {
      campaignId,
      totalOpens: 0,
      uniqueOpens: 0,
      recipients: [],
    };
  }

  const summary: TrackingSummary = JSON.parse(raw);

  return {
    campaignId: summary.campaignId,
    totalOpens: summary.totalOpens,
    uniqueOpens: summary.uniqueOpens,
    recipients: Object.entries(summary.recipients).map(([recipientId, data]) => ({
      recipientId,
      openCount: data.openCount,
      firstOpenedAt: data.firstOpenedAt,
      lastOpenedAt: data.lastOpenedAt,
    })),
  };
}
