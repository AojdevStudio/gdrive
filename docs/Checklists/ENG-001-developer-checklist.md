# Developer Checklist: OAuth Token Refresh Implementation

**PRD Reference:** [docs/PRDs/ENG-001-oauth-token-refresh.md](/Users/ossieirondi/Projects/local-mcps/gdrive/docs/PRDs/ENG-001-oauth-token-refresh.md)
**Issue ID:** ENG-001
**Priority:** High
**Estimated Time:** 8 hours

## Pre-Development Setup
- [ ] Review PRD and acceptance criteria thoroughly
- [ ] Set up development branch: `feature/ENG-001-oauth-token-refresh`
- [ ] Review existing code in `src/index.ts` (lines 1924-1935)
- [ ] Review research documents:
  - [ ] `docs/Research/oauth-token-refresh-research.md`
  - [ ] `docs/Research/persistent-oauth-authentication-gdrive-mcp.md`
- [ ] Identify integration points with existing auth flow

## Implementation Tasks

### Backend Development

#### Phase 1: Core Token Management (2-3 hours)
- [ ] Create `src/auth/TokenManager.ts` class
  - [ ] Implement token storage interface
  - [ ] Add secure file operations with 0600 permissions
  - [ ] Implement token loading from persistent storage
  - [ ] Add token validation and expiry checking
  - [ ] **MANDATORY: Implement token encryption/decryption using AES-256-GCM**
    - [ ] Use node:crypto for encryption
    - [ ] Store encryption key in environment variable
    - [ ] Implement secure key derivation
    - [ ] Add key rotation capability
    - [ ] Clear sensitive data from memory after use

- [ ] Create `src/auth/AuthManager.ts` class
  - [ ] Implement OAuth2Client initialization with proper config
  - [ ] Add `tokens` event listener for automatic persistence
  - [ ] Implement state management (authenticated, unauthenticated, etc.)
  - [ ] Add mutex/locking for concurrent refresh prevention
  - [ ] Implement graceful degradation when tokens unavailable

- [ ] Update `src/index.ts` authentication setup (lines 1924-1935)
  - [ ] Replace static credential loading with AuthManager
  - [ ] Ensure OAuth2Client uses `access_type: 'offline'`
  - [ ] Add `prompt: 'consent'` for refresh token generation
  - [ ] Integrate TokenManager with existing auth flow
  - [ ] Update google.options() to use OAuth2Client instance

#### Phase 2: Proactive Token Refresh (2-3 hours)
- [ ] Implement scheduled token monitoring in TokenManager
  - [ ] Add configurable refresh interval (default: 30 minutes)
  - [ ] Check token expiry with 10-minute buffer
  - [ ] Implement automatic refresh when approaching expiry
  - [ ] Add performance monitoring for refresh operations
  - [ ] Log all token lifecycle events

- [ ] Add retry logic with exponential backoff
  - [ ] Implement max retry attempts (default: 3)
  - [ ] Add exponential backoff delays (1s, 2s, 4s)
  - [ ] Handle specific error codes (invalid_grant, invalid_request)
    - [ ] **CRITICAL: On invalid_grant, immediately delete token file**
    - [ ] Clear token from memory
    - [ ] Log security audit event
    - [ ] Prevent retry loops by requiring re-authentication
  - [ ] Implement circuit breaker for repeated failures
  - [ ] Add alerting for refresh failures

- [ ] Implement error recovery mechanisms
  - [ ] Detect refresh token expiration/revocation
  - [ ] Provide clear user guidance for re-authentication
  - [ ] Handle Google API rate limiting
  - [ ] Implement fallback to manual auth flow
  - [ ] Add comprehensive error logging

#### Phase 3: Docker & Health Check Integration (1-2 hours)
- [ ] Create `src/health-check.ts` endpoint
  - [ ] Implement sophisticated health check logic:
    - [ ] **HEALTHY**: Token valid AND (expiry > 10 min OR recent refresh success)
    - [ ] **DEGRADED**: Token expiring soon AND refresh in progress
    - [ ] **UNHEALTHY**: Token expired AND refresh failed OR no token
  - [ ] Validate token status and expiry
  - [ ] Check refresh capability and recent attempts
  - [ ] Return appropriate health status codes
  - [ ] Include token metadata in health response (without sensitive data)
  - [ ] Add performance metrics to health check

