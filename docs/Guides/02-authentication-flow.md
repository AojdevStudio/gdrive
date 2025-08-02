# Authentication Flow Guide

This guide covers the complete OAuth 2.0 authentication process for the Google Drive MCP Server, including initial setup, token management, and troubleshooting.

## Prerequisites

Before starting authentication, ensure you have completed:
- **[Initial Setup Guide](./01-initial-setup.md)** - Google Cloud project and local installation
- **OAuth credentials** downloaded and placed in `credentials/gcp-oauth.keys.json`
- **Encryption key** generated and saved in `.env` file
- **Required APIs** enabled in Google Cloud Console

## Understanding the Authentication System

### Authentication Architecture

The server uses a sophisticated authentication system with multiple components:

```
Authentication Flow:
User → OAuth Browser Flow → Google Authorization → Tokens → Encrypted Storage
  ↓                                                              ↓
Runtime → Token Validation → Auto-Refresh → API Access → Continuous Operation
```

### Key Components

- **AuthManager**: Handles OAuth flow and token lifecycle
- **TokenManager**: Encrypts/decrypts and stores tokens securely
- **Auto-Refresh**: Proactive token refresh (30-minute intervals)
- **Health Monitoring**: Continuous token status monitoring
- **Audit Logging**: Complete authentication event logging

## Step 1: Initial Authentication

### 1.1 Pre-Authentication Checklist

```bash
# Verify all prerequisites are met
cd /path/to/gdrive-mcp-server

# Check OAuth keys exist
ls -la credentials/gcp-oauth.keys.json
# Should show file with 600 permissions

# Check encryption key is set
source .env
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c
# Should output: 32

# Verify build is complete
ls -la dist/index.js
# Should exist and be executable

# Test environment loading
node -e "require('dotenv').config(); console.log('Environment loaded:', !!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY)"
```

### 1.2 Run Authentication Command

**Method 1: Direct Node.js (Recommended for Local Development)**

```bash
# Ensure environment variables are loaded
source .env

# Run authentication (this will open your browser)
node ./dist/index.js auth

# Expected output:
# "Starting OAuth flow..."
# "Opening browser for authentication..."
# "Waiting for authorization..."
```

**Method 2: Using Auth Script (Recommended for Docker Setup)**

```bash
# Use the provided authentication script
./scripts/auth.sh

# This script will:
# - Check for required files
# - Generate encryption key if needed
# - Run authentication flow
# - Verify success
```

### 1.3 Browser Authentication Process

1. **Browser Opens Automatically**
   - Your default browser will open with Google OAuth page
   - If browser doesn't open, check terminal for URL to copy

2. **Choose Google Account**
   - Select the Google account you want to use
   - Must be an account with access to your Google Drive

3. **OAuth Consent Screen**
   ```
   Google Drive MCP Server wants to:
   ✓ See, edit, create, and delete all of your Google Drive files
   ✓ See, edit, create, and delete your spreadsheets in Google Drive
   ✓ See, edit, create, and delete your documents in Google Drive
   ✓ See, edit, create, and delete all your Google Forms forms
   ✓ View your Google Apps Script projects
   ```

4. **Grant Permissions**
   - Review the permissions carefully
   - Click "Allow" to grant access
   - **Do not click "Deny" or close the browser**

5. **Success Confirmation**
   - Browser will show "Authentication successful!"
   - You can close the browser tab
   - Terminal will show "Authentication completed successfully"

### 1.4 Verify Authentication Success

```bash
# Check if token file was created
ls -la credentials/.gdrive-mcp-tokens.json
# Should exist with 600 permissions

# Run health check to verify tokens work
node ./dist/index.js health

# Expected output:
{
  "status": "HEALTHY",
  "timestamp": "2024-01-15T...",
  "checks": {
    "tokenStatus": {
      "status": "pass",
      "message": "Token is valid and not expiring soon"
    },
    "refreshCapability": {
      "status": "pass",
      "message": "Refresh token available"
    }
  }
}
```

