#!/bin/bash

# Test script for Google Drive MCP Server

# Load encryption key from .env
export GDRIVE_TOKEN_ENCRYPTION_KEY=$(grep "^GDRIVE_TOKEN_ENCRYPTION_KEY=" .env | cut -d '=' -f2)

# Set paths
export GDRIVE_OAUTH_PATH="./credentials/gcp-oauth.keys.json"
export GDRIVE_CREDENTIALS_PATH="./credentials/.gdrive-server-credentials.json"
export GDRIVE_TOKEN_STORAGE_PATH="./credentials/.gdrive-mcp-tokens.json"
export GDRIVE_TOKEN_AUDIT_LOG_PATH="./logs/gdrive-mcp-audit.log"

echo "Testing server with encryption key: ${GDRIVE_TOKEN_ENCRYPTION_KEY:0:10}..."
echo ""

# Run health check
echo "Health Check:"
node dist/index.js health

echo ""
echo "If health check passes, the server is ready for use."