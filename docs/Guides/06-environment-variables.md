# Environment Variables Setup Guide

This guide covers all environment variables for the Google Drive MCP Server, including security, performance, authentication, caching, and logging configuration.

## Prerequisites

Before configuring environment variables:
- **[Initial Setup](./01-initial-setup.md)** completed
- **Basic understanding** of environment variables
- **Text editor** for editing `.env` files
- **Command line access** for testing

## Environment Variable Categories

### Variable Overview

```
Environment Variable Categories:

┌────────────────────────┐
│     Security & Auth        │
│  • Token encryption       │
│  • File paths             │
│  • Token lifecycle        │
└────────────────────────┘

┌────────────────────────┐
│    Performance & Cache    │
│  • Redis configuration    │
│  • Cache settings         │
│  • API optimization       │
└────────────────────────┘

┌────────────────────────┐
│     Logging & Debug       │
│  • Log levels             │
│  • File locations         │
│  • Audit trails           │
└────────────────────────┘
```

## Step 1: Security & Authentication Variables

### 1.1 Required Security Variables

```bash
# Create or update .env file with security settings
cat > .env << 'EOF'
# =============================================================================
# SECURITY & AUTHENTICATION CONFIGURATION
# =============================================================================

# REQUIRED: 32-byte base64 encryption key for token storage
# Generate with: openssl rand -base64 32
GDRIVE_TOKEN_ENCRYPTION_KEY=your-32-byte-base64-key-here

# OAuth credentials file path (relative to project root)
GDRIVE_OAUTH_PATH=credentials/gcp-oauth.keys.json

# Encrypted token storage path
GDRIVE_TOKEN_STORAGE_PATH=credentials/.gdrive-mcp-tokens.json

# Security audit log path
GDRIVE_TOKEN_AUDIT_LOG_PATH=logs/gdrive-mcp-audit.log
EOF
```

### 1.2 Generate Encryption Key

```bash
# Generate a secure 32-byte base64 encryption key
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "Generated encryption key: $ENCRYPTION_KEY"

# Update .env file with generated key
sed -i.bak "s/your-32-byte-base64-key-here/$ENCRYPTION_KEY/g" .env

# Verify key length (must be exactly 32 bytes when decoded)
echo $ENCRYPTION_KEY | base64 -d | wc -c
# Expected output: 32

# Remove backup file
rm .env.bak
```

### 1.3 Token Lifecycle Configuration

```bash
# Add token management settings to .env
cat >> .env << 'EOF'

# Token refresh interval in milliseconds (default: 30 minutes)
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000

# Preemptive refresh buffer in milliseconds (default: 10 minutes)
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000

# Maximum retry attempts for token refresh (default: 3)
GDRIVE_TOKEN_MAX_RETRIES=3

# Retry delay between attempts in milliseconds (default: 1 second)
GDRIVE_TOKEN_RETRY_DELAY=1000

# Enable health check monitoring (default: true)
GDRIVE_TOKEN_HEALTH_CHECK=true
EOF
```

### 1.4 Path Configuration

```bash
# Add path configuration (useful for Docker deployments)
cat >> .env << 'EOF'

# =============================================================================
# FILE PATH CONFIGURATION
# =============================================================================

# Base credentials directory (default: credentials/)
GDRIVE_CREDENTIALS_DIR=credentials

# Legacy credentials path (for migration)
GDRIVE_CREDENTIALS_PATH=credentials/.gdrive-server-credentials.json

# Application data directory
GDRIVE_DATA_DIR=data

# Logs directory
GDRIVE_LOGS_DIR=logs
EOF
```

## Step 2: Performance & Caching Variables

### 2.1 Redis Configuration

