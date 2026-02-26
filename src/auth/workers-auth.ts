/**
 * OAuth token management for Cloudflare Workers.
 *
 * Uses the fetch() API and Web Crypto for all operations —
 * no googleapis or google-auth-library packages (not Workers-compatible).
 *
 * Token storage is handled via WorkersKVCache (src/storage/kv-store.ts).
 */

import { decryptToken, encryptToken } from '../storage/kv-store.js';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const KV_TOKEN_KEY = 'gdrive:oauth:tokens';
const WORKERS_ENCRYPTED_FORMAT = 'workers-aes-gcm-v1';
const KV_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface WorkersTokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

interface EncryptedWorkersTokenEnvelope {
  format: typeof WORKERS_ENCRYPTED_FORMAT;
  data: string;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Exchange a refresh token for a new access token via the Google token endpoint.
 * Uses fetch() — safe for Workers runtime.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiryDate: number }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await globalThis.fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as TokenResponse;

  return {
    accessToken: data.access_token,
    expiryDate: Date.now() + data.expires_in * 1000,
  };
}

function isWorkersTokenData(value: unknown): value is WorkersTokenData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe.access_token === 'string' &&
    maybe.access_token.length > 0 &&
    typeof maybe.refresh_token === 'string' &&
    maybe.refresh_token.length > 0 &&
    typeof maybe.expiry_date === 'number' &&
    Number.isFinite(maybe.expiry_date) &&
    typeof maybe.token_type === 'string' &&
    typeof maybe.scope === 'string'
  );
}

function isEncryptedEnvelope(value: unknown): value is EncryptedWorkersTokenEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return maybe.format === WORKERS_ENCRYPTED_FORMAT && typeof maybe.data === 'string';
}

function looksLikeVersionedTokenPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe.version === 'string' &&
    typeof maybe.algorithm === 'string' &&
    typeof maybe.data === 'string'
  );
}

function parseJSONOrThrow(raw: string, context: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${context} is not valid JSON`);
  }
}

async function persistEncryptedTokens(
  kv: KVNamespace,
  tokens: WorkersTokenData,
  tokenEncryptionKey: string
): Promise<void> {
  const encrypted = await encryptToken(JSON.stringify(tokens), tokenEncryptionKey);
  const payload: EncryptedWorkersTokenEnvelope = {
    format: WORKERS_ENCRYPTED_FORMAT,
    data: encrypted,
  };

  await kv.put(KV_TOKEN_KEY, JSON.stringify(payload), {
    expirationTtl: KV_TOKEN_TTL_SECONDS,
  });
}

async function loadTokensFromKV(
  raw: string,
  tokenEncryptionKey: string
): Promise<{ tokens: WorkersTokenData; source: 'encrypted' | 'plaintext' }> {
  const parsed = parseJSONOrThrow(raw, 'KV token payload');

  if (isEncryptedEnvelope(parsed)) {
    const decrypted = await decryptToken(parsed.data, tokenEncryptionKey);
    const decryptedPayload = parseJSONOrThrow(decrypted, 'Decrypted KV token payload');
    if (!isWorkersTokenData(decryptedPayload)) {
      throw new Error(
        'Decrypted KV token payload is malformed — expected access_token, refresh_token, expiry_date, token_type, scope'
      );
    }
    return { tokens: decryptedPayload, source: 'encrypted' };
  }

  if (isWorkersTokenData(parsed)) {
    return { tokens: parsed, source: 'plaintext' };
  }

  if (looksLikeVersionedTokenPayload(parsed)) {
    throw new Error(
      'KV token payload uses TokenManager versioned format. Workers expects workers-encrypted tokens. Re-upload tokens using the Workers auth flow.'
    );
  }

  throw new Error(
    'KV token payload is malformed — expected encrypted envelope or WorkersTokenData shape'
  );
}

/**
 * Load tokens from KV, refresh if expired, and return a valid access token.
 *
 * @param kv  - KV namespace binding (env.GDRIVE_KV)
 * @param clientId     - OAuth client ID from env
 * @param clientSecret - OAuth client secret from env
 * @param tokenEncryptionKey - Base64-encoded 32-byte encryption key
 * @param preemptiveMs - Refresh this many ms before actual expiry (default: 5 min)
 */
export async function getValidAccessToken(
  kv: KVNamespace,
  clientId: string,
  clientSecret: string,
  tokenEncryptionKey: string,
  preemptiveMs = 5 * 60 * 1000
): Promise<string> {
  if (!tokenEncryptionKey) {
    throw new Error('GDRIVE_TOKEN_ENCRYPTION_KEY is required for Workers KV token handling');
  }

  const raw = await kv.get(KV_TOKEN_KEY);
  if (!raw) {
    throw new Error(
      'No OAuth tokens found in KV. Run the auth flow (node ./dist/index.js auth) and upload tokens to KV.'
    );
  }

  const { tokens, source } = await loadTokensFromKV(raw, tokenEncryptionKey);

  // One-time migration path for legacy plaintext KV tokens.
  if (source === 'plaintext') {
    await persistEncryptedTokens(kv, tokens, tokenEncryptionKey);
  }

  const needsRefresh = Date.now() >= tokens.expiry_date - preemptiveMs;

  if (!needsRefresh) {
    return tokens.access_token;
  }

  // Refresh and persist back to KV
  const { accessToken, expiryDate } = await refreshAccessToken(
    tokens.refresh_token,
    clientId,
    clientSecret
  );

  const updated: WorkersTokenData = {
    ...tokens,
    access_token: accessToken,
    expiry_date: expiryDate,
  };

  await persistEncryptedTokens(kv, updated, tokenEncryptionKey);

  return accessToken;
}
