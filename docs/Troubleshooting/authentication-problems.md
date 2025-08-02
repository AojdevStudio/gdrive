# Authentication Problems

This guide covers common authentication issues with the Google Drive MCP Server and provides step-by-step solutions.

## 🔍 Quick Diagnosis

### Check Authentication Status
```bash
# Check health and token status
node ./dist/index.js health

# View authentication logs
tail -20 logs/gdrive-mcp-audit.log

# Check token file exists and has correct permissions
ls -la credentials/.gdrive-mcp-tokens.json
```

## 🚨 Common Authentication Issues

### 1. Invalid Grant Error

**Symptoms:**
- Error: `invalid_grant`
- Authentication fails during startup
- Health check shows UNHEALTHY status

**Causes:**
- Token has expired and cannot be refreshed
- System clock is out of sync
- OAuth app configuration changed
- Refresh token was revoked

**Solutions:**

#### Option A: Re-authenticate (Recommended)
```bash
# 1. Remove old tokens
rm credentials/.gdrive-mcp-tokens.json

# 2. Run authentication again
./scripts/auth.sh
# OR manually:
node ./dist/index.js auth

# 3. Verify authentication works
node ./dist/index.js health
```

#### Option B: Check System Configuration
```bash
# Verify system time is correct
date
ntpq -p  # Check NTP sync status

# Sync system clock if needed
sudo ntpdate -s time.nist.gov
```

### 2. OAuth Flow Fails to Open Browser

**Symptoms:**
- Authentication process doesn't open browser
- Error: "Failed to open browser"
- Hangs on "Please visit this URL to authorize..."

**Solutions:**

#### For SSH/Remote Sessions:
```bash
# Method 1: Copy URL manually
node ./dist/index.js auth
# Copy the displayed URL to your local browser

# Method 2: Use SSH port forwarding
ssh -L 3000:localhost:3000 user@remote-server
# Then run auth on remote server
```

#### For Docker/Container Environments:
```bash
# Authentication MUST be done on host machine
# Never try to authenticate inside a container

# Correct approach:
./scripts/auth.sh  # Run on host
docker-compose up -d  # Then start container
```

### 3. Missing OAuth Configuration

**Symptoms:**
- Error: "OAuth client not found"
- Error: "gcp-oauth.keys.json not found"
- Error: "Invalid client ID"

**Solutions:**

#### Check OAuth Keys File:
```bash
# Verify file exists
ls -la credentials/gcp-oauth.keys.json
# OR
ls -la gcp-oauth.keys.json

# Validate JSON structure
node -e "console.log(JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json')))"
```

#### Create OAuth Configuration:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Click "Create Credentials" → "OAuth client ID"
4. Choose "Desktop application"
5. Download JSON file and rename to `gcp-oauth.keys.json`
6. Place in `credentials/` directory

### 4. Encryption Key Issues

**Symptoms:**
- Error: "Invalid encryption key"
- Error: "Failed to decrypt tokens"
- Authentication succeeds but tokens can't be loaded

**Solutions:**

#### Verify Encryption Key:
```bash
# Check key is set and correct length (32 bytes)
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c
# Should output: 32

# If key is missing or wrong length:
export GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$GDRIVE_TOKEN_ENCRYPTION_KEY" >> .env
```

#### Reset Tokens with New Key:
```bash
# If key changed, old tokens can't be decrypted
rm credentials/.gdrive-mcp-tokens.json
./scripts/auth.sh  # Re-authenticate with new key
```

### 5. Insufficient OAuth Scopes

**Symptoms:**
- Authentication succeeds but API calls fail
- Error: "Insufficient permissions"
- Some features work but others don't

**Solutions:**

#### Verify Required Scopes:
Ensure your OAuth consent screen includes these scopes:
```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/forms
https://www.googleapis.com/auth/script.projects.readonly
```

#### Update OAuth Configuration:
1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Add missing scopes under "Scopes for Google APIs"
3. Save changes
4. Re-authenticate:
   ```bash
   rm credentials/.gdrive-mcp-tokens.json
   ./scripts/auth.sh
   ```

## 🔧 Advanced Diagnostics

### Debug Authentication Flow
```bash
# Enable debug logging
LOG_LEVEL=debug node ./dist/index.js auth

# Check token refresh cycle
LOG_LEVEL=debug node ./dist/index.js
# Watch for TOKEN_REFRESH events
```

### Validate Token Structure
```bash
# View token metadata (without exposing sensitive data)
node -e "
const fs = require('fs');
const crypto = require('crypto');
const key = Buffer.from(process.env.GDRIVE_TOKEN_ENCRYPTION_KEY, 'base64');
const data = fs.readFileSync('credentials/.gdrive-mcp-tokens.json');
const parsed = JSON.parse(data);
console.log('Token fields:', Object.keys(parsed));
console.log('Encrypted data length:', parsed.data?.length || 'missing');
"
```

### Test API Access
```bash
# Test basic Drive API access
echo '{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "test",
      "pageSize": 1
    }
  }
}' | node ./dist/index.js
```

## 🛡️ Prevention Strategies

### Automated Token Health Monitoring
```bash
# Add to crontab for regular health checks
# Check every hour and log status
0 * * * * cd /path/to/gdrive-mcp && node dist/index.js health >> logs/health-check.log 2>&1
```

### Backup Authentication
```bash
# Create backup of working tokens
cp credentials/.gdrive-mcp-tokens.json credentials/.gdrive-mcp-tokens.backup

# Store encryption key securely
echo $GDRIVE_TOKEN_ENCRYPTION_KEY > .encryption-key.backup
chmod 600 .encryption-key.backup
```

### Environment Validation Script
```bash
#!/bin/bash
# save as validate-auth.sh

echo "Validating authentication environment..."

# Check required files
if [[ ! -f "credentials/gcp-oauth.keys.json" ]]; then
    echo "❌ OAuth keys missing"
    exit 1
fi

# Check encryption key
if [[ -z "$GDRIVE_TOKEN_ENCRYPTION_KEY" ]]; then
    echo "❌ Encryption key not set"
    exit 1
fi

# Validate key length
KEY_LENGTH=$(echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c)
if [[ $KEY_LENGTH -ne 32 ]]; then
    echo "❌ Encryption key wrong length: $KEY_LENGTH (should be 32)"
    exit 1
fi

# Check token file
if [[ -f "credentials/.gdrive-mcp-tokens.json" ]]; then
    echo "✅ Token file exists"
else
    echo "⚠️  Token file missing - authentication required"
fi

echo "✅ Authentication environment validated"
```

## 🆘 Emergency Recovery

If authentication is completely broken:

### Nuclear Option - Complete Reset
```bash
#!/bin/bash
echo "Performing complete authentication reset..."

# Stop all services
docker-compose down

# Remove all authentication data
rm -f credentials/.gdrive-mcp-tokens.json
rm -f credentials/.gdrive-server-credentials.json
rm -f logs/gdrive-mcp-audit.log

# Generate new encryption key
export GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$GDRIVE_TOKEN_ENCRYPTION_KEY" > .env

# Re-authenticate
./scripts/auth.sh

# Restart services
docker-compose up -d

# Verify recovery
node ./dist/index.js health
```

### Restore from Backup
```bash
# If you have a backup of working tokens
cp credentials/.gdrive-mcp-tokens.backup credentials/.gdrive-mcp-tokens.json

# Restore encryption key
export GDRIVE_TOKEN_ENCRYPTION_KEY=$(cat .encryption-key.backup)

# Test restored authentication
node ./dist/index.js health
```

---

If none of these solutions work, check the [Error Messages Reference](./error-messages.md) for specific error codes and solutions.