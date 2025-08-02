# Claude Desktop Integration Guide

This guide covers integrating the Google Drive MCP Server with Claude Desktop, including configuration, testing, and troubleshooting for different deployment scenarios.

## Prerequisites

Before integrating with Claude Desktop:
- **[Initial Setup](./01-initial-setup.md)** completed
- **[Authentication Flow](./02-authentication-flow.md)** completed
- **Google Drive MCP Server** working (tested with health check)
- **Claude Desktop** installed and running
- **MCP server** accessible via command line

## Understanding Claude Desktop Integration

### MCP Integration Architecture

```
Claude Desktop Integration Flow:

Claude Desktop → MCP Client → stdio transport → MCP Server Process
                              │
                              └── JSON-RPC Messages
                                  │
                                  │   Google Drive MCP Server
                                  └── ┌──────────────────────┐
                                      │ • Resource Handler     │
                                      │ • Tool Handler         │
                                      │ • Request Router       │
                                      │ • Performance Monitor  │
                                      └──────────────────────┘
                                               │
                                               └── Google Workspace APIs
```

### Key Integration Points

- **stdio Transport**: Claude Desktop communicates via stdin/stdout
- **JSON-RPC Protocol**: MCP standard request/response format
- **Resource Access**: Files accessible via `gdrive:///file_id` URIs
- **Tool Execution**: 22 comprehensive tools for Google Workspace
- **Real-time Communication**: Live interaction with Google services

## Step 1: Locate Claude Desktop Configuration

### 1.1 Find Configuration File Location

**macOS:**
```bash
# Claude Desktop configuration location
CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

# Check if file exists
ls -la "$CONFIG_PATH"

# Create directory if it doesn't exist
mkdir -p "$(dirname "$CONFIG_PATH")"
```

**Windows:**
```powershell
# Claude Desktop configuration (PowerShell)
$CONFIG_PATH = "$env:APPDATA\Claude\claude_desktop_config.json"

# Check if file exists
Test-Path $CONFIG_PATH

# Create directory if needed
New-Item -ItemType Directory -Force -Path (Split-Path $CONFIG_PATH)
```

**Linux:**
```bash
# Claude Desktop configuration location
CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"

# Check if file exists
ls -la "$CONFIG_PATH"

# Create directory if it doesn't exist
mkdir -p "$(dirname "$CONFIG_PATH")"
```

### 1.2 Backup Existing Configuration

```bash
# Backup existing configuration (if it exists)
if [ -f "$CONFIG_PATH" ]; then
  cp "$CONFIG_PATH" "$CONFIG_PATH.backup.$(date +%Y%m%d_%H%M%S)"
  echo "Backed up existing configuration"
else
  echo "No existing configuration found"
fi
```

## Step 2: Configuration Options

### Option 1: Local Development Setup

**Best for:** Development, testing, direct Node.js execution

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["/absolute/path/to/gdrive-mcp-server/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "your-base64-encryption-key",
        "REDIS_URL": "redis://localhost:6379",
        "LOG_LEVEL": "info",
        "NODE_ENV": "development"
      }
    }
  }
}
```

**Setup Steps:**
```bash
# Get absolute paths
GDRIVE_PATH="$(pwd)/dist/index.js"
ENCRYPTION_KEY="$(grep GDRIVE_TOKEN_ENCRYPTION_KEY .env | cut -d= -f2)"

# Create configuration
cat > "$CONFIG_PATH" << EOF
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["$GDRIVE_PATH"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "$ENCRYPTION_KEY",
        "REDIS_URL": "redis://localhost:6379",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF

echo "Local configuration created"
```

### Option 2: Docker Run Setup

**Best for:** Containerized deployment, isolated environment

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

**Setup Steps:**
```bash
# Get absolute paths
CREDS_PATH="$(pwd)/credentials"
DATA_PATH="$(pwd)/data"
LOGS_PATH="$(pwd)/logs"
ENV_PATH="$(pwd)/.env"

# Ensure Docker image exists
docker build -t gdrive-mcp-server .

# Create configuration
cat > "$CONFIG_PATH" << EOF
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--init",
        "-v", "$CREDS_PATH:/credentials:ro",
        "-v", "$DATA_PATH:/data",
        "-v", "$LOGS_PATH:/app/logs",
        "--env-file", "$ENV_PATH",
        "gdrive-mcp-server"
      ]
    }
  }
}
EOF

echo "Docker run configuration created"
```

### Option 3: Docker Compose Setup (Recommended)

**Best for:** Production, with Redis caching, full feature set

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

**Setup Steps:**
```bash
# Start Docker Compose services
docker-compose up -d

