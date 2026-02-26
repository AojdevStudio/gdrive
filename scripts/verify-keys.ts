#!/usr/bin/env node
/**
 * Token decryption verification utility — extracted from the v3 index.ts monolith.
 */

import { TokenManager } from '../src/auth/TokenManager.js';
import { KeyRotationManager } from '../src/auth/KeyRotationManager.js';
import { createLogger } from '../src/server/bootstrap.js';

export async function verifyKeys(): Promise<void> {
  const logger = createLogger();

  try {
    logger.info('🔍 Google Drive MCP Key Verification Tool');
    logger.info('========================================');

    const tokenManager = TokenManager.getInstance(logger);
    const keyRotationManager = KeyRotationManager.getInstance(logger);

    const currentKey = keyRotationManager.getCurrentKey();
    logger.info(`📍 Current key version: ${currentKey.version}`);
    logger.info(`🔑 Registered key versions: ${keyRotationManager.getVersions().join(', ')}`);

    logger.info('🔓 Attempting to decrypt tokens...');
    const tokens = await tokenManager.loadTokens();

    if (!tokens) {
      logger.error('❌ No tokens found or unable to decrypt');
      process.exit(1);
    }

    logger.info('✓ Tokens successfully decrypted');
    logger.info('📋 Token validation:');
    logger.info(`   - Access token: ${tokens.access_token ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Refresh token: ${tokens.refresh_token ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Expiry date: ${tokens.expiry_date ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Token type: ${tokens.token_type ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Scope: ${tokens.scope ? '✓ Present' : '❌ Missing'}`);

    if (tokens.expiry_date) {
      const isExpired = tokenManager.isTokenExpired(tokens);
      const expiryDate = new Date(tokens.expiry_date);
      logger.info(`⏰ Token expiry: ${expiryDate.toISOString()}`);
      logger.info(`   Status: ${isExpired ? '❌ Expired' : '✓ Valid'}`);
    }

    logger.info('✅ All tokens successfully verified with current key');
  } catch (error) {
    const logger2 = createLogger();
    logger2.error('❌ Verification failed', {
      error: error instanceof Error ? error.message : error,
    });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyKeys().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
