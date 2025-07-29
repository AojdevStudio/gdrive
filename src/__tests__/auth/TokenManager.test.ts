import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { TokenManager, TokenData, AuditEvent } from '../../auth/TokenManager.js';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock winston logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  const testTokenPath = '/test/.gdrive-mcp-tokens.json';
  const testAuditPath = '/test/.gdrive-mcp-audit.log';
  const testEncryptionKey = Buffer.from(new Uint8Array(32)).toString('base64');
  
  const validTokenData: TokenData = {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expiry_date: Date.now() + 3600000, // 1 hour from now
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/drive',
  };

  beforeEach(() => {
    process.env.GDRIVE_TOKEN_STORAGE_PATH = testTokenPath;
    process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH = testAuditPath;
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = testEncryptionKey;
    
    jest.clearAllMocks();
    // @ts-ignore - mocking private property
    TokenManager._instance = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt tokens correctly', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      // Test encryption
      const encrypted = await tokenManager['encrypt'](JSON.stringify(validTokenData));
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain('test_access_token');
      expect(encrypted).not.toContain('test_refresh_token');
      
      // Test decryption
      const decrypted = await tokenManager['decrypt'](encrypted);
      const decryptedData = JSON.parse(decrypted);
      expect(decryptedData).toEqual(validTokenData);
    });

    it('should use AES-256-GCM algorithm', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const encrypted = await tokenManager['encrypt']('test data');
      
      // Encrypted format: iv:authTag:encryptedData
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      
      // IV should be 16 bytes (32 hex chars)
      expect(parts[0]).toHaveLength(32);
      
      // Auth tag should be 16 bytes (32 hex chars)
      expect(parts[1]).toHaveLength(32);
    });

    it('should throw error with invalid encryption key', () => {
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = 'invalid_key';
      
      expect(() => TokenManager.getInstance(mockLogger as any)).toThrow(
        'Invalid encryption key. Must be 32-byte base64-encoded key.'
      );
    });

    it('should clear sensitive data from memory after operations', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const sensitiveData = 'sensitive_token_data';
      const buffer = Buffer.from(sensitiveData);
      
      // Simulate memory clearing
      await tokenManager['clearMemory'](buffer);
      
      // Buffer should be zeroed out
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Token Storage and Retrieval', () => {
    it('should save tokens with correct file permissions (0600)', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockFs.chmod.mockResolvedValueOnce(undefined);
      
      await tokenManager.saveTokens(validTokenData);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testTokenPath,
        expect.any(String),
        { encoding: 'utf8' }
      );
      
      expect(mockFs.chmod).toHaveBeenCalledWith(testTokenPath, 0o600);
    });

    it('should load and decrypt tokens from storage', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      // Encrypt the data first
      const encrypted = await tokenManager['encrypt'](JSON.stringify(validTokenData));
      mockFs.readFile.mockResolvedValueOnce(encrypted);
      
      const loadedTokens = await tokenManager.loadTokens();
      
      expect(loadedTokens).toEqual(validTokenData);
      expect(mockFs.readFile).toHaveBeenCalledWith(testTokenPath, 'utf8');
    });

    it('should return null when token file does not exist', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      
      const tokens = await tokenManager.loadTokens();
      
      expect(tokens).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No saved tokens found',
        expect.any(Object)
      );
    });

    it('should handle corrupted token files gracefully', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.readFile.mockResolvedValueOnce('corrupted_data');
      
      const tokens = await tokenManager.loadTokens();
      
      expect(tokens).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load tokens',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Token Validation', () => {
    it('should detect expired tokens', () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const expiredToken = {
        ...validTokenData,
        expiry_date: Date.now() - 1000, // 1 second ago
      };
      
      expect(tokenManager.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should detect tokens expiring within buffer time', () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const soonToExpireToken = {
        ...validTokenData,
        expiry_date: Date.now() + 5 * 60 * 1000, // 5 minutes from now
      };
      
      // With 10 minute buffer
      expect(tokenManager.isTokenExpiringSoon(soonToExpireToken, 10 * 60 * 1000)).toBe(true);
    });

    it('should validate token has required fields', () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const invalidToken = {
        access_token: 'test',
        // missing refresh_token
      };
      
      expect(tokenManager.isValidTokenData(invalidToken as any)).toBe(false);
    });
  });

  describe('Audit Trail', () => {
    it('should log TOKEN_ENCRYPTED event', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.appendFile.mockResolvedValueOnce(undefined);
      
      await tokenManager['logAuditEvent']('TOKEN_ENCRYPTED', true, {
        tokenId: 'hashed_token_id',
      });
      
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        testAuditPath,
        expect.stringContaining('"event":"TOKEN_ENCRYPTED"'),
        'utf8'
      );
    });

    it('should log TOKEN_DELETED_INVALID_GRANT event', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.appendFile.mockResolvedValueOnce(undefined);
      mockFs.unlink.mockResolvedValueOnce(undefined);
      
      await tokenManager.deleteTokensOnInvalidGrant();
      
      expect(mockFs.unlink).toHaveBeenCalledWith(testTokenPath);
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        testAuditPath,
        expect.stringContaining('"event":"TOKEN_DELETED_INVALID_GRANT"'),
        'utf8'
      );
    });

    it('should include all required audit fields', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      let capturedAudit: string = '';
      mockFs.appendFile.mockImplementation(async (path, data) => {
        capturedAudit = data as string;
        return undefined;
      });
      
      await tokenManager['logAuditEvent']('TOKEN_REFRESHED', true, {
        expiresIn: 3600,
        refreshAttempt: 1,
        source: 'proactive_refresh',
      });
      
      const auditLog = JSON.parse(capturedAudit.trim());
      
      expect(auditLog).toMatchObject({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        event: 'TOKEN_REFRESHED',
        success: true,
        metadata: {
          expiresIn: 3600,
          refreshAttempt: 1,
          source: 'proactive_refresh',
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));
      
      await expect(tokenManager.saveTokens(validTokenData)).rejects.toThrow('Disk full');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save tokens',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle invalid_grant error by deleting tokens', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.unlink.mockResolvedValueOnce(undefined);
      mockFs.appendFile.mockResolvedValueOnce(undefined);
      
      await tokenManager.deleteTokensOnInvalidGrant();
      
      expect(mockFs.unlink).toHaveBeenCalledWith(testTokenPath);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Deleted invalid tokens due to invalid_grant error'
      );
    });

    it('should prevent retry loops after invalid_grant', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      mockFs.unlink.mockResolvedValueOnce(undefined);
      
      await tokenManager.deleteTokensOnInvalidGrant();
      
      // Set a flag that prevents retries
      expect(tokenManager['invalidGrantEncountered']).toBe(true);
    });
  });

  describe('Security Requirements', () => {
    it('should hash token IDs in logs using SHA256', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const tokenId = 'actual_token_value';
      const hashedId = tokenManager['hashTokenId'](tokenId);
      
      // Should be a 64-character hex string (SHA256)
      expect(hashedId).toHaveLength(64);
      expect(hashedId).toMatch(/^[a-f0-9]{64}$/);
      
      // Should not contain actual token
      expect(hashedId).not.toContain(tokenId);
    });

    it('should never log refresh tokens in plain text', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const mockLoggerSpy = jest.spyOn(mockLogger, 'info');
      const mockErrorSpy = jest.spyOn(mockLogger, 'error');
      
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockFs.chmod.mockResolvedValueOnce(undefined);
      
      await tokenManager.saveTokens(validTokenData);
      
      // Check all log calls
      const allLogCalls = [
        ...mockLoggerSpy.mock.calls,
        ...mockErrorSpy.mock.calls,
      ];
      
      allLogCalls.forEach(call => {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(validTokenData.refresh_token);
        expect(logContent).not.toContain(validTokenData.access_token);
      });
    });
  });
});