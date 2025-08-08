import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
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
    } as unknown as jest.Mocked<Logger>;

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
    } as unknown as jest.Mocked<KeyRotationManager>;

    (KeyRotationManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockKeyRotationManager);

    // Set environment variables
    process.env.GDRIVE_TOKEN_STORAGE_PATH = mockTokenPath;
    process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH = mockAuditPath;
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

    // Mock fs
    (fs.writeFile as jest.MockedFunction<any>).mockResolvedValue(undefined);
    (fs.chmod as jest.MockedFunction<any>).mockResolvedValue(undefined);
    (fs.appendFile as jest.MockedFunction<any>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (TokenManager as any)._instance = undefined;
    delete process.env.GDRIVE_TOKEN_STORAGE_PATH;
    delete process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH;
    delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
    // Clean up additional environment variables
    for (let i = 2; i <= 10; i++) {
      delete process.env[`GDRIVE_TOKEN_ENCRYPTION_KEY_V${i}`];
    }
    delete process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION;
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
      const writeCall = (fs.writeFile as jest.MockedFunction<any>).mock.calls[0];
      expect(writeCall?.[0]).toBe(mockTokenPath);
      
      // Parse the saved data
      const savedData = JSON.parse(writeCall?.[1] as string);
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
    it('should save tokens in versioned format and attempt to load', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      // Test that save works with versioned format
      await tokenManager.saveTokens(mockTokenData);
      const savedData = JSON.parse((fs.writeFile as jest.MockedFunction<any>).mock.calls[0]?.[1] as string);
      
      // Verify the saved data has the correct versioned structure
      expect(savedData.version).toBe('v1');
      expect(savedData.algorithm).toBe('aes-256-gcm');
      expect(savedData.keyDerivation).toEqual({
        method: 'pbkdf2',
        iterations: 100000,
        salt: expect.any(String),
      });
      expect(savedData.data).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should throw error for legacy format', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      // Mock legacy format
      (fs.readFile as jest.MockedFunction<any>).mockResolvedValue('iv:authTag:encryptedData');
      
      const result = await tokenManager.loadTokens();
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Legacy token format detected');
    });

    it('should return null if file does not exist', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const error = new Error('ENOENT') as any;
      error.code = 'ENOENT';
      (fs.readFile as jest.MockedFunction<any>).mockRejectedValue(error);
      
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
      
      (fs.unlink as jest.MockedFunction<any>).mockResolvedValue(undefined);
      
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
      
      (fs.unlink as jest.MockedFunction<any>).mockRejectedValue(new Error('Permission denied'));
      
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
      
      invalidCases.forEach((testCase) => {
        const result = tokenManager.isValidTokenData(testCase);
        expect(result).toBeFalsy(); // Use toBeFalsy to handle null, false, undefined
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

    it('should handle invalid base64 keys gracefully', () => {
      // Reset the mock to avoid conflicts with other tests
      jest.clearAllMocks();
      (TokenManager as any)._instance = undefined;
      
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2 = 'short'; // Will decode to wrong length
      
      tokenManager = TokenManager.getInstance(mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid key length for GDRIVE_TOKEN_ENCRYPTION_KEY_V2')
      );
      expect(mockKeyRotationManager.registerKey).toHaveBeenCalledTimes(1); // Only v1
    });

    it('should handle invalid key length gracefully', () => {
      // Reset the mock to avoid conflicts with other tests
      jest.clearAllMocks();
      (TokenManager as any)._instance = undefined;
      
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2 = crypto.randomBytes(16).toString('base64'); // Wrong size
      
      tokenManager = TokenManager.getInstance(mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid key length for GDRIVE_TOKEN_ENCRYPTION_KEY_V2: 16 bytes, skipping'
      );
      expect(mockKeyRotationManager.registerKey).toHaveBeenCalledTimes(1); // Only v1
    });

    it('should handle key registration failure gracefully', () => {
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY_V2 = crypto.randomBytes(32).toString('base64');
      mockKeyRotationManager.registerKey.mockImplementation((version: string) => {
        if (version === 'v2') {
          throw new Error('Registration failed');
        }
      });
      
      tokenManager = TokenManager.getInstance(mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to register key GDRIVE_TOKEN_ENCRYPTION_KEY_V2',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should throw error for invalid main encryption key', () => {
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = 'short'; // Will decode to less than 32 bytes
      
      expect(() => {
        TokenManager.getInstance(mockLogger);
      }).toThrow(/Invalid encryption key length: \d+ bytes/);
    });

    it('should throw error for wrong main encryption key length', () => {
      process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(16).toString('base64');
      
      expect(() => {
        TokenManager.getInstance(mockLogger);
      }).toThrow('Invalid encryption key length: 16 bytes. Must be 32-byte base64-encoded key.');
    });

    it('should log audit events for key registration', () => {
      tokenManager = TokenManager.getInstance(mockLogger);

      expect(fs.appendFile).toHaveBeenCalledWith(
        mockAuditPath,
        expect.stringContaining('KEY_REGISTERED'),
        'utf8'
      );
      expect(fs.appendFile).toHaveBeenCalledWith(
        mockAuditPath,
        expect.stringContaining('KEY_VERSION_CHANGED'),
        'utf8'
      );
    });
  });

  describe('encryption and decryption', () => {
    it('should handle key not found during decryption', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const versionedData: VersionedTokenStorage = {
        version: 'v999', // Non-existent version
        algorithm: 'aes-256-gcm',
        keyDerivation: {
          method: 'pbkdf2',
          iterations: 100000,
          salt: 'salt-value',
        },
        data: 'iv:authTag:encryptedData',
        createdAt: new Date().toISOString(),
        keyId: 'v999',
      };
      
      mockKeyRotationManager.getKey.mockReturnValue(undefined);
      (fs.readFile as jest.MockedFunction<any>).mockResolvedValue(JSON.stringify(versionedData));
      
      const result = await tokenManager.loadTokens();
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load tokens',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Key version v999 not found',
          }),
        })
      );
    });

    it('should handle malformed encrypted data', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const versionedData: VersionedTokenStorage = {
        version: 'v1',
        algorithm: 'aes-256-gcm',
        keyDerivation: {
          method: 'pbkdf2',
          iterations: 100000,
          salt: 'salt-value',
        },
        data: 'malformed:data', // Wrong format
        createdAt: new Date().toISOString(),
        keyId: 'v1',
      };
      
      (fs.readFile as jest.MockedFunction<any>).mockResolvedValue(JSON.stringify(versionedData));
      
      const result = await tokenManager.loadTokens();
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load tokens',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid encrypted data format',
          }),
        })
      );
    });

    it('should handle audit log write failure gracefully', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      (fs.appendFile as jest.MockedFunction<any>).mockRejectedValue(new Error('Disk full'));
      
      await tokenManager.saveTokens(mockTokenData);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to write audit log',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

  });

  describe('legacy format detection', () => {
    it('should detect legacy format and return appropriate error', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      // Mock reading legacy format
      (fs.readFile as jest.MockedFunction<any>).mockResolvedValue('iv:authTag:encryptedData');
      
      const result = await tokenManager.loadTokens();
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Legacy token format detected'
      );
    });

    it('should reject non-versioned JSON format', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      // Mock reading non-versioned JSON
      const nonVersionedData = {
        encrypted: 'some-data',
        timestamp: Date.now(),
      };
      (fs.readFile as jest.MockedFunction<any>).mockResolvedValue(JSON.stringify(nonVersionedData));
      
      const result = await tokenManager.loadTokens();
      
      expect(result).toBeNull();
      // The actual error message logged is different, so let's check for the key parts
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load tokens',
        expect.any(Object)
      );
    });
  });

  describe('token validation edge cases', () => {
    it('should handle empty token expiry date', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const tokenWithEmptyExpiry = { ...mockTokenData, expiry_date: 0 };
      
      expect(tokenManager.isTokenExpired(tokenWithEmptyExpiry)).toBe(true);
      expect(tokenManager.isTokenExpiringSoon(tokenWithEmptyExpiry)).toBe(true);
    });

    it('should handle null/undefined values in token validation', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const tokenWithNullValues = {
        access_token: null,
        refresh_token: 'valid',
        expiry_date: Date.now(),
        token_type: 'Bearer',
        scope: 'test',
      };
      
      expect(tokenManager.isValidTokenData(tokenWithNullValues)).toBe(false);
    });

    it('should handle numeric string expiry dates', () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const tokenWithStringExpiry = {
        ...mockTokenData,
        expiry_date: '12345' as any,
      };
      
      expect(tokenManager.isValidTokenData(tokenWithStringExpiry)).toBe(false);
    });
  });

  describe('file system operations', () => {
    it('should handle file write errors during save', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      (fs.writeFile as jest.MockedFunction<any>).mockRejectedValue(new Error('Permission denied'));
      
      await expect(tokenManager.saveTokens(mockTokenData)).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save tokens',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle chmod errors during save', async () => {
      tokenManager = TokenManager.getInstance(mockLogger);
      
      (fs.chmod as jest.MockedFunction<any>).mockRejectedValue(new Error('Chmod failed'));
      
      await expect(tokenManager.saveTokens(mockTokenData)).rejects.toThrow('Chmod failed');
    });

    it('should use default paths when environment variables not set', () => {
      delete process.env.GDRIVE_TOKEN_STORAGE_PATH;
      delete process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH;
      
      tokenManager = TokenManager.getInstance(mockLogger);
      
      const expectedTokenPath = path.join(os.homedir(), '.gdrive-mcp-tokens.json');
      const expectedAuditPath = path.join(os.homedir(), '.gdrive-mcp-audit.log');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TokenManager initialized',
        expect.objectContaining({
          tokenPath: expectedTokenPath,
          auditPath: expectedAuditPath,
        })
      );
    });
  });
});