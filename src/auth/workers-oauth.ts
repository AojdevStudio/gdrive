import {
  getWorkerOAuthStatus,
  persistEncryptedTokens,
  TOKEN_ENDPOINT,
  type KVNamespace,
  type WorkersTokenData,
} from './workers-auth.js';
import { jsonError, validateBearerRequest } from '../server/http-auth.js';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const STATE_KEY_PREFIX = 'gdrive:oauth:state:';
const DEFAULT_STATE_TTL_SECONDS = 10 * 60;

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/script.projects.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

export interface WorkerOAuthEnv {
  GDRIVE_KV: KVNamespace;
  GDRIVE_CLIENT_ID?: string | undefined;
  GDRIVE_CLIENT_SECRET?: string | undefined;
  GDRIVE_TOKEN_ENCRYPTION_KEY?: string | undefined;
  MCP_SETUP_TOKEN?: string | undefined;
  MCP_ALLOWED_ORIGINS?: string | undefined;
}

interface StoredOAuthState {
  createdAt: number;
  expiresAt: number;
  redirectUri: string;
}

interface CodeExchangeResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  scope?: unknown;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setupAuthError(request: Request, env: WorkerOAuthEnv): Response | null {
  return validateBearerRequest(request, {
    requiredToken: env.MCP_SETUP_TOKEN,
    allowedOrigins: env.MCP_ALLOWED_ORIGINS,
    runtimeName: 'remote Google OAuth setup',
    tokenName: 'MCP_SETUP_TOKEN',
  });
}

function requiredConfig(env: WorkerOAuthEnv): {
  ok: boolean;
  missing: string[];
  present: Record<string, boolean>;
} {
  const present = {
    GDRIVE_KV: Boolean(env.GDRIVE_KV),
    GDRIVE_CLIENT_ID: Boolean(env.GDRIVE_CLIENT_ID),
    GDRIVE_CLIENT_SECRET: Boolean(env.GDRIVE_CLIENT_SECRET),
    GDRIVE_TOKEN_ENCRYPTION_KEY: Boolean(env.GDRIVE_TOKEN_ENCRYPTION_KEY),
    MCP_SETUP_TOKEN: Boolean(env.MCP_SETUP_TOKEN),
  };
  const missing = Object.entries(present)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { ok: missing.length === 0, missing, present };
}

function setupConfigError(env: WorkerOAuthEnv, exposeDetails = true): Response | null {
  const config = requiredConfig(env);
  if (config.ok) {
    return null;
  }

  if (!exposeDetails) {
    return jsonResponse(500, {
      error: 'Server misconfiguration',
      detail: 'Remote Google OAuth setup is not fully configured.',
    });
  }

  return jsonResponse(500, {
    error: 'Server misconfiguration',
    detail: 'Remote Google OAuth setup is not fully configured.',
    missing: config.missing,
    configuration: config.present,
  });
}

function encodeBase64Url(bytes: Uint8Array): string {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('Base64 encoding is not available in this runtime');
  }
  const base64 = globalThis.btoa(String.fromCharCode(...bytes));
  return base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function randomState(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function callbackUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/setup/google/callback`;
}

function stateKey(state: string): string {
  return `${STATE_KEY_PREFIX}${state}`;
}

async function readStoredState(kv: KVNamespace, state: string): Promise<StoredOAuthState | null> {
  const raw = await kv.get(stateKey(state));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredOAuthState>;
    if (
      typeof parsed.createdAt === 'number' &&
      typeof parsed.expiresAt === 'number' &&
      typeof parsed.redirectUri === 'string'
    ) {
      return parsed as StoredOAuthState;
    }
  } catch {
    return null;
  }

  return null;
}

async function validateCallbackStateGuard(
  request: Request,
  kv: KVNamespace,
  state: string
): Promise<StoredOAuthState | Response> {
  const storedState = await readStoredState(kv, state);
  if (!storedState) {
    return jsonError(400, 'Invalid OAuth state', 'OAuth state is missing, expired, reused, or mismatched. Restart remote setup at /setup/google/start.');
  }

  await kv.delete(stateKey(state));

  if (Date.now() > storedState.expiresAt || storedState.redirectUri !== callbackUrl(request)) {
    return jsonError(400, 'Invalid OAuth state', 'OAuth state is missing, expired, reused, or mismatched. Restart remote setup at /setup/google/start.');
  }

  return storedState;
}

export async function handleGoogleOAuthStart(
  request: Request,
  env: WorkerOAuthEnv
): Promise<Response> {
  const authError = setupAuthError(request, env);
  if (authError) {
    return authError;
  }

  const configError = setupConfigError(env);
  if (configError) {
    return configError;
  }

  const state = randomState();
  const redirectUri = callbackUrl(request);
  const now = Date.now();
  const storedState: StoredOAuthState = {
    createdAt: now,
    expiresAt: now + DEFAULT_STATE_TTL_SECONDS * 1000,
    redirectUri,
  };

  await env.GDRIVE_KV.put(stateKey(state), JSON.stringify(storedState), {
    expirationTtl: DEFAULT_STATE_TTL_SECONDS,
  });

  const oauthUrl = new URL(AUTHORIZATION_ENDPOINT);
  oauthUrl.searchParams.set('client_id', env.GDRIVE_CLIENT_ID as string);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', GOOGLE_WORKSPACE_SCOPES.join(' '));
  oauthUrl.searchParams.set('access_type', 'offline');
  oauthUrl.searchParams.set('prompt', 'consent');
  oauthUrl.searchParams.set('include_granted_scopes', 'true');
  oauthUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: oauthUrl.toString(),
      'Cache-Control': 'no-store',
    },
  });
}

function validExchangeResponse(data: CodeExchangeResponse): data is {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
} {
  return (
    typeof data.access_token === 'string' &&
    data.access_token.length > 0 &&
    typeof data.refresh_token === 'string' &&
    data.refresh_token.length > 0 &&
    typeof data.expires_in === 'number' &&
    Number.isFinite(data.expires_in) &&
    data.expires_in > 0 &&
    typeof data.token_type === 'string' &&
    data.token_type.length > 0 &&
    (data.scope === undefined || typeof data.scope === 'string')
  );
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  env: WorkerOAuthEnv
): Promise<WorkersTokenData> {
  const body = new URLSearchParams({
    client_id: env.GDRIVE_CLIENT_ID as string,
    client_secret: env.GDRIVE_CLIENT_SECRET as string,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await globalThis.fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth code exchange failed (${response.status})`);
  }

  const data = (await response.json()) as CodeExchangeResponse;
  if (!validExchangeResponse(data)) {
    throw new Error('Google OAuth code exchange did not return refresh-capable token state');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope ?? GOOGLE_WORKSPACE_SCOPES.join(' '),
  };
}

export async function handleGoogleOAuthCallback(
  request: Request,
  env: WorkerOAuthEnv
): Promise<Response> {
  const configError = setupConfigError(env, false);
  if (configError) {
    return configError;
  }

  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return jsonError(400, 'Google OAuth authorization failed', 'Restart remote setup at /setup/google/start.');
  }

  if (!state || !code) {
    return jsonError(400, 'Invalid OAuth callback', 'Missing authorization code or OAuth state.');
  }

  // Google redirects cannot attach Authorization headers. The one-time, expiring
  // state value is the setup guard for this callback and is consumed before code exchange.
  const callbackStateGuard = await validateCallbackStateGuard(request, env.GDRIVE_KV, state);
  if (callbackStateGuard instanceof Response) {
    return callbackStateGuard;
  }

  try {
    const tokens = await exchangeCodeForTokens(code, callbackStateGuard.redirectUri, env);
    await persistEncryptedTokens(
      env.GDRIVE_KV,
      tokens,
      env.GDRIVE_TOKEN_ENCRYPTION_KEY as string
    );

    return jsonResponse(200, {
      status: 'configured',
      message: 'Google Workspace MCP remote Google OAuth setup completed.',
      next: 'Verify remote setup at /setup/status, then connect MCP clients to /mcp.',
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Google OAuth code exchange failed';
    return jsonError(502, 'Google OAuth token exchange failed', `${detail}. Restart remote setup at /setup/google/start.`);
  }
}

export async function handleGoogleOAuthStatus(
  request: Request,
  env: WorkerOAuthEnv
): Promise<Response> {
  const authError = setupAuthError(request, env);
  if (authError) {
    return authError;
  }

  const config = requiredConfig(env);
  const recovery = 'Use /setup/google/start with setup bearer auth to restart remote Google OAuth setup.';
  if (!config.ok) {
    return jsonResponse(200, {
      status: 'misconfigured',
      configured: false,
      configuration: config.present,
      missing: config.missing,
      tokenStateExists: false,
      recovery,
    });
  }

  const oauthStatus = await getWorkerOAuthStatus(
    env.GDRIVE_KV,
    env.GDRIVE_CLIENT_ID as string,
    env.GDRIVE_CLIENT_SECRET as string,
    env.GDRIVE_TOKEN_ENCRYPTION_KEY as string
  );

  return jsonResponse(200, {
    status: oauthStatus.status,
    configured: oauthStatus.status === 'configured' || oauthStatus.status === 'expired-or-refreshable',
    configuration: config.present,
    tokenStateExists: oauthStatus.tokenStateExists,
    refreshAttempted: oauthStatus.refreshAttempted,
    recovery,
  });
}
