# Google Drive MCP Server Troubleshooting Guide

This directory contains comprehensive troubleshooting guides for the Google Drive MCP Server. Each guide focuses on specific issues and provides step-by-step diagnostic and resolution procedures.

## 📋 Available Guides

### 🔐 **Authentication Issues**
- [Authentication Problems](./authentication-problems.md)
  - OAuth 2.0 flow failures
  - Token refresh issues  
  - Invalid grant errors
  - Browser authentication problems

### ⚡ **Performance & Rate Limits**
- [API Rate Limits](./api-rate-limits.md)
  - Google API quota exceeded
  - Request throttling
  - Optimization strategies
  - Error handling patterns

### 🛡️ **Permission & Access**
- [Permission Errors](./permission-errors.md)
  - Insufficient permissions
  - Scope configuration issues
  - File access problems
  - Admin restrictions

### 🐳 **Docker & Deployment**
- [Docker Issues](./docker-issues.md)
  - Container startup problems
  - Volume mounting issues
  - Network connectivity
  - Environment configuration

### 📡 **Redis & Caching**
- [Redis Connection Problems](./redis-connection-problems.md)
  - Connection failures
  - Performance issues
  - Cache invalidation
  - Memory management

### 🚨 **Common Error Messages**
- [Error Messages Reference](./error-messages.md)
  - Complete error code reference
  - Diagnostic procedures
  - Step-by-step solutions
  - Prevention strategies

## 🎯 Quick Diagnostic Commands

### Health Check
```bash
# Check overall system health
node ./dist/index.js health

# Docker health check
docker-compose exec gdrive-mcp node dist/index.js health
```

### Log Analysis
```bash
# View recent logs
tail -f logs/combined.log

# Search for specific errors
grep -i "error" logs/combined.log | tail -20

# Check authentication events
grep "TOKEN_" logs/gdrive-mcp-audit.log
```

### Environment Validation
```bash
# Verify encryption key length
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c  # Should be 32

# Check file permissions
ls -la credentials/

# Test Redis connection
redis-cli ping
```

## 🆘 Emergency Recovery

If the server is completely non-functional:

1. **Check System Health**
   ```bash
   # Verify all services are running
   docker-compose ps
   
   # Check system resources
   docker stats
   ```

2. **Reset Authentication**
   ```bash
   # Clean up tokens
   rm credentials/.gdrive-mcp-tokens.json
   
   # Re-authenticate
   ./scripts/auth.sh
   ```

3. **Restart Services**
   ```bash
   # Full restart
   docker-compose down
   docker-compose up -d
   ```

4. **Verify Recovery**
   ```bash
   # Test basic functionality
   node ./dist/index.js health
   ```

## 🔍 Getting Help

If you can't resolve an issue:

1. **Gather Information**
   - Run diagnostic commands above
   - Collect relevant log files
   - Note your system configuration

2. **Check Documentation**
   - Review the specific troubleshooting guide
   - Check the main README.md
   - Look for similar issues in GitHub

3. **Report Issues**
   - Include diagnostic output
   - Describe reproduction steps
   - Provide system information

---

**Navigate to specific troubleshooting guides using the links above for detailed solutions.**