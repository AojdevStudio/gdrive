# Implementing Persistent OAuth Authentication for gdrive MCP

## Research Summary: Long-Lived Authentication & Token Management

**Date:** 2025-07-29  
**Objective:** Eliminate frequent re-authentication by implementing persistent OAuth token storage and automatic refresh

## Current Problem Analysis

**Issue:** OAuth tokens expire after ~30 minutes, requiring constant re-authentication
**Impact:** 
- Poor user experience with frequent auth interruptions
- Workflow disruption when using gdrive MCP
- Manual intervention required every 30 minutes

## OAuth Token Lifecycle Deep Dive

### Token Types & Lifespans

**Access Tokens:**
- **Lifespan:** 30-60 minutes (typically 1 hour)
- **Purpose:** Direct API access
- **Frequency:** Used for every API request
- **Storage:** Should be cached (Redis/memory) for fast access

**Refresh Tokens:**
- **Lifespan:** Long-lived (weeks/months/indefinite)
- **Purpose:** Generate new access tokens
- **Frequency:** Used when access token expires
- **Storage:** Must be persistently stored (database/file)

### Critical OAuth Configuration

**Required Parameters for Persistent Auth:**
```javascript
// Essential for getting refresh tokens
const authorizeUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',    // CRITICAL: Must be 'offline'
  prompt: 'consent',         // Forces refresh token generation
  scope: REQUIRED_SCOPES
});
```

**Key Points:**
- `access_type: 'offline'` is **mandatory** for refresh tokens
- `prompt: 'consent'` forces consent flow (ensures refresh token)
- Refresh tokens are only issued on **first authorization**

## Implementation Strategy

### Architecture Pattern: Token Storage + Auto-Refresh

**Storage Strategy:**
```
┌─────────────────┐    ┌────────────────┐    ┌─────────────────┐
│   Persistent    │    │   In-Memory    │    │   MCP Client    │
│   Storage       │    │   Cache        │    │   Operations    │
│   (refresh_token)│    │  (access_token)│    │                 │
├─────────────────┤    ├────────────────┤    ├─────────────────┤
│ • File System   │◄──►│ • Redis        │◄──►│ • API Calls     │
│ • Database      │    │ • Memory       │    │ • Auto-refresh  │
│ • Secure Store  │    │ • Fast Access  │    │ • Error Handle  │
└─────────────────┘    └────────────────┘    └─────────────────┘
```

### Option 1: File-Based Storage (Recommended for MCP)

**Implementation:**
```javascript
// Save tokens to file
const saveTokens = async (tokens) => {
  const tokenPath = path.join(os.homedir(), '.gdrive-mcp-tokens.json');
  await fs.writeFile(tokenPath, JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    token_type: tokens.token_type,
    scope: tokens.scope
  }), { mode: 0o600 }); // Secure file permissions
};

// Load tokens from file
const loadTokens = async () => {
  const tokenPath = path.join(os.homedir(), '.gdrive-mcp-tokens.json');
  try {
    const data = await fs.readFile(tokenPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null; // No saved tokens
  }
};
```

**File Location Options:**
- `~/.gdrive-mcp-tokens.json` (user home directory)
- `~/.config/gdrive-mcp/tokens.json` (XDG config standard)
- Project-specific: `./.gdrive-tokens.json` (with .gitignore)

### Option 2: OS Keychain Integration

**Advantages:**
- Native OS security (macOS Keychain, Windows Credential Store)
- Encrypted storage
- User-specific access control

**Implementation with `keytar`:**
```javascript
const keytar = require('keytar');

const saveTokens = async (tokens) => {
  await keytar.setPassword('gdrive-mcp', 'refresh_token', tokens.refresh_token);
  await keytar.setPassword('gdrive-mcp', 'access_token', JSON.stringify({
    access_token: tokens.access_token,
    expiry_date: tokens.expiry_date
  }));
};

const loadTokens = async () => {
  const refreshToken = await keytar.getPassword('gdrive-mcp', 'refresh_token');
  const accessData = await keytar.getPassword('gdrive-mcp', 'access_token');
  // Reconstruct token object
};
```

