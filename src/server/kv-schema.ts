/**
 * KV schema definitions for the CF Worker tracking pixel system.
 *
 * Key design principles:
 * - All tracking keys share the `tracking:` prefix for namespace isolation
 * - Summary records aggregate per-recipient data under a single KV key per campaign
 *   (one read to get all opens for a campaign — efficient for listing)
 * - 90-day TTL keeps KV clean without manual pruning
 *
 * Key patterns:
 *
 *   tracking:summary:{campaignId}
 *     → TrackingSummary (JSON)
 *     → Contains all recipient open events for the campaign
 *     → Supports prefix scan via KV list({ prefix: 'tracking:summary:' })
 *
 * Example queries:
 *   - All opens for campaign "q1-launch":  kv.get('tracking:summary:q1-launch')
 *   - All campaigns (paginated):           kv.list({ prefix: 'tracking:summary:' })
 */

// ─── Key Helpers ─────────────────────────────────────────────

/** Namespace prefix for all tracking keys. */
export const TRACKING_PREFIX = 'tracking:' as const;

/** Sub-prefix for campaign summary records. */
export const SUMMARY_PREFIX = `${TRACKING_PREFIX}summary:` as const;

/**
 * Returns the KV key for a campaign's summary record.
 * Key: `tracking:summary:{campaignId}`
 */
export function summaryKey(campaignId: string): string {
  return `${SUMMARY_PREFIX}${campaignId}`;
}

// ─── TTL ─────────────────────────────────────────────────────

/** Default TTL for tracking records: 90 days in seconds. */
export const TRACKING_TTL_SECONDS = 90 * 24 * 60 * 60; // 7_776_000

// ─── KV Value Types ──────────────────────────────────────────

/**
 * Per-recipient open tracking data.
 * Stored as a nested value inside TrackingSummary.recipients.
 */
export interface RecipientTracking {
  /** Total number of pixel requests from this recipient. */
  openCount: number;
  /** ISO 8601 timestamp of the first pixel request. */
  firstOpenedAt: string;
  /** ISO 8601 timestamp of the most recent pixel request. */
  lastOpenedAt: string;
}

/**
 * Summary record for a single campaign.
 * Stored at `tracking:summary:{campaignId}` as a JSON string.
 *
 * Schema version: 1
 */
export interface TrackingSummary {
  /** Campaign identifier matching the URL segment. */
  campaignId: string;
  /** Total pixel requests across all recipients (includes re-opens). */
  totalOpens: number;
  /** Number of distinct recipients who opened at least once. */
  uniqueOpens: number;
  /**
   * Per-recipient tracking data.
   * Key: recipientId (URL segment).
   * Value: RecipientTracking.
   */
  recipients: Record<string, RecipientTracking>;
  /** ISO 8601 timestamp of the last write to this record. */
  updatedAt: string;
}

// ─── KV Interface ────────────────────────────────────────────

/**
 * Minimal KV interface used by the tracking module.
 * Compatible with Cloudflare Workers KVNamespace.
 */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