### 1.5 Test Basic Functionality

```bash
# Test server startup (Ctrl+C to stop)
node ./dist/index.js

# Expected output:
# "MCP Server for Google Drive initialized"
# "AuthManager initialized successfully"
# "Server running on stdio transport"

# In another terminal, test a simple operation
echo '{"method": "tools/list"}' | node ./dist/index.js
# Should return list of available tools
```

## Step 2: Understanding Token Management

### 2.1 Token Storage

Tokens are stored in encrypted format:

```bash
# View token file (encrypted content)
cat credentials/.gdrive-mcp-tokens.json
# Shows encrypted data, not readable tokens

# Check audit log for token events
tail -f logs/gdrive-mcp-audit.log
# Shows token lifecycle events
```

### 2.2 Automatic Token Refresh

The server automatically refreshes tokens:

- **Refresh Interval**: Every 30 minutes (configurable)
- **Preemptive Refresh**: 10 minutes before expiry (configurable)
- **Retry Logic**: Up to 3 retries with exponential backoff
- **Health Monitoring**: Continuous token validity checks

```bash
# Monitor token refresh in real-time
tail -f logs/combined.log | grep -i token

# Configure refresh intervals in .env
echo "GDRIVE_TOKEN_REFRESH_INTERVAL=1800000" >> .env  # 30 minutes
echo "GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000" >> .env  # 10 minutes
echo "GDRIVE_TOKEN_MAX_RETRIES=3" >> .env
```

### 2.3 Token Lifecycle Events

The system logs all token events:

```json
// Example audit log entries
{"timestamp":"2024-01-15T10:00:00.000Z","event":"TOKEN_ACQUIRED","metadata":{"expires_in":3600}}
{"timestamp":"2024-01-15T10:25:00.000Z","event":"TOKEN_REFRESHED","metadata":{"new_expires_in":3600}}
{"timestamp":"2024-01-15T10:30:00.000Z","event":"TOKEN_ENCRYPTED","metadata":{"algorithm":"aes-256-gcm"}}
```

## Step 3: Advanced Authentication Scenarios

### 3.1 Re-authentication (Token Reset)

When tokens become invalid or corrupted:

```bash
# Delete existing tokens
rm -f credentials/.gdrive-mcp-tokens.json

# Re-run authentication
node ./dist/index.js auth

# Or use the auth script
./scripts/auth.sh
```

### 3.2 Multiple Account Setup

**Note**: The current system supports one account per installation. For multiple accounts:

```bash
# Create separate installations
mkdir -p gdrive-account-1 gdrive-account-2

# Copy configuration to each
cp -r credentials .env gdrive-account-1/
cp -r credentials .env gdrive-account-2/

# Authenticate each separately
cd gdrive-account-1 && node ../dist/index.js auth
cd gdrive-account-2 && node ../dist/index.js auth
```

### 3.3 Service Account Authentication (Advanced)

**Note**: Service accounts are not currently supported but can be added:

```bash
# Generate service account key (in Google Cloud Console)
# Download service-account-key.json

# Place in credentials directory
cp service-account-key.json credentials/

# Modify environment variables
echo "GDRIVE_USE_SERVICE_ACCOUNT=true" >> .env
echo "GDRIVE_SERVICE_ACCOUNT_PATH=credentials/service-account-key.json" >> .env
```

## Step 4: Authentication for Different Deployment Scenarios

### 4.1 Local Development Authentication

```bash
# Standard local setup
source .env
node ./dist/index.js auth

# Development with watch mode
npm run watch &
node ./dist/index.js auth
```

### 4.2 Docker Authentication

**Important**: Authentication must be done on the host machine, not inside Docker:

```bash
# Authenticate on host first
./scripts/auth.sh

# Verify tokens exist
ls -la credentials/.gdrive-mcp-tokens.json

# Then run Docker
docker-compose up -d

# Verify Docker container has access
docker-compose exec gdrive-mcp node dist/index.js health
```

