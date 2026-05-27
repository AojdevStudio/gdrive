#!/usr/bin/env node
/**
 * Unsupported local entry point.
 *
 * Google Workspace MCP is remote-only. MCP clients must connect to the
 * deployed Cloudflare Worker /mcp endpoint.
 */

const command = process.argv[2] ?? 'unsupported';

const setupHint =
  'Use the deployed Worker /setup/status route to inspect Google OAuth state, ' +
  'then /setup/google/start to authorize Google Workspace APIs.';

process.stderr.write(
  [
    `Unsupported local command: ${command}`,
    'Google Workspace MCP does not support local stdio, local HTTP, Docker, or local OAuth bootstrap MCP runtimes.',
    'Connect MCP clients to the deployed Cloudflare Workers /mcp URL.',
    setupHint,
  ].join('\n') + '\n'
);

process.exit(1);
