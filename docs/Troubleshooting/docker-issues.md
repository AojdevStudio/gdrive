# Docker Issues

This guide covers Docker-specific problems with the Google Drive MCP Server, including container startup issues, volume mounting problems, and environment configuration.

## 🔍 Quick Diagnosis

### Check Docker Status
```bash
# Check if containers are running
docker-compose ps

# View container logs
docker-compose logs gdrive-mcp
docker-compose logs redis

# Check container health
docker-compose exec gdrive-mcp node dist/index.js health

# Inspect container configuration
docker inspect gdrive-mcp-server
```

### Check Volume Mounts
```bash
# Verify volume mounts
docker-compose exec gdrive-mcp ls -la /credentials/
docker-compose exec gdrive-mcp ls -la /app/logs/

# Check file permissions
ls -la credentials/
ls -la logs/
```

## 🚨 Common Docker Issues

### 1. Container Fails to Start

**Symptoms:**
- Container exits immediately
- Error: `container exited with code 1`
- Container restarts continuously
- Docker logs show startup errors

**Common Causes & Solutions:**

#### Missing Authentication
```bash
# Check if authentication was performed on host
ls -la credentials/.gdrive-mcp-tokens.json

# If missing, authenticate on host (not in container)
./scripts/auth.sh

# Verify authentication file exists
ls -la credentials/
```

#### Missing Environment Variables
```bash
# Check .env file exists and contains required variables
cat .env
# Should contain GDRIVE_TOKEN_ENCRYPTION_KEY

# If missing, create .env file
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)" > .env
echo "REDIS_URL=redis://redis:6379" >> .env
echo "LOG_LEVEL=info" >> .env
```

#### Permission Issues
```bash
# Fix file permissions
chmod 755 credentials/
chmod 644 credentials/gcp-oauth.keys.json
chmod 600 credentials/.gdrive-mcp-tokens.json  # If exists

# Fix log directory permissions
mkdir -p logs
chmod 755 logs/
```

#### Missing OAuth Configuration
```bash
# Verify OAuth keys file exists
ls -la credentials/gcp-oauth.keys.json

# If missing, copy from your download location
cp /path/to/gcp-oauth.keys.json credentials/
```

### 2. Volume Mount Problems

**Symptoms:**
- Files not visible inside container
- Changes not persisting
- Permission denied errors
- Container can't access credentials

**Solutions:**

#### Check Docker Compose Configuration
```yaml
# Verify docker-compose.yml has correct volume mounts
services:
  gdrive-mcp:
    volumes:
      - ./credentials:/credentials:ro  # Read-only for security
      - ./logs:/app/logs              # Read-write for logs
      - ./data:/data                  # Optional data directory
```

#### Fix Volume Mount Permissions
```bash
# Create required directories with correct permissions
mkdir -p credentials logs data
chmod 755 credentials logs data

# For SELinux systems (RHEL/CentOS/Fedora)
sudo chcon -R -t container_file_t credentials/ logs/ data/
```

#### Absolute Path Issues
```bash
# Use absolute paths in volume mounts if having issues
# Edit docker-compose.yml:
services:
  gdrive-mcp:
    volumes:
      - "/absolute/path/to/credentials:/credentials:ro"
      - "/absolute/path/to/logs:/app/logs"
```

### 3. Network Connectivity Issues

**Symptoms:**
- Cannot connect to Google APIs
- Redis connection failures
- Container isolation problems
- OAuth authentication fails

**Solutions:**

#### Check Docker Network
```bash
# List Docker networks
docker network ls

# Inspect the network
docker network inspect gdrive_default

# Test network connectivity from container
docker-compose exec gdrive-mcp ping redis
docker-compose exec gdrive-mcp nslookup google.com
```

#### Configure Network Settings
```yaml
# Add to docker-compose.yml if needed
services:
  gdrive-mcp:
    networks:
      - gdrive-network
    dns:
      - 8.8.8.8
      - 8.8.4.4
      
networks:
  gdrive-network:
    driver: bridge
```

#### Proxy Configuration
```bash
# If behind corporate proxy, add to .env
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1,redis
```

### 4. Redis Connection Problems

**Symptoms:**
- Error: `Redis connection failed`
- Caching not working
- Performance degradation
- Container health checks failing

**Solutions:**

#### Check Redis Container
```bash
# Verify Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test Redis connectivity
docker-compose exec redis redis-cli ping
# Should return: PONG
```

#### Fix Redis Configuration
```bash
# Verify Redis URL in environment
echo $REDIS_URL
# Should be: redis://redis:6379 (for Docker Compose)

# Test connection from main container
docker-compose exec gdrive-mcp sh -c 'nc -zv redis 6379'
```

#### Redis Persistence Issues
```yaml
# Add Redis data persistence to docker-compose.yml
services:
  redis:
    volumes:
      - redis-data:/data
      
volumes:
  redis-data:
    driver: local
```

### 5. Environment Configuration Issues

