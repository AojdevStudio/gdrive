/**
 * Cloudflare Workers KV cache implementation.
 * Implements CacheManagerLike so it can drop-in replace the Redis CacheManager
 * for the Workers runtime.
 *
 * Token encryption uses the Web Crypto API (crypto.subtle) — available in both
 * Workers and modern Node.js (18+). No Node crypto module required.
 */

import type { CacheManagerLike } from '../modules/types.js';
import type { KVNamespace } from '../auth/workers-auth.js';

// ─── Web Crypto helpers ───────────────────────────────────────────────────────

const ALGORITHM = { name: 'AES-GCM', length: 256 } as const;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

async function importKey(rawKey: string): Promise<CryptoKey> {
  // Key is expected as a base64-encoded 32-byte value (matches GDRIVE_TOKEN_ENCRYPTION_KEY format)
  const keyBytes = Uint8Array.from(atob(rawKey), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', keyBytes, ALGORITHM, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(plaintext: string, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Combine iv + ciphertext and base64-encode for KV storage
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptToken(encryptedBase64: string, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ─── Workers KV Cache ─────────────────────────────────────────────────────────

export class WorkersKVCache implements CacheManagerLike {
  private readonly ttl: number;

  /**
   * @param kv  - KV namespace binding from the Workers `env` object (env.GDRIVE_KV)
   * @param ttl - Default TTL in seconds (default: 300 = 5 minutes)
   */
  constructor(
    private readonly kv: KVNamespace,
    ttl = 300
  ) {
    this.ttl = ttl;
  }

  async get(key: string): Promise<unknown | null> {
    try {
      const raw = await this.kv.get(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      await this.kv.put(key, JSON.stringify(value), { expirationTtl: this.ttl });
    } catch {
      // Non-fatal: Workers KV writes can occasionally fail; log and continue
    }
  }

  async invalidate(pattern: string): Promise<void> {
    // KV does not support pattern-based deletion.
    // For exact key invalidation, pass the full key as pattern.
    // This is a best-effort: only works when pattern equals an exact key.
    try {
      await this.kv.put(pattern, JSON.stringify(null), { expirationTtl: 1 });
    } catch {
      // Ignore
    }
  }
}

// ─── Null Cache (fallback when KV is unavailable) ────────────────────────────

export class NullCache implements CacheManagerLike {
  async get(_key: string): Promise<null> { return null; }
  async set(_key: string, _value: unknown): Promise<void> { /* noop */ }
  async invalidate(_pattern: string): Promise<void> { /* noop */ }
}
