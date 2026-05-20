export function protectedResourceMetadata(requestUrl: string): Record<string, unknown> {
  return {
    resource: new URL('/mcp', requestUrl).toString(),
    authorization_servers: [],
    auth_mode: 'static_bearer',
    mcp_endpoint: '/mcp',
    note: 'Static bearer auth is currently required. OAuth authorization server metadata is not implemented.',
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
