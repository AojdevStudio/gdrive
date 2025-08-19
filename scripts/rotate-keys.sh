#!/bin/bash

# Google Drive MCP Server - Key Rotation Script
# Rotates authentication keys without full Docker restart

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Google Drive MCP - Key Rotation${NC}"
echo "================================="
echo ""

# Function to check if service is running
check_service_running() {
    if docker-compose ps gdrive-mcp | grep -q "Up"; then
        return 0
    else
        return 1
    fi
}

# Check what type of rotation is needed
case "${1:-token}" in
    "oauth")
        echo -e "${YELLOW}OAuth Key Rotation (requires new OAuth file)${NC}"
        echo "1. Ensure new gcp-oauth.keys.json is in credentials/"
        echo "2. Running re-authentication..."
        ./scripts/auth.sh
        echo "3. Restarting gdrive service..."
        docker-compose restart gdrive-mcp
        ;;
    "encryption")
        echo -e "${YELLOW}Encryption Key Rotation${NC}"
        echo "1. Generating new encryption key..."
        NEW_KEY=$(openssl rand -base64 32)
        
        # Update .env file
        if grep -q "GDRIVE_TOKEN_ENCRYPTION_KEY" .env; then
            sed -i.bak "s/GDRIVE_TOKEN_ENCRYPTION_KEY=.*/GDRIVE_TOKEN_ENCRYPTION_KEY=$NEW_KEY/" .env
        else
            echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$NEW_KEY" >> .env
        fi
        
        echo "2. Re-authenticating with new encryption..."
        ./scripts/auth.sh
        echo "3. Restarting gdrive service..."
        docker-compose restart gdrive-mcp
        ;;
    "token"|"refresh")
        echo -e "${YELLOW}Token Refresh (automatic, but forcing now)${NC}"
        if check_service_running; then
            echo "1. Service is running - tokens auto-refresh every 30min"
            echo "2. To force refresh, restart the service:"
            docker-compose restart gdrive-mcp
        else
            echo "1. Service not running, starting..."
            docker-compose up -d gdrive-mcp
        fi
        ;;
    *)
        echo "Usage: $0 [oauth|encryption|token]"
        echo ""
        echo "  oauth      - Rotate OAuth keys (requires new gcp-oauth.keys.json)"
        echo "  encryption - Rotate encryption key"
        echo "  token      - Refresh tokens (default, usually automatic)"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✓ Key rotation complete!${NC}"
echo ""
echo "Service status:"
docker-compose ps gdrive-mcp