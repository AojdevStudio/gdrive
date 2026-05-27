# Google Workspace MCP Server

This context defines the language for the gdrive MCP server as a bridge between MCP clients and Google Workspace APIs.

## Language

**MCP client authentication**:
Authentication from an MCP client, such as Codex or Claude, to this MCP server.
_Avoid_: Google OAuth, user login

**Google OAuth**:
Authorization from this MCP server to Google Workspace APIs on behalf of the Google account owner.
_Avoid_: MCP login, client bearer auth

**Static bearer auth**:
A shared bearer token used for MCP client authentication.
_Avoid_: OAuth, Google token

**External authorization server**:
A separate service that owns OAuth login for MCP client authentication.
_Avoid_: Google OAuth, gdrive MCP server

## Relationships

- **MCP client authentication** protects access to this server.
- **Google OAuth** authorizes this server to call Google Workspace APIs.
- **Static bearer auth** is the supported first-class mechanism for **MCP client authentication**.
- An **external authorization server** may later enable Codex-initiated MCP login without making this server an identity provider.

## Example dialogue

> **Dev:** "Should `codex mcp login gdrive` create Google tokens?"
> **Domain expert:** "No — **Google OAuth** is handled by the server's existing auth flow; Codex authenticates to the MCP server with **static bearer auth**."

## Flagged ambiguities

- "OAuth compatibility" could mean either MCP client login or Google Workspace authorization — resolved: this repo does not become an OAuth authorization server; **Google OAuth** remains upstream server-to-Google authorization.