**Symptoms:**
- Environment variables not loaded
- Configuration inconsistencies
- Different behavior between local and Docker
- Missing or incorrect paths

**Solutions:**

#### Verify Environment File
```bash
# Check .env file contents
cat .env

# Required variables:
# GDRIVE_TOKEN_ENCRYPTION_KEY=<base64-key>
# REDIS_URL=redis://redis:6379
# LOG_LEVEL=info
```

#### Debug Environment Variables
```bash
# Check environment variables inside container
docker-compose exec gdrive-mcp env | grep GDRIVE
docker-compose exec gdrive-mcp env | grep REDIS

# Verify encryption key length
docker-compose exec gdrive-mcp sh -c 'echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c'
# Should output: 32
```

#### Fix Path Configurations
```bash
# Docker-specific paths (automatically set in docker-compose.yml)
GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log
```

## ⚙️ Advanced Docker Configuration

### 1. Multi-Stage Build Optimization

```dockerfile
# Optimize Dockerfile for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist/ ./dist/
COPY package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Set proper permissions
RUN chown -R mcp:nodejs /app
USER mcp

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 2. Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  gdrive-mcp:
    build:
      context: .
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    volumes:
      - ./credentials:/credentials:ro
      - ./logs:/app/logs
      - ./data:/data
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
    env_file:
      - .env
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'

  # Optional: Redis monitoring
  redis-commander:
    image: rediscommander/redis-commander:latest
    restart: unless-stopped
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis
    profiles:
      - monitoring

volumes:
  redis-data:
    driver: local

networks:
  default:
    name: gdrive-mcp-network
```

### 3. Development Docker Setup

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  gdrive-mcp:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules  # Prevent host node_modules from overriding
      - ./credentials:/credentials:ro
      - ./logs:/app/logs
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    env_file:
      - .env.dev
    command: npm run watch
    stdin_open: true
    tty: true
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"  # Expose for local development tools
```

## 🔧 Diagnostic Tools

### Docker Health Check Script

```bash
#!/bin/bash
# save as docker-health-check.sh

echo "Docker Health Check - Google Drive MCP Server"
echo "============================================="

# Check Docker and Docker Compose
echo "1. Docker Installation:"
if command -v docker &> /dev/null; then
    echo "✅ Docker: $(docker --version)"
else
    echo "❌ Docker not installed"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose: $(docker-compose --version)"
elif docker compose version &> /dev/null; then
    echo "✅ Docker Compose: $(docker compose version)"
else
    echo "❌ Docker Compose not available"
    exit 1
fi

# Check container status
echo "\n2. Container Status:"
docker-compose ps

# Check container health
echo "\n3. Container Health:"
if docker-compose exec -T gdrive-mcp node dist/index.js health &> /dev/null; then
    echo "✅ Main container: HEALTHY"
else
    echo "❌ Main container: UNHEALTHY"
fi

if docker-compose exec -T redis redis-cli ping &> /dev/null; then
    echo "✅ Redis: HEALTHY"
else
    echo "❌ Redis: UNHEALTHY"
fi

# Check volume mounts
echo "\n4. Volume Mounts:"
echo "Credentials directory:"
docker-compose exec -T gdrive-mcp ls -la /credentials/ 2>/dev/null || echo "❌ Cannot access credentials"

echo "\nLogs directory:"
docker-compose exec -T gdrive-mcp ls -la /app/logs/ 2>/dev/null || echo "❌ Cannot access logs"

# Check network connectivity
echo "\n5. Network Connectivity:"
if docker-compose exec -T gdrive-mcp ping -c 1 redis &> /dev/null; then
    echo "✅ Redis connectivity: OK"
else
    echo "❌ Redis connectivity: FAILED"
fi

if docker-compose exec -T gdrive-mcp nslookup google.com &> /dev/null; then
    echo "✅ External connectivity: OK"
else
    echo "❌ External connectivity: FAILED"
fi