- [ ] Update `docker-compose.yml`
  - [ ] Add health check configuration
  - [ ] Set appropriate intervals and timeouts
  - [ ] Configure restart policies
  - [ ] Add token-related environment variables
  - [ ] Update volume mounts for token storage

- [ ] Update `Dockerfile`
  - [ ] Ensure health check script is included
  - [ ] Set proper file permissions for token storage
  - [ ] Add token directory creation
  - [ ] Configure logging for token operations

### Configuration & Environment
- [ ] Add environment variables to `.env.example`
  ```bash
  GDRIVE_TOKEN_REFRESH_INTERVAL=1800000  # 30 minutes
  GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000  # 10 minutes before expiry
  GDRIVE_TOKEN_MAX_RETRIES=3
  GDRIVE_TOKEN_RETRY_DELAY=1000
  GDRIVE_TOKEN_HEALTH_CHECK=true
  GDRIVE_TOKEN_STORAGE_PATH=~/.gdrive-mcp-tokens.json
  GDRIVE_TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-key>  # MANDATORY
  GDRIVE_TOKEN_AUDIT_LOG_PATH=~/.gdrive-mcp-audit.log
  ```

- [ ] Update configuration loading in application
  - [ ] Parse environment variables with defaults
  - [ ] Validate configuration on startup
  - [ ] Log active configuration (excluding sensitive data)

### Integration Tasks
- [ ] Update all Google API operations to use AuthManager
  - [ ] Wrap API calls with auth validation
  - [ ] Handle token refresh during API operations
  - [ ] Ensure no disruption during refresh
  - [ ] Test with long-running operations

- [ ] Integrate with Redis cache manager
  - [ ] Clear relevant caches on token refresh
  - [ ] Update cache keys with auth state
  - [ ] Ensure cache consistency

- [ ] Update logging infrastructure
  - [ ] Add token-specific log categories
  - [ ] Ensure no sensitive data in logs
  - [ ] Add structured audit logging for token events:
    ```json
    {
      "timestamp": "ISO-8601",
      "event": "TOKEN_ACQUIRED|TOKEN_REFRESHED|TOKEN_REFRESH_FAILED|TOKEN_REVOKED_BY_USER|TOKEN_DELETED_INVALID_GRANT|TOKEN_ENCRYPTED|TOKEN_DECRYPTED",
      "userId": "user email",
      "tokenId": "sha256 hash",
      "success": true/false,
      "metadata": {}
    }
    ```
  - [ ] Configure log rotation for token logs
  - [ ] Ensure logs are machine-parseable for security forensics

## Testing Tasks

### Unit Tests
- [ ] Create `src/__tests__/auth/TokenManager.test.ts`
  - [ ] Test token storage and retrieval
  - [ ] Test file permissions (0600)
  - [ ] Test token expiry detection
  - [ ] **Test encryption/decryption (MANDATORY)**
    - [ ] Test AES-256-GCM encryption correctness
    - [ ] Test key derivation
    - [ ] Test encrypted token cannot be read without key
    - [ ] Test memory clearing after operations
  - [ ] Test error handling scenarios
  - [ ] Test invalid_grant token deletion behavior

- [ ] Create `src/__tests__/auth/AuthManager.test.ts`
  - [ ] Test OAuth2Client initialization
  - [ ] Test token event handling
  - [ ] Test state transitions
  - [ ] Test mutex/locking behavior
  - [ ] Test graceful degradation

- [ ] Update existing auth tests
  - [ ] Ensure compatibility with new auth flow
  - [ ] Add refresh scenario tests
  - [ ] Test backward compatibility

### Integration Tests
- [ ] Create `src/__tests__/integration/token-refresh.test.ts`
  - [ ] Test full token refresh flow
  - [ ] Test API operations during refresh
  - [ ] Test error recovery scenarios
  - [ ] Test concurrent refresh attempts
  - [ ] Test rate limiting handling

