# Docker Deployment Guide

This guide covers containerized deployment of the Google Drive MCP Server using Docker and Docker Compose, including Redis caching, production configuration, and monitoring.

## Prerequisites

Before starting Docker deployment:
- **[Initial Setup](./01-initial-setup.md)** completed
- **[Authentication Flow](./02-authentication-flow.md)** completed on host machine
- **Docker** and **Docker Compose** installed
- **Host authentication** completed (required before containerization)

## Understanding Docker Architecture

### Container Architecture

```
Docker Environment:

Host Machine                     Docker Network (mcp-network)
├── credentials/              │
│   ├── OAuth keys          │     ┌──────────────────────┐
│   └── Encrypted tokens    │     │   gdrive-mcp-server    │
├── .env                    ─────▶ │   Node.js + MCP Server  │
├── logs/                   │     │   Port: stdio          │
└── data/                   │     │   Volumes: /credentials │
                              │     │          /logs        │
    Auth Script (./scripts/auth.sh)    │          /data        │
    │                             │     └──────────────────────┘
    └───── Browser OAuth Flow     │              │
                              │     ┌──────────────────────┐
                              │     │   gdrive-mcp-redis     │
                              │     │   Redis 7-alpine       │
                              │     │   Port: 6379           │
                              │     │   Volume: redis_data   │
                              │     └──────────────────────┘
```

### Key Docker Components

- **MCP Server Container**: Main application with Node.js runtime
- **Redis Container**: High-performance caching layer
- **Shared Network**: Secure inter-container communication
- **Volume Mounts**: Persistent data and credential access
- **Health Checks**: Container health monitoring
- **Environment Configuration**: Secure environment variable management

## Step 1: Pre-Docker Authentication

### 1.1 Host Authentication (Critical)

**Important**: Authentication MUST be completed on the host machine before Docker deployment because OAuth requires browser access.

```bash
# Navigate to project directory
cd /path/to/gdrive-mcp-server

# Verify all prerequisites
ls -la credentials/gcp-oauth.keys.json  # OAuth keys
ls -la .env                             # Environment variables
ls -la dist/index.js                    # Built application

# Run authentication on host
./scripts/auth.sh

# Verify authentication success
ls -la credentials/.gdrive-mcp-tokens.json
node ./dist/index.js health
```

### 1.2 Verify Authentication Files

```bash
# Check all required files exist
echo "Checking authentication files..."
ls -la credentials/ | grep -E "(gcp-oauth|gdrive-mcp-tokens)"

# Verify file permissions
stat -c "%a %n" credentials/gcp-oauth.keys.json        # Should be 600
stat -c "%a %n" credentials/.gdrive-mcp-tokens.json   # Should be 600

# Test token validity
node ./dist/index.js health | jq '.status'
# Should output: "HEALTHY"
```

### 1.3 Prepare Docker Environment

```bash
# Create required directories for Docker volumes
mkdir -p data logs

# Set appropriate permissions
chmod 755 data logs
chmod 700 credentials

# Verify .env file contains required variables
grep -E "GDRIVE_TOKEN_ENCRYPTION_KEY" .env
# Should show your encryption key
```

## Step 2: Docker Image Building

### 2.1 Build Docker Image

```bash
# Build the Docker image
docker build -t gdrive-mcp-server .

# Or build with Docker Compose (recommended)
docker-compose build --no-cache gdrive-mcp

# Verify image was built
docker images | grep gdrive-mcp-server
```

### 2.2 Understanding the Dockerfile

The multi-stage Dockerfile includes:

```dockerfile
# Key features of our Dockerfile:
# • Node.js 20 slim base image
# • System dependencies for native modules
# • Layer caching optimization
# • Security hardening
# • Health check integration
# • Proper permissions
```

### 2.3 Test Image Locally

```bash
# Test the built image
docker run --rm -it \
  -v $(pwd)/credentials:/credentials:ro \
  -v $(pwd)/.env:/app/.env:ro \
  gdrive-mcp-server node dist/index.js health

# Expected output: Healthy status JSON
```