# Verify containers are running
docker-compose ps

# Create configuration
cat > "$CONFIG_PATH" << EOF
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
EOF

echo "Docker Compose configuration created"
echo "Note: Ensure 'docker-compose up -d' is running before using Claude Desktop"
```

## Step 3: Test Configuration

### 3.1 Validate JSON Configuration

```bash
# Validate JSON syntax
if command -v jq >/dev/null 2>&1; then
  jq . "$CONFIG_PATH"
  if [ $? -eq 0 ]; then
    echo "✅ Configuration JSON is valid"
  else
    echo "❌ Configuration JSON is invalid"
  fi
else
  echo "Install jq to validate JSON: brew install jq"
fi

# Alternative validation with Python
python3 -c "import json; json.load(open('$CONFIG_PATH')); print('✅ JSON is valid')"
```

### 3.2 Test MCP Server Command

**Test Local Setup:**
```bash
# Test the exact command Claude Desktop will use
GDRIVE_TOKEN_ENCRYPTION_KEY="$(grep GDRIVE_TOKEN_ENCRYPTION_KEY .env | cut -d= -f2)" \
REDIS_URL="redis://localhost:6379" \
LOG_LEVEL="info" \
node "$(pwd)/dist/index.js" << 'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
EOF

# Expected: JSON response with list of 22 tools
```

**Test Docker Setup:**
```bash
# Test Docker run command
docker run -i --rm --init \
  -v "$(pwd)/credentials:/credentials:ro" \
  -v "$(pwd)/data:/data" \
  -v "$(pwd)/logs:/app/logs" \
  --env-file "$(pwd)/.env" \
  gdrive-mcp-server << 'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
EOF

# Expected: JSON response with list of tools
```

**Test Docker Compose Setup:**
```bash
# Ensure services are running
docker-compose up -d

# Test exec command
docker exec -i gdrive-mcp-server node dist/index.js << 'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
EOF

# Expected: JSON response with tools
```

### 3.3 Test Health Check

```bash
# Test health check based on your setup

# Local setup
GDRIVE_TOKEN_ENCRYPTION_KEY="$(grep GDRIVE_TOKEN_ENCRYPTION_KEY .env | cut -d= -f2)" \
node "$(pwd)/dist/index.js" health

# Docker setup
docker run --rm \
  -v "$(pwd)/credentials:/credentials:ro" \
  --env-file "$(pwd)/.env" \
  gdrive-mcp-server node dist/index.js health

# Docker Compose setup
docker-compose exec gdrive-mcp node dist/index.js health

# All should return: {"status": "HEALTHY", ...}
```

## Step 4: Claude Desktop Integration

### 4.1 Restart Claude Desktop

```bash
# macOS - Quit and restart Claude Desktop
osascript -e 'quit app "Claude"'
sleep 2
open -a "Claude"

# Or manually:
# 1. Quit Claude Desktop completely
# 2. Reopen Claude Desktop
# 3. Check for MCP server connection in settings
```

### 4.2 Verify Integration in Claude Desktop

1. **Open Claude Desktop**
2. **Check Settings/Preferences**
   - Look for MCP Servers section
   - Verify "gdrive" server is listed
   - Check connection status (should be green/connected)

3. **Test Basic Functionality**
   - Start a new conversation
   - Try commands like:
     ```
     Can you list my Google Drive files?
     Search for spreadsheets in my Drive
     Show me my recent documents
     ```

### 4.3 Verify Resource Access

```bash
# In Claude Desktop, try:
"Can you read the contents of gdrive:///1abc123def456?" 

# Replace with an actual file ID from your Drive
# You can get file IDs by asking Claude to search your Drive first
```

## Step 5: Advanced Configuration Options

### 5.1 Multiple Environment Configuration

```json
{
  "mcpServers": {
    "gdrive-dev": {
      "command": "node",
      "args": ["/path/to/dev/gdrive-mcp-server/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "dev-key",
        "LOG_LEVEL": "debug",
        "NODE_ENV": "development"
      }
    },
    "gdrive-prod": {
      "command": "docker",
      "args": [
        "exec", "-i", "gdrive-mcp-server-prod",
        "node", "dist/index.js"
      ]
    }
  }
}
```

### 5.2 Custom Environment Variables

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "your-key",
        "REDIS_URL": "redis://localhost:6379",
        "LOG_LEVEL": "info",
        "NODE_ENV": "production",
        "GDRIVE_TOKEN_REFRESH_INTERVAL": "1800000",
        "GDRIVE_TOKEN_PREEMPTIVE_REFRESH": "600000",
        "GDRIVE_TOKEN_MAX_RETRIES": "3"
      }
    }
  }
}
```

