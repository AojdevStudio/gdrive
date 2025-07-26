# OAuth2 Token Refresh Research & Implementation Plan

## Current Problem
The gdrive MCP server requires manual token refresh when Google OAuth2 access tokens expire (~1 hour). Users must run `docker-compose run --rm gdrive-mcp-auth node dist/index.js auth` to refresh tokens, creating a poor UX.

## Research Findings

### Current Implementation Analysis
**File**: `index.ts` lines 1924-1935

**Issues Identified**:
1. **Static credentials loading**: Loads credentials once at startup without refresh capability
2. **No token event handling**: Doesn't listen for token refresh events from google-auth-library  
3. **No automatic refresh**: Relies on manual intervention when tokens expire
4. **Missing refresh handler**: No `oauth2Client.refreshHandler` implementation

```typescript
// Current problematic implementation
const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
const auth = new google.auth.OAuth2();
auth.setCredentials(credentials); // Static, no refresh handling
google.options({ auth });
```

### Google Auth Library Best Practices (2024)

#### 1. Automatic Token Refresh with Event Handling
The google-auth-library provides a `tokens` event that fires when tokens are refreshed:

```javascript
client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    // store the refresh_token in database/file
    console.log(tokens.refresh_token);
  }
  console.log(tokens.access_token);
});
```

#### 2. Refresh Handler Pattern
For advanced use cases, implement a custom refresh handler:

```javascript
oauth2Client.refreshHandler = async () => {
  const refreshedAccessToken = await getTokenFromSomewhere();
  return {
    access_token: refreshedAccessToken.token,
    expiry_date: refreshedAccessToken.expirationTime,
  }
};
```

#### 3. Built-in Automatic Refresh
The googleapis client automatically refreshes tokens during API calls when:
- Access token is expired
- Refresh token is available
- Proper OAuth2 client is configured

## Recommended Solutions

### Solution 1: Enhanced OAuth2 Client with Event Handling (Recommended)
**Complexity**: Medium  
**Impact**: High reliability, automatic token persistence

**Implementation**:
```typescript
// Enhanced auth setup with automatic refresh
const oauth2Client = new google.auth.OAuth2({
  clientId: keys.client_id,
  clientSecret: keys.client_secret,
  redirectUri: keys.redirect_uris[0]
});

// Load existing credentials
oauth2Client.setCredentials(existingCredentials);

// Handle token refresh events
oauth2Client.on('tokens', (tokens) => {
  logger.info('Tokens refreshed automatically');
  
  // Update in-memory credentials
  const currentCredentials = oauth2Client.credentials;
  const updatedCredentials = {
    ...currentCredentials,
    ...tokens
  };
  
  // Persist to file/database
  try {
    fs.writeFileSync(credentialsPath, JSON.stringify(updatedCredentials));
    logger.info('Updated credentials saved successfully');
  } catch (error) {
    logger.error('Failed to save updated credentials', { error });
  }
});

google.options({ auth: oauth2Client });
```

### Solution 2: Proactive Token Validation with Scheduled Refresh
**Complexity**: Low  
**Impact**: Medium reliability, prevents expiration

**Implementation**:
```typescript
class TokenManager {
  private oauth2Client: any;
  private refreshInterval: NodeJS.Timeout | null = null;
  
  constructor(oauth2Client: any) {
    this.oauth2Client = oauth2Client;
    this.startTokenMonitoring();
  }
  
  private startTokenMonitoring() {
    // Check token validity every 30 minutes
    this.refreshInterval = setInterval(async () => {
      await this.checkAndRefreshToken();
    }, 30 * 60 * 1000);
  }
  
  private async checkAndRefreshToken() {
    try {
      const credentials = this.oauth2Client.credentials;
      if (!credentials.expiry_date) return;
      
      const now = Date.now();
      const expiryTime = credentials.expiry_date;
      const timeUntilExpiry = expiryTime - now;
      
      // Refresh if token expires within 10 minutes
      if (timeUntilExpiry < 10 * 60 * 1000) {
        logger.info('Proactively refreshing token');
        await this.oauth2Client.getAccessToken();
      }
    } catch (error) {
      logger.error('Token refresh failed', { error });
    }
  }
}
```

### Solution 3: Robust Error Handling with Retry Logic
**Complexity**: High  
**Impact**: Maximum reliability, handles edge cases

