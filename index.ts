#!/usr/bin/env node
/**
 * Unsupported local entry point.
 *
 * AOJ Workbench is remote-only. MCP clients must connect to the
 * deployed Cloudflare Worker /mcp endpoint.
 */

import { PROJECT_IDENTITY } from './src/server/identity.js';

const command = process.argv[2] ?? 'unsupported';

const setupHint =
  'Use the deployed Worker /setup/status route to inspect Google OAuth state, ' +
  'then /setup/google/start to authorize Google Workspace APIs.';

process.stderr.write(
  [
    `Unsupported local command: ${command}`,
    `${PROJECT_IDENTITY.productName} does not support local stdio, local HTTP, Docker, or local OAuth bootstrap MCP runtimes.`,
    'Connect MCP clients to the deployed Cloudflare Workers /mcp URL.',
    setupHint,
  ].join('\n') + '\n'
);

process.exit(1);