```bash
# Add Redis configuration to .env
cat >> .env << 'EOF'

# =============================================================================
# REDIS & CACHING CONFIGURATION
# =============================================================================

# Redis connection URL (default: redis://localhost:6379)
REDIS_URL=redis://localhost:6379

# Redis database number (default: 0)
REDIS_DB=0

# Redis connection timeout in milliseconds (default: 5000)
REDIS_CONNECT_TIMEOUT=5000

# Redis command timeout in milliseconds (default: 3000)
REDIS_COMMAND_TIMEOUT=3000

# Maximum Redis connection retries (default: 3)
REDIS_MAX_RETRIES=3

# Redis retry delay in milliseconds (default: 1000)
REDIS_RETRY_DELAY=1000
EOF
```

### 2.2 Cache Settings

```bash
# Add cache configuration to .env
cat >> .env << 'EOF'

# Enable/disable caching (default: true)
CACHE_ENABLED=true

# Default cache TTL in seconds (default: 300 = 5 minutes)
CACHE_TTL=300

# Cache key prefix (default: gdrive_mcp)
CACHE_PREFIX=gdrive_mcp

# Enable cache compression (default: true)
CACHE_COMPRESSION=true

# Cache statistics collection (default: true)
CACHE_STATS_ENABLED=true
EOF
```

### 2.3 API Performance Configuration

```bash
# Add API performance settings to .env
cat >> .env << 'EOF'

# =============================================================================
# API PERFORMANCE CONFIGURATION
# =============================================================================

# Google API request timeout in milliseconds (default: 30000)
GOOGLE_API_TIMEOUT=30000

# Maximum concurrent requests (default: 10)
GOOGLE_API_MAX_CONCURRENT=10

# Request retry attempts (default: 3)
GOOGLE_API_MAX_RETRIES=3

# Rate limiting - requests per second (default: 10)
GOOGLE_API_RATE_LIMIT=10

# Batch operation size limit (default: 100)
GOOGLE_API_BATCH_SIZE=100
EOF
```

## Step 3: Logging & Debug Variables

### 3.1 Logging Configuration

```bash
# Add logging configuration to .env
cat >> .env << 'EOF'

# =============================================================================
# LOGGING & DEBUG CONFIGURATION
# =============================================================================

# Application environment (development, production, test)
NODE_ENV=development

# Winston log level (error, warn, info, http, verbose, debug, silly)
LOG_LEVEL=info

# Console logging enabled (default: true)
LOG_CONSOLE_ENABLED=true

# File logging enabled (default: true)
LOG_FILE_ENABLED=true

# Log file maximum size in bytes (default: 5MB)
LOG_FILE_MAX_SIZE=5242880

# Maximum number of log files (default: 5)
LOG_FILE_MAX_FILES=5
EOF
```

### 3.2 Debug and Development Settings

```bash
# Add debug configuration to .env
cat >> .env << 'EOF'

# Enable debug mode (default: false)
DEBUG_ENABLED=false

# Debug output patterns (e.g., "mcp:*", "gdrive:*")
DEBUG=

# Performance monitoring enabled (default: true)
PERFORMANCE_MONITORING=true

# Performance statistics interval in milliseconds (default: 30000)
PERFORMANCE_STATS_INTERVAL=30000

# Enable request/response logging (default: false in production)
REQUEST_RESPONSE_LOGGING=false
EOF
```

### 3.3 Audit and Security Logging

```bash
# Add audit logging configuration to .env
cat >> .env << 'EOF'

# =============================================================================
# AUDIT & SECURITY LOGGING
# =============================================================================

# Enable comprehensive audit logging (default: true)
AUDIT_LOGGING_ENABLED=true

# Audit log format (json, text) (default: json)
AUDIT_LOG_FORMAT=json

# Log authentication events (default: true)
LOG_AUTH_EVENTS=true

# Log token lifecycle events (default: true)
LOG_TOKEN_EVENTS=true

# Log API access events (default: false)
LOG_API_EVENTS=false

# Log performance metrics (default: true)
LOG_PERFORMANCE_METRICS=true
EOF
```

## Step 4: Environment-Specific Configurations

### 4.1 Development Environment