### 5.3 Logging and Debug Configuration

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "your-key",
        "LOG_LEVEL": "debug",
        "NODE_ENV": "development"
      }
    }
  },
  "debug": true,
  "logging": {
    "level": "debug",
    "file": "/tmp/claude_mcp_debug.log"
  }
}
```

## Step 6: Testing and Validation

### 6.1 Comprehensive Integration Test

**Test Resource Listing:**
```
Claude: "List my Google Drive files"
Expected: List of files with names, types, and gdrive:// URIs
```

**Test File Search:**
```
Claude: "Search for spreadsheets modified in the last week"
Expected: Filtered list of recent spreadsheet files
```

**Test File Reading:**
```
Claude: "Read the contents of my document titled 'Project Plan'"
Expected: Document content in readable format
```

**Test File Creation:**
```
Claude: "Create a new document titled 'Meeting Notes' with today's date"
Expected: Confirmation of document creation with file ID
```

**Test Spreadsheet Operations:**
```
Claude: "Update cell A1 in my Budget spreadsheet to 'Total Revenue'"
Expected: Confirmation of cell update
```

### 6.2 Performance Testing

```bash
# Monitor MCP server performance during Claude Desktop usage

# Local monitoring
tail -f logs/combined.log | grep "Performance stats"

# Docker monitoring
docker-compose logs -f gdrive-mcp | grep "Performance stats"

# Watch resource usage
watch -n 5 "ps aux | grep -E '(node|docker)' | grep -v grep"
```

### 6.3 Error Testing

**Test Error Handling:**
```
Claude: "Read a file with ID 'invalid-file-id'"
Expected: Graceful error message about file not found

Claude: "Update a non-existent spreadsheet"
Expected: Clear error message about spreadsheet not found
```

## Troubleshooting Claude Desktop Integration

### Issue: "MCP Server Not Found" in Claude Desktop

**Symptoms:**
- MCP server not listed in Claude Desktop settings
- No Google Drive functionality available
- Connection status shows as disconnected

**Solutions:**
```bash
# 1. Verify configuration file location
echo "Config path: $CONFIG_PATH"
ls -la "$CONFIG_PATH"

# 2. Validate JSON syntax
jq . "$CONFIG_PATH"

# 3. Check file permissions
chmod 644 "$CONFIG_PATH"

# 4. Verify command paths are absolute
grep -o '/[^"]*' "$CONFIG_PATH"

# 5. Test command manually
# Extract and test the exact command from config

# 6. Restart Claude Desktop completely
# Kill all Claude processes and restart
```

### Issue: "MCP Server Connection Failed"

**Symptoms:**
- Server listed but shows connection error
- Red/disconnected status in Claude Desktop
- Error messages in Claude Desktop logs

**Solutions:**
```bash
# 1. Test command line execution
# Run the exact command from configuration manually

# For local setup:
GDRIVE_TOKEN_ENCRYPTION_KEY="your-key" node /path/to/dist/index.js health

# For Docker setup:
docker run --rm -v $(pwd)/credentials:/credentials:ro --env-file .env gdrive-mcp-server node dist/index.js health

# 2. Check environment variables
echo "Checking environment variables..."
grep GDRIVE_TOKEN_ENCRYPTION_KEY .env

# 3. Verify authentication
node /path/to/dist/index.js health
# Should return HEALTHY status

# 4. Check logs for errors
tail -50 logs/combined.log

# 5. Test basic MCP communication
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}' | node /path/to/dist/index.js
```

### Issue: "Permission Denied" Errors

**Symptoms:**
- Cannot read credentials files
- Docker volume mount failures
- File access errors

**Solutions:**
```bash
# 1. Fix file permissions
chmod 600 credentials/gcp-oauth.keys.json
chmod 600 credentials/.gdrive-mcp-tokens.json
chmod 644 .env
chmod 755 logs data

# 2. Fix ownership (if needed)
sudo chown -R $(whoami):$(whoami) credentials/ logs/ data/

# 3. For Docker: Check volume mount permissions
docker run --rm -v $(pwd)/credentials:/credentials:ro gdrive-mcp-server ls -la /credentials/

# 4. Verify Claude Desktop has access to paths
# Ensure paths in configuration are accessible
ls -la /path/to/dist/index.js
ls -la /path/to/credentials/
```

### Issue: "Authentication Errors" in Claude Desktop

**Symptoms:**
- Google API authentication failures
- "Token expired" or "Invalid grant" errors
- Operations fail with auth errors

**Solutions:**
```bash
# 1. Check token status
node /path/to/dist/index.js health

# 2. Re-authenticate if needed
rm credentials/.gdrive-mcp-tokens.json
./scripts/auth.sh

