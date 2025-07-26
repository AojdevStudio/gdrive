# Google Drive MCP Server - Automatic Token Refresh Implementation Plan

## Executive Summary
This plan outlines the implementation of automatic OAuth2 token refresh for the Google Drive MCP server to eliminate manual token renewal and improve user experience.

## Current State Analysis

### Problems Identified
1. **Manual token refresh required** when OAuth2 access tokens expire (~1 hour)
2. **Poor user experience** requiring docker commands for token renewal
3. **Static credential loading** without refresh capability
4. **No error recovery** mechanisms for token expiration
5. **Production deployment issues** with token management

### Technical Root Cause
The current implementation loads credentials statically at startup without implementing Google's recommended token refresh patterns:

```typescript
// Problematic current code
const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
const auth = new google.auth.OAuth2();
auth.setCredentials(credentials); // No refresh handling
```

## Solution Architecture

### Core Strategy: Enhanced OAuth2 Client with Event-Driven Refresh

**Pattern**: Google Auth Library's built-in `tokens` event + proactive monitoring  
**Benefits**: Industry standard, reliable, minimal complexity  
**Risk Level**: Low (uses Google's recommended approach)

### Implementation Components

#### 1. TokenManager Class
```typescript
class TokenManager {
  private oauth2Client: google.auth.OAuth2;
  private credentialsPath: string;
  private logger: winston.Logger;
  
  constructor(oauth2Client, credentialsPath, logger) {
    this.oauth2Client = oauth2Client;
    this.credentialsPath = credentialsPath;
    this.logger = logger;
    this.setupTokenHandling();
  }
  
  private setupTokenHandling() {
    // Handle automatic token refresh events
    this.oauth2Client.on('tokens', this.handleTokenRefresh.bind(this));
  }
  
  private async handleTokenRefresh(tokens) {
    // Persist refreshed tokens automatically
    // Update in-memory credentials
    // Log refresh events for monitoring
  }
}
```

#### 2. Enhanced Authentication Module
```typescript
async function setupAuthentication() {
  const oauth2Client = new google.auth.OAuth2({
    clientId: keys.client_id,
    clientSecret: keys.client_secret,
    redirectUri: keys.redirect_uris[0]
  });
  
  // Load existing credentials
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  oauth2Client.setCredentials(credentials);
  
  // Setup automatic token management
  const tokenManager = new TokenManager(oauth2Client, credentialsPath, logger);
  
  // Configure global auth
  google.options({ auth: oauth2Client });
  
  return { oauth2Client, tokenManager };
}
```

#### 3. Health Monitoring System
```typescript
class AuthHealthMonitor {
  async checkTokenHealth(): Promise<{
    valid: boolean;
    expiresIn: number;
    lastRefresh: Date;
    needsRefresh: boolean;
  }> {
    // Validate current token status
    // Check expiration times
    // Determine if proactive refresh needed
  }
}
```

## Implementation Phases

### Phase 1: Core Token Management (Week 1)
**Scope**: Replace static auth with dynamic token handling

**Tasks**:
- [ ] Create `TokenManager` class with event handling
- [ ] Replace static credential loading in `loadCredentialsAndRunServer()`
- [ ] Implement `tokens` event listener with file persistence
- [ ] Add comprehensive logging for token events
- [ ] Test automatic refresh during API calls

**Success Criteria**: 
- Tokens refresh automatically during API operations
- Refreshed tokens persist to credential file
- No manual intervention required for 24-hour test period

**Files Modified**: `index.ts` (lines 1924-1935)

### Phase 2: Proactive Monitoring (Week 2)  
**Scope**: Add scheduled token validation and preemptive refresh

**Tasks**:
- [ ] Implement `AuthHealthMonitor` class
- [ ] Add configurable refresh intervals via environment variables
- [ ] Create health check endpoint for container monitoring
- [ ] Implement proactive refresh (10 minutes before expiry)
- [ ] Add token status metrics to performance monitoring

**Success Criteria**:
- Tokens refresh before expiration (proactive)
- Health checks report accurate token status
- Configurable refresh intervals work correctly

**New Files**: `src/auth/TokenManager.ts`, `src/health/AuthHealthMonitor.ts`

### Phase 3: Error Recovery & Reliability (Week 3)
**Scope**: Robust error handling and retry mechanisms

**Tasks**:
- [ ] Implement retry logic with exponential backoff
- [ ] Add fallback to re-authentication flow
- [ ] Create error notification system
- [ ] Implement mutex for concurrent refresh prevention
- [ ] Add comprehensive error logging and alerting

**Success Criteria**:
- Graceful handling of Google API rate limits
- Automatic recovery from transient failures
- Clear user guidance when re-auth required

**New Files**: `src/auth/ErrorRecovery.ts`, `src/utils/RetryManager.ts`

### Phase 4: Docker & Production Integration (Week 4)
**Scope**: Production-ready deployment with monitoring

**Tasks**:
- [ ] Update Docker health checks for token validation
- [ ] Add environment variable configuration
- [ ] Create monitoring dashboard endpoints
- [ ] Implement automated testing for refresh scenarios
- [ ] Update deployment documentation

**Success Criteria**:
- Docker containers restart gracefully on auth failures
- Production monitoring shows token health metrics
- Automated tests cover all refresh scenarios

**Files Modified**: `docker-compose.yml`, `Dockerfile`, `package.json`

## Technical Specifications

### Environment Variables
```bash
# Core token settings
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000     # 30 minutes check interval
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000    # Refresh 10 min before expiry
GDRIVE_TOKEN_MAX_RETRIES=3                # Max retry attempts
GDRIVE_TOKEN_RETRY_DELAY=1000             # Base retry delay (ms)

# Monitoring settings
GDRIVE_TOKEN_HEALTH_ENABLED=true          # Enable health monitoring
GDRIVE_TOKEN_METRICS_ENABLED=true         # Enable metrics collection
GDRIVE_AUTH_FAILURE_ALERTS=true           # Enable failure alerts

# Security settings  
GDRIVE_CREDENTIALS_BACKUP_ENABLED=true    # Backup credentials
GDRIVE_TOKEN_VALIDATION_STRICT=false      # Strict token validation
```

### Docker Configuration Updates
```yaml
services:
  gdrive-mcp:
    environment:
      - GDRIVE_TOKEN_REFRESH_INTERVAL=1800000
      - GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000
      - GDRIVE_TOKEN_HEALTH_ENABLED=true
    healthcheck:
      test: ["CMD", "node", "dist/health-check.js", "--check-auth"]
      interval: 5m
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped
    depends_on:
      - redis
```

### API Changes
```typescript
// New health check endpoint
interface TokenHealthResponse {
  valid: boolean;
  expiresAt: string;
  expiresIn: number;
  lastRefresh: string;
  refreshCount: number;
  needsRefresh: boolean;
}

// Enhanced error responses  
interface AuthError {
  error: 'auth_required' | 'auth_failed' | 'token_expired';
  message: string;
  requiresReauth: boolean;
  suggestion: string;
}
```

## Risk Assessment & Mitigation

### High Risk: Google API Changes
**Probability**: Low  
**Impact**: High  
**Mitigation**: Use official googleapis library, monitor for deprecation notices

### Medium Risk: Refresh Token Expiration (6 months)
**Probability**: Medium  
**Impact**: Medium  
**Mitigation**: Detect expiration, provide clear re-auth guidance, automated alerts

### Medium Risk: Race Conditions in Token Refresh
**Probability**: Medium  
**Impact**: Medium  
**Mitigation**: Implement mutex locking, serialize refresh operations

### Low Risk: Credential File Corruption
**Probability**: Low  
**Impact**: Medium  
**Mitigation**: Backup credentials, validation checks, atomic file writes

## Success Metrics

### User Experience Metrics
- **Manual auth interventions**: Reduce from daily to quarterly
- **Error rate due to auth**: Reduce by 95%
- **User complaints about auth**: Eliminate auth-related support tickets

### Technical Metrics  
- **Token refresh success rate**: >99.5%
- **API call failure rate**: <0.1% due to auth issues
- **Mean time to auth recovery**: <30 seconds
- **Token expiration incidents**: Zero unplanned expirations

### Operational Metrics
- **Deployment stability**: Zero auth-related container restarts
- **Monitoring coverage**: 100% token health visibility
- **Alert accuracy**: <5% false positive rate

## Dependencies & Prerequisites

### Required Updates
- **google-auth-library-nodejs**: Ensure latest version (v9.0.0+)
- **googleapis**: Ensure automatic refresh support
- **Docker images**: Update base images for stability

### Infrastructure Requirements
- **Redis availability**: For caching and coordination
- **File system permissions**: For credential file updates
- **Network connectivity**: For Google OAuth endpoints

### Testing Requirements
- **Token expiration simulation**: Mock expired tokens
- **Network failure simulation**: Test retry logic
- **Concurrent request testing**: Verify race condition handling

## Rollout Strategy

### Phase 1: Development Environment
- Implement and test all components locally
- Verify automatic refresh in development containers
- Complete unit and integration testing

### Phase 2: Staging Environment  
- Deploy to staging with production-like configuration
- Run 48-hour continuous operation test
- Validate monitoring and alerting systems

### Phase 3: Canary Production
- Deploy to subset of production users (10%)
- Monitor metrics for 1 week
- Collect user feedback and resolve issues

### Phase 4: Full Production
- Deploy to all production environments
- Monitor for 2 weeks with enhanced alerting
- Document lessons learned and update procedures

## Timeline & Resources

### Total Duration: 4 weeks
### Resource Requirements: 1 senior developer

**Week 1**: Core implementation and basic testing  
**Week 2**: Monitoring and proactive features  
**Week 3**: Error handling and reliability features  
**Week 4**: Production integration and documentation

### Critical Path Dependencies
1. TokenManager implementation → Testing → Docker integration
2. Health monitoring → Production deployment
3. Error recovery → User acceptance testing

## Conclusion

This implementation plan addresses the core UX issue of manual token refresh while following Google's recommended OAuth2 patterns. The phased approach minimizes risk while ensuring comprehensive coverage of edge cases and production requirements.

The solution will eliminate manual token management, improve system reliability, and provide the foundation for robust production deployments of the Google Drive MCP server.