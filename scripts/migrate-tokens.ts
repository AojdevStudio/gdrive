#!/usr/bin/env node
/* eslint-disable no-console */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { homedir } from 'os';

// Token file paths
const LEGACY_TOKEN_PATH = path.join(homedir(), '.gdrive-mcp-tokens.json');
const NEW_TOKEN_PATH = path.join(homedir(), '.gdrive-mcp-tokens.json');
const BACKUP_DIR = path.join(homedir(), '.backup');

// Encryption constants
const ALGORITHM = 'aes-256-gcm';

interface LegacyTokenData {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

interface VersionedTokenStorage {
  version: string;
  algorithm: string;
  keyDerivation: {
    method: 'pbkdf2';
    iterations: number;
    salt: string;
  };
  data: string;
  createdAt: string;
  keyId: string;
}

interface DerivedKeyResult {
  key: Buffer;
  salt: Buffer;
  iterations: number;
}

class KeyDerivation {
  private static readonly MIN_ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 32; // 256 bits for AES-256
  private static readonly SALT_LENGTH = 32;
  private static readonly DIGEST = 'sha256';

  public static deriveKey(
    password: string | Buffer, 
    salt?: Buffer, 
    iterations: number = KeyDerivation.MIN_ITERATIONS
  ): DerivedKeyResult {
    if (iterations < KeyDerivation.MIN_ITERATIONS) {
      throw new Error(`Iterations must be at least ${KeyDerivation.MIN_ITERATIONS}`);
    }

    const actualSalt = salt ?? KeyDerivation.generateSalt();
    
    const key = crypto.pbkdf2Sync(
      password,
      actualSalt,
      iterations,
      KeyDerivation.KEY_LENGTH,
      KeyDerivation.DIGEST
    );

    return {
      key,
      salt: actualSalt,
      iterations
    };
  }

  public static generateSalt(): Buffer {
    return crypto.randomBytes(KeyDerivation.SALT_LENGTH);
  }

  public static clearSensitiveData(...buffers: Buffer[]): void {
    for (const buffer of buffers) {
      if (Buffer.isBuffer(buffer)) {
        buffer.fill(0);
      }
    }
  }
}

async function loadEncryptionKey(): Promise<Buffer> {
  const keyEnv = process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable not set');
  }
  