- [ ] Test Docker health checks
  - [ ] Verify health endpoint responses
  - [ ] Test container restart behavior
  - [ ] Validate health check intervals

### E2E Tests
- [ ] Create `tests/e2e/auth-persistence.test.ts`
  - [ ] Test initial authentication flow
  - [ ] Test token persistence across restarts
  - [ ] Test automatic refresh after expiry
  - [ ] Test manual re-authentication flow
  - [ ] Test production-like scenarios

- [ ] Performance testing
  - [ ] Measure token refresh latency
  - [ ] Test under high API load
  - [ ] Validate no service interruption

## Documentation Tasks
- [ ] Update `README.md`
  - [ ] Document new authentication flow
  - [ ] Add token refresh configuration options
  - [ ] Include troubleshooting section
  - [ ] Update Docker usage instructions

- [ ] Create `docs/authentication.md`
  - [ ] Detailed auth flow documentation
  - [ ] Token lifecycle explanation
  - [ ] Configuration reference
  - [ ] Security best practices

- [ ] Update API documentation
  - [ ] Document health check endpoint
  - [ ] Add auth-related error codes
  - [ ] Include token refresh behavior

- [ ] Add inline code comments
  - [ ] Document complex logic in TokenManager
  - [ ] Explain retry and backoff strategies
  - [ ] Document security considerations

## Review & Deployment
- [ ] Self-review code changes
  - [ ] Verify all acceptance criteria met
  - [ ] Check for security vulnerabilities
  - [ ] Ensure proper error handling
  - [ ] Validate logging completeness

- [ ] Run all quality checks
  ```bash
  npm run lint
  npm run type-check
  npm run test
  npm run test:integration
  npm run test:e2e
  ```

- [ ] Create PR with proper description
  - [ ] Use PR template with "Fixes ENG-001"
  - [ ] Include testing evidence
  - [ ] Document any deviations from PRD
  - [ ] Add performance metrics

- [ ] Address code review feedback
  - [ ] Implement requested changes
  - [ ] Re-run all tests
  - [ ] Update documentation if needed

- [ ] Verify deployment to staging
  - [ ] Test auth flow in staging environment
  - [ ] Monitor token refresh in logs
  - [ ] Validate health checks
  - [ ] Perform load testing

- [ ] Perform manual testing on staging
  - [ ] Complete all manual verification steps from PRD
  - [ ] Test edge cases and error scenarios
  - [ ] Verify backward compatibility

- [ ] Monitor production deployment
  - [ ] Watch token refresh metrics
  - [ ] Monitor error rates
  - [ ] Verify health check status
  - [ ] Check performance impact

## Post-Deployment
- [ ] Verify feature works in production
  - [ ] Monitor first 24 hours of operation
  - [ ] Check token refresh success rate
  - [ ] Validate no increase in auth errors

- [ ] Check monitoring/logging
  - [ ] Verify token events are logged
  - [ ] Check performance metrics
  - [ ] Ensure no sensitive data exposure

- [ ] Update issue status to Done
  - [ ] Confirm PR merge auto-closed issue
  - [ ] Add implementation notes to PRD
  - [ ] Document any follow-up items

- [ ] Document lessons learned
  - [ ] Note any unexpected challenges
  - [ ] Document useful patterns discovered
  - [ ] Suggest improvements for future work
  - [ ] Update team knowledge base

## Security Checklist
- [ ] **MANDATORY: Tokens encrypted at rest using AES-256-GCM**
- [ ] Encryption key stored separately from encrypted data
- [ ] Refresh tokens never logged in plain text
- [ ] Token file has 0600 permissions
- [ ] No tokens exposed in error messages
- [ ] Secure token storage path validation
- [ ] Rate limiting protection implemented
- [ ] **Audit trail for all token events maintained in JSON format**
- [ ] **Invalid_grant errors trigger immediate token deletion**
- [ ] Memory cleared after sensitive operations
- [ ] Health checks report status without exposing tokens
- [ ] Token ID in logs uses SHA256 hash, not actual token