**Implementation**:
```typescript
class RobustAuthManager {
  private oauth2Client: any;
  private credentialsPath: string;
  private maxRetries: number = 3;
  
  async ensureValidToken(): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Check if token is valid
        const tokenInfo = await this.oauth2Client.getTokenInfo(
          this.oauth2Client.credentials.access_token
        );
        
        logger.info('Token is valid', { 
          expires: new Date(tokenInfo.expiry_date * 1000) 
        });
        return true;
        
      } catch (error) {
        logger.warn(`Token validation failed (attempt ${attempt + 1})`, { error });
        
        try {
          // Attempt to refresh
          await this.oauth2Client.getAccessToken();
          logger.info('Token refreshed successfully');
          return true;
          
        } catch (refreshError) {
          logger.error(`Token refresh failed (attempt ${attempt + 1})`, { 
            error: refreshError 
          });
          
          if (attempt === this.maxRetries - 1) {
            // Final attempt failed - require re-auth
            logger.error('All refresh attempts failed - manual re-authentication required');
            return false;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    return false;
  }
}
```

## Implementation Plan

### Phase 1: Core Token Event Handling
1. **Replace static auth setup** with OAuth2Client instance
2. **Implement `tokens` event listener** for automatic credential persistence
3. **Add token validation logging** for debugging
4. **Test token refresh flow** manually

### Phase 2: Proactive Monitoring
1. **Add TokenManager class** with scheduled validation
2. **Implement configurable refresh intervals**
3. **Add health check endpoint** for token status
4. **Monitor and alert on refresh failures**

### Phase 3: Error Recovery & Reliability
1. **Implement retry logic** for failed refreshes
2. **Add fallback mechanisms** (re-auth flow)
3. **Create monitoring dashboard** for token health
4. **Add automated tests** for refresh scenarios

### Phase 4: Docker Integration
1. **Update Docker health checks** to include token validation
2. **Add container restart policies** for auth failures
3. **Implement graceful degradation** when tokens unavailable
4. **Add monitoring alerts** for production deployments

## Configuration Options

### Environment Variables
```bash
# Token refresh settings
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000  # 30 minutes
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000  # 10 minutes before expiry
GDRIVE_TOKEN_MAX_RETRIES=3
GDRIVE_TOKEN_RETRY_DELAY=1000

# Monitoring settings  
GDRIVE_TOKEN_HEALTH_CHECK=true
GDRIVE_TOKEN_ALERTS_ENABLED=true
```

### Docker Compose Updates
```yaml
services:
  gdrive-mcp:
    environment:
      - GDRIVE_TOKEN_REFRESH_INTERVAL=1800000
      - GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000
    healthcheck:
      test: ["CMD", "node", "dist/health-check.js"]
      interval: 5m
      timeout: 10s
      retries: 3
      start_period: 30s
```

## Benefits

### User Experience
- **Eliminates manual token refresh** - tokens refresh automatically
- **Seamless API access** - no interruption during normal operation  
- **Better error messages** - clear indication when re-auth is needed
- **Production ready** - robust handling of edge cases

### System Reliability
- **Automatic recovery** from token expiration
- **Proactive monitoring** prevents service interruption
- **Graceful degradation** when auth systems are unavailable
- **Comprehensive logging** for debugging and monitoring

### Maintenance
- **Reduced support burden** - fewer authentication issues
- **Clear monitoring** of token health and refresh patterns
- **Automated testing** of refresh scenarios
- **Documentation** for troubleshooting

## Risks & Mitigation

### Risk: Refresh Token Expiration
**Mitigation**: Implement detection and clear user guidance for re-authentication

### Risk: Google API Rate Limiting
**Mitigation**: Implement exponential backoff and respect rate limit headers

### Risk: Concurrent Refresh Attempts
**Mitigation**: Use mutex/locking to prevent multiple simultaneous refresh attempts

### Risk: Credential File Corruption
**Mitigation**: Implement backup/restore mechanism and validation checks

## Next Steps

1. **Implement Solution 1** (Enhanced OAuth2 Client) as the foundation
2. **Add comprehensive testing** for refresh scenarios  
3. **Update Docker configuration** with health checks
4. **Create monitoring dashboard** for production deployments
5. **Document troubleshooting procedures** for edge cases