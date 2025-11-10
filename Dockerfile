FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies without running prepare script
RUN npm ci --ignore-scripts

# Rebuild native modules (isolated-vm requires native compilation)
RUN npm rebuild isolated-vm

# Copy source code
COPY . .

# Build TypeScript now that source files are available with increased memory limit
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Create necessary directories with appropriate permissions
RUN mkdir -p /credentials /app/logs && \
    chmod 700 /credentials && \
    chmod 755 /app/logs

# Create volume for credentials
VOLUME ["/credentials"]

# Environment variables
ENV GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
ENV GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
ENV GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log
ENV NODE_ENV=production

# Health check - using the built-in health check functionality
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD ["node", "dist/health-check.js"]

# Run the MCP server
CMD ["node", "dist/index.js"]