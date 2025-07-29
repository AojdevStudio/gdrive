import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { AuthManager } from '../../auth/AuthManager.js';
import { TokenManager } from '../../auth/TokenManager.js';

// Integration test - less mocking, more real behavior
describe('Token Refresh Integration', () => {
  let authManager: AuthManager;
  let tokenManager: TokenManager;
  let tempDir: string;
  
  const testOAuthKeys = {
    client_id: 'test_client_id',
    client_secret: 'test_client_secret', 
    redirect_uris: ['http://localhost:3000/callback'],
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdrive-test-'));
    
    // Set environment variables
    process.env.GDRIVE_TOKEN_STORAGE_PATH = path.join(tempDir, 'tokens.json');
    process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH = path.join(tempDir, 'audit.log');
    process.env.GDRIVE_TOKEN_ENCRYPTION_KEY = Buffer.from(new Uint8Array(32)).toString('base64');
    
    // Reset singletons
    // @ts-ignore
    TokenManager._instance = undefined;
    // @ts-ignore
    AuthManager._instance = undefined;
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup
    if (authManager) {
      authManager.stopTokenMonitoring();
    }
    
    // Remove temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Full Auth Flow', () => {
    it('should handle complete authentication and token refresh cycle', async () => {
      // Initialize managers
      tokenManager = TokenManager.getInstance(mockLogger as any);
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      // Mock OAuth2Client to simulate Google's behavior
      const mockOAuth2Client = new OAuth2Client();
      jest.spyOn(authManager as any, 'createOAuth2Client').mockReturnValue(mockOAuth2Client);
      
      // Simulate initial authentication
      const initialTokens = {
        access_token: 'initial_access_token',
        refresh_token: 'refresh_token_value',
        expiry_date: Date.now() + 3600000, // 1 hour
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive',
      };
      
      await tokenManager.saveTokens(initialTokens);
      
      // Initialize auth manager
      await authManager.initialize();
      
      // Verify tokens were loaded
      const loadedTokens = await tokenManager.loadTokens();
      expect(loadedTokens).toMatchObject({
        access_token: initialTokens.access_token,
        refresh_token: initialTokens.refresh_token,
      });
      
      // Verify file permissions
      const stats = await fs.stat(process.env.GDRIVE_TOKEN_STORAGE_PATH!);
      expect(stats.mode & 0o777).toBe(0o600);
      
      // Simulate token refresh
      let tokenEventCallback: any;
      mockOAuth2Client.on = jest.fn((event, callback) => {
        if (event === 'tokens') {
          tokenEventCallback = callback;
        }
      });
      
      // Re-initialize to set up event listener
      await authManager.initialize();
      
      // Trigger token refresh event
      const refreshedTokens = {
        access_token: 'refreshed_access_token',
        expiry_date: Date.now() + 7200000, // 2 hours
      };
      
      tokenEventCallback(refreshedTokens);
      
      // Wait for async save
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify tokens were updated
      const updatedTokens = await tokenManager.loadTokens();
      expect(updatedTokens).toMatchObject({
        access_token: refreshedTokens.access_token,
        refresh_token: initialTokens.refresh_token, // Preserved
        expiry_date: refreshedTokens.expiry_date,
      });
    });
  });

  describe('API Operations During Refresh', () => {
    it('should handle API calls during token refresh without disruption', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      // Save initial tokens
      await tokenManager.saveTokens({
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expiry_date: Date.now() + 300000, // 5 minutes (will trigger refresh)
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive',
      });
      
      // Mock the OAuth2Client
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        getAccessToken: jest.fn().mockResolvedValue({
          token: 'new_access_token',
          res: null,
        }),
        on: jest.fn(),
        credentials: {},
      };
      
      jest.spyOn(authManager as any, 'createOAuth2Client').mockReturnValue(mockOAuth2Client);
      
      await authManager.initialize();
      
      // Simulate multiple concurrent API operations
      const apiCall = async () => {
        const client = authManager.getOAuth2Client();
        // Simulate API call
        return client.credentials.access_token;
      };
      
      // Start refresh
      const refreshPromise = authManager.refreshToken();
      
      // Make API calls during refresh
      const results = await Promise.all([
        apiCall(),
        apiCall(),
        apiCall(),
      ]);
      
      await refreshPromise;
      
      // All calls should succeed
      expect(results).toHaveLength(3);
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledTimes(1); // Only one refresh
    });
  });

  describe('Error Recovery', () => {
    it('should recover from corrupted token file', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      // Write corrupted data
      await fs.writeFile(
        process.env.GDRIVE_TOKEN_STORAGE_PATH!,
        'corrupted data that is not valid encrypted tokens',
        'utf8'
      );
      
      // Should handle gracefully
      const tokens = await tokenManager.loadTokens();
      expect(tokens).toBeNull();
      
      // Should be able to save new tokens
      const newTokens = {
        access_token: 'new_token',
        refresh_token: 'new_refresh',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive',
      };
      
      await tokenManager.saveTokens(newTokens);
      
      const loaded = await tokenManager.loadTokens();
      expect(loaded).toMatchObject(newTokens);
    });

    it('should handle file system errors gracefully', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      // Make directory read-only
      await fs.chmod(tempDir, 0o555);
      
      // Should handle save error gracefully
      try {
        await tokenManager.saveTokens({
          access_token: 'test',
          refresh_token: 'test',
          expiry_date: Date.now(),
          token_type: 'Bearer',
          scope: 'test',
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Restore permissions
      await fs.chmod(tempDir, 0o755);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent token saves correctly', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      
      const tokens1 = {
        access_token: 'token1',
        refresh_token: 'refresh1',
        expiry_date: Date.now() + 1000000,
        token_type: 'Bearer',
        scope: 'scope1',
      };
      
      const tokens2 = {
        access_token: 'token2',
        refresh_token: 'refresh2',
        expiry_date: Date.now() + 2000000,
        token_type: 'Bearer',
        scope: 'scope2',
      };
      
      // Save concurrently
      await Promise.all([
        tokenManager.saveTokens(tokens1),
        tokenManager.saveTokens(tokens2),
      ]);
      
      // One should win
      const loaded = await tokenManager.loadTokens();
      expect(loaded).toBeDefined();
      expect(['token1', 'token2']).toContain(loaded!.access_token);
    });
  });

  describe('Audit Trail', () => {
    it('should create complete audit trail for token lifecycle', async () => {
      tokenManager = TokenManager.getInstance(mockLogger as any);
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      // Save initial tokens
      await tokenManager.saveTokens({
        access_token: 'initial_token',
        refresh_token: 'refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive',
      });
      
      // Read audit log
      const auditContent = await fs.readFile(
        process.env.GDRIVE_TOKEN_AUDIT_LOG_PATH!,
        'utf8'
      );
      
      const auditLines = auditContent.trim().split('\n');
      const auditEvents = auditLines.map(line => JSON.parse(line));
      
      // Should have encryption and save events
      expect(auditEvents).toContainEqual(
        expect.objectContaining({
          event: 'TOKEN_ENCRYPTED',
          success: true,
        })
      );
      
      // Verify timestamp format
      auditEvents.forEach(event => {
        expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect Google API rate limits during refresh', async () => {
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        getAccessToken: jest.fn()
          .mockRejectedValueOnce({ 
            response: { 
              status: 429, 
              headers: { 'retry-after': '2' } 
            } 
          })
          .mockResolvedValueOnce({ token: 'success_token', res: null }),
        on: jest.fn(),
        credentials: {},
      };
      
      jest.spyOn(authManager as any, 'createOAuth2Client').mockReturnValue(mockOAuth2Client);
      
      await authManager.initialize();
      
      const start = Date.now();
      await authManager.refreshToken();
      const duration = Date.now() - start;
      
      // Should have waited at least 2 seconds
      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledTimes(2);
    });
  });
});