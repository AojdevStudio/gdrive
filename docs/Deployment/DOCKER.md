# Docker Deployment Guide

## Overview

This guide documents the **current** Docker setup for the v4 server.

- Runtime image: `node:22-slim`
- MCP transport: stdio
- Health checks:
  - Dockerfile: `node dist/health-check.js`
  - docker-compose: `node dist/index.js health`
- Optional Redis service is included in compose by default

## Prerequisites

- Docker and Docker Compose installed
- OAuth keys file at `credentials/gcp-oauth.keys.json`
- `.env` with `GDRIVE_TOKEN_ENCRYPTION_KEY` set

## Authenticate First (Host Machine)

Authentication opens a browser, so run it on the host before starting containers.

```bash
./scripts/auth.sh
```

Equivalent direct command:

```bash
node ./dist/index.js auth
```

Verify token file exists:

```bash
ls -la credentials/.gdrive-mcp-tokens.json
```

## Dockerfile Reference

Current Dockerfile behavior:

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

RUN mkdir -p /credentials /app/logs && \
    chmod 700 /credentials && \
    chmod 755 /app/logs

VOLUME ["/credentials"]

ENV GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
ENV GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
ENV GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log
ENV NODE_ENV=production

HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD ["node", "dist/health-check.js"]

CMD ["node", "dist/index.js"]
```

## docker-compose Reference

Current compose behavior:

```yaml
services:
  gdrive-mcp:
    build: .
    container_name: gdrive-mcp-server
    volumes:
      - ./credentials:/credentials
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=silent
      - REDIS_URL=redis://redis:6379
      - GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
      - GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
      - GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log
      - GDRIVE_TOKEN_ENCRYPTION_KEY=${GDRIVE_TOKEN_ENCRYPTION_KEY}
      - GDRIVE_TOKEN_REFRESH_INTERVAL=1800000
      - GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000
      - GDRIVE_TOKEN_MAX_RETRIES=3
      - GDRIVE_TOKEN_RETRY_DELAY=1000
      - GDRIVE_TOKEN_HEALTH_CHECK=true
    restart: unless-stopped
    stdin_open: true
    tty: true
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "health"]
      interval: 5m
      timeout: 10s
      retries: 3
      start_period: 30s

  redis:
    image: redis:7-alpine
    container_name: gdrive-mcp-redis
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## Build and Run

## 1) Build image

```bash
docker build -t gdrive-mcp-server .
```

## 2) Run container directly

```bash
docker run -i --rm \
  -v "$(pwd)/credentials:/credentials" \
  -v "$(pwd)/logs:/app/logs" \
  -e GDRIVE_TOKEN_ENCRYPTION_KEY="$GDRIVE_TOKEN_ENCRYPTION_KEY" \
  gdrive-mcp-server
```

## 3) Run with docker compose

```bash
docker-compose up -d
docker-compose ps
docker-compose logs -f gdrive-mcp
```

Stop:

```bash
docker-compose down
```

## Health Checks

Container-level check:

```bash
docker inspect gdrive-mcp-server --format='{{json .State.Health}}'
```

Manual check inside container:

```bash
docker exec -i gdrive-mcp-server node dist/index.js health
```

## Claude Desktop Integration (Docker)

Example `claude_desktop_config.json` entry:

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
        "/absolute/path/to/credentials:/credentials",
        "-v",
        "/absolute/path/to/logs:/app/logs",
        "--env-file",
        "/absolute/path/to/.env",
        "gdrive-mcp-server"
      ]
    }
  }
}
```

If using compose and persistent container:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": ["exec", "-i", "gdrive-mcp-server", "node", "dist/index.js"]
    }
  }
}
```

## Troubleshooting

### Missing encryption key

Symptom: startup fails with `GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required`.

Fix:

```bash
openssl rand -base64 32
```

Set value in `.env` and restart container.

### OAuth keys not found

Symptom: `OAuth keys not found at: /credentials/gcp-oauth.keys.json`.

Fix:

- ensure `credentials/gcp-oauth.keys.json` exists
- verify credentials volume mount path

### Auth required at startup

Symptom: `Authentication required. Please run with 'auth' argument first.`

Fix:

- run `./scripts/auth.sh` on host
- confirm token file exists in `credentials/`
- restart container

## Notes

- Redis is optional in runtime behavior; if unavailable, server continues without cache.
- Keep `credentials/` and `.env` out of version control.
- For exact env variables, use `.env.example` as source of truth.