### 4.3 Production Authentication

```bash
# Use production environment
export NODE_ENV=production
export LOG_LEVEL=error

# Run authentication with minimal logging
node ./dist/index.js auth

# Verify production health
node ./dist/index.js health
```

## Step 5: Monitoring and Health Checks

### 5.1 Real-time Health Monitoring

```bash
# Continuous health monitoring
watch -n 300 "node ./dist/index.js health"  # Every 5 minutes

# Monitor authentication events
tail -f logs/gdrive-mcp-audit.log | jq '.'

# Monitor general server logs
tail -f logs/combined.log | grep -E "(auth|token|error)"
```

### 5.2 Health Check Statuses

**Status Meanings**:
- 🟢 **HEALTHY**: Token valid, refresh capability available
- 🟡 **DEGRADED**: Token expiring soon, refresh in progress
- 🔴 **UNHEALTHY**: Token expired or no refresh capability

```bash
# Example health check responses

# HEALTHY
{
  "status": "HEALTHY",
  "checks": {
    "tokenStatus": {
      "status": "pass",
      "message": "Token is valid and not expiring soon",
      "metadata": {
        "expiresIn": 2847,
        "state": "AUTHENTICATED"
      }
    }
  }
}

# DEGRADED
{
  "status": "DEGRADED",
  "checks": {
    "tokenStatus": {
      "status": "warn",
      "message": "Token expiring soon, refresh in progress",
      "metadata": {
        "expiresIn": 298,
        "state": "REFRESHING"
      }
    }
  }
}

# UNHEALTHY
{
  "status": "UNHEALTHY",
  "checks": {
    "tokenStatus": {
      "status": "fail",
      "message": "Token expired",
      "metadata": {
        "expiresIn": -1,
        "state": "EXPIRED"
      }
    }
  }
}
```

## Troubleshooting Authentication Issues

### Issue: "Browser doesn't open" 

**Symptoms:**
- Authentication command runs but no browser opens
- Terminal shows URL but no automatic browser launch

**Solutions:**
```bash
# Method 1: Copy URL manually
node ./dist/index.js auth
# Copy the displayed URL to your browser

# Method 2: Set browser explicitly
export BROWSER=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
node ./dist/index.js auth

# Method 3: Use different browser
export BROWSER=firefox
node ./dist/index.js auth
```

### Issue: "invalid_grant" Error

**Symptoms:**
- Token refresh fails with "invalid_grant"
- Authentication works initially but fails later

**Solutions:**
```bash
# Check system clock synchronization
date
# Ensure time is correct

# Clear existing tokens and re-authenticate
rm -f credentials/.gdrive-mcp-tokens.json
node ./dist/index.js auth

# Verify OAuth app settings in Google Cloud Console
# Ensure "Desktop application" type is selected
# Check that OAuth consent screen is properly configured
```

### Issue: "Client ID not found" Error

**Symptoms:**
- Authentication fails immediately
- Error about missing or invalid client ID

**Solutions:**
```bash
# Verify OAuth keys file format
node -e "
const keys = JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json'));
console.log('Keys structure:');
console.log('Has installed:', !!keys.installed);
console.log('Has web:', !!keys.web);
console.log('Client ID:', keys.installed?.client_id || keys.web?.client_id || 'NOT FOUND');
"

# Re-download OAuth credentials from Google Cloud Console
# Ensure "Desktop application" type was selected
# Replace the file and try again
cp /path/to/new/gcp-oauth.keys.json credentials/
node ./dist/index.js auth
```

### Issue: "Encryption/Decryption Failed" Error

**Symptoms:**
- Tokens can't be saved or loaded
- "Invalid key" or "Decryption failed" errors

