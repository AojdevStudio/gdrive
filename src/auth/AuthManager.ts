import { OAuth2Client } from 'google-auth-library';
import { Logger } from 'winston';
import { TokenManager, TokenData } from './TokenManager.js';

export enum AuthState {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATED = 'authenticated',
  TOKEN_EXPIRED = 'token_expired',
  REFRESH_FAILED = 'refresh_failed',
  TOKENS_REVOKED = 'tokens_revoked',
}

interface OAuthKeys {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

export class AuthManager {
  private static _instance: AuthManager;
  private readonly logger: Logger;
  private readonly tokenManager: TokenManager;
  private readonly oauthKeys: OAuthKeys;
  private oauth2Client: OAuth2Client | null = null;
  private state: AuthState = AuthState.UNAUTHENTICATED;
  private refreshInterval: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<void> | null = null;
  private isRefreshing: boolean = false;

  private constructor(oauthKeys: OAuthKeys, logger: Logger) {
    this.logger = logger;
    this.oauthKeys = oauthKeys;
    this.tokenManager = TokenManager.getInstance(logger);
    
    this.logger.debug('AuthManager initialized');
  }

  public static getInstance(oauthKeys: OAuthKeys, logger: Logger): AuthManager {
    if (!AuthManager._instance) {
      AuthManager._instance = new AuthManager(oauthKeys, logger);
    }
    return AuthManager._instance;
  }

  /**
   * Initialize the auth manager and load existing tokens
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AuthManager');
      
      // Create OAuth2 client
      this.oauth2Client = this.createOAuth2Client();
      
      // Set up token event listener
      this.oauth2Client.on('tokens', async (tokens) => {
        await this.handleTokenUpdate(tokens);
      });
      
      // Load existing tokens
      const savedTokens = await this.tokenManager.loadTokens();
      if (savedTokens && this.tokenManager.isValidTokenData(savedTokens)) {
        this.oauth2Client.setCredentials(savedTokens);
        this.state = AuthState.AUTHENTICATED;
        this.logger.info('Loaded existing tokens successfully');
        
        // Start proactive token monitoring
        this.startTokenMonitoring();
      } else {
        this.state = AuthState.UNAUTHENTICATED;
        this.logger.info('No saved tokens found. Authentication required.');
      }
    } catch (error) {
      this.logger.error('Failed to initialize AuthManager', { error });
      this.state = AuthState.UNAUTHENTICATED;
    }
  }

  /**
   * Get the current authentication state
   */
  public getState(): AuthState {
    if (this.oauth2Client?.credentials) {
      if (this.tokenManager.isTokenExpired(this.oauth2Client.credentials as TokenData)) {
        return AuthState.TOKEN_EXPIRED;
      }
      return this.state;
    }
    return AuthState.UNAUTHENTICATED;
  }

  /**
   * Get the OAuth2 client instance
   */
  public getOAuth2Client(): OAuth2Client {
    if (!this.oauth2Client || this.state === AuthState.UNAUTHENTICATED) {
      throw new Error('OAuth2Client not available - not authenticated');
    }
    return this.oauth2Client;
  }