## Auto-Refresh Implementation Pattern

### Token Event Handling
```javascript
// Listen for token updates
client.on('tokens', async (tokens) => {
  console.log('Tokens updated');
  
  // Always save new tokens
  await saveTokens(tokens);
  
  // Store refresh token permanently (only issued once)
  if (tokens.refresh_token) {
    console.log('New refresh token received - saving permanently');
    await saveRefreshToken(tokens.refresh_token);
  }
});
```

### Automatic Refresh Logic
```javascript
class TokenManager {
  constructor() {
    this.oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    this.setupTokenRefresh();
  }

  async setupTokenRefresh() {
    // Load existing tokens
    const savedTokens = await loadTokens();
    if (savedTokens) {
      this.oauth2Client.setCredentials(savedTokens);
    }

    // Setup automatic refresh
    this.oauth2Client.on('tokens', async (tokens) => {
      await saveTokens({
        ...savedTokens,
        ...tokens,
        refresh_token: tokens.refresh_token || savedTokens?.refresh_token
      });
    });
  }

  async getValidClient() {
    const tokens = await loadTokens();
    
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    this.oauth2Client.setCredentials(tokens);

    // Check if access token is expired
    if (this.isTokenExpired(tokens)) {
      console.log('Access token expired, refreshing...');
      await this.oauth2Client.getAccessToken(); // Triggers auto-refresh
    }

    return this.oauth2Client;
  }

  isTokenExpired(tokens) {
    if (!tokens.expiry_date) return true;
    return Date.now() >= tokens.expiry_date;
  }
}
```

## Production-Grade Token Management

### Error Handling Patterns

**Common Error Scenarios:**
```javascript
const handleTokenErrors = async (error) => {
  if (error.code === 'invalid_grant') {
    // Refresh token expired/revoked - require re-auth
    console.log('Refresh token invalid. User must re-authenticate.');
    await clearStoredTokens();
    throw new Error('Authentication required');
  }
  
  if (error.code === 'invalid_request') {
    // Temporary error - retry with backoff
    console.log('Temporary token error, retrying...');
    await delay(2000);
    return retryTokenRefresh();
  }
  
  // Log and re-throw unknown errors
  console.error('Unknown token error:', error);
  throw error;
};
```

### Refresh Token Lifecycle Management

**Best Practices:**
1. **Store refresh token immediately on first auth**
2. **Never expose refresh token in logs**
3. **Implement token rotation** (if supported by provider)
4. **Handle edge cases** (user revokes access, quota exceeded)

### State Management for MCP

**Auth State Tracking:**
```javascript
const AuthStates = {
  UNAUTHENTICATED: 'unauthenticated',
  AUTHENTICATED: 'authenticated', 
  TOKEN_EXPIRED: 'token_expired',
  REFRESH_FAILED: 'refresh_failed',
  TOKENS_REVOKED: 'tokens_revoked'
};

class MCPAuthManager {
  constructor() {
    this.state = AuthStates.UNAUTHENTICATED;
    this.tokenManager = new TokenManager();
  }

  async initialize() {
    try {
      const client = await this.tokenManager.getValidClient();
      this.state = AuthStates.AUTHENTICATED;
      return client;
    } catch (error) {
      this.state = AuthStates.UNAUTHENTICATED;
      throw error;
    }
  }

  async executeWithAuth(apiCall) {
    if (this.state !== AuthStates.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run authentication flow.');
    }

    try {
      return await apiCall();
    } catch (error) {
      if (this.isAuthError(error)) {
        // Attempt token refresh
        await this.tokenManager.getValidClient();
        return await apiCall(); // Retry once
      }
      throw error;
    }
  }
}
```

## Integration with gdrive MCP

### Modification Points