# 3. Verify encryption key is consistent
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c
# Should output: 32

# 4. Check system clock
date
# Ensure time is accurate for token validation

# 5. Restart MCP server after re-authentication
# Restart Claude Desktop to refresh connection
```

### Issue: "High CPU/Memory Usage"

**Symptoms:**
- Claude Desktop becomes slow
- High system resource usage
- MCP server consuming excessive resources

**Solutions:**
```bash
# 1. Monitor resource usage
top -p $(pgrep -f "gdrive.*mcp")

# 2. Check for infinite loops or stuck processes
ps aux | grep -E "(node|gdrive)"

# 3. Restart MCP server
# Stop Claude Desktop
# Kill any stuck MCP processes
pkill -f "gdrive.*mcp"
# Restart Claude Desktop

# 4. Optimize configuration
# Reduce log level in production
echo "LOG_LEVEL=error" >> .env

# 5. Monitor Redis usage (if applicable)
docker stats gdrive-mcp-redis
```

### Issue: "Operations Timeout"

**Symptoms:**
- Claude Desktop operations hang
- Long delays in responses
- Timeout errors

**Solutions:**
```bash
# 1. Check network connectivity
ping -c 4 googleapis.com

# 2. Test API response times
time node /path/to/dist/index.js << 'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "search", "arguments": {"query": "test"}}}
EOF

# 3. Check Redis performance (if using caching)
redis-cli --latency-history -i 1

# 4. Monitor MCP server logs for slow operations
tail -f logs/combined.log | grep -E "(slow|timeout|error)"

# 5. Optimize Redis configuration
redis-cli CONFIG SET timeout 300
redis-cli CONFIG SET tcp-keepalive 60
```

## Advanced Troubleshooting

### Debug Mode Configuration

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "your-key",
        "LOG_LEVEL": "debug",
        "NODE_ENV": "development",
        "DEBUG": "*"
      }
    }
  },
  "debug": true
}
```

### MCP Protocol Debugging

```bash
# Create debug script to test MCP protocol
cat > debug_mcp.sh << 'EOF'
#!/bin/bash

echo "Testing MCP Protocol..."

# Test initialize
echo "1. Testing initialize:"
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "0.1.0", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node /path/to/dist/index.js

echo -e "\n2. Testing tools/list:"
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}' | node /path/to/dist/index.js

echo -e "\n3. Testing resources/list:"
echo '{"jsonrpc": "2.0", "id": 3, "method": "resources/list"}' | node /path/to/dist/index.js
EOF

chmod +x debug_mcp.sh
./debug_mcp.sh
```

### Logging Analysis

```bash
# Analyze MCP server logs
grep -E "(ERROR|WARN)" logs/combined.log | tail -20

# Monitor real-time issues
tail -f logs/combined.log | grep -E "(error|fail|timeout)"

# Performance analysis
grep "Performance stats" logs/combined.log | tail -10

# Authentication events
grep -E "(TOKEN|AUTH)" logs/gdrive-mcp-audit.log | tail -10
```

## Security Considerations

### Claude Desktop Security
- **Credential Protection**: Never include credentials directly in Claude Desktop config
- **Environment Variables**: Use environment variables for sensitive data
- **File Permissions**: Ensure config file has appropriate permissions (644)
- **Path Security**: Use absolute paths to prevent path traversal

### Network Security
- **Local Communication**: MCP uses local stdio, no network exposure
- **API Access**: Google APIs accessed over HTTPS
- **Redis Security**: Secure Redis if using remote instance
- **Docker Security**: Use read-only mounts where possible

## Performance Optimization

### Claude Desktop Performance
- **Resource Limits**: Monitor MCP server resource usage
- **Cache Configuration**: Enable Redis caching for better performance
- **Log Levels**: Use appropriate log levels (info for dev, error for prod)
- **Connection Pooling**: Reuse Google API connections

### Configuration Optimization

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "your-key",
        "REDIS_URL": "redis://localhost:6379",
        "LOG_LEVEL": "error",
        "NODE_ENV": "production",
        "GDRIVE_TOKEN_REFRESH_INTERVAL": "1800000"
      }
    }
  }
}
```

## Next Steps

After successful Claude Desktop integration:
1. **[Environment Variables Setup](./06-environment-variables.md)** - Fine-tune configuration
2. **Usage examples and best practices**
3. **Production monitoring and maintenance**
4. **Backup and recovery procedures**

---

**Claude Desktop Integration Complete!** 🎉

Your Google Drive MCP Server is now fully integrated with Claude Desktop, providing seamless access to Google Workspace services through natural language interaction.