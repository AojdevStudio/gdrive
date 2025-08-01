#!/bin/bash

# Google Drive MCP Server - Host Authentication Script
# This script handles OAuth authentication outside of Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Google Drive MCP Server - Authentication Setup${NC}"
echo "============================================="
echo ""

# Check if credentials directory exists
CREDS_DIR="./credentials"
if [ ! -d "$CREDS_DIR" ]; then
    echo -e "${YELLOW}Creating credentials directory...${NC}"
    mkdir -p "$CREDS_DIR"
fi

# Check for OAuth keys file
OAUTH_FILE="$CREDS_DIR/gcp-oauth.keys.json"
if [ ! -f "$OAUTH_FILE" ]; then
    echo -e "${RED}Error: OAuth keys file not found at $OAUTH_FILE${NC}"
    echo ""
    echo "Please follow these steps:"
    echo "1. Go to https://console.cloud.google.com/apis/credentials"
    echo "2. Create an OAuth 2.0 Client ID for 'Desktop app'"
    echo "3. Download the JSON file"
    echo "4. Save it as: $OAUTH_FILE"
    exit 1
fi

# Check for .env file and encryption key
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" > .env
    echo -e "${GREEN}Generated new encryption key${NC}"
else
    # Check if encryption key exists in .env
    if ! grep -q "GDRIVE_TOKEN_ENCRYPTION_KEY" .env; then
        echo -e "${YELLOW}Adding encryption key to existing .env file...${NC}"
        ENCRYPTION_KEY=$(openssl rand -base64 32)
        echo "" >> .env
        echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
        echo -e "${GREEN}Generated new encryption key${NC}"
    fi
fi

# Load environment variables (excluding comments and empty lines)
if [ -f ".env" ]; then
    # Export only the GDRIVE_TOKEN_ENCRYPTION_KEY
    export GDRIVE_TOKEN_ENCRYPTION_KEY=$(grep "^GDRIVE_TOKEN_ENCRYPTION_KEY=" .env | cut -d '=' -f2)
    
    # Also export other GDRIVE-related variables if present
    for var in GDRIVE_TOKEN_REFRESH_INTERVAL GDRIVE_TOKEN_PREEMPTIVE_REFRESH GDRIVE_TOKEN_MAX_RETRIES GDRIVE_TOKEN_RETRY_DELAY; do
        value=$(grep "^$var=" .env | cut -d '=' -f2)
        if [ -n "$value" ]; then
            export "$var=$value"
        fi
    done
fi

# Set environment variables for authentication
export GDRIVE_OAUTH_PATH="$OAUTH_FILE"
export GDRIVE_CREDENTIALS_PATH="$CREDS_DIR/.gdrive-server-credentials.json"
export GDRIVE_TOKEN_STORAGE_PATH="$CREDS_DIR/.gdrive-mcp-tokens.json"
export GDRIVE_TOKEN_AUDIT_LOG_PATH="./logs/gdrive-mcp-audit.log"

# Ensure the project is built
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Building project...${NC}"
    npm run build
fi

echo ""
echo -e "${GREEN}Starting authentication process...${NC}"
echo "A browser window will open for Google OAuth authentication."
echo "If the browser doesn't open automatically, check the terminal for a URL to visit."
echo ""

# Run authentication with verbose logging
NODE_ENV=development LOG_LEVEL=debug node ./dist/index.js auth

# Check if authentication was successful
if [ -f "$GDRIVE_TOKEN_STORAGE_PATH" ]; then
    echo ""
    echo -e "${GREEN}✓ Authentication successful!${NC}"
    echo ""
    echo "Credentials saved to:"
    echo "  - $GDRIVE_TOKEN_STORAGE_PATH"
    echo ""
    echo "You can now run the server with Docker:"
    echo "  docker-compose up -d"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Authentication failed${NC}"
    echo "Please check the error messages above and try again."
    exit 1
fi