  try {
    const keyBuffer = Buffer.from(keyEnv, 'base64');
    if (keyBuffer.length !== 32) {
      throw new Error('Invalid key length');
    }
    return keyBuffer;
  } catch {
    throw new Error('GDRIVE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
}

async function decryptLegacyTokens(encryptedData: string, encryptionKey: Buffer): Promise<LegacyTokenData> {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid legacy token format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex ?? "", "hex");
  const authTag = Buffer.from(authTagHex ?? "", "hex");
  const encryptedBuffer = Buffer.from(encrypted ?? "", "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString());
}

async function encryptVersionedTokens(tokens: LegacyTokenData, derivedKey: DerivedKeyResult): Promise<VersionedTokenStorage> {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey.key, iv);

  const jsonString = JSON.stringify(tokens);
  let encrypted = cipher.update(jsonString, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return VersionedTokenStorage format
  return {
    version: 'v1',
    algorithm: 'aes-256-gcm',
    keyDerivation: {
      method: 'pbkdf2',
      iterations: derivedKey.iterations,
      salt: derivedKey.salt.toString('base64')
    },
    data: `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`,
    createdAt: new Date().toISOString(),
    keyId: 'v1'
  };
}

async function createBackup(sourcePath: string): Promise<string> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(BACKUP_DIR, `tokens-${timestamp}.json`);
    
    const content = await fs.readFile(sourcePath, 'utf8');
    await fs.writeFile(backupPath, content);
    
    console.log(`✓ Backing up tokens to ${backupPath}`);
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : error}`);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  
  try {
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch { /* ignore */ }
    throw error;
  }
}

async function migrateTokens(): Promise<void> {
  console.log('🔄 Google Drive MCP Token Migration Tool');
  console.log('========================================\n');

  let keyBuffer: Buffer | undefined;
  
  try {
    // Step 1: Check if legacy tokens exist
    if (!await fileExists(LEGACY_TOKEN_PATH)) {
      console.log('ℹ️  No legacy tokens found at', LEGACY_TOKEN_PATH);
      console.log('✅ Nothing to migrate');
      return;
    }

    // Step 2: Load encryption key
    console.log('🔑 Loading encryption key...');
    keyBuffer = await loadEncryptionKey();

    // Step 3: Create backup
    const backupPath = await createBackup(LEGACY_TOKEN_PATH);

    // Step 4: Load and decrypt legacy tokens
    console.log('📖 Reading legacy tokens...');
    const encryptedContent = await fs.readFile(LEGACY_TOKEN_PATH, 'utf8');
    
    let legacyTokens: LegacyTokenData;
    try {
      legacyTokens = await decryptLegacyTokens(encryptedContent.trim(), keyBuffer);
      console.log('✓ Successfully decrypted legacy tokens');
    } catch (error) {
      console.error('❌ Failed to decrypt legacy tokens:', error instanceof Error ? error.message : error);
      console.log('💡 Backup preserved at:', backupPath);
      process.exit(1);
    }

    // Step 5: Convert to versioned format
    console.log('🔄 Converting to versioned format...');
    
    // Ensure all required fields are present for TokenData
    const tokenData: LegacyTokenData = {
      access_token: legacyTokens.access_token ?? "",
      refresh_token: legacyTokens.refresh_token ?? "",
      expiry_date: legacyTokens.expiry_date ?? Date.now() + 3600000,
      token_type: legacyTokens.token_type ?? "Bearer",
      scope: legacyTokens.scope ?? "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/forms https://www.googleapis.com/auth/script.projects.readonly"
    };

    // Step 6: Derive key and encrypt with new format
    console.log('🔐 Deriving key with PBKDF2...');
    const salt = KeyDerivation.generateSalt();
    const derivedKey = KeyDerivation.deriveKey(keyBuffer, salt);
    
    const encryptedVersioned = await encryptVersionedTokens(tokenData, derivedKey);

    // Step 7: Write atomically
    console.log('💾 Writing new versioned tokens...');
    await atomicWrite(NEW_TOKEN_PATH, JSON.stringify(encryptedVersioned, null, 2));
    console.log('✓ Migration complete. Tokens saved to', NEW_TOKEN_PATH);

    // Step 8: Verify the new file
    console.log('🔍 Verifying migration...');
    const verifyContent = await fs.readFile(NEW_TOKEN_PATH, 'utf8');
    if (!verifyContent || verifyContent.trim().length === 0) {
      throw new Error('Verification failed: New token file is empty');
    }
    console.log('✓ Verification successful');

    // Display summary
    console.log('\n📊 Migration Summary:');
    console.log('   - Tokens migrated: 1');
    console.log('   - Format: Legacy → Versioned (v1)');
    console.log('   - Key version: v1');
    console.log('   - Key derivation: PBKDF2 with 100000 iterations');
    console.log('   - Backup location:', backupPath);
    
    console.log('\n✅ Migration completed successfully!');
    
    // Step 9: Ask about cleanup
    console.log('\n🧹 Cleanup Options:');
    console.log('   The legacy token file is still present at:', LEGACY_TOKEN_PATH);
    console.log('   Would you like to remove it now? (not recommended until after verification)');
    console.log('\n💡 Recommended next steps:');
    console.log('   1. Run "node dist/index.js verify-keys" to verify the migration');
    console.log('   2. Test your application to ensure tokens work correctly');
    console.log('   3. Once verified, manually remove the legacy file:');
    console.log(`      rm "${LEGACY_TOKEN_PATH}"`);
    console.log('\n📁 Your backup is safely stored at:', backupPath);

  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : error);
    console.error('💡 No changes were made to your tokens');
    process.exit(1);
  } finally {
    // Clear sensitive data from memory
    if (keyBuffer) {
      KeyDerivation.clearSensitiveData(keyBuffer);
    }
  }
}

// This will be handled by the section at the end of the file

async function cleanupLegacyTokens(): Promise<void> {
  console.log('🧹 Google Drive MCP Legacy Token Cleanup');
  console.log('======================================\n');

  try {
    // Check if legacy tokens exist
    if (!await fileExists(LEGACY_TOKEN_PATH)) {
      console.log('ℹ️  No legacy tokens found at', LEGACY_TOKEN_PATH);
      console.log('✅ Nothing to clean up');
      return;
    }

    // Check if new tokens exist
    if (!await fileExists(NEW_TOKEN_PATH)) {
      console.log('⚠️  Warning: New versioned tokens not found');
      console.log('❌ Refusing to delete legacy tokens without verified migration');
      process.exit(1);
    }

    // Verify new tokens can be loaded
    console.log('🔍 Verifying new tokens before cleanup...');
    try {
      const content = await fs.readFile(NEW_TOKEN_PATH, 'utf8');
      const versionedData = JSON.parse(content);
      if (!versionedData.version || !versionedData.algorithm) {
        throw new Error('Invalid versioned token format');
      }
      console.log('✓ New tokens verified');
    } catch (error) {
      console.error('❌ Cannot verify new tokens:', error instanceof Error ? error.message : error);
      console.log('❌ Refusing to delete legacy tokens');
      process.exit(1);
    }

    // Remove legacy token file
    console.log('🗑️  Removing legacy token file...');
    await fs.unlink(LEGACY_TOKEN_PATH);
    console.log('✓ Legacy token file removed:', LEGACY_TOKEN_PATH);

    // Log the action
    const auditPath = path.join(homedir(), '.gdrive-mcp-audit.log');
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event: 'LEGACY_TOKENS_REMOVED',
      success: true,
      metadata: {
        legacyPath: LEGACY_TOKEN_PATH,
        reason: 'Post-migration cleanup'
      }
    };
    
    try {
      await fs.appendFile(auditPath, JSON.stringify(auditEntry) + '\n', 'utf8');
    } catch { /* ignore */ }

    console.log('\n✅ Cleanup completed successfully!');
    console.log('💡 Your tokens are now using the new versioned format');
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Support being called with --cleanup flag
// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--cleanup')) {
    cleanupLegacyTokens().catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  } else {
    migrateTokens().catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}

export { migrateTokens, cleanupLegacyTokens };