## Step 3: Docker Compose Deployment

### 3.1 Understanding docker-compose.yml

The Docker Compose configuration includes:

```yaml
# Key services:
services:
  gdrive-mcp:         # Main MCP server
    - Volume mounts for credentials, data, logs
    - Environment variables from .env
    - Health checks every 5 minutes
    - Restart policy: unless-stopped
    - Dependencies: redis
  
  redis:              # Caching layer
    - Redis 7-alpine image
    - Persistent data volume
    - Health checks every 30 seconds
    - Network: mcp-network

volumes:
  redis_data:         # Persistent Redis storage

networks:
  mcp-network:        # Isolated container network
```

### 3.2 Deploy with Docker Compose

```bash
# Start all services in detached mode
docker-compose up -d

# Verify containers are running
docker-compose ps

# Expected output:
NAME                IMAGE               STATUS
gdrive-mcp-server   gdrive-mcp-server   Up (healthy)
gdrive-mcp-redis    redis:7-alpine      Up (healthy)
```

### 3.3 Verify Deployment Success

```bash
# Check container health
docker-compose exec gdrive-mcp node dist/index.js health

# Check logs
docker-compose logs gdrive-mcp
docker-compose logs redis

# Verify Redis connection
docker-compose exec gdrive-mcp redis-cli -h redis ping
# Should output: PONG

# Test MCP server functionality
echo '{"method": "tools/list"}' | docker-compose exec -T gdrive-mcp node dist/index.js
```

## Step 4: Redis Configuration

### 4.1 Redis Cache Settings

The Redis cache enhances performance:

```bash
# View Redis configuration
docker-compose exec redis redis-cli CONFIG GET '*'

# Monitor Redis usage
docker-compose exec redis redis-cli MONITOR

# Check cache statistics
docker-compose exec redis redis-cli INFO stats
```

### 4.2 Cache Performance Monitoring

```bash
# Monitor cache hit/miss ratios
docker-compose logs gdrive-mcp | grep -i cache

# Check Redis memory usage
docker-compose exec redis redis-cli INFO memory

# View cached keys
docker-compose exec redis redis-cli KEYS '*'
```

### 4.3 Cache Management

```bash
# Clear all cache (if needed)
docker-compose exec redis redis-cli FLUSHALL

# Clear specific cache patterns
docker-compose exec redis redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 "search:*"

# Monitor cache expiration
docker-compose exec redis redis-cli --latency-history -i 1
```

## Step 5: Production Configuration

### 5.1 Production Environment Setup

```bash
# Create production environment file
cp .env .env.production

# Edit production settings
cat >> .env.production << EOF
# Production settings
NODE_ENV=production
LOG_LEVEL=error
REDIS_URL=redis://redis:6379

# Performance tuning
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000    # 30 minutes
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000   # 10 minutes
GDRIVE_TOKEN_MAX_RETRIES=3

# Security
GDRIVE_TOKEN_ENCRYPTION_KEY=$GDRIVE_TOKEN_ENCRYPTION_KEY
EOF

# Deploy with production config
docker-compose --env-file .env.production up -d
```

### 5.2 Resource Limits (Production)

```yaml
# Add to docker-compose.yml for production
services:
  gdrive-mcp:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5.3 Production Health Monitoring

```bash
# Set up health check monitoring
watch -n 300 "docker-compose exec gdrive-mcp node dist/index.js health"

# Monitor container statistics
docker stats gdrive-mcp-server gdrive-mcp-redis

# Set up log rotation
docker-compose exec gdrive-mcp logrotate /etc/logrotate.conf
```

## Step 6: Claude Desktop Integration

### 6.1 Docker Configuration for Claude Desktop

**Method 1: Direct Docker Run (Simple)**

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--init",
        "-v", "/absolute/path/to/credentials:/credentials:ro",
        "-v", "/absolute/path/to/data:/data",
        "-v", "/absolute/path/to/logs:/app/logs",
        "--env-file", "/absolute/path/to/.env",
        "gdrive-mcp-server"
      ]
    }
  }
}
```

