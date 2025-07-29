import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import { Logger } from 'winston';

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export type AuditEvent = 
  | 'TOKEN_ACQUIRED'
  | 'TOKEN_REFRESHED'
  | 'TOKEN_REFRESH_FAILED'
  | 'TOKEN_REVOKED_BY_USER'
  | 'TOKEN_DELETED_INVALID_GRANT'
  | 'TOKEN_ENCRYPTED'
  | 'TOKEN_DECRYPTED';

interface AuditLog {
  timestamp: string;
  event: AuditEvent;
  userId?: string;
  tokenId?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export class TokenManager {
  private static _instance: TokenManager;
  private readonly logger: Logger;
  private readonly tokenPath: string;
  private readonly auditPath: string;
  private readonly encryptionKey: Buffer;
  private invalidGrantEncountered: boolean = false;

  private constructor(logger: Logger) {
    this.logger = logger;
    
    // Load configuration from environment
    this.tokenPath = process.env.GDRIVE_TOKEN_STORAGE_PATH || 
      path.join(os.homedir(), '.gdrive-mcp-tokens.json');
    
    this.auditPath = process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH || 
      path.join(os.homedir(), '.gdrive-mcp-audit.log');
    
    // Validate and load encryption key
    const keyBase64 = process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new Error('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required');
    }
    
    this.encryptionKey = Buffer.from(keyBase64, 'base64');
    if (this.encryptionKey.length !== 32) {
      throw new Error('Invalid encryption key. Must be 32-byte base64-encoded key.');
    }
    
    this.logger.debug('TokenManager initialized', {
      tokenPath: this.tokenPath,
      auditPath: this.auditPath,
    });
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
      
      // Encrypt tokens
      const encrypted = await this.encrypt(JSON.stringify(tokens));
      
      // Write to file with secure permissions
      await fs.writeFile(this.tokenPath, encrypted, { encoding: 'utf8' });
      await fs.chmod(this.tokenPath, 0o600);
      
      // Log audit event
      await this.logAuditEvent('TOKEN_ENCRYPTED', true, {
        tokenId: this.hashTokenId(tokens.access_token),
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
      
      const encrypted = await fs.readFile(this.tokenPath, 'utf8');
      const decrypted = await this.decrypt(encrypted);
      const tokens = JSON.parse(decrypted);
      
      // Log audit event
      await this.logAuditEvent('TOKEN_DECRYPTED', true, {
        tokenId: this.hashTokenId(tokens.access_token),
      });
      
      this.logger.info('Tokens loaded successfully');
      return tokens;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.logger.debug('No saved tokens found', { path: this.tokenPath });
        return null;
      }
      
      this.logger.error('Failed to load tokens', { error });
      return null;
    }
  }

  /**
   * Delete tokens when invalid_grant error occurs
   */
  public async deleteTokensOnInvalidGrant(): Promise<void> {
    try {
      await fs.unlink(this.tokenPath);
      this.invalidGrantEncountered = true;
      
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
    if (!tokens.expiry_date) return true;
    return Date.now() >= tokens.expiry_date;
  }

  /**
   * Check if token is expiring soon
   */
  public isTokenExpiringSoon(tokens: TokenData, bufferMs: number = 10 * 60 * 1000): boolean {
    if (!tokens.expiry_date) return true;
    return Date.now() >= (tokens.expiry_date - bufferMs);
  }

  /**
   * Validate token data structure
   */
  public isValidTokenData(data: any): data is TokenData {
    return (
      data &&
      typeof data.access_token === 'string' &&
      typeof data.refresh_token === 'string' &&
      typeof data.expiry_date === 'number' &&
      typeof data.token_type === 'string' &&
      typeof data.scope === 'string'
    );
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encrypt(data: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Clear sensitive data from memory
    const dataBuffer = Buffer.from(data);
    await this.clearMemory(dataBuffer);
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private async decrypt(encrypted: string): Promise<string> {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Clear sensitive data from memory
   */
  private async clearMemory(buffer: Buffer): Promise<void> {
    buffer.fill(0);
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
    metadata?: Record<string, any>
  ): Promise<void> {
    const auditLog: AuditLog = {
      timestamp: new Date().toISOString(),
      event,
      success,
      metadata,
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