# Check environment variables
echo "\n6. Environment Variables:"
ENCRYPTION_KEY=$(docker-compose exec -T gdrive-mcp sh -c 'echo ${GDRIVE_TOKEN_ENCRYPTION_KEY:-NOT_SET}')
if [[ "$ENCRYPTION_KEY" != "NOT_SET" ]] && [[ ${#ENCRYPTION_KEY} -gt 10 ]]; then
    echo "✅ Encryption key: SET"
else
    echo "❌ Encryption key: NOT_SET or invalid"
fi

REDIS_URL=$(docker-compose exec -T gdrive-mcp sh -c 'echo ${REDIS_URL:-NOT_SET}')
if [[ "$REDIS_URL" != "NOT_SET" ]]; then
    echo "✅ Redis URL: $REDIS_URL"
else
    echo "❌ Redis URL: NOT_SET"
fi

echo "\nHealth check completed."
```

### Container Debugging Script

```bash
#!/bin/bash
# save as debug-container.sh

echo "Container Debugging Tool"
echo "======================="

# Function to run commands in container
run_in_container() {
    echo "\n>>> $1"
    docker-compose exec gdrive-mcp sh -c "$1" 2>&1
}

# System information
echo "1. System Information:"
run_in_container "uname -a"
run_in_container "node --version"
run_in_container "npm --version"

# File system
echo "\n2. File System:"
run_in_container "ls -la /app/"
run_in_container "ls -la /credentials/"
run_in_container "ls -la /app/logs/"

# Process information
echo "\n3. Process Information:"
run_in_container "ps aux"

# Network information
echo "\n4. Network Information:"
run_in_container "cat /etc/resolv.conf"
run_in_container "netstat -tlnp"

# Environment variables
echo "\n5. Environment Variables:"
run_in_container "env | grep -E 'GDRIVE|REDIS|NODE|LOG' | sort"

# Application logs
echo "\n6. Recent Application Logs:"
run_in_container "tail -20 /app/logs/combined.log"

echo "\nDebugging completed."
```

### Performance Monitoring

```bash
#!/bin/bash
# save as monitor-docker-performance.sh

echo "Docker Performance Monitor"
echo "=========================="

# Container resource usage
echo "1. Resource Usage:"
docker stats --no-stream gdrive-mcp-server redis

# System resources
echo "\n2. Host System Resources:"
echo "Memory:"
free -h
echo "\nDisk:"
df -h
echo "\nCPU:"
top -bn1 | grep "Cpu(s)"

# Docker system info
echo "\n3. Docker System Info:"
docker system df

# Network performance
echo "\n4. Network Performance Test:"
time docker-compose exec gdrive-mcp ping -c 3 google.com

# Redis performance
echo "\n5. Redis Performance:"
docker-compose exec redis redis-cli info stats | grep -E "instantaneous|total"
```

## 🛡️ Prevention Strategies

### 1. Automated Health Monitoring

```bash
# Add to crontab for regular health checks
*/5 * * * * /path/to/docker-health-check.sh >> /path/to/docker-health.log 2>&1

# Alert on container failures
*/1 * * * * docker-compose ps | grep -q "Exit" && echo "Container failure detected" | mail -s "Docker Alert" admin@company.com
```

### 2. Container Backup Strategy

```bash
#!/bin/bash
# save as backup-docker-data.sh

echo "Backing up Docker data..."

# Backup credentials
tar -czf "backup/credentials-$(date +%Y%m%d).tar.gz" credentials/

# Backup logs
tar -czf "backup/logs-$(date +%Y%m%d).tar.gz" logs/

# Backup Redis data (if using named volume)
docker run --rm -v gdrive_redis-data:/data -v $(pwd)/backup:/backup alpine tar -czf /backup/redis-data-$(date +%Y%m%d).tar.gz -C /data .

echo "Backup completed."
```

### 3. Container Update Strategy

```bash
#!/bin/bash
# save as update-containers.sh

echo "Updating Docker containers..."

# Pull latest images
docker-compose pull

# Recreate containers with new images
docker-compose up -d --force-recreate

# Clean up old images
docker image prune -f

echo "Update completed."
```

## 🆘 Emergency Recovery

If Docker setup is completely broken:

### Complete Docker Reset
```bash
#!/bin/bash
echo "Emergency Docker Recovery"
echo "========================"

# Stop all containers
docker-compose down -v

# Remove containers and images
docker-compose rm -f
docker rmi $(docker images -q gdrive-mcp-server) 2>/dev/null || echo "No images to remove"

# Clean Docker system
docker system prune -af --volumes

# Verify critical files exist
if [[ ! -f "credentials/gcp-oauth.keys.json" ]]; then
    echo "❌ Missing OAuth configuration"
    echo "Copy gcp-oauth.keys.json to credentials/ directory"
    exit 1
fi

if [[ ! -f ".env" ]]; then
    echo "Creating .env file..."
    echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)" > .env
    echo "REDIS_URL=redis://redis:6379" >> .env
    echo "LOG_LEVEL=info" >> .env
fi

# Re-authenticate (on host)
echo "Re-authenticating..."
./scripts/auth.sh

# Rebuild and start
echo "Rebuilding containers..."
docker-compose build --no-cache
docker-compose up -d

# Wait for startup
sleep 10

# Verify recovery
echo "\nVerifying recovery..."
docker-compose ps
docker-compose exec gdrive-mcp node dist/index.js health

echo "\nRecovery completed."
```

### Restore from Backup
```bash
#!/bin/bash
# If you have backups available

echo "Restoring from backup..."

# Stop containers
docker-compose down

# Restore credentials
tar -xzf backup/credentials-latest.tar.gz

# Restore logs
tar -xzf backup/logs-latest.tar.gz

# Restore Redis data
docker run --rm -v gdrive_redis-data:/data -v $(pwd)/backup:/backup alpine sh -c "cd /data && tar -xzf /backup/redis-data-latest.tar.gz"

# Start containers
docker-compose up -d

echo "Restore completed."
```

---

For specific Docker-related error messages, see the [Error Messages Reference](./error-messages.md).