**Solutions:**
```bash
# Check encryption key length
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c
# Must output exactly: 32

# Regenerate encryption key if invalid
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" > .env

# Remove old encrypted tokens and re-authenticate
rm -f credentials/.gdrive-mcp-tokens.json
source .env
node ./dist/index.js auth
```

### Issue: "APIs not enabled" Error

**Symptoms:**
- Authentication succeeds but API calls fail
- 403 Forbidden errors during operation

**Solutions:**
```bash
# Re-enable APIs with explicit project
gcloud config set project YOUR_PROJECT_ID
gcloud services enable drive.googleapis.com sheets.googleapis.com docs.googleapis.com forms.googleapis.com script.googleapis.com

# Wait 5-10 minutes for propagation
# Test with simple API call
node -e "
require('dotenv').config();
const {google} = require('googleapis');
const auth = new google.auth.GoogleAuth({scopes: ['https://www.googleapis.com/auth/drive.readonly']});
auth.getClient().then(client => console.log('Auth successful')).catch(console.error);
"
```

### Issue: "Permission denied" for Scopes

**Symptoms:**
- OAuth consent shows different permissions than expected
- Some operations fail with permission errors

**Solutions:**
```bash
# Verify OAuth consent screen scopes
# Go to Google Cloud Console > APIs & Services > OAuth consent screen
# Ensure these exact scopes are added:
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/forms
https://www.googleapis.com/auth/script.projects.readonly

# Clear tokens and re-authenticate with updated scopes
rm -f credentials/.gdrive-mcp-tokens.json
node ./dist/index.js auth
```

### Issue: "Refresh token missing" Error

**Symptoms:**
- Initial authentication works but auto-refresh fails
- "No refresh token available" in logs

**Solutions:**
```bash
# Ensure OAuth app requests offline access
# This is configured in the application code
# If issue persists, revoke and re-authenticate:

# Revoke access in Google Account settings
# Go to myaccount.google.com/permissions
# Find "Google Drive MCP Server" and remove access

# Re-authenticate
rm -f credentials/.gdrive-mcp-tokens.json
node ./dist/index.js auth
```

### Issue: Docker Authentication Problems

**Symptoms:**
- Docker container can't access tokens
- Volume mount issues

**Solutions:**
```bash
# Ensure authentication is done on host, not in Docker
./scripts/auth.sh  # Run on host machine

# Check volume mounts
docker-compose exec gdrive-mcp ls -la /credentials/
# Should show gcp-oauth.keys.json and .gdrive-mcp-tokens.json

# Check environment variables in container
docker-compose exec gdrive-mcp env | grep GDRIVE
# Should show encryption key and other settings

# Verify permissions
docker-compose exec gdrive-mcp stat /credentials/.gdrive-mcp-tokens.json
# Should be readable by container user
```

## Security Best Practices

### Token Security
- **Never share** `.gdrive-mcp-tokens.json` file
- **Never commit** credentials to version control
- **Regularly rotate** encryption keys
- **Monitor** audit logs for suspicious activity
- **Use secure permissions** (600) for credential files

### OAuth Security
- **Use "Internal" user type** when possible for organizations
- **Regularly review** OAuth consent screen settings
- **Monitor** Google Cloud Console for unauthorized changes
- **Enable 2FA** on Google accounts used for authentication
- **Audit** token permissions periodically

### Environment Security
- **Secure `.env` files** with appropriate permissions
- **Use different encryption keys** for different environments
- **Monitor** failed authentication attempts
- **Implement** log monitoring and alerting
- **Regular backup** and test recovery procedures

## Next Steps

Once authentication is complete:
1. **[Claude Desktop Integration](./05-claude-desktop-integration.md)** - Connect to Claude
2. **[Environment Variables Setup](./06-environment-variables.md)** - Configure advanced settings
3. **[Docker Deployment](./03-docker-deployment.md)** - Optional containerized deployment

---

**Authentication Complete!** ✅

Your Google Drive MCP Server is now authenticated and ready to use. The server will automatically manage token refresh and maintain authentication status.