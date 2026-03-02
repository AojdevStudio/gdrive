# Environment Variables Setup Guide

This guide documents the environment variables currently supported by the server.

Source of truth:

- `.env.example`
- runtime usage in `index.ts`, `src/server/transports/stdio.ts`, `src/health-check.ts`, and auth/token modules

## Quick Start

Create a local `.env` from the example:

```bash
cp .env.example .env
```

Set the required encryption key:

```bash
openssl rand -base64 32
```

Then put that value in:

```bash
GDRIVE_TOKEN_ENCRYPTION_KEY=...
```

## Required Variable

## `GDRIVE_TOKEN_ENCRYPTION_KEY`

- required for auth/token storage
- must be a 32-byte base64-encoded key

If missing, startup and auth commands fail.

## Core Authentication Variables

## `GDRIVE_OAUTH_PATH`

- path to OAuth client keys JSON (`gcp-oauth.keys.json`)
- default is resolved by runtime; explicit path is recommended in Docker

## `GDRIVE_TOKEN_STORAGE_PATH`

- encrypted token storage file path

## `GDRIVE_TOKEN_AUDIT_LOG_PATH`

- audit log output path for token lifecycle events

## Token Lifecycle Variables

## `GDRIVE_TOKEN_REFRESH_INTERVAL`

- token refresh interval in milliseconds
- default in example: `1800000`

## `GDRIVE_TOKEN_PREEMPTIVE_REFRESH`

- pre-expiry refresh window in milliseconds
- default in example: `600000`

## `GDRIVE_TOKEN_MAX_RETRIES`

- max retry count for refresh attempts

## `GDRIVE_TOKEN_RETRY_DELAY`

- initial retry delay in milliseconds

## `GDRIVE_TOKEN_HEALTH_CHECK`

- enable/disable token health checks

## Key Rotation Variables (Optional)

## `GDRIVE_TOKEN_ENCRYPTION_KEY_V2`
## `GDRIVE_TOKEN_ENCRYPTION_KEY_V3`
## `GDRIVE_TOKEN_ENCRYPTION_KEY_V4`

- optional additional keys for rotation

## `GDRIVE_TOKEN_CURRENT_KEY_VERSION`

- active key version (for example: `v1`, `v2`)

## Calendar Contact Resolution (Optional)

## `PAI_CONTACTS_PATH`

- enables name -> email resolution for Calendar attendees
- without this, attendee values are treated as raw email addresses

## Logging and Cache Variables

## `LOG_LEVEL`

- Winston log level (`error`, `warn`, `info`, `debug`, `verbose`, etc.)

## `REDIS_URL`

- Redis connection string
- if Redis is unavailable, server continues without cache

## Transport and Remote Deployment Variables

These are only needed when using HTTP transport / remote deployment modes.

## `MCP_TRANSPORT`

- `stdio` (default) or `http`

## `MCP_HTTP_HOST`
## `MCP_HTTP_PORT`
## `MCP_HTTP_PATH`

- HTTP bind/address/path settings when `MCP_TRANSPORT=http`

## `MCP_ALLOWED_ORIGINS`

- comma-separated CORS allowlist

## `MCP_BEARER_TOKEN`

- optional bearer token required by HTTP endpoint

## Cloudflare Variables (Optional)

Use for Cloudflare Workers workflows:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_KV_NAMESPACE_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

## Minimal `.env` (Local Stdio)

```bash
GDRIVE_TOKEN_ENCRYPTION_KEY=YOUR_BASE64_KEY
GDRIVE_OAUTH_PATH=credentials/gcp-oauth.keys.json
GDRIVE_TOKEN_STORAGE_PATH=credentials/.gdrive-mcp-tokens.json
GDRIVE_TOKEN_AUDIT_LOG_PATH=logs/gdrive-mcp-audit.log
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000
GDRIVE_TOKEN_MAX_RETRIES=3
GDRIVE_TOKEN_RETRY_DELAY=1000
GDRIVE_TOKEN_HEALTH_CHECK=true
```

## Docker-Friendly `.env` Notes

With `docker-compose.yml`, paths are typically:

- `GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json`
- `GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json`
- `GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log`

`docker-compose.yml` already sets these values for the container.

## Validation Checklist

## 1) Validate key is set

```bash
test -n "$GDRIVE_TOKEN_ENCRYPTION_KEY" && echo "key set" || echo "key missing"
```

## 2) Validate OAuth file exists

```bash
ls -la credentials/gcp-oauth.keys.json
```

## 3) Validate health command

```bash
node ./dist/index.js health
```

Expected: JSON output with health status.

## 4) Validate auth command (first-time setup)

```bash
node ./dist/index.js auth
```

## Common Mistakes

- setting `GDRIVE_TOKEN_ENCRYPTION_KEY` to a non-base64 value
- missing OAuth keys file at configured `GDRIVE_OAUTH_PATH`
- mixing host and container file paths
- adding unsupported custom vars and expecting runtime behavior changes

## Recommended Practice

- keep `.env` minimal
- use `.env.example` as baseline whenever updating config
- avoid adding undocumented variables unless you also implement runtime support