**1. Authentication Initialization:**
```javascript
// Current: Manual auth every time
// New: Check for stored tokens first

server.addTool({
  name: "gdrive:authenticate",
  description: "Authenticate with Google Drive (one-time setup)",
  handler: async () => {
    // Check for existing valid tokens
    const authManager = new MCPAuthManager();
    try {
      await authManager.initialize();
      return "Already authenticated with stored tokens";
    } catch {
      // Proceed with OAuth flow
      return startAuthFlow();
    }
  }
});
```

**2. Function Wrappers:**
```javascript
// Wrap all gdrive functions with auth check
const withAuth = (fn) => async (params) => {
  const client = await authManager.getValidClient();
  return await fn(client, params);
};

// Apply to all functions
server.addTool({
  name: "gdrive:search",
  handler: withAuth(async (client, params) => {
    // Use authenticated client
    const drive = google.drive({ version: 'v3', auth: client });
    return await drive.files.list(params);
  })
});
```

**3. Token Storage Configuration:**
```javascript
// Configuration options
const AUTH_CONFIG = {
  tokenStoragePath: process.env.GDRIVE_TOKEN_PATH || 
                   path.join(os.homedir(), '.gdrive-mcp-tokens.json'),
  useKeychain: process.env.GDRIVE_USE_KEYCHAIN === 'true',
  secureStorage: true
};
```

## Security Considerations

**Token Security:**
- **File Permissions:** `0o600` (owner read/write only)
- **Encryption:** Consider encrypting refresh tokens at rest
- **Access Control:** Store in user-specific locations only
- **Audit Trail:** Log authentication events (not token values)

**Production Hardening:**
```javascript
// Secure token storage
const secureTokenStorage = {
  async save(tokens) {
    const encrypted = encrypt(JSON.stringify(tokens));
    await fs.writeFile(tokenPath, encrypted, { mode: 0o600 });
  },
  
  async load() {
    const encrypted = await fs.readFile(tokenPath);
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted);
  }
};
```

## Implementation Timeline

**Phase 1: Basic Persistence (2-3 hours)**
1. Implement file-based token storage
2. Add token loading on MCP startup
3. Basic error handling for missing tokens
4. Test with existing gdrive functions

**Phase 2: Auto-Refresh (2-3 hours)**
1. Implement automatic token refresh logic
2. Add token expiry checking
3. Handle refresh failures gracefully
4. Add comprehensive error handling

**Phase 3: Production Polish (1-2 hours)**
1. Add secure storage options (keychain)
2. Implement proper logging
3. Add configuration options
4. Documentation and testing

**Total Effort:** 5-8 hours implementation + testing

## Expected Benefits

**User Experience:**
- ✅ **One-time authentication** (until tokens revoked)
- ✅ **Seamless MCP usage** without auth interruptions
- ✅ **Background token refresh** (transparent to user)
- ✅ **Reliable long-running processes**

**Technical Benefits:**
- ✅ **Production-ready authentication** 
- ✅ **Reduced API quota usage** (fewer auth flows)
- ✅ **Better error handling** and recovery
- ✅ **Configurable storage options**

## Migration Strategy

**For Existing Users:**
1. **Backup Current Setup:** Document current auth process
2. **Graceful Upgrade:** Detect missing tokens and prompt for one-time re-auth
3. **Clear Instructions:** Provide migration guide for users
4. **Fallback Mode:** Maintain compatibility with manual auth

**Implementation Steps:**
1. Add persistent storage alongside current auth
2. Test thoroughly with existing functionality  
3. Deploy with feature flag for gradual rollout
4. Monitor for auth-related issues
5. Full migration after validation

---

## Key Research Sources

- **Google Auth Library Node.js:** OAuth refresh token patterns and best practices
- **Context7 MCP:** Comprehensive token management documentation and examples
- **Hiver Engineering:** Large-scale Gmail OAuth token management case study
- **EXA Research:** MCP development patterns and Node.js OAuth implementation

*This research provides a complete roadmap for implementing persistent authentication that will transform the gdrive MCP from a frequently-interrupted tool into a seamless, production-ready integration.*