**Method 2: Docker Compose Exec (Recommended)**

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "exec", "-i", "gdrive-mcp-server",
        "node", "dist/index.js"
      ]
    }
  }
}
```

### 6.2 Verify Claude Desktop Integration

```bash
# Ensure Docker Compose is running
docker-compose ps

# Test the exact command Claude Desktop will use
docker exec -i gdrive-mcp-server node dist/index.js << 'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
EOF

# Should return list of available tools
```

### 6.3 Claude Desktop Troubleshooting

```bash
# Common issues and solutions:

# Issue: Container not found
docker-compose ps  # Ensure containers are running
docker-compose up -d  # Start if needed

# Issue: Permission denied
ls -la credentials/  # Check file permissions
docker-compose exec gdrive-mcp whoami  # Check container user

# Issue: Environment variables not loaded
docker-compose exec gdrive-mcp env | grep GDRIVE
```

## Step 7: Monitoring and Maintenance

### 7.1 Container Health Monitoring

```bash
# View health check status
docker inspect gdrive-mcp-server | jq '.[0].State.Health'

# Monitor health checks in real-time
docker events --filter container=gdrive-mcp-server --filter event=health_status

# Manual health check
docker-compose exec gdrive-mcp node dist/index.js health
```

### 7.2 Log Management

```bash
# View live logs
docker-compose logs -f gdrive-mcp
docker-compose logs -f redis

# View specific log types
docker-compose logs gdrive-mcp | grep ERROR
docker-compose logs gdrive-mcp | grep "Performance stats"

# Log file locations (mounted volumes)
tail -f logs/combined.log
tail -f logs/error.log
tail -f logs/gdrive-mcp-audit.log
```

### 7.3 Performance Monitoring

```bash
# Container resource usage
docker stats gdrive-mcp-server gdrive-mcp-redis

# Application performance metrics
docker-compose logs gdrive-mcp | grep "Performance stats" | tail -5

# Redis performance
docker-compose exec redis redis-cli INFO stats
docker-compose exec redis redis-cli SLOWLOG GET 10
```

### 7.4 Maintenance Tasks

```bash
# Update containers
docker-compose pull
docker-compose build --no-cache
docker-compose up -d

# Backup data
tar -czf backup-$(date +%Y%m%d).tar.gz credentials/ data/ logs/ .env

# Clean up unused resources
docker system prune -f
docker volume prune -f

# Restart services
docker-compose restart gdrive-mcp
docker-compose restart redis
```

## Troubleshooting Docker Issues

### Issue: "Authentication not found" in Container

**Symptoms:**
- Container starts but can't find authentication tokens
- Health check fails with authentication errors

**Solutions:**
```bash
# Verify authentication was done on host
ls -la credentials/.gdrive-mcp-tokens.json

# Check volume mounts
docker-compose exec gdrive-mcp ls -la /credentials/

# Verify file permissions
docker-compose exec gdrive-mcp stat /credentials/.gdrive-mcp-tokens.json

# If missing, re-run authentication on host
./scripts/auth.sh
docker-compose restart gdrive-mcp
```

### Issue: "Redis connection failed"

**Symptoms:**
- MCP server starts but Redis errors in logs
- Cache functionality not working

**Solutions:**
```bash
# Check Redis container status
docker-compose ps redis

# Test Redis connectivity
docker-compose exec gdrive-mcp redis-cli -h redis ping

# Check Redis logs
docker-compose logs redis

# Restart Redis if needed
docker-compose restart redis

# Verify network connectivity
docker network ls
docker network inspect gdrive_mcp-network
```

### Issue: "Container exits immediately"

**Symptoms:**
- Container starts then exits with code 0 or 1
- No stdio interaction possible

**Solutions:**
```bash
# Check container logs
docker-compose logs gdrive-mcp