```bash
# Create development-specific environment file
cp .env .env.development

# Update development-specific settings
cat >> .env.development << 'EOF'

# =============================================================================
# DEVELOPMENT ENVIRONMENT OVERRIDES
# =============================================================================

NODE_ENV=development
LOG_LEVEL=debug
DEBUG_ENABLED=true
REQUEST_RESPONSE_LOGGING=true
PERFORMANCE_MONITORING=true

# Shorter refresh intervals for testing
GDRIVE_TOKEN_REFRESH_INTERVAL=300000    # 5 minutes
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=60000   # 1 minute

# Local Redis
REDIS_URL=redis://localhost:6379

# Enhanced debugging
DEBUG=mcp:*,gdrive:*
LOG_CONSOLE_ENABLED=true
LOG_FILE_ENABLED=true
EOF
```

### 4.2 Production Environment

```bash
# Create production-specific environment file
cp .env .env.production

# Update production-specific settings
cat >> .env.production << 'EOF'

# =============================================================================
# PRODUCTION ENVIRONMENT OVERRIDES
# =============================================================================

NODE_ENV=production
LOG_LEVEL=error
DEBUG_ENABLED=false
REQUEST_RESPONSE_LOGGING=false

# Production security
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000   # 30 minutes
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000  # 10 minutes
GDRIVE_TOKEN_MAX_RETRIES=3

# Production Redis (update with your Redis server)
REDIS_URL=redis://your-redis-server:6379

# Optimized performance
GOOGLE_API_MAX_CONCURRENT=5
GOOGLE_API_RATE_LIMIT=5
CACHE_TTL=600                           # 10 minutes

# Minimal logging
LOG_CONSOLE_ENABLED=false
LOG_FILE_ENABLED=true
LOG_FILE_MAX_SIZE=10485760              # 10MB
LOG_FILE_MAX_FILES=3
EOF
```

### 4.3 Docker Environment

```bash
# Create Docker-specific environment file
cp .env .env.docker

# Update Docker-specific settings
cat >> .env.docker << 'EOF'

# =============================================================================
# DOCKER ENVIRONMENT OVERRIDES
# =============================================================================

# Docker container paths
GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log
GDRIVE_CREDENTIALS_DIR=/credentials
GDRIVE_DATA_DIR=/data
GDRIVE_LOGS_DIR=/app/logs

# Docker Redis service
REDIS_URL=redis://redis:6379

# Container-optimized settings
NODE_ENV=production
LOG_LEVEL=info
LOG_CONSOLE_ENABLED=true
LOG_FILE_ENABLED=true

# Performance settings for containers
GOOGLE_API_TIMEOUT=60000
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
EOF
```

## Step 5: Validation and Testing

### 5.1 Environment Variable Validation

