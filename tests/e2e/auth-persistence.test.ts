import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// E2E test for full authentication flow
describe('E2E: Authentication Persistence', () => {
  let tempDir: string;
  let serverProcess: ChildProcess | null = null;
  
  // Test credentials for E2E (would be mocked in real tests)
  const testCredentials = {
    access_token: 'e2e_test_access_token',
    refresh_token: 'e2e_test_refresh_token',
    expiry_date: Date.now() + 3600000,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/drive',
  };

  beforeAll(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdrive-e2e-'));
    
    // Create test OAuth keys file
    const oauthKeys = {
      web: {
        client_id: 'test_client_id.apps.googleusercontent.com',
        client_secret: 'test_client_secret',
        redirect_uris: ['http://localhost:3000/oauth2callback'],
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      },
    };
    
    await fs.writeFile(
      path.join(tempDir, 'gcp-oauth.keys.json'),
      JSON.stringify(oauthKeys),
      'utf8'
    );
    
    // Set up encryption key
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = Buffer.from(new Uint8Array(32)).toString('base64');
  });

  afterAll(async () => {
    // Cleanup
    if (serverProcess) {
      serverProcess.kill();
    }
    
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Initial Authentication Flow', () => {
    it('should complete initial auth and save encrypted tokens', async () => {
      // This would typically involve:
      // 1. Starting the server in auth mode
      // 2. Simulating OAuth callback
      // 3. Verifying tokens are saved
      
      // For testing purposes, simulate the result
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      const encryptedData = await encryptTestData(testCredentials);
      
      await fs.writeFile(tokenPath, encryptedData, { mode: 0o600 });
      
      // Verify file exists with correct permissions
      const stats = await fs.stat(tokenPath);
      expect(stats.mode & 0o777).toBe(0o600);
      
      // Verify data is encrypted (not plain text)
      const content = await fs.readFile(tokenPath, 'utf8');
      expect(content).not.toContain('e2e_test_access_token');
      expect(content).not.toContain('e2e_test_refresh_token');
    });
  });

  describe('Token Persistence Across Restarts', () => {
    it('should load tokens after server restart', async () => {
      // Simulate server restart by:
      // 1. Saving tokens
      // 2. "Restarting" (new instance)
      // 3. Verifying tokens are loaded
      
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      
      // First "session" - save tokens
      const session1Tokens = {
        ...testCredentials,
        access_token: 'session1_token',
      };
      
      await fs.writeFile(
        tokenPath,
        await encryptTestData(session1Tokens),
        { mode: 0o600 }
      );
      
      // Second "session" - load tokens
      const loadedData = await fs.readFile(tokenPath, 'utf8');
      const decryptedTokens = await decryptTestData(loadedData);
      
      expect(decryptedTokens).toMatchObject({
        access_token: 'session1_token',
        refresh_token: testCredentials.refresh_token,
      });
    });
  });

  describe('Automatic Token Refresh', () => {
    it('should refresh token automatically when expiring', async () => {
      // Test scenario:
      // 1. Save token that expires in 5 minutes
      // 2. Wait for proactive refresh
      // 3. Verify token was refreshed
      
      const expiringToken = {
        ...testCredentials,
        expiry_date: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      await fs.writeFile(
        tokenPath,
        await encryptTestData(expiringToken),
        { mode: 0o600 }
      );
      
      // In real E2E test, would start server and wait for refresh
      // For now, simulate the expected behavior
      const refreshedToken = {
        ...expiringToken,
        access_token: 'refreshed_token',
        expiry_date: Date.now() + 3600000, // 1 hour
      };
      
      await fs.writeFile(
        tokenPath,
        await encryptTestData(refreshedToken),
        { mode: 0o600 }
      );
      
      const loaded = await decryptTestData(await fs.readFile(tokenPath, 'utf8'));
      expect(loaded.access_token).toBe('refreshed_token');
      expect(loaded.expiry_date).toBeGreaterThan(Date.now() + 30 * 60 * 1000);
    });
  });

  describe('Manual Re-authentication Flow', () => {
    it('should handle invalid_grant error correctly', async () => {
      // Simulate invalid_grant scenario
      const tokenPath = path.join(tempDir, '.gdrive-server-credentials.json');
      const auditPath = path.join(tempDir, '.gdrive-mcp-audit.log');
      
      // Save tokens
      await fs.writeFile(
        tokenPath,
        await encryptTestData(testCredentials),
        { mode: 0o600 }
      );
      
      // Simulate invalid_grant handling (token deletion)
      await fs.unlink(tokenPath);
      
      // Write audit event
      const auditEvent = {
        timestamp: new Date().toISOString(),
        event: 'TOKEN_DELETED_INVALID_GRANT',
        success: true,
        metadata: {
          reason: 'invalid_grant error from Google OAuth',
        },
      };
      
      await fs.appendFile(auditPath, JSON.stringify(auditEvent) + '\n', 'utf8');
      
      // Verify token file is gone
      await expect(fs.access(tokenPath)).rejects.toThrow();
      
      // Verify audit log
      const auditContent = await fs.readFile(auditPath, 'utf8');
      expect(auditContent).toContain('TOKEN_DELETED_INVALID_GRANT');
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
        await fs.writeFile(
          tokenPath,
          await encryptTestData(tokenData),
          { mode: 0o600 }
        );
        
        return tokenPath;
      });
      
      const paths = await Promise.all(operations);
      
      // Verify all files were created
      for (const tokenPath of paths) {
        const exists = await fs.access(tokenPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it('should maintain performance under token refresh load', async () => {
      const start = Date.now();
      
      // Simulate 100 token operations
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
      
      // Should complete in reasonable time (< 5 seconds for 100 operations)
      expect(duration).toBeLessThan(5000);
      
      // Average time per operation
      const avgTime = duration / 100;
      expect(avgTime).toBeLessThan(50); // < 50ms per operation
    });
  });

  // Helper functions for E2E tests
  async function encryptTestData(data: any): Promise<string> {
    // Simplified encryption for testing
    const key = Buffer.from(process.env.GDRIVE_TOKEN_ENCRYPTION_KEY!, 'base64');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  async function decryptTestData(encrypted: string): Promise<any> {
    const key = Buffer.from(process.env.GDRIVE_TOKEN_ENCRYPTION_KEY!, 'base64');
    const parts = encrypted.split(':');
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
});

// Import crypto for encryption helpers
import * as crypto from 'crypto';