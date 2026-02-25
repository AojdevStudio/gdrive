/**
 * Node.js stdio transport entry point.
 * Loads OAuth credentials, initialises auth, and starts the MCP server
 * over stdin/stdout for Claude Desktop / local MCP client usage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import { AuthManager, AuthState } from '../../auth/AuthManager.js';
import { TokenManager } from '../../auth/TokenManager.js';
import { createLogger, createCacheManager, createPerformanceMonitor } from '../bootstrap.js';
import { createConfiguredServer } from '../factory.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/forms',
  'https://www.googleapis.com/auth/script.projects.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

function resolveOAuthPath(): string {
  return (
    process.env.GDRIVE_OAUTH_PATH ??
    path.join(path.dirname(new URL(import.meta.url).pathname), '../../../../credentials/gcp-oauth.keys.json')
  );
}

export async function authenticateAndSave(): Promise<void> {
  const logger = createLogger();

  if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
    logger.error('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required.');
    logger.error('Generate a key with: openssl rand -base64 32');
    process.exit(1);
  }

  const auth = await authenticate({ keyfilePath: resolveOAuthPath(), scopes: SCOPES });

  const { credentials } = auth;
  if (
    !credentials.access_token ||
    !credentials.refresh_token ||
    !credentials.expiry_date ||
    !credentials.token_type ||
    !credentials.scope
  ) {
    throw new Error('Missing required authentication credentials');
  }

  const tokenManager = TokenManager.getInstance(logger);
  await tokenManager.saveTokens({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
    token_type: credentials.token_type,
    scope: credentials.scope,
  });

  logger.info('Credentials saved securely with encryption.');
  logger.info('You can now run the server.');
  process.exit(0);
}

export async function runStdioServer(): Promise<void> {
  const logger = createLogger();

  if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
    logger.error('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required.');
    logger.error('Generate a key with: openssl rand -base64 32');
    process.exit(1);
  }

  const oauthPath = resolveOAuthPath();
  if (!fs.existsSync(oauthPath)) {
    logger.error(`OAuth keys not found at: ${oauthPath}`);
    logger.error('Please ensure gcp-oauth.keys.json is present.');
    process.exit(1);
  }

  const keysContent = fs.readFileSync(oauthPath, 'utf-8');
  const keys = JSON.parse(keysContent);
  const oauthKeys = keys.web ?? keys.installed;

  if (!oauthKeys) {
    logger.error("Invalid OAuth keys format. Expected 'web' or 'installed' configuration.");
    process.exit(1);
  }

  const authManager = AuthManager.getInstance(oauthKeys, logger);
  await authManager.initialize();

  if (authManager.getState() === AuthState.UNAUTHENTICATED) {
    logger.error("Authentication required. Please run with 'auth' argument first.");
    process.exit(1);
  }

  const oauth2Client = authManager.getOAuth2Client();
  google.options({ auth: oauth2Client });

  logger.info('Authentication initialized with automatic token refresh.');

  const cacheManager = await createCacheManager(logger);
  const performanceMonitor = createPerformanceMonitor();

  const server = createConfiguredServer({
    logger,
    cacheManager,
    performanceMonitor,
    auth: oauth2Client,
  });

  setInterval(() => {
    logger.info('Server heartbeat', { uptime: process.uptime() });
  }, 30000);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP server started successfully (stdio).');
}