```bash
# Create validation script
cat > validate_env.sh << 'EOF'
#!/bin/bash

echo "Environment Variable Validation"
echo "=============================="

# Source environment file
if [ -f ".env" ]; then
    source .env
    echo "✅ .env file loaded"
else
    echo "❌ .env file not found"
    exit 1
fi

# Required variables validation
echo "\nRequired Variables:"
required_vars=(
    "GDRIVE_TOKEN_ENCRYPTION_KEY"
    "GDRIVE_OAUTH_PATH"
    "GDRIVE_TOKEN_STORAGE_PATH"
)

for var in "${required_vars[@]}"; do
    if [ -n "${!var}" ]; then
        echo "✅ $var is set"
    else
        echo "❌ $var is NOT set"
    fi
done

# Encryption key validation
echo "\nEncryption Key Validation:"
if [ -n "$GDRIVE_TOKEN_ENCRYPTION_KEY" ]; then
    key_length=$(echo "$GDRIVE_TOKEN_ENCRYPTION_KEY" | base64 -d 2>/dev/null | wc -c)
    if [ "$key_length" -eq 32 ]; then
        echo "✅ Encryption key is valid (32 bytes)"
    else
        echo "❌ Encryption key is invalid (${key_length} bytes, expected 32)"
    fi
else
    echo "❌ Encryption key is not set"
fi

# File path validation
echo "\nFile Path Validation:"
file_paths=(
    "$GDRIVE_OAUTH_PATH"
)

for path in "${file_paths[@]}"; do
    if [ -f "$path" ]; then
        echo "✅ $path exists"
    else
        echo "❌ $path does not exist"
    fi
done

# Directory validation
echo "\nDirectory Validation:"
directories=(
    "${GDRIVE_CREDENTIALS_DIR:-credentials}"
    "${GDRIVE_LOGS_DIR:-logs}"
    "${GDRIVE_DATA_DIR:-data}"
)

for dir in "${directories[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir directory exists"
    else
        echo "⚠️  $dir directory does not exist (will be created)"
        mkdir -p "$dir"
    fi
done

# Redis connection test (optional)
echo "\nRedis Connection Test:"
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -u "${REDIS_URL:-redis://localhost:6379}" ping >/dev/null 2>&1; then
        echo "✅ Redis connection successful"
    else
        echo "⚠️  Redis connection failed (cache will be disabled)"
    fi
else
    echo "⚠️  redis-cli not available (skipping Redis test)"
fi

echo "\nValidation complete."
EOF

chmod +x validate_env.sh
./validate_env.sh
```

### 5.2 Test Environment Loading

```bash
# Test environment loading in Node.js
node -e "
require('dotenv').config();
console.log('Environment Variables Test:');
console.log('GDRIVE_TOKEN_ENCRYPTION_KEY:', !!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY);
console.log('REDIS_URL:', process.env.REDIS_URL || 'Not set');
console.log('LOG_LEVEL:', process.env.LOG_LEVEL || 'Not set');
console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');
"

# Test health check with environment
source .env
node ./dist/index.js health
```

### 5.3 Performance Testing with Different Configurations

```bash
# Test with different log levels
echo "Testing with LOG_LEVEL=debug"
LOG_LEVEL=debug node ./dist/index.js health

echo "Testing with LOG_LEVEL=error"
LOG_LEVEL=error node ./dist/index.js health

# Test with cache disabled
echo "Testing with cache disabled"
CACHE_ENABLED=false node ./dist/index.js health

# Test with different Redis URLs
echo "Testing Redis connection"
REDIS_URL=redis://localhost:6379 node -e "console.log('Redis URL set to:', process.env.REDIS_URL)"
```

## Step 6: Advanced Configuration

### 6.1 Multiple Environment Management

```bash
# Create environment switcher script
cat > switch_env.sh << 'EOF'
#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: $0 [development|production|docker|testing]"
    exit 1
fi

ENV=$1

case $ENV in
    development)
        cp .env.development .env
        echo "Switched to development environment"
        ;;
    production)
        cp .env.production .env
        echo "Switched to production environment"
        ;;
    docker)
        cp .env.docker .env
        echo "Switched to Docker environment"
        ;;
    testing)
        cp .env.testing .env
        echo "Switched to testing environment"
        ;;
    *)
        echo "Unknown environment: $ENV"
        echo "Available environments: development, production, docker, testing"
        exit 1
        ;;
esac

echo "Active environment variables:"
source .env
echo "NODE_ENV: $NODE_ENV"
echo "LOG_LEVEL: $LOG_LEVEL"
echo "REDIS_URL: $REDIS_URL"
EOF

chmod +x switch_env.sh

# Usage examples:
# ./switch_env.sh development
# ./switch_env.sh production
```

### 6.2 Secrets Management Integration

