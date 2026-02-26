#!/usr/bin/env node
/**
 * Key rotation utility — extracted from the v3 index.ts monolith.
 * Rotates encryption keys for stored OAuth tokens.
 */

import { TokenManager } from '../src/auth/TokenManager.js';
import { KeyRotationManager } from '../src/auth/KeyRotationManager.js';
import { createLogger } from '../src/server/bootstrap.js';

export async function rotateKey(): Promise<void> {
  const logger = createLogger();

  try {
    logger.info('🔄 Google Drive MCP Key Rotation Tool');
    logger.info('====================================');

    const tokenManager = TokenManager.getInstance(logger);
    const keyRotationManager = KeyRotationManager.getInstance(logger);

    const currentKey = keyRotationManager.getCurrentKey();
    const currentVersionNum = parseInt(currentKey.version.substring(1));
    const newVersionNum = currentVersionNum + 1;
    const newVersion = `v${newVersionNum}`;

    logger.info(`📍 Current key version: ${currentKey.version}`);
    logger.info(`🔑 Generating new key version: ${newVersion}`);

    const newKeyEnv =
      newVersionNum === 2
        ? 'GDRIVE_TOKEN_ENCRYPTION_KEY_V2'
        : `GDRIVE_TOKEN_ENCRYPTION_KEY_V${newVersionNum}`;
    const existingNewKey = process.env[newKeyEnv];

    if (!existingNewKey) {
      logger.error(`❌ Error: ${newKeyEnv} environment variable not found`);
      logger.info('\n💡 To rotate keys:');
      logger.info(`   1. Generate a new 32-byte key: openssl rand -base64 32`);
      logger.info(`   2. Set environment variable: export ${newKeyEnv}="<your-new-key>"`);
      logger.info(`   3. Run this command again`);
      process.exit(1);
    }

    const tokens = await tokenManager.loadTokens();
    if (!tokens) {
      logger.error('❌ No tokens found to rotate');
      process.exit(1);
    }

    // Switch active in-memory version before re-saving so saveTokens() encrypts with new key.
    keyRotationManager.setCurrentVersion(newVersion);
    await tokenManager.saveTokens(tokens);

    logger.info(`📊 Summary:`);
    logger.info(`   - Previous key version: ${currentKey.version}`);
    logger.info(`   - New key version: ${newVersion}`);
    logger.info(`   - Tokens re-encrypted successfully`);
    logger.info(`💡 Next steps:`);
    logger.info(
      `   1. Update GDRIVE_TOKEN_CURRENT_KEY_VERSION=${newVersion} in your environment`
    );
    logger.info(`   2. Test the application to ensure tokens work correctly`);
    logger.info(
      `   3. Keep the old key (${currentKey.version}) until you're certain the rotation succeeded`
    );
  } catch (error) {
    const logger2 = createLogger();
    logger2.error('❌ Key rotation failed', {
      error: error instanceof Error ? error.message : error,
    });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rotateKey().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
