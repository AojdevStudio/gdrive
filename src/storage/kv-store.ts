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

function decodeBase64(value: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    return Uint8Array.from(globalThis.atob(value), (c) => c.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function encodeBase64(value: Uint8Array): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(String.fromCharCode(...value));
  }

  return Buffer.from(value).toString('base64');
}

function getWebCrypto(): Crypto {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl || !cryptoImpl.subtle) {
    throw new Error('Web Crypto API is not available in this runtime');
  }
  return cryptoImpl;
}

async function importKey(rawKey: string): Promise<CryptoKey> {
  // Key is expected as a base64-encoded 32-byte value (matches GDRIVE_TOKEN_ENCRYPTION_KEY format)
  const keyBytes = decodeBase64(rawKey);
  if (keyBytes.length !== 32) {
    throw new Error(`Encryption key must be exactly 32 bytes (got ${keyBytes.length})`);
  }
  return getWebCrypto().subtle.importKey('raw', keyBytes, ALGORITHM, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(plaintext: string, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const webCrypto = getWebCrypto();
  const iv = webCrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await webCrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Combine iv + ciphertext and base64-encode for KV storage
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return encodeBase64(combined);
}

export async function decryptToken(encryptedBase64: string, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const combined = decodeBase64(encryptedBase64);

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await getWebCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
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
      if (raw === null) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return parsed === null ? null : parsed;
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
    // For exact-key invalidation, pass the full key as pattern.
    // If a wildcard is supplied, we cannot invalidate safely and no-op.
    try {
      if (pattern.includes('*')) {
        return;
      }
      await this.kv.delete(pattern);
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