  /**
   * Refresh the access token
   */
  public async refreshToken(): Promise<void> {
    // Mutex to prevent concurrent refresh attempts
    if (this.isRefreshing) {
      this.logger.debug('Token refresh already in progress, waiting...');
      if (this.refreshPromise) {
        return this.refreshPromise;
      }
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Stop token monitoring
   */
  public stopTokenMonitoring(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      this.logger.debug('Stopped token monitoring');
    }
  }

  /**
   * Create OAuth2 client instance
   */
  private createOAuth2Client(): OAuth2Client {
    return new OAuth2Client({
      clientId: this.oauthKeys.client_id,
      clientSecret: this.oauthKeys.client_secret,
      redirectUri: this.oauthKeys.redirect_uris[0],
    });
  }

  /**
   * Handle token update events
   */
  private async handleTokenUpdate(tokens: any): Promise<void> {
    try {
      this.logger.info('Handling token update event');
      
      // Merge with existing credentials (preserve refresh token)
      const currentCredentials = this.oauth2Client!.credentials;
      const updatedCredentials = {
        ...currentCredentials,
        ...tokens,
        refresh_token: tokens.refresh_token || currentCredentials.refresh_token,
      } as TokenData;
      
      // Save to persistent storage
      await this.tokenManager.saveTokens(updatedCredentials);
      
      // Update in-memory credentials
      this.oauth2Client!.setCredentials(updatedCredentials);
      this.state = AuthState.AUTHENTICATED;
      
      this.logger.info('Tokens refreshed and persisted', {
        expiresIn: tokens.expiry_date ? 
          Math.floor((tokens.expiry_date - Date.now()) / 1000) : 
          'unknown',
      });
    } catch (error) {
      this.logger.error('Failed to handle token update', { error });
    }
  }

  /**
   * Start proactive token monitoring
   */
  private startTokenMonitoring(): void {
    // Check token every 30 minutes
    const intervalMs = parseInt(process.env.GDRIVE_TOKEN_REFRESH_INTERVAL || '1800000', 10);
    
    this.refreshInterval = setInterval(async () => {
      await this.checkAndRefreshToken();
    }, intervalMs);
    
    this.logger.debug('Started token monitoring', { intervalMs });
  }

  /**
   * Check token expiry and refresh if needed
   */
  private async checkAndRefreshToken(): Promise<void> {
    try {
      if (!this.oauth2Client?.credentials) {
        return;
      }
      
      const tokens = this.oauth2Client.credentials as TokenData;
      const bufferMs = parseInt(
        process.env.GDRIVE_TOKEN_PREEMPTIVE_REFRESH || '600000',
        10
      );
      
      if (this.tokenManager.isTokenExpiringSoon(tokens, bufferMs)) {
        this.logger.info('Proactively refreshing token');
        await this.refreshToken();
      }
    } catch (error) {
      this.logger.error('Failed to check and refresh token', { error });
    }
  }

  /**
   * Perform the actual token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<void> {
    const maxRetries = parseInt(process.env.GDRIVE_TOKEN_MAX_RETRIES || '3', 10);
    const baseDelay = parseInt(process.env.GDRIVE_TOKEN_RETRY_DELAY || '1000', 10);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Token refresh attempt ${attempt}/${maxRetries}`);
        
        // Force token refresh
        const response = await this.oauth2Client!.getAccessToken();
        const credentials = response.res?.data || response.token ? { access_token: response.token } : null;
        
        if (credentials) {
          this.oauth2Client!.setCredentials(credentials);
          this.state = AuthState.AUTHENTICATED;
        }
        
        this.logger.info('Token refreshed successfully');
        return;
      } catch (error: any) {
        this.logger.warn(`Token refresh failed (attempt ${attempt})`, { error });
        
        // Handle specific error cases
        if (this.isInvalidGrantError(error)) {
          await this.handleInvalidGrant();
          throw new Error('Authentication required - refresh token invalid');
        }
        
        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          await this.delay(retryAfter * 1000);
          continue;
        }
        
        // Exponential backoff for other errors
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
        } else {
          this.state = AuthState.REFRESH_FAILED;
          throw error;
        }
      }
    }
  }

  /**
   * Check if error is invalid_grant
   */
  private isInvalidGrantError(error: any): boolean {
    return (
      error.message?.includes('invalid_grant') ||
      error.response?.data?.error === 'invalid_grant'
    );
  }

  /**
   * Handle invalid_grant error
   */
  private async handleInvalidGrant(): Promise<void> {
    this.logger.error('Refresh token is invalid or revoked');
    
    // Delete invalid tokens
    await this.tokenManager.deleteTokensOnInvalidGrant();
    
    // Update state
    this.state = AuthState.TOKENS_REVOKED;
    
    // Clear credentials
    this.oauth2Client!.setCredentials({});
  }

  /**
   * Delay helper for retry logic
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}