# Docker Setup Guide for Google Drive MCP Server

## Overview

This guide provides comprehensive instructions for containerizing and running the Google Drive MCP Server using Docker. The containerized approach ensures consistent environments and simplifies deployment.

## Docker Configuration

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create directories for credentials and data
RUN mkdir -p /credentials /data

# Environment variables
ENV NODE_ENV=production \
    GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json \
    GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run as non-root user
RUN useradd -m -u 1001 mcp-user && \
    chown -R mcp-user:mcp-user /app /credentials /data

USER mcp-user

# Expose stdio
EXPOSE 3000

# Run the MCP server
CMD ["node", "dist/index.js"]
```

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  gdrive-mcp:
    build:
      context: .
      dockerfile: Dockerfile
    image: gdrive-mcp-server:latest
    container_name: gdrive-mcp-server
    volumes:
      # Mount credentials directory
      - ${HOME}/.gdrive:/credentials:ro
      # Optional: Mount local directory for file operations
      - ./data:/data
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json
      - GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
    restart: unless-stopped
    stdin_open: true
    tty: true
    networks:
      - mcp-network

  # Optional: Redis for caching (future enhancement)
  redis:
    image: redis:7-alpine
    container_name: gdrive-mcp-redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - mcp-network
    profiles:
      - with-cache

networks:
  mcp-network:
    driver: bridge

volumes:
  redis-data:
```

## Building and Running

### 1. Build the Docker Image

```bash
# Build the image
docker build -t gdrive-mcp-server:latest .

# Or with Docker Compose
docker-compose build
```

### 2. Initial Authentication

Before running the server, you need to authenticate with Google:

```bash
# Create credentials directory
mkdir -p ~/.gdrive

# Copy your OAuth keys
cp /path/to/gcp-oauth.keys.json ~/.gdrive/

# Run authentication
docker run -it --rm \
  -v ~/.gdrive:/credentials \
  -e GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json \
  -e GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json \
  -p 3000:3000 \
  gdrive-mcp-server \
  node dist/index.js auth
```

### 3. Running the Server

#### Using Docker Run

```bash
docker run -i --rm \
  --name gdrive-mcp \
  -v ~/.gdrive:/credentials:ro \
  gdrive-mcp-server
```

#### Using Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f gdrive-mcp

# Stop the service
docker-compose down
```

## Claude Desktop Integration

### Configuration for Docker

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--init",
        "-v",
        "${HOME}/.gdrive:/credentials:ro",
        "gdrive-mcp-server:latest"
      ]
    }
  }
}
```

### Using Docker Compose

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker-compose",
      "args": [
        "-f",
        "/path/to/gdrive/docker-compose.yml",
        "run",
        "--rm",
        "gdrive-mcp"
      ]
    }
  }
}
```

## Advanced Configuration

### Multi-Stage Build (Production)

For smaller production images:

```dockerfile
# Build stage
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -S -u 1001 -G mcp mcp

USER mcp

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

### Environment Variables

Complete list of supported environment variables:

```bash
# Authentication
GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json
GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json

# API Configuration (planned)
GOOGLE_API_BATCH_SIZE=100
GOOGLE_API_TIMEOUT=30000
GOOGLE_API_RETRY_COUNT=3

# Caching (planned)
REDIS_URL=redis://redis:6379
CACHE_TTL=3600
ENABLE_CACHE=true

# Logging
LOG_LEVEL=info  # debug, info, warn, error
LOG_FORMAT=json # json, pretty

# Performance
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT=60000
```

### Docker Secrets (Production)

For production deployments, use Docker secrets:

```yaml
version: '3.8'

services:
  gdrive-mcp:
    image: gdrive-mcp-server:latest
    secrets:
      - gdrive_credentials
      - oauth_keys
    environment:
      - GDRIVE_CREDENTIALS_PATH=/run/secrets/gdrive_credentials
      - GDRIVE_OAUTH_PATH=/run/secrets/oauth_keys

secrets:
  gdrive_credentials:
    file: ./secrets/.gdrive-server-credentials.json
  oauth_keys:
    file: ./secrets/gcp-oauth.keys.json
```

## Debugging

### Interactive Shell

```bash
# Run with shell access
docker run -it --rm \
  -v ~/.gdrive:/credentials:ro \
  --entrypoint /bin/sh \
  gdrive-mcp-server

# Inside container
node dist/index.js --version
```

### Debug Mode

```bash
# Run with debug logging
docker run -i --rm \
  -v ~/.gdrive:/credentials:ro \
  -e LOG_LEVEL=debug \
  -e NODE_ENV=development \
  gdrive-mcp-server
```

### Container Logs

```bash
# View logs
docker logs gdrive-mcp

# Follow logs
docker logs -f gdrive-mcp

# Last 100 lines
docker logs --tail 100 gdrive-mcp
```

## Performance Optimization

### 1. Layer Caching

Order Dockerfile commands to maximize cache usage:

```dockerfile
# Less frequently changed
COPY package*.json ./
RUN npm ci

# More frequently changed
COPY . .
RUN npm run build
```

### 2. Multi-Stage Builds

Reduce final image size by excluding build dependencies.

### 3. Alpine Linux

Use Alpine-based images for smaller size:
- `node:20-alpine` instead of `node:20`
- Install only required packages

### 4. Resource Limits

Set appropriate resource limits:

```yaml
services:
  gdrive-mcp:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Security Best Practices

### 1. Non-Root User

Always run as non-root user in production.

### 2. Read-Only Filesystem

```yaml
services:
  gdrive-mcp:
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - ~/.gdrive:/credentials:ro
```

### 3. Security Scanning

```bash
# Scan for vulnerabilities
docker scan gdrive-mcp-server:latest

# Use Trivy
trivy image gdrive-mcp-server:latest
```

### 4. Minimal Base Image

Use distroless or scratch images when possible.

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Fix credential permissions
   chmod 600 ~/.gdrive/*
   ```

2. **Cannot Connect to Docker**
   ```bash
   # Ensure Docker is running
   docker info
   ```

3. **Authentication Failures**
   ```bash
   # Re-run authentication
   docker run -it --rm -v ~/.gdrive:/credentials \
     gdrive-mcp-server node dist/index.js auth
   ```

### Health Checks

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' gdrive-mcp

# Manual health check
docker exec gdrive-mcp node -e "console.log('healthy')"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          push: true
          tags: user/gdrive-mcp:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Monitoring

### Prometheus Metrics (Planned)

```yaml
services:
  gdrive-mcp:
    ports:
      - "9090:9090"  # Metrics endpoint
```

### Log Aggregation

Use Fluentd or Logstash for centralized logging:

```yaml
logging:
  driver: fluentd
  options:
    fluentd-address: localhost:24224
    tag: gdrive-mcp
```