# Test container manually
docker run -it --rm \
  -v $(pwd)/credentials:/credentials:ro \
  -v $(pwd)/.env:/app/.env:ro \
  gdrive-mcp-server /bin/bash

# Check if stdio transport is blocking
docker-compose exec gdrive-mcp ps aux

# Ensure proper Docker Compose stdin/tty settings
# In docker-compose.yml:
stdin_open: true
tty: true
```

### Issue: "Health check failing"

**Symptoms:**
- Container shows as unhealthy
- Health check command fails

**Solutions:**
```bash
# Run health check manually
docker-compose exec gdrive-mcp node dist/index.js health

# Check health check configuration
docker inspect gdrive-mcp-server | jq '.[0].Config.Healthcheck'

# Verify health check dependencies
docker-compose exec gdrive-mcp ls -la dist/index.js
docker-compose exec gdrive-mcp node --version

# Check authentication status
docker-compose exec gdrive-mcp node dist/index.js health | jq '.checks.tokenStatus'
```

### Issue: "Volume mount permissions"

**Symptoms:**
- Permission denied errors in container
- Cannot read/write mounted files

**Solutions:**
```bash
# Check host file permissions
ls -la credentials/ logs/ data/

# Check container user
docker-compose exec gdrive-mcp id

# Fix permissions on host
sudo chown -R $(id -u):$(id -g) credentials/ logs/ data/
chmod 700 credentials/
chmod 755 logs/ data/

# Restart container after permission fix
docker-compose restart gdrive-mcp
```

### Issue: "Environment variables not loaded"

**Symptoms:**
- Missing encryption key errors
- Configuration not applied

**Solutions:**
```bash
# Check .env file exists and is readable
ls -la .env
cat .env | grep GDRIVE_TOKEN_ENCRYPTION_KEY

# Verify env-file in docker-compose.yml
grep -A 5 "env_file" docker-compose.yml

# Check environment in container
docker-compose exec gdrive-mcp env | grep GDRIVE

# Recreate container with environment
docker-compose down
docker-compose up -d
```

## Advanced Docker Configurations

### Multi-Environment Setup

```bash
# Development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Testing environment
docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d
```

### Custom Network Configuration

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  gdrive-mcp:
    networks:
      - custom-network
      - external-network

networks:
  custom-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
  external-network:
    external: true
```

### Docker Swarm Deployment

```bash
# Initialize Docker Swarm
docker swarm init

# Deploy as stack
docker stack deploy -c docker-compose.yml gdrive-mcp

# Monitor stack
docker stack services gdrive-mcp
docker stack ps gdrive-mcp
```

## Security Best Practices

### Container Security
- **Run as non-root user** (configured in Dockerfile)
- **Read-only credential mounts** (`ro` flag)
- **Secure environment variables** (never log sensitive values)
- **Network isolation** (custom Docker network)
- **Resource limits** (prevent resource exhaustion)

### Data Security
- **Encrypted token storage** (AES-256-GCM)
- **Secure file permissions** (600 for sensitive files)
- **Volume encryption** (if required by organization)
- **Regular backups** (encrypted backups of credentials)
- **Audit logging** (comprehensive authentication events)

### Operational Security
- **Health monitoring** (automated health checks)
- **Log management** (structured logging with rotation)
- **Update management** (regular container updates)
- **Access control** (limit who can manage Docker deployment)
- **Network security** (firewall rules, VPN if needed)

## Next Steps

After successful Docker deployment:
1. **[Claude Desktop Integration](./05-claude-desktop-integration.md)** - Connect Claude to Docker
2. **[Environment Variables Setup](./06-environment-variables.md)** - Fine-tune configuration
3. **Production monitoring and alerting setup**
4. **Backup and recovery procedures**

---

**Docker Deployment Complete!** 🐳

Your Google Drive MCP Server is now running in a containerized environment with Redis caching, health monitoring, and production-ready configuration.