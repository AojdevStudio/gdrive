export interface BearerAuthConfig {
  requiredToken?: string | undefined;
  allowedOrigins?: string | undefined;
  runtimeName: string;
}

export function jsonError(status: number, error: string, detail?: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (status === 401) {
    headers['WWW-Authenticate'] = 'Bearer';
  }

  return new Response(
    JSON.stringify({
      error,
      ...(detail ? { detail } : {}),
    }),
    {
      status,
      headers,
    }
  );
}

function parseAllowedOrigins(raw?: string): Set<string> {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}

export function validateBearerRequest(
  request: Request,
  config: BearerAuthConfig
): Response | null {
  if (!config.requiredToken) {
    return jsonError(
      500,
      'Server misconfiguration',
      `MCP_BEARER_TOKEN is not configured for ${config.runtimeName}`
    );
  }

  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${config.requiredToken}`;
  if (!authHeader || authHeader !== expected) {
    return jsonError(401, 'Unauthorized', 'Missing or invalid bearer token');
  }

  const allowedOrigins = parseAllowedOrigins(config.allowedOrigins);
  if (allowedOrigins.size > 0) {
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      return jsonError(403, 'Forbidden', 'Origin not allowed');
    }
  }

  return null;
}
