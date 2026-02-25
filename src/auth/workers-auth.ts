/**
 * OAuth token management for Cloudflare Workers.
 *
 * Uses the fetch() API and Web Crypto for all operations —
 * no googleapis or google-auth-library packages (not Workers-compatible).
 *
 * Token storage is handled via WorkersKVCache (src/storage/kv-store.ts).
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const KV_TOKEN_KEY = 'gdrive:oauth:tokens';

export interface WorkersTokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
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

  const response = await fetch(TOKEN_ENDPOINT, {
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

/**
 * Load tokens from KV, refresh if expired, and return a valid access token.
 *
 * @param kv  - KV namespace binding (env.GDRIVE_KV)
 * @param clientId     - OAuth client ID from env
 * @param clientSecret - OAuth client secret from env
 * @param preemptiveMs - Refresh this many ms before actual expiry (default: 5 min)
 */
export async function getValidAccessToken(
  kv: KVNamespace,
  clientId: string,
  clientSecret: string,
  preemptiveMs = 5 * 60 * 1000
): Promise<string> {
  const raw = await kv.get(KV_TOKEN_KEY);
  if (!raw) {
    throw new Error(
      'No OAuth tokens found in KV. Run the auth flow (node ./dist/index.js auth) and upload tokens to KV.'
    );
  }

  const tokens = JSON.parse(raw) as WorkersTokenData;
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

  await kv.put(KV_TOKEN_KEY, JSON.stringify(updated), {
    // Keep KV entry alive for 30 days; the token itself will be refreshed before expiry
    expirationTtl: 30 * 24 * 60 * 60,
  });

  return accessToken;
}