```bash
# Example integration with external secrets management
cat > load_secrets.sh << 'EOF'
#!/bin/bash

# Example using AWS Secrets Manager
if command -v aws >/dev/null 2>&1; then
    echo "Loading secrets from AWS Secrets Manager..."
    SECRET=$(aws secretsmanager get-secret-value --secret-id gdrive-mcp-encryption-key --query SecretString --output text)
    export GDRIVE_TOKEN_ENCRYPTION_KEY="$SECRET"
fi

# Example using HashiCorp Vault
if command -v vault >/dev/null 2>&1; then
    echo "Loading secrets from Vault..."
    export GDRIVE_TOKEN_ENCRYPTION_KEY=$(vault kv get -field=encryption_key secret/gdrive-mcp)
fi

# Example using Kubernetes secrets
if [ -f "/var/secrets/encryption-key" ]; then
    echo "Loading secrets from Kubernetes..."
    export GDRIVE_TOKEN_ENCRYPTION_KEY=$(cat /var/secrets/encryption-key)
fi

# Load remaining environment variables
source .env

echo "Secrets loaded successfully"
EOF

chmod +x load_secrets.sh
```

### 6.3 Configuration Templating

```bash
# Create environment template generator
cat > generate_env.sh << 'EOF'
#!/bin/bash

echo "Google Drive MCP Server Environment Configuration Generator"
echo "========================================================"

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "Generated new encryption key"

# Get user input
read -p "Environment (development/production/docker): " ENV_TYPE
read -p "Redis URL (default: redis://localhost:6379): " REDIS_URL
REDIS_URL=${REDIS_URL:-redis://localhost:6379}

read -p "Log Level (error/warn/info/debug): " LOG_LEVEL
LOG_LEVEL=${LOG_LEVEL:-info}

# Generate .env file
cat > .env << ENVEOF
# Google Drive MCP Server Configuration
# Generated on $(date)
# Environment: $ENV_TYPE

# Security
GDRIVE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY
GDRIVE_OAUTH_PATH=credentials/gcp-oauth.keys.json
GDRIVE_TOKEN_STORAGE_PATH=credentials/.gdrive-mcp-tokens.json
GDRIVE_TOKEN_AUDIT_LOG_PATH=logs/gdrive-mcp-audit.log

# Performance
REDIS_URL=$REDIS_URL
CACHE_ENABLED=true
CACHE_TTL=300

# Logging
NODE_ENV=$ENV_TYPE
LOG_LEVEL=$LOG_LEVEL
LOG_CONSOLE_ENABLED=true
LOG_FILE_ENABLED=true

# Token Management
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000
GDRIVE_TOKEN_MAX_RETRIES=3
ENVEOF

echo "Configuration generated successfully in .env"
echo "Please review and modify as needed"
EOF

chmod +x generate_env.sh
```

## Troubleshooting Environment Variables

### Issue: "Invalid encryption key" Error

**Symptoms:**
- Token encryption/decryption failures
- "Invalid key length" errors
- Authentication failures

**Solutions:**
```bash
# Check encryption key length
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c
# Must output exactly: 32

# Regenerate if invalid
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" > .env.new
grep -v GDRIVE_TOKEN_ENCRYPTION_KEY .env >> .env.new
mv .env.new .env

# Remove old encrypted tokens
rm -f credentials/.gdrive-mcp-tokens.json

# Re-authenticate
./scripts/auth.sh
```

### Issue: "Environment variables not loaded"

**Symptoms:**
- Default values being used instead of configured values
- Configuration not taking effect
- Missing environment variables

**Solutions:**
```bash
# Check if .env file exists and is readable
ls -la .env
cat .env | head -5

# Test environment loading
node -e "require('dotenv').config(); console.log(Object.keys(process.env).filter(k => k.startsWith('GDRIVE')))"

# Check for syntax errors in .env
grep -n "=" .env | grep -v "^#"

# Validate with dotenv
npm install --save-dev dotenv
node -e "console.log(require('dotenv').config())"
```

### Issue: "Permission denied" for log files

**Symptoms:**
- Cannot write to log files
- Log directory creation failures
- File permission errors

**Solutions:**
```bash
# Check and fix directory permissions
mkdir -p logs
chmod 755 logs

# Check log file permissions
ls -la logs/

# Fix log file permissions
chmod 644 logs/*.log 2>/dev/null || true

# Ensure correct ownership
sudo chown -R $(whoami):$(whoami) logs/

# Test log writing
echo "Test log entry" >> logs/test.log
rm logs/test.log
```

