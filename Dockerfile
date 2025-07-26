FROM node:20-slim

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

# Copy source code
COPY . .

# Fix auth flow for Docker environment (replace automatic browser opening with URL printing)
RUN sed -i 's/opn(authorizeUrl, { wait: false }).then(cp => cp.unref());/process.stderr.write(`Open this URL in your browser: ${authorizeUrl}\\n`);/' node_modules/@google-cloud/local-auth/build/src/index.js

# Build TypeScript now that source files are available
RUN npm run build

# Create volume for credentials
VOLUME ["/credentials"]

# Environment variables
ENV GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json
ENV GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run the MCP server
CMD ["node", "dist/index.js"]