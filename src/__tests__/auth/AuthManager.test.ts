import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OAuth2Client } from 'google-auth-library';
import { AuthManager, AuthState } from '../../auth/AuthManager.js';
import { TokenManager, TokenData } from '../../auth/TokenManager.js';

// Mock dependencies
jest.mock('google-auth-library');
jest.mock('../../auth/TokenManager.js');

const mockOAuth2Client = {
  setCredentials: jest.fn(),
  getAccessToken: jest.fn(),
  on: jest.fn(),
  credentials: {},
  refreshAccessToken: jest.fn(),
};

const mockTokenManager = {
  loadTokens: jest.fn(),
  saveTokens: jest.fn(),
  isTokenExpired: jest.fn(),
  isTokenExpiringSoon: jest.fn(),
  deleteTokensOnInvalidGrant: jest.fn(),
  isValidTokenData: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('AuthManager', () => {
  let authManager: AuthManager;
  const testOAuthKeys = {
    client_id: 'test_client_id',
    client_secret: 'test_client_secret',
    redirect_uris: ['http://localhost:3000/callback'],
  };

  const validTokenData: TokenData = {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expiry_date: Date.now() + 3600000, // 1 hour from now
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/drive',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    (OAuth2Client as jest.MockedClass<typeof OAuth2Client>).mockImplementation(() => mockOAuth2Client as any);
    (TokenManager.getInstance as jest.Mock).mockReturnValue(mockTokenManager);
    
    // Reset singleton
    // @ts-ignore
    AuthManager._instance = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (authManager) {
      authManager.stopTokenMonitoring();
    }
  });

  describe('Initialization', () => {
    it('should initialize with OAuth2Client and set up event listeners', async () => {
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      await authManager.initialize();
      
      expect(OAuth2Client).toHaveBeenCalledWith({
        clientId: testOAuthKeys.client_id,
        clientSecret: testOAuthKeys.client_secret,
        redirectUri: testOAuthKeys.redirect_uris[0],
      });
      
      expect(mockOAuth2Client.on).toHaveBeenCalledWith('tokens', expect.any(Function));
    });

    it('should load existing tokens on initialization', async () => {
      mockTokenManager.loadTokens.mockResolvedValueOnce(validTokenData);
      mockTokenManager.isValidTokenData.mockReturnValueOnce(true);
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      await authManager.initialize();
      
      expect(mockTokenManager.loadTokens).toHaveBeenCalled();
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(validTokenData);
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
    });

    it('should remain unauthenticated if no tokens exist', async () => {
      mockTokenManager.loadTokens.mockResolvedValueOnce(null);
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      await authManager.initialize();
      
      expect(authManager.getState()).toBe(AuthState.UNAUTHENTICATED);
      expect(mockOAuth2Client.setCredentials).not.toHaveBeenCalled();
    });
  });

  describe('Token Event Handling', () => {
    it('should persist tokens when tokens event is fired', async () => {
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      // Capture the event handler
      let tokenEventHandler: ((tokens: any) => void) | undefined;
      mockOAuth2Client.on.mockImplementation((event: string, handler: any) => {
        if (event === 'tokens') {
          tokenEventHandler = handler;
        }
      });
      
      await authManager.initialize();
      
      // Simulate token refresh event
      const newTokens = {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 7200000,
      };
      
      mockOAuth2Client.credentials = validTokenData;
      tokenEventHandler!(newTokens);
      
      expect(mockTokenManager.saveTokens).toHaveBeenCalledWith({
        ...validTokenData,
        ...newTokens,
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tokens refreshed and persisted',
        expect.any(Object)
      );
    });

    it('should preserve refresh token if not provided in update', async () => {
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      let tokenEventHandler: ((tokens: any) => void) | undefined;
      mockOAuth2Client.on.mockImplementation((event: string, handler: any) => {
        if (event === 'tokens') {
          tokenEventHandler = handler;
        }
      });
      
      mockOAuth2Client.credentials = validTokenData;
      await authManager.initialize();
      
      // New tokens without refresh_token
      const newTokens = {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 7200000,
      };
      
      tokenEventHandler!(newTokens);
      
      expect(mockTokenManager.saveTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh_token: validTokenData.refresh_token, // Original refresh token preserved
        })
      );
    });
  });

  describe('Proactive Token Refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start token monitoring on initialization', async () => {
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      const startMonitoringSpy = jest.spyOn(authManager as any, 'startTokenMonitoring');
      
      await authManager.initialize();
      
      expect(startMonitoringSpy).toHaveBeenCalled();
    });

    it('should refresh token when expiring soon', async () => {
      mockTokenManager.loadTokens.mockResolvedValue(validTokenData);
      mockTokenManager.isTokenExpiringSoon.mockReturnValue(true);
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: 'refreshed_token',
        res: null,
      });
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      await authManager.initialize();
      
      // Trigger the interval
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
      
      // Allow async operations to complete
      await Promise.resolve();
      
      expect(mockTokenManager.isTokenExpiringSoon).toHaveBeenCalledWith(
        validTokenData,
        10 * 60 * 1000 // 10 minute buffer
      );
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Proactively refreshing token');
    });

    it('should not refresh if token is still valid', async () => {
      mockTokenManager.loadTokens.mockResolvedValue(validTokenData);
      mockTokenManager.isTokenExpiringSoon.mockReturnValue(false);
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      await authManager.initialize();
      
      jest.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
      
      expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should handle invalid_grant error by deleting tokens', async () => {
      const invalidGrantError: any = new Error('invalid_grant');
      invalidGrantError.response = { data: { error: 'invalid_grant' } };
      
      mockOAuth2Client.getAccessToken.mockRejectedValue(invalidGrantError);
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      await expect(authManager.refreshToken()).rejects.toThrow('Authentication required');
      
      expect(mockTokenManager.deleteTokensOnInvalidGrant).toHaveBeenCalled();
      expect(authManager.getState()).toBe(AuthState.TOKENS_REVOKED);
    });

    it('should retry temporary errors with exponential backoff', async () => {
      const tempError = new Error('Network error');
      
      mockOAuth2Client.getAccessToken
        .mockRejectedValueOnce(tempError)
        .mockRejectedValueOnce(tempError)
        .mockResolvedValueOnce({ token: 'success_token', res: null });
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      await authManager.refreshToken();
      
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Token refresh failed'),
        expect.any(Object)
      );
    });

    it('should fail after max retries', async () => {
      const tempError = new Error('Network error');
      mockOAuth2Client.getAccessToken.mockRejectedValue(tempError);
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      await expect(authManager.refreshToken()).rejects.toThrow('Network error');
      
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledTimes(3); // Default max retries
      expect(authManager.getState()).toBe(AuthState.REFRESH_FAILED);
    });
  });

  describe('Mutex/Locking for Concurrent Refresh', () => {
    it('should prevent concurrent refresh attempts', async () => {
      mockOAuth2Client.getAccessToken.mockImplementation(async () => {
        // Simulate slow refresh
        await new Promise(resolve => setTimeout(resolve, 100));
        return { token: 'refreshed_token', res: null };
      });
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      // Start multiple refresh attempts
      const refresh1 = authManager.refreshToken();
      const refresh2 = authManager.refreshToken();
      const refresh3 = authManager.refreshToken();
      
      await Promise.all([refresh1, refresh2, refresh3]);
      
      // Should only call getAccessToken once due to mutex
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Token refresh already in progress, waiting...'
      );
    });
  });

  describe('State Management', () => {
    it('should transition states correctly during lifecycle', async () => {
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      expect(authManager.getState()).toBe(AuthState.UNAUTHENTICATED);
      
      mockTokenManager.loadTokens.mockResolvedValue(validTokenData);
      mockTokenManager.isValidTokenData.mockReturnValue(true);
      
      await authManager.initialize();
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      
      // Simulate token expiry
      mockTokenManager.isTokenExpired.mockReturnValue(true);
      expect(authManager.getState()).toBe(AuthState.TOKEN_EXPIRED);
      
      // Simulate successful refresh
      mockOAuth2Client.getAccessToken.mockResolvedValue({ token: 'new_token', res: null });
      await authManager.refreshToken();
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
    });
  });

  describe('OAuth2Client Access', () => {
    it('should provide access to authenticated OAuth2Client', async () => {
      mockTokenManager.loadTokens.mockResolvedValue(validTokenData);
      mockTokenManager.isValidTokenData.mockReturnValue(true);
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      await authManager.initialize();
      
      const client = authManager.getOAuth2Client();
      
      expect(client).toBe(mockOAuth2Client);
    });

    it('should throw error when getting client in unauthenticated state', () => {
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      
      expect(() => authManager.getOAuth2Client()).toThrow(
        'OAuth2Client not available - not authenticated'
      );
    });
  });

  describe('Graceful Degradation', () => {
    it('should handle missing credentials gracefully', async () => {
      mockTokenManager.loadTokens.mockResolvedValue(null);
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      await authManager.initialize();
      
      expect(authManager.getState()).toBe(AuthState.UNAUTHENTICATED);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No saved tokens found. Authentication required.'
      );
    });

    it('should handle token manager errors gracefully', async () => {
      mockTokenManager.loadTokens.mockRejectedValue(new Error('File system error'));
      
      authManager = AuthManager.getInstance(testOAuthKeys, mockLogger as any);
      await authManager.initialize();
      
      expect(authManager.getState()).toBe(AuthState.UNAUTHENTICATED);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load tokens during initialization',
        expect.any(Object)
      );
    });
  });
});