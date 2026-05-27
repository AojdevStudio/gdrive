export interface ProtectedResourceMetadataOptions {
  authorizationServerUrl?: string | undefined;
}

export function protectedResourceMetadata(
  requestUrl: string,
  options: ProtectedResourceMetadataOptions = {}
): Record<string, unknown> {
  const authorizationServers = options.authorizationServerUrl
    ? [options.authorizationServerUrl]
    : [];

  return {
    resource: new URL('/mcp', requestUrl).toString(),
    authorization_servers: authorizationServers,
    auth_mode: authorizationServers.length > 0 ? 'external_oauth_metadata' : 'static_bearer',
    mcp_endpoint: '/mcp',
    note: authorizationServers.length > 0
      ? 'External OAuth authorization server metadata is advertised, but this server still validates static bearer auth only.'
      : 'Static bearer auth is currently required. OAuth authorization server metadata is not implemented.',
  };
}

export function oauthAuthorizationServerNotImplemented(): Record<string, unknown> {
  return {
    error: 'OAuth authorization server is not implemented',
    auth_mode: 'static_bearer',
    mcp_endpoint: '/mcp',
  };
}

export function jsonMetadata(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
