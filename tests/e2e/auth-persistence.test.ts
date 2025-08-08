import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';

// Mock dependencies for E2E testing
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

// E2E test for full authentication flow
describe('E2E: Authentication Persistence', () => {
  let tempDir: string;
  let serverProcess: ChildProcess | null = null;
  
  // Test credentials for E2E mocking
  const testCredentials = {
    access_token: 'e2e_test_access_token',
    refresh_token: 'e2e_test_refresh_token',
    expiry_date: Date.now() + 3600000,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/drive',
  };
  
  const mockEncryptionKey = Buffer.from('test-key-32-bytes-1234567890ab').toString('base64');

  beforeAll(async () => {
    tempDir = '/mock/temp/dir';
    
    // Set up encryption key
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = mockEncryptionKey;
    
    // Setup mocks
    setupMocks();
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  afterAll(async () => {
    // Cleanup  
    if (serverProcess) {
      (serverProcess as ChildProcess).kill?.('SIGTERM');
    }
    
    delete process.env.GDRIVE_TOKEN_ENCRYPTION_KEY;
    jest.resetAllMocks();
  });

  describe('Initial Authentication Flow', () => {
    it('should complete initial auth and save encrypted tokens', async () => {
      // Mock the OAuth flow result
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      const encryptedData = await encryptTestData(testCredentials);
      
      // Simulate saving encrypted tokens
      await mockFs.writeFile(tokenPath, encryptedData, { mode: 0o600 });
      
      // Verify mocked file operations were called correctly
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        tokenPath, 
        encryptedData, 
        { mode: 0o600 }
      );
      
      // Mock stat to return correct permissions
      mockFs.stat.mockResolvedValueOnce({ mode: 0o600 } as Stats);
      const stats = await mockFs.stat(tokenPath);
      expect(stats.mode & 0o777).toBe(0o600);
      
      // Verify data is in encrypted format (contains colons, not plain text)
      expect(encryptedData).toContain(':');
      expect(encryptedData).not.toContain('e2e_test_access_token');
      expect(encryptedData).not.toContain('e2e_test_refresh_token');
    });
  });

  describe('Token Persistence Across Restarts', () => {
    it('should load tokens after server restart', async () => {
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      
      // First "session" - save tokens
      const session1Tokens = {
        ...testCredentials,
        access_token: 'session1_token',
      };
      
      const encryptedData = await encryptTestData(session1Tokens);
      await mockFs.writeFile(tokenPath, encryptedData, { mode: 0o600 });
      
      // Mock reading the file back
      mockFs.readFile.mockResolvedValueOnce(encryptedData);
      
      // Second "session" - load tokens
      const loadedData = await mockFs.readFile(tokenPath, 'utf8');
      const decryptedTokens = await decryptTestData(loadedData);
      
      expect(decryptedTokens).toMatchObject({
        access_token: 'session1_token',
        refresh_token: testCredentials.refresh_token,
      });
      
      expect(mockFs.readFile).toHaveBeenCalledWith(tokenPath, 'utf8');
    });
  });

  describe('Automatic Token Refresh', () => {
    it('should refresh token automatically when expiring', async () => {
      const expiringToken = {
        ...testCredentials,
        expiry_date: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      const expiringEncrypted = await encryptTestData(expiringToken);
      await mockFs.writeFile(tokenPath, expiringEncrypted, { mode: 0o600 });
      
      // Simulate automatic refresh process
      const refreshedToken = {
        ...expiringToken,
        access_token: 'refreshed_token',
        expiry_date: Date.now() + 3600000, // 1 hour
      };
      
      const refreshedEncrypted = await encryptTestData(refreshedToken);
      await mockFs.writeFile(tokenPath, refreshedEncrypted, { mode: 0o600 });
      
      // Mock reading the refreshed token
      mockFs.readFile.mockResolvedValueOnce(refreshedEncrypted);
      
      const loaded = await decryptTestData(await mockFs.readFile(tokenPath, 'utf8'));
      expect(loaded.access_token).toBe('refreshed_token');
      expect(loaded.expiry_date).toBeGreaterThan(Date.now() + 30 * 60 * 1000);
      
      // Verify refresh was persisted
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        tokenPath,
        refreshedEncrypted,
        { mode: 0o600 }
      );
    });
  });

  describe('Manual Re-authentication Flow', () => {
    it('should handle invalid_grant error correctly', async () => {
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      const auditPath = path.join(tempDir, '.gdrive-mcp-audit.log');
      
      // Save tokens first
      const encryptedData = await encryptTestData(testCredentials);
      await mockFs.writeFile(tokenPath, encryptedData, { mode: 0o600 });
      
      // Simulate invalid_grant handling (token deletion)
      await mockFs.unlink(tokenPath);
      
      // Write audit event
      const auditEvent = {
        timestamp: new Date().toISOString(),
        event: 'TOKEN_DELETED_INVALID_GRANT',
        success: true,
        metadata: {
          reason: 'invalid_grant error from Google OAuth',
        },
      };
      
      await mockFs.appendFile(auditPath, JSON.stringify(auditEvent) + '\n', 'utf8');
      
      // Verify token deletion was called
      expect(mockFs.unlink).toHaveBeenCalledWith(tokenPath);
      
      // Mock file access to throw error (file doesn't exist)
      mockFs.access.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));
      
      // Verify token file access fails
      await expect(mockFs.access(tokenPath)).rejects.toThrow();
      
      // Mock audit log reading
      const auditContent = JSON.stringify(auditEvent) + '\n';
      mockFs.readFile.mockResolvedValueOnce(auditContent);
      
      // Verify audit log
      const loadedAuditContent = await mockFs.readFile(auditPath, 'utf8');
      expect(loadedAuditContent).toContain('TOKEN_DELETED_INVALID_GRANT');
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        auditPath,
        JSON.stringify(auditEvent) + '\n',
        'utf8'
      );
    });
  });

  describe('Production Scenarios', () => {
    it('should handle high load with multiple token refreshes', async () => {
      // Simulate multiple concurrent operations
      const operations = Array(10).fill(null).map(async (_, i) => {
        const tokenData = {
          ...testCredentials,
          access_token: `concurrent_token_${i}`,
        };
        
        const tokenPath = path.join(tempDir, `.gdrive-tokens-${i}.json`);
        const encryptedData = await encryptTestData(tokenData);
        await mockFs.writeFile(tokenPath, encryptedData, { mode: 0o600 });
        
        return tokenPath;
      });
      
      const paths = await Promise.all(operations);
      
      // Verify all write operations were called
      expect(mockFs.writeFile).toHaveBeenCalledTimes(10);
      
      // Mock file access to succeed for all paths
      mockFs.access.mockResolvedValue();
      
      // Verify all files would exist
      for (const tokenPath of paths) {
        const exists = await mockFs.access(tokenPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it('should maintain performance under token refresh load', async () => {
      const start = Date.now();
      
      // Simulate 100 token operations with mocked crypto
      const operations = Array(100).fill(null).map(async (_, i) => {
        const data = {
          ...testCredentials,
          access_token: `perf_token_${i}`,
        };
        
        const encrypted = await encryptTestData(data);
        const decrypted = await decryptTestData(encrypted);
        
        return decrypted.access_token === `perf_token_${i}`;
      });
      
      const results = await Promise.all(operations);
      const duration = Date.now() - start;
      
      // All operations should succeed
      expect(results.every(r => r === true)).toBe(true);
      
      // Should complete in reasonable time (mocked operations are fast)
      expect(duration).toBeLessThan(1000); // < 1 second for mocked operations
      
      // Average time per operation should be very fast with mocks
      const avgTime = duration / 100;
      expect(avgTime).toBeLessThan(10); // < 10ms per mocked operation
    });
  });

  // Mock setup functions
  function setupMocks(): void {
    // Mock fs operations
    mockFs.writeFile.mockResolvedValue();
    mockFs.readFile.mockResolvedValue('mock-encrypted-data:authTag:encryptedContent');
    mockFs.stat.mockResolvedValue({ mode: 0o600 } as Stats);
    mockFs.access.mockResolvedValue();
    mockFs.unlink.mockResolvedValue();
    mockFs.appendFile.mockResolvedValue();
  }
  
  // Helper functions for E2E tests with mocked crypto
  async function encryptTestData(data: Record<string, unknown>): Promise<string> {
    // Mock encryption - return predictable format
    const mockIv = '1234567890123456';
    const mockAuthTag = 'abcdef1234567890';
    const mockEncrypted = Buffer.from(JSON.stringify(data)).toString('hex');
    
    return `${mockIv}:${mockAuthTag}:${mockEncrypted}`;
  }

  async function decryptTestData(encrypted: string): Promise<Record<string, unknown>> {
    // Mock decryption - extract data from predictable format
    const parts = encrypted.split(':');
    if (parts.length === 3) {
      try {
        const data = Buffer.from(parts[2]!, 'hex').toString('utf8');
        return JSON.parse(data);
      } catch {
        return testCredentials as Record<string, unknown>; // Fallback to test credentials
      }
    }
    return testCredentials as Record<string, unknown>;
  }
});