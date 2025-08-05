import { TokenManager, TokenData, VersionedTokenStorage } from '../../auth/TokenManager.js';
import { KeyRotationManager } from '../../auth/KeyRotationManager.js';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs/promises');
jest.mock('../../auth/KeyRotationManager.js');

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let mockLogger: Logger;
  let mockKeyRotationManager: jest.Mocked<KeyRotationManager>;
  const mockTokenPath = '/tmp/.gdrive-mcp-tokens.json';
  const mockAuditPath = '/tmp/.gdrive-mcp-audit.log';

  const mockTokenData: TokenData = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expiry_date: Date.now() + 3600000, // 1 hour from now
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/drive',
  };

  beforeEach(() => {
    // Clear singleton instance
    (TokenManager as any)._instance = undefined;

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Mock KeyRotationManager
    mockKeyRotationManager = {
      getInstance: jest.fn(),
      registerKey: jest.fn(),
      setCurrentVersion: jest.fn(),
      getCurrentKey: jest.fn().mockReturnValue({
        version: 'v1',
        key: crypto.randomBytes(32),
        metadata: {
          version: 'v1',
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64'),
        },
      }),
      getKey: jest.fn().mockReturnValue({
        version: 'v1',
        key: crypto.randomBytes(32),
        metadata: {
          version: 'v1',
          algorithm: 'aes-256-gcm',
          createdAt: new Date().toISOString(),
          iterations: 100000,
          salt: crypto.randomBytes(32).toString('base64'),
        },
      }),
    } as any;

    (KeyRotationManager.getInstance as jest.Mock).mockReturnValue(mockKeyRotationManager);

    // Set environment variables
    process.env.GDRIVE_TOKEN_STORAGE_PATH = mockTokenPath;
    process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH = mockAuditPath;
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

    // Mock fs
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.chmod as jest.Mock).mockResolvedValue(undefined);
    (fs.appendFile as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GDRIVE_TOKEN_STORAGE_PATH;
    delete process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH;
    delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = TokenManager.getInstance(mockLogger);
      const instance2 = TokenManager.getInstance(mockLogger);
      expect(instance1).toBe(instance2);
    });

    it('should throw error if encryption key not provided', () => {
      delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
      expect(() => {
        TokenManager.getInstance(mockLogger);
      }).toThrow('GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required');
    });
  });

  describe('saveTokens', () => {
    it('should save tokens with versioned format', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      await tokenManager.saveTokens(mockTokenData);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toBe(mockTokenPath);
      
      // Parse the saved data
      const savedData = JSON.parse(writeCall[1]);
      expect(savedData.version).toBe('v1');
      expect(savedData.algorithm).toBe('aes-256-gcm');
      expect(savedData.keyDerivation).toEqual({
        method: 'pbkdf2',
        iterations: 100000,
        salt: expect.any(String),
      });
      expect(savedData.data).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
      expect(savedData.createdAt).toBeDefined();
      expect(savedData.keyId).toBe('v1');

      expect(fs.chmod).toHaveBeenCalledWith(mockTokenPath, 0o600);
    });

    it('should throw error for invalid token data', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const invalidTokenData = { access_token: 'test' } as any;
      
      await expect(tokenManager.saveTokens(invalidTokenData)).rejects.toThrow('Invalid token data');
    });
  });

  describe('loadTokens', () => {
    it('should load and decrypt versioned tokens', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      // First save tokens to get proper encrypted format
      await tokenManager.saveTokens(mockTokenData);
      const savedData = JSON.parse((fs.writeFile as jest.Mock).mock.calls[0][1]);
      
      // Mock file read to return the saved data
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(savedData));
      
      const loadedTokens = await tokenManager.loadTokens();
      
      expect(loadedTokens).toEqual(mockTokenData);
    });

    it('should throw error for legacy format', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      // Mock legacy format
      (fs.readFile as jest.Mock).mockResolvedValue('iv:authTag:encryptedData');
      
      const result = await tokenManager.loadTokens();
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load tokens',
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Legacy token format detected'),
          }),
        })
      );
    });

    it('should return null if file does not exist', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const error = new Error('ENOENT') as any;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);
      
      const result = await tokenManager.loadTokens();
      
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No saved tokens found',
        { path: mockTokenPath }
      );
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const expiredToken: TokenData = {
        ...mockTokenData,
        expiry_date: Date.now() - 1000, // 1 second ago
      };
      
      expect(tokenManager.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should return false for valid token', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      expect(tokenManager.isTokenExpired(mockTokenData)).toBe(false);
    });

    it('should return true for missing expiry date', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const tokenWithoutExpiry = { ...mockTokenData, expiry_date: undefined } as any;
      
      expect(tokenManager.isTokenExpired(tokenWithoutExpiry)).toBe(true);
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('should return true for token expiring within buffer', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const expiringToken: TokenData = {
        ...mockTokenData,
        expiry_date: Date.now() + 5 * 60 * 1000, // 5 minutes from now
      };
      
      expect(tokenManager.isTokenExpiringSoon(expiringToken)).toBe(true);
    });

    it('should return false for token not expiring soon', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      expect(tokenManager.isTokenExpiringSoon(mockTokenData)).toBe(false);
    });

    it('should respect custom buffer time', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const customBuffer = 2 * 60 * 60 * 1000; // 2 hours
      const tokenExpiringIn90Min: TokenData = {
        ...mockTokenData,
        expiry_date: Date.now() + 90 * 60 * 1000, // 90 minutes from now
      };
      
      expect(tokenManager.isTokenExpiringSoon(tokenExpiringIn90Min, customBuffer)).toBe(true);
    });
  });

  describe('deleteTokensOnInvalidGrant', () => {
    it('should delete token file and log audit event', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);
      
      await tokenManager.deleteTokensOnInvalidGrant();
      
      expect(fs.unlink).toHaveBeenCalledWith(mockTokenPath);
      expect(fs.appendFile).toHaveBeenCalledWith(
        mockAuditPath,
        expect.stringContaining('TOKEN_DELETED_INVALID_GRANT'),
        'utf8'
      );
    });

    it('should handle deletion failure gracefully', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      
      await tokenManager.deleteTokensOnInvalidGrant();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete invalid tokens',
        expect.any(Object)
      );
    });
  });

  describe('isValidTokenData', () => {
    it('should return true for valid token data', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      expect(tokenManager.isValidTokenData(mockTokenData)).toBe(true);
    });

    it('should return false for invalid token data', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const invalidCases = [
        null,
        undefined,
        {},
        { access_token: 'test' },
        { ...mockTokenData, access_token: undefined },
        { ...mockTokenData, refresh_token: 123 },
        { ...mockTokenData, expiry_date: 'not-a-number' },
      ];
      
      invalidCases.forEach(testCase => {
        expect(tokenManager.isValidTokenData(testCase)).toBe(false);
      });
    });
  });

  describe('Environment key loading', () => {
    it('should load multiple key versions from environment', () => {
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2 = crypto.randomBytes(32).toString('base64');
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V3 = crypto.randomBytes(32).toString('base64');
      process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION = 'v2';

      tokenManager = TokenManager.getInstance(mockLogger);

      expect(mockKeyRotationManager.registerKey).toHaveBeenCalledTimes(3); // v1, v2, v3
      expect(mockKeyRotationManager.setCurrentVersion).toHaveBeenCalledWith('v2');
    });

    it('should default to v1 if current version not specified', () => {
      tokenManager = TokenManager.getInstance(mockLogger);

      expect(mockKeyRotationManager.setCurrentVersion).toHaveBeenCalledWith('v1');
    });
  });
});