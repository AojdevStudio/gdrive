# Error Messages Reference

This comprehensive reference covers all common error messages you might encounter with the Google Drive MCP Server, including diagnostic steps and specific solutions.

## 🔍 Quick Error Lookup

### Search by Error Message
```bash
# Search this document for your specific error
grep -i "your error message" docs/Troubleshooting/error-messages.md

# Search application logs for error context
grep -B5 -A5 "your error message" logs/error.log

# Get recent errors with timestamps
tail -50 logs/error.log | grep -E "ERROR|WARN"
```

## 🔐 Authentication Errors

### `invalid_grant`
**Full Error:** `Error: invalid_grant`

**Meaning:** OAuth token has expired or been revoked and cannot be refreshed.

**Diagnostic Steps:**
```bash
# Check token file exists
ls -la credentials/.gdrive-mcp-tokens.json

# Check system time is correct
date
ntpdate -q pool.ntp.org

# Check authentication logs
grep "invalid_grant" logs/gdrive-mcp-audit.log
```

**Solutions:**
1. **Re-authenticate:**
   ```bash
   rm credentials/.gdrive-mcp-tokens.json
   ./scripts/auth.sh
   ```

2. **Sync system clock:**
   ```bash
   sudo ntpdate -s time.nist.gov
   ```

3. **Check OAuth app hasn't been modified in Google Cloud Console**

---

### `OAuth client not found`
**Full Error:** `Error: OAuth client not found` or `Client ID not found`

**Meaning:** OAuth configuration file is missing or contains invalid client ID.

**Diagnostic Steps:**
```bash
# Check OAuth file exists
ls -la credentials/gcp-oauth.keys.json

# Validate JSON structure
node -pe "JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json'))"

# Check client ID in Google Cloud Console
```

**Solutions:**
1. **Download fresh OAuth configuration:**
   - Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
   - Download OAuth client JSON
   - Save as `credentials/gcp-oauth.keys.json`

2. **Verify project configuration in Google Cloud Console**

---

### `Token refresh failed`
**Full Error:** `Error: Token refresh failed` or `Failed to refresh access token`

**Meaning:** Automatic token refresh failed, usually due to revoked refresh token.

**Diagnostic Steps:**
```bash
# Check refresh token status
grep "TOKEN_REFRESH" logs/gdrive-mcp-audit.log | tail -5

# Check if user revoked access
# Go to: https://myaccount.google.com/permissions
```

**Solutions:**
1. **Re-authenticate:**
   ```bash
   rm credentials/.gdrive-mcp-tokens.json
   ./scripts/auth.sh
   ```

2. **Check OAuth app hasn't been disabled in Google Cloud Console**

---

### `Browser authentication failed`
**Full Error:** `Failed to open browser` or `Browser authentication timeout`

**Meaning:** OAuth flow couldn't open browser or user didn't complete authentication.

**Diagnostic Steps:**
```bash
# Check if running in headless environment
echo $DISPLAY

# Check SSH connection type
echo $SSH_CLIENT
```

**Solutions:**
1. **For SSH/Remote sessions:**
   ```bash
   # Copy the authorization URL manually
   node ./dist/index.js auth
   # Copy URL to local browser
   ```

2. **For Docker environments:**
   ```bash
   # NEVER authenticate inside Docker
   # Always run on host:
   ./scripts/auth.sh
   ```

## 🔧 API Errors

### `API has not been used in project`
**Full Error:** `API has not been used in project XXXXXXX before or it is disabled`

**Meaning:** Required Google API is not enabled in your project.

**Diagnostic Steps:**
```bash
# Check enabled APIs
gcloud services list --enabled --project=YOUR_PROJECT_ID

# Check specific API
gcloud services list --enabled --filter="name:drive.googleapis.com" --project=YOUR_PROJECT_ID
```

**Solutions:**
1. **Enable required APIs:**
   ```bash
   gcloud services enable drive.googleapis.com --project=YOUR_PROJECT_ID
   gcloud services enable sheets.googleapis.com --project=YOUR_PROJECT_ID
   gcloud services enable docs.googleapis.com --project=YOUR_PROJECT_ID
   gcloud services enable forms.googleapis.com --project=YOUR_PROJECT_ID
   gcloud services enable script.googleapis.com --project=YOUR_PROJECT_ID
   ```

2. **Enable via Console:**
   - Go to [API Library](https://console.cloud.google.com/apis/library)
   - Search and enable each required API

---

### `Quota exceeded`
**Full Error:** `Quota exceeded for quota metric 'Queries' and limit 'Queries per day'`

**Meaning:** You've exceeded Google API quotas.

**Diagnostic Steps:**
```bash
# Check quota usage in Google Cloud Console
# Go to: https://console.cloud.google.com/apis/api/drive.googleapis.com/quotas

# Check recent API usage
grep "quota" logs/error.log | tail -10

# Check cache hit rate
grep -E "cache (hit|miss)" logs/combined.log | tail -20
```

**Solutions:**
1. **Enable caching to reduce API calls:**
   ```bash
   # Ensure Redis is running
   docker-compose up -d redis
   
   # Verify cache configuration
   echo $REDIS_URL
   ```

2. **Implement request throttling:**
   ```bash
   echo "GDRIVE_RATE_LIMIT_DELAY=2000" >> .env
   echo "GDRIVE_MAX_CONCURRENT_REQUESTS=2" >> .env
   ```

3. **Request quota increase in Google Cloud Console**

---

### `Rate limit exceeded`
**Full Error:** `User Rate Limit Exceeded` or HTTP 429 status

**Meaning:** Too many requests sent too quickly.

**Diagnostic Steps:**
```bash
# Check request frequency
grep "$(date '+%Y-%m-%d %H:%M')" logs/combined.log | grep "API request" | wc -l

# Check for 429 errors
grep "429" logs/error.log
```

**Solutions:**
1. **Enable exponential backoff:**
   ```bash
   echo "GDRIVE_EXPONENTIAL_BACKOFF=true" >> .env
   echo "GDRIVE_MAX_RETRIES=5" >> .env
   ```

2. **Reduce concurrent requests:**
   ```bash
   echo "GDRIVE_MAX_CONCURRENT_REQUESTS=1" >> .env
   echo "GDRIVE_RATE_LIMIT_DELAY=3000" >> .env
   ```

## 🛡️ Permission Errors

### `Insufficient permissions`
**Full Error:** `The user does not have sufficient permissions for this file` or `Request had insufficient authentication scopes`

**Meaning:** User doesn't have access to file or OAuth scopes are insufficient.

**Diagnostic Steps:**
```bash
# Test with files you own
echo '{
  "method": "tools/call",
  "params": {
    "name": "enhancedSearch",
    "arguments": {
      "query": "'me' in owners",
      "pageSize": 5
    }
  }
}' | node ./dist/index.js

# Check OAuth scopes
# Go to: https://console.cloud.google.com/apis/credentials/consent
```

**Solutions:**
1. **Update OAuth scopes:**
   - Add required scopes in OAuth consent screen
   - Re-authenticate: `./scripts/auth.sh`

2. **Check file permissions in Google Drive web interface**

3. **For organization accounts, contact admin**

---

### `File not found`
**Full Error:** `File not found` for existing files

**Meaning:** File exists but user doesn't have access permissions.

**Diagnostic Steps:**
```bash
# Test if file is visible in search
echo '{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {"query": "FILE_NAME"}
  }
}' | node ./dist/index.js

# Check if file is in Trash
echo '{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {"query": "trashed=true"}
  }
}' | node ./dist/index.js
```

**Solutions:**
1. **Request access to the file from owner**
2. **Check if file is in shared drives with different permissions**
3. **Use file ID instead of name if available**

## 🐳 Docker Errors

### `Container exited with code 1`
**Full Error:** Container stops immediately with exit code 1

**Meaning:** Application failed to start, usually due to missing configuration.

**Diagnostic Steps:**
```bash
# Check container logs
docker-compose logs gdrive-mcp

# Check if required files exist
docker-compose exec gdrive-mcp ls -la /credentials/

# Check environment variables
docker-compose exec gdrive-mcp env | grep GDRIVE
```

**Solutions:**
1. **Ensure authentication was done on host:**
   ```bash
   ls -la credentials/.gdrive-mcp-tokens.json
   # If missing: ./scripts/auth.sh
   ```

2. **Check .env file exists with encryption key:**
   ```bash
   cat .env | grep GDRIVE_TOKEN_ENCRYPTION_KEY
   ```

3. **Verify file permissions:**
   ```bash
   chmod 755 credentials/
   chmod 644 credentials/gcp-oauth.keys.json
   ```

---

### `Volume mount failed`
**Full Error:** Various volume mounting errors

**Meaning:** Docker can't mount required directories.

**Diagnostic Steps:**
```bash
# Check directories exist
ls -la credentials/ logs/

# Check Docker Compose configuration
cat docker-compose.yml | grep -A5 volumes

# Check file permissions
ls -la credentials/ logs/
```

**Solutions:**
1. **Create required directories:**
   ```bash
   mkdir -p credentials logs data
   chmod 755 credentials logs data
   ```

2. **Fix permissions:**
   ```bash
   # For SELinux systems
   sudo chcon -R -t container_file_t credentials/ logs/
   ```

3. **Use absolute paths in docker-compose.yml if needed**

---

### `Network connectivity failed`
**Full Error:** Can't connect to Redis or external APIs

**Meaning:** Docker network issues preventing connections.

**Diagnostic Steps:**
```bash
# Test Redis connectivity
docker-compose exec gdrive-mcp ping redis

# Test external connectivity
docker-compose exec gdrive-mcp nslookup google.com

# Check Docker networks
docker network ls
```

**Solutions:**
1. **Restart Docker network:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **Configure DNS if needed:**
   ```yaml
   # Add to docker-compose.yml
   services:
     gdrive-mcp:
       dns:
         - 8.8.8.8
         - 8.8.4.4
   ```

## 📡 Redis Errors

### `Redis connection failed`
**Full Error:** `Error: Redis connection failed` or `ECONNREFUSED 127.0.0.1:6379`

**Meaning:** Can't connect to Redis server.

**Diagnostic Steps:**
```bash
# Test Redis connection
redis-cli ping

# For Docker setup
docker-compose exec redis redis-cli ping

# Check Redis URL
echo $REDIS_URL
```

**Solutions:**
1. **Start Redis:**
   ```bash
   # Local Redis
   brew services start redis  # macOS
   sudo systemctl start redis  # Linux
   
   # Docker Redis
   docker-compose up -d redis
   ```

2. **Fix Redis URL:**
   ```bash
   # For local Redis
   export REDIS_URL="redis://localhost:6379"
   
   # For Docker Redis
   export REDIS_URL="redis://redis:6379"
   ```

---

### `NOAUTH Authentication required`
**Full Error:** `NOAUTH Authentication required`

**Meaning:** Redis requires password authentication.

**Diagnostic Steps:**
```bash
# Check if Redis requires auth
redis-cli config get requirepass

# Check Redis URL format
echo $REDIS_URL
```

**Solutions:**
1. **Add password to Redis URL:**
   ```bash
   export REDIS_URL="redis://:password@localhost:6379"
   ```

2. **Configure Redis without password (for development):**
   ```bash
   redis-cli config set requirepass ""
   ```

---

### `OOM command not allowed`
**Full Error:** `OOM command not allowed when used memory > 'maxmemory'`

**Meaning:** Redis has run out of memory.

**Diagnostic Steps:**
```bash
# Check Redis memory usage
redis-cli info memory

# Check system memory
free -h
```

**Solutions:**
1. **Increase Redis memory limit:**
   ```bash
   redis-cli config set maxmemory 512mb
   ```

2. **Configure memory eviction:**
   ```bash
   redis-cli config set maxmemory-policy allkeys-lru
   ```

3. **Reduce cache TTL values:**
   ```bash
   echo "GDRIVE_CACHE_TTL=300" >> .env
   ```

## ⚙️ Configuration Errors

### `Invalid encryption key`
**Full Error:** `Invalid encryption key` or `Failed to decrypt tokens`

**Meaning:** Encryption key is missing, wrong format, or changed.

**Diagnostic Steps:**
```bash
# Check if key is set
echo $GDRIVE_TOKEN_ENCRYPTION_KEY

# Check key length (should be 32 bytes when base64 decoded)
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c
```

**Solutions:**
1. **Generate new encryption key:**
   ```bash
   export GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
   echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$GDRIVE_TOKEN_ENCRYPTION_KEY" >> .env
   ```

2. **Re-authenticate with new key:**
   ```bash
   rm credentials/.gdrive-mcp-tokens.json
   ./scripts/auth.sh
   ```

---

### `Environment variable not set`
**Full Error:** Various missing environment variable errors

**Meaning:** Required configuration is missing.

**Diagnostic Steps:**
```bash
# Check .env file exists
ls -la .env

# Check environment variables
env | grep GDRIVE
env | grep REDIS
```

**Solutions:**
1. **Create .env file:**
   ```bash
   cat > .env << EOF
GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
EOF
   ```

2. **Load environment file:**
   ```bash
   source .env
   # Or for Docker:
   docker-compose --env-file .env up -d
   ```

## 🚑 System Errors

### `ENOENT: no such file or directory`
**Full Error:** `ENOENT: no such file or directory, open '/path/to/file'`

**Meaning:** Required file is missing.

**Diagnostic Steps:**
```bash
# Check if file exists
ls -la /path/to/file

# Check directory permissions
ls -la $(dirname /path/to/file)
```

**Solutions:**
1. **Create missing directories:**
   ```bash
   mkdir -p credentials logs data
   ```

2. **Copy required files:**
   ```bash
   cp gcp-oauth.keys.json credentials/
   ```

3. **Check file paths in configuration**

---

### `EACCES: permission denied`
**Full Error:** `EACCES: permission denied, open '/path/to/file'`

**Meaning:** Insufficient file system permissions.

**Diagnostic Steps:**
```bash
# Check file permissions
ls -la /path/to/file

# Check directory permissions
ls -la $(dirname /path/to/file)

# Check current user
whoami
id
```

**Solutions:**
1. **Fix file permissions:**
   ```bash
   chmod 755 credentials/ logs/
   chmod 644 credentials/gcp-oauth.keys.json
   chmod 600 credentials/.gdrive-mcp-tokens.json
   ```

2. **Change ownership if needed:**
   ```bash
   sudo chown -R $USER:$USER credentials/ logs/
   ```

---

### `EMFILE: too many open files`
**Full Error:** `EMFILE: too many open files`

**Meaning:** System file descriptor limit exceeded.

**Diagnostic Steps:**
```bash
# Check current limits
ulimit -n

# Check open files
lsof | wc -l

# Check processes using many files
lsof | awk '{print $2}' | sort | uniq -c | sort -nr | head -10
```

**Solutions:**
1. **Increase file descriptor limit:**
   ```bash
   ulimit -n 4096
   ```

2. **Add to system limits:**
   ```bash
   echo "* soft nofile 4096" | sudo tee -a /etc/security/limits.conf
   echo "* hard nofile 8192" | sudo tee -a /etc/security/limits.conf
   ```

3. **Restart application to pick up new limits**

## 🔍 Error Diagnosis Tools

### Comprehensive Error Analysis Script

```bash
#!/bin/bash
# save as diagnose-error.sh

ERROR_MESSAGE="$1"

if [[ -z "$ERROR_MESSAGE" ]]; then
    echo "Usage: $0 'error message'"
    echo "Example: $0 'invalid_grant'"
    exit 1
fi

echo "Diagnosing Error: $ERROR_MESSAGE"
echo "================================="

# Search logs for error context
echo "1. Error Context from Logs:"
if [[ -f "logs/error.log" ]]; then
    grep -B5 -A5 -i "$ERROR_MESSAGE" logs/error.log | tail -20
else
    echo "No error log found"
fi

if [[ -f "logs/combined.log" ]]; then
    echo "\nFrom combined logs:"
    grep -B3 -A3 -i "$ERROR_MESSAGE" logs/combined.log | tail -15
fi

# Check common error patterns
echo "\n2. Error Category Analysis:"
case "$ERROR_MESSAGE" in
    *"invalid_grant"*)
        echo "Authentication error - likely token expired"
        echo "Run: rm credentials/.gdrive-mcp-tokens.json && ./scripts/auth.sh"
        ;;
    *"quota"*|*"rate"*)
        echo "API quota/rate limit error"
        echo "Check: grep 'cache' logs/combined.log"
        echo "Enable caching if not already enabled"
        ;;
    *"permission"*|*"forbidden"*)
        echo "Permission error"
        echo "Check OAuth scopes and file permissions"
        ;;
    *"redis"*|*"ECONNREFUSED"*)
        echo "Redis connection error"
        echo "Check: redis-cli ping"
        ;;
    *"docker"*|"container"*)
        echo "Docker-related error"
        echo "Check: docker-compose logs"
        ;;
    *)
        echo "Unknown error pattern"
        ;;
esac

# System health check
echo "\n3. System Health Check:"
echo "Node.js version: $(node --version 2>/dev/null || echo 'Not found')"
echo "Docker status: $(docker --version 2>/dev/null || echo 'Not installed')"
echo "Redis status: $(redis-cli ping 2>/dev/null || echo 'Not available')"

# Configuration check
echo "\n4. Configuration Check:"
echo "Environment file: $(ls -la .env 2>/dev/null || echo 'Missing')"
echo "OAuth keys: $(ls -la credentials/gcp-oauth.keys.json 2>/dev/null || echo 'Missing')"
echo "Token file: $(ls -la credentials/.gdrive-mcp-tokens.json 2>/dev/null || echo 'Missing')"

# Recent system changes
echo "\n5. Recent System Activity:"
echo "Recent file changes in project:"
find . -name "*.json" -o -name "*.env" -o -name "*.yml" -mtime -1 2>/dev/null | head -5

echo "\n6. Recommended Actions:"
echo "- Check the specific error section in docs/Troubleshooting/error-messages.md"
echo "- Run health check: node ./dist/index.js health"
echo "- Enable debug logging: LOG_LEVEL=debug"
echo "- Check system resources: df -h && free -h"
```

### Error Pattern Matcher

```bash
#!/bin/bash
# save as error-pattern-matcher.sh

LOG_FILE="${1:-logs/error.log}"

if [[ ! -f "$LOG_FILE" ]]; then
    echo "Log file not found: $LOG_FILE"
    exit 1
fi

echo "Error Pattern Analysis for: $LOG_FILE"
echo "======================================"

# Authentication errors
echo "Authentication Errors:"
grep -c -i "invalid_grant\|oauth\|token.*fail\|authentication.*fail" "$LOG_FILE"

# API errors
echo "\nAPI Errors:"
grep -c -i "quota.*exceed\|rate.*limit\|api.*not.*enabled\|service.*disabled" "$LOG_FILE"

# Permission errors
echo "\nPermission Errors:"
grep -c -i "permission.*denied\|insufficient.*permission\|forbidden\|unauthorized" "$LOG_FILE"

# Network/Connection errors
echo "\nNetwork/Connection Errors:"
grep -c -i "connection.*failed\|econnrefused\|timeout\|network.*error" "$LOG_FILE"

# Redis errors
echo "\nRedis Errors:"
grep -c -i "redis.*error\|redis.*fail\|noauth\|oom.*command" "$LOG_FILE"

# System errors
echo "\nSystem Errors:"
grep -c -i "enoent\|eacces\|emfile\|out of memory\|disk.*full" "$LOG_FILE"

# Error timeline
echo "\nError Timeline (last 24 hours):"
grep "$(date '+%Y-%m-%d')" "$LOG_FILE" | cut -d' ' -f1-3 | sort | uniq -c | tail -10

# Most common errors
echo "\nMost Common Error Messages:"
grep -i "error" "$LOG_FILE" | sed 's/.*ERROR[: ]*//i' | sort | uniq -c | sort -nr | head -10
```

---

## 🆘 Emergency Error Recovery

If you're getting multiple errors and nothing seems to work:

```bash
#!/bin/bash
# save as emergency-recovery.sh

echo "Emergency Error Recovery"
echo "========================"

# Stop everything
echo "1. Stopping all services..."
docker-compose down 2>/dev/null
killall node 2>/dev/null

# Clean temporary files
echo "2. Cleaning temporary files..."
rm -rf logs/*.log
rm -f credentials/.gdrive-mcp-tokens.json

# Verify basic requirements
echo "3. Verifying requirements..."
if [[ ! -f "credentials/gcp-oauth.keys.json" ]]; then
    echo "❌ Missing OAuth configuration"
    echo "Download from Google Cloud Console and save as credentials/gcp-oauth.keys.json"
    exit 1
fi

if [[ ! -f ".env" ]]; then
    echo "Creating .env file..."
    echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)" > .env
    echo "REDIS_URL=redis://localhost:6379" >> .env
    echo "LOG_LEVEL=info" >> .env
fi

# Fix permissions
echo "4. Fixing permissions..."
chmod 755 credentials/ logs/ 2>/dev/null
chmod 644 credentials/gcp-oauth.keys.json 2>/dev/null
mkdir -p logs

# Test basic functionality
echo "5. Testing basic functionality..."
echo "Building project..."
npm run build

echo "Testing authentication..."
./scripts/auth.sh

echo "Starting services..."
docker-compose up -d

# Wait and verify
sleep 10
echo "6. Verifying recovery..."
node ./dist/index.js health

echo "\nRecovery completed. Check the output above for any remaining issues."
```

This comprehensive error reference should help you diagnose and resolve most issues with the Google Drive MCP Server. For additional help, check the specific troubleshooting guides linked from the main [Troubleshooting README](./README.md).