#!/usr/bin/env node
/**
 * gdrive-mcp — v4.0.0-alpha entry point
 *
 * Thin CLI dispatcher. All business logic lives in src/.
 *
 * Usage:
 *   node ./dist/index.js            # Start MCP server (stdio)
 *   node ./dist/index.js auth       # OAuth browser flow — saves tokens
 *   node ./dist/index.js health     # Run health check and exit
 *   node ./dist/index.js rotate-key # Key rotation tool
 *   node ./dist/index.js verify-keys# Verify token decryption
 *   node ./dist/index.js migrate-tokens # Migrate token format
 */

import { runStdioServer, authenticateAndSave } from './src/server/transports/stdio.js';
import { performHealthCheck, HealthStatus } from './src/health-check.js';

const cmd = process.argv[2];

switch (cmd) {
  case 'auth':
    authenticateAndSave().catch((err) => {
      console.error('Auth flow failed:', err);
      process.exit(1);
    });
    break;

  case 'health':
    performHealthCheck()
      .then((result) => {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        process.exit(result.status === HealthStatus.HEALTHY ? 0 : 1);
      })
      .catch((err) => {
        process.stderr.write(`Health check failed: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(2);
      });
    break;

  case 'rotate-key':
    import('./scripts/rotate-key.js')
      .then(({ rotateKey }) => rotateKey())
      .catch((err) => {
        console.error('Key rotation failed:', err);
        process.exit(1);
      });
    break;

  case 'migrate-tokens':
    import('./scripts/migrate-tokens.js')
      .then(({ migrateTokens }) => migrateTokens())
      .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
      });
    break;

  case 'verify-keys':
    import('./scripts/verify-keys.js')
      .then(({ verifyKeys }) => verifyKeys())
      .catch((err) => {
        console.error('Verification failed:', err);
        process.exit(1);
      });
    break;

  default:
    runStdioServer().catch((err) => {
      console.error('Server startup failed:', err);
      process.exit(1);
    });
}
