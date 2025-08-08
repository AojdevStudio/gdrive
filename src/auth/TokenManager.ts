import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import { Logger } from 'winston';
import { KeyRotationManager } from './KeyRotationManager.js';
import { KeyDerivation } from './KeyDerivation.js';

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export interface VersionedTokenStorage {
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

export type AuditEvent = 
  | 'TOKEN_ACQUIRED'
  | 'TOKEN_REFRESHED'
  | 'TOKEN_REFRESH_FAILED'
  | 'TOKEN_REVOKED_BY_USER'
  | 'TOKEN_DELETED_INVALID_GRANT'
  | 'TOKEN_ENCRYPTED'
  | 'TOKEN_DECRYPTED'
  | 'KEY_REGISTERED'
  | 'KEY_VERSION_CHANGED'
  | 'KEY_ROTATION_INITIATED'
  | 'KEY_ROTATION_COMPLETED';

interface AuditLog {
  timestamp: string;
  event: AuditEvent;
  userId?: string;
  tokenId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export class TokenManager {
  private static _instance: TokenManager;
  private readonly logger: Logger;
  private readonly tokenPath: string;
  private readonly auditPath: string;
  private readonly keyRotationManager: KeyRotationManager;

  private constructor(logger: Logger) {
    this.logger = logger;
    
    // Load configuration from environment
    this.tokenPath = process.env.GDRIVE_TOKEN_STORAGE_PATH ?? 
      path.join(os.homedir(), '.gdrive-mcp-tokens.json');
    
    this.auditPath = process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH ?? 
      path.join(os.homedir(), '.gdrive-mcp-audit.log');
    
    // Initialize key rotation manager
    this.keyRotationManager = KeyRotationManager.getInstance(logger);
    
    // Load and register keys from environment
    this.loadKeysFromEnvironment();
    
    this.logger.debug('TokenManager initialized', {
      tokenPath: this.tokenPath,
      auditPath: this.auditPath,
    });
  }

  private loadKeysFromEnvironment(): void {
    // Load v1 key (current key)
    const keyBase64 = process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new Error('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required');
    }
    
    let keyBuffer: Buffer;
    try {
      keyBuffer = Buffer.from(keyBase64, 'base64');
    } catch {
      throw new Error('Invalid base64 encoding for GDRIVE_TOKEN_ENCRYPTION_KEY');
    }
    
    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid encryption key length: ${keyBuffer.length} bytes. Must be 32-byte base64-encoded key.`);
    }

    // Generate salt for v1 key
    const salt = KeyDerivation.generateSalt();
    const derivedKey = KeyDerivation.deriveKey(keyBuffer, salt);
    
    // Clear original key buffer for security
    keyBuffer.fill(0);
    
    // Register v1 key
    try {
      this.keyRotationManager.registerKey('v1', derivedKey.key, {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        createdAt: new Date().toISOString(),
        iterations: derivedKey.iterations,
        salt: derivedKey.salt.toString('base64')
      });
    } catch (error) {
      // Clear derived key on error
      derivedKey.key.fill(0);
      throw error;
    }
    
    // Log audit event
    this.logAuditEvent('KEY_REGISTERED', true, {
      keyVersion: 'v1',
      algorithm: 'aes-256-gcm',
      iterations: derivedKey.iterations
    }).catch(err => this.logger.error('Failed to log audit event', { error: err }));
    
    // Load additional keys if present (v2, v3, etc.)
    for (let i = 2; i <= 10; i++) {
      const envKey = `GDRIVE_TOKEN_ENCRYPTION_KEY_V${i}`;
      const keyBase64 = process.env[envKey];
      if (keyBase64) {
        let keyBuffer: Buffer;
        try {
          keyBuffer = Buffer.from(keyBase64, 'base64');
        } catch {
          this.logger.warn(`Invalid base64 encoding for ${envKey}, skipping`);
          continue;
        }
        
        if (keyBuffer.length !== 32) {
          this.logger.warn(`Invalid key length for ${envKey}: ${keyBuffer.length} bytes, skipping`);
          keyBuffer.fill(0);
          continue;
        }
        
        const salt = KeyDerivation.generateSalt();
        const derivedKey = KeyDerivation.deriveKey(keyBuffer, salt);
        
        // Clear original key buffer for security
        keyBuffer.fill(0);
        
        try {
          this.keyRotationManager.registerKey(`v${i}`, derivedKey.key, {
            version: `v${i}`,
            algorithm: 'aes-256-gcm',
            createdAt: new Date().toISOString(),
            iterations: derivedKey.iterations,
            salt: derivedKey.salt.toString('base64')
          });
          
          // Log audit event
          this.logAuditEvent('KEY_REGISTERED', true, {
            keyVersion: `v${i}`,
            algorithm: 'aes-256-gcm',
            iterations: derivedKey.iterations
          }).catch(err => this.logger.error('Failed to log audit event', { error: err }));
        } catch (error) {
          // Clear derived key on error
          derivedKey.key.fill(0);
          this.logger.error(`Failed to register key ${envKey}`, { error });
        }
      }
    }

    // Set current version from environment or default to v1
    const currentVersion = process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION ?? 'v1';
    this.keyRotationManager.setCurrentVersion(currentVersion);
    
    // Log audit event
    this.logAuditEvent('KEY_VERSION_CHANGED', true, {
      newVersion: currentVersion,
      source: 'environment_config'
    }).catch(err => this.logger.error('Failed to log audit event', { error: err }));
  }

  public static getInstance(logger: Logger): TokenManager {
    if (!TokenManager._instance) {
      TokenManager._instance = new TokenManager(logger);
    }
    return TokenManager._instance;
  }

  /**
   * Save tokens to persistent storage with encryption
   */
  public async saveTokens(tokens: TokenData): Promise<void> {
    try {
      this.logger.debug('Saving tokens to persistent storage');
      
      // Validate token data
      if (!this.isValidTokenData(tokens)) {
        throw new Error('Invalid token data');
      }
      
      // Encrypt tokens with versioned format
      const encrypted = await this.encrypt(JSON.stringify(tokens));
      
      // Write to file with secure permissions
      await fs.writeFile(this.tokenPath, JSON.stringify(encrypted, null, 2), { encoding: 'utf8' });
      await fs.chmod(this.tokenPath, 0o600);
      
      // Log audit event
      await this.logAuditEvent('TOKEN_ENCRYPTED', true, {
        tokenId: this.hashTokenId(tokens.access_token),
        keyVersion: encrypted.version,
      });
      
      this.logger.info('Tokens saved successfully');
    } catch (error) {
      this.logger.error('Failed to save tokens', { error });
      throw error;
    }
  }

  /**
   * Load tokens from persistent storage and decrypt
   */
  public async loadTokens(): Promise<TokenData | null> {
    try {
      this.logger.debug('Loading tokens from persistent storage');
      
      const fileContent = await fs.readFile(this.tokenPath, 'utf8');
      
      // Check if it's the new versioned format
      let decrypted: string;
      try {
        const versionedData = JSON.parse(fileContent) as VersionedTokenStorage;
        if (versionedData.version && versionedData.algorithm) {
          // New versioned format
          decrypted = await this.decrypt(versionedData);
        } else {
          // Not versioned format, return error
          throw new Error('Legacy token format detected. Please migrate tokens using the migration tool.');
        }
      } catch (parseError) {
        // Check if it's legacy format (colon-separated)
        if (fileContent.includes(':') && fileContent.split(':').length === 3) {
          // Legacy format detected
          this.logger.error('Legacy token format detected');
          const error = new Error('LEGACY_TOKEN_FORMAT') as Error & { isLegacyFormat?: boolean };
          error.isLegacyFormat = true;
          throw error;
        }
        // Other parse error
        throw parseError;
      }
      
      const tokens = JSON.parse(decrypted);
      
      // Log audit event
      await this.logAuditEvent('TOKEN_DECRYPTED', true, {
        tokenId: this.hashTokenId(tokens.access_token),
        keyVersion: typeof fileContent === 'string' ? 'unknown' : (JSON.parse(fileContent) as VersionedTokenStorage).version,
      });
      
      this.logger.info('Tokens loaded successfully');
      return tokens;
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException & { isLegacyFormat?: boolean };
      if (nodeError.code === 'ENOENT') {
        this.logger.debug('No saved tokens found', { path: this.tokenPath });
        return null;
      }
      
      this.logger.error('Failed to load tokens', { error: nodeError });
      return null;
    }
  }

  /**
   * Delete tokens when invalid_grant error occurs
   */
  public async deleteTokensOnInvalidGrant(): Promise<void> {
    try {
      await fs.unlink(this.tokenPath);
      
      await this.logAuditEvent('TOKEN_DELETED_INVALID_GRANT', true, {
        reason: 'invalid_grant error from Google OAuth',
      });
      
      this.logger.warn('Deleted invalid tokens due to invalid_grant error');
    } catch (error) {
      this.logger.error('Failed to delete invalid tokens', { error });
    }
  }

  /**
   * Check if token is expired
   */
  public isTokenExpired(tokens: TokenData): boolean {
    if (!tokens.expiry_date) {
      return true;
    }
    return Date.now() >= tokens.expiry_date;
  }

  /**
   * Check if token is expiring soon
   */
  public isTokenExpiringSoon(tokens: TokenData, bufferMs: number = 10 * 60 * 1000): boolean {
    if (!tokens.expiry_date) {
      return true;
    }
    return Date.now() >= (tokens.expiry_date - bufferMs);
  }

  /**
   * Validate token data structure
   */
  public isValidTokenData(data: unknown): data is TokenData {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const tokenData = data as Record<string, unknown>;
    return (
      typeof tokenData.access_token === 'string' &&
      typeof tokenData.refresh_token === 'string' &&
      typeof tokenData.expiry_date === 'number' &&
      typeof tokenData.token_type === 'string' &&
      typeof tokenData.scope === 'string'
    );
  }

  /**
   * Encrypt data using AES-256-GCM with versioned format
   */
  private async encrypt(data: string): Promise<VersionedTokenStorage> {
    const currentKey = this.keyRotationManager.getCurrentKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', currentKey.key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Clear sensitive data from memory
    // Note: Cannot clear the string data parameter as it's immutable
    // This is a limitation of JavaScript - strings cannot be cleared from memory
    // The caller should ensure sensitive data is handled appropriately
    
    // Return versioned format
    return {
      version: currentKey.version,
      algorithm: currentKey.metadata.algorithm,
      keyDerivation: {
        method: 'pbkdf2',
        iterations: currentKey.metadata.iterations,
        salt: currentKey.metadata.salt
      },
      data: `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`,
      createdAt: new Date().toISOString(),
      keyId: currentKey.version
    };
  }

  /**
   * Decrypt data using AES-256-GCM with version support
   */
  private async decrypt(versionedData: VersionedTokenStorage): Promise<string> {
    // Get the appropriate key for this version
    const key = this.keyRotationManager.getKey(versionedData.version);
    if (!key) {
      throw new Error(`Key version ${versionedData.version} not found`);
    }

    // Parse the encrypted data
    const parts = versionedData.data.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Ensure parts are defined before using them
    const ivPart = parts[0];
    const authTagPart = parts[1];
    const encryptedData = parts[2];
    
    if (!ivPart || !authTagPart || !encryptedData) {
      throw new Error('Missing encryption components');
    }
    
    const iv = Buffer.from(ivPart, 'hex');
    const authTag = Buffer.from(authTagPart, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }



  /**
   * Hash token ID for logging (SHA256)
   */
  private hashTokenId(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    event: AuditEvent,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const auditLog: AuditLog = {
      timestamp: new Date().toISOString(),
      event,
      success,
      metadata: metadata ?? {},  // Use empty object if metadata is undefined
    };
    
    try {
      await fs.appendFile(
        this.auditPath,
        JSON.stringify(auditLog) + '\n',
        'utf8'
      );
    } catch (error) {
      this.logger.error('Failed to write audit log', { error });
    }
  }
}