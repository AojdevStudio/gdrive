# MCP Client Auth Boundary

AOJ Workbench is a knowledge-work MCP server, not an identity provider. MCP client authentication is static bearer auth for this compatibility slice, while provider authorization belongs to the provider layer. In the target architecture, Composio managed auth owns connected-account authorization for provider toolkits.

This means Codex can only initiate a login flow if this server advertises a real external or dedicated OAuth authorization server in MCP metadata. This repo must not fake OAuth metadata or implement `/authorize` and `/token` endpoints as part of AOJ Workbench just to make `codex mcp login aoj-workbench` appear supported.

For now, `MCP_AUTHORIZATION_SERVER_URL` is metadata-only. It may advertise where an MCP client can initiate login, but this server continues to validate only static bearer auth until there is a concrete token validation contract such as JWKS, issuer, audience, introspection, or an upstream gateway.

**Considered options:** implement an OAuth authorization server in this repo; point metadata at a separate authorization server; use static bearer auth only. We chose static bearer auth now, with a metadata-only path to external/dedicated OAuth, because owning identity-provider behavior here would expand the security surface beyond the project's purpose.