### Issue: "Redis connection failures"

**Symptoms:**
- Cache not working
- Redis connection errors
- Performance degradation

**Solutions:**
```bash
# Test Redis connection
redis-cli -u "$REDIS_URL" ping

# Check Redis URL format
echo "Redis URL: $REDIS_URL"
# Should be: redis://[username:password@]host:port[/database]

# Test with different Redis configurations
REDIS_URL=redis://localhost:6379 node -e "console.log('Testing Redis connection...')"

# Disable cache if Redis unavailable
echo "CACHE_ENABLED=false" >> .env
```

## Security Best Practices

### Environment Variable Security

```bash
# Set secure file permissions
chmod 600 .env*

# Never commit .env files to version control
echo ".env*" >> .gitignore

# Use different encryption keys for different environments
# Development
openssl rand -base64 32 > .encryption_key_dev

# Production  
openssl rand -base64 32 > .encryption_key_prod

# Load environment-specific keys
if [ "$NODE_ENV" = "production" ]; then
    export GDRIVE_TOKEN_ENCRYPTION_KEY=$(cat .encryption_key_prod)
else
    export GDRIVE_TOKEN_ENCRYPTION_KEY=$(cat .encryption_key_dev)
fi
```

### Regular Security Maintenance

```bash
# Create security audit script
cat > security_audit.sh << 'EOF'
#!/bin/bash

echo "Security Audit - $(date)"
echo "========================"

# Check file permissions
echo "File Permissions:"
ls -la .env* 2>/dev/null | awk '{print $1, $9}'
ls -la credentials/ | awk '{print $1, $9}'

# Check for secrets in logs
echo "\nChecking for secrets in logs:"
grep -i "token\|key\|password" logs/*.log 2>/dev/null | head -5 || echo "No secrets found in logs"

# Check environment variable exposure
echo "\nEnvironment Variable Exposure Check:"
ps aux | grep -v grep | grep -E "(GDRIVE_TOKEN|ENCRYPTION)" || echo "No exposed secrets in process list"

# Audit encryption key age
echo "\nEncryption Key Audit:"
if [ -f ".env" ]; then
    key_line=$(grep GDRIVE_TOKEN_ENCRYPTION_KEY .env)
    echo "Current key set: $(stat -f "%Sm" .env 2>/dev/null || stat -c "%y" .env 2>/dev/null)"
fi

echo "\nAudit complete"
EOF

chmod +x security_audit.sh
./security_audit.sh
```

## Performance Tuning Guide

### Environment-Based Performance Optimization

```bash
# High-performance configuration
cat > .env.high_performance << 'EOF'
# High Performance Configuration
GOOGLE_API_MAX_CONCURRENT=20
GOOGLE_API_RATE_LIMIT=15
CACHE_TTL=900
REDIS_CONNECT_TIMEOUT=2000
REDIS_COMMAND_TIMEOUT=1000
PERFORMANCE_STATS_INTERVAL=10000
EOF

# Memory-optimized configuration
cat > .env.memory_optimized << 'EOF'
# Memory Optimized Configuration
LOG_LEVEL=error
LOG_FILE_MAX_SIZE=1048576
LOG_FILE_MAX_FILES=2
CACHE_COMPRESSION=true
PERFORMANCE_MONITORING=false
REQUEST_RESPONSE_LOGGING=false
EOF

# Merge with main configuration as needed
```

## Next Steps

After environment configuration:
1. **Test all configurations** with your specific setup
2. **Monitor performance** with different settings
3. **Set up alerts** for configuration issues
4. **Document custom configurations** for your team
5. **Regular security audits** of environment variables

---

**Environment Variables Setup Complete!** ⚙️

Your Google Drive MCP Server is now configured with comprehensive environment variables for security, performance, and monitoring across all deployment scenarios.