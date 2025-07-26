# 🚀 Google Drive MCP Server - Quick Setup Guide

A step-by-step guide to configure and run the Google Drive MCP server in under 10 minutes.

## 📋 Prerequisites

### Required Software
- **Docker & Docker Compose** (recommended) or **Node.js 18+**
- **Google Cloud Console access** (free account works)
- **Claude Desktop** or compatible MCP client

### Time Required
- ⏱️ **Initial setup**: 5-10 minutes
- ⏱️ **Subsequent runs**: 30 seconds

---

## 🔧 Step 1: Google Cloud Setup

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"New Project"** → Enter project name → **Create**
3. Make sure your new project is selected (top dropdown)

### 1.2 Enable Required APIs
In the Google Cloud Console:
1. Go to **APIs & Services** → **Library**
2. Search and enable these APIs (click each + **Enable**):
   - ✅ **Google Drive API**
   - ✅ **Google Sheets API**  
   - ✅ **Google Docs API**
   - ✅ **Google Forms API**

### 1.3 Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **OAuth client ID**
3. Create OAuth client:
   - **Application type**: ⚠️ **IMPORTANT: Select "Desktop application"** (not Web application)
   - **Name**: `MCP Server`
   - Click **Create**
   
   > 💡 **Why Desktop app?** The MCP server runs locally and needs to handle OAuth redirects directly, making it a desktop application from Google's perspective.
4. If prompted, configure OAuth consent screen:
   - Choose **External** → **Create**
   - Fill required fields:
     - **App name**: `Google Drive MCP Server`
     - **User support email**: Your email
     - **Developer contact**: Your email
   - Click **Save and Continue** through all steps
5. **Download** the JSON file → Rename to `gcp-oauth.keys.json`

---

## 📦 Step 2: MCP Server Setup

### Option A: Docker Setup (Recommended)

#### 2.1 Download Project
```bash
# Clone or download the MCP server files
cd /path/to/your/projects
# Place your gcp-oauth.keys.json in the project root
```

#### 2.2 Prepare Directories
```bash
# Create required directories (if they don't exist)
mkdir -p credentials data logs

# Copy your OAuth keys to the credentials directory
cp gcp-oauth.keys.json credentials/
```

#### 2.3 Initial Authentication (Recommended: Local Method)
```bash
# Install dependencies locally
npm install

# Build TypeScript
npm run build  

# Run authentication locally (no container timeout issues)
node ./dist/index.js auth

# The authentication will:
# 1. Open your browser for Google login
# 2. Save credentials directly to: credentials/.gdrive-server-credentials.json
# 3. Exit cleanly when complete
```

**What happens**:
- Browser opens automatically for Google authentication
- OAuth redirect is handled properly (no timeout issues)
- Credentials are saved directly to `credentials/.gdrive-server-credentials.json`
- Process exits cleanly after saving

**✅ Advantages**: No timeout issues, automatic browser opening, more reliable

**✅ No manual copying needed!** The authentication automatically saves to the correct location.

**📁 Your credentials directory should contain**:
- `gcp-oauth.keys.json` (OAuth client config - you copied this in step 2.2)
- `.gdrive-server-credentials.json` (created automatically by auth command)

#### 2.3b Alternative: Docker Authentication (Advanced)
```bash
# Only use if local method doesn't work
docker-compose --profile auth run --rm gdrive-mcp-auth node dist/index.js auth
```

**⚠️ Note**: Docker method may have OAuth redirect timeout issues.

#### 2.4 Start Services
```bash
# Start MCP server + Redis
docker-compose up -d

# Check status
docker-compose logs gdrive-mcp
```

### Option B: Local Node.js Setup

#### 2.1 Install Dependencies
```bash
npm install
npm run build
```

#### 2.2 Authentication
```bash
# Place gcp-oauth.keys.json in project root
node ./dist/index.js auth
```

#### 2.3 Start Server
```bash
node ./dist/index.js
```

---

## 🔌 Step 3: Claude Desktop Integration

### 3.1 Add to Claude Desktop Config

Edit your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Recommended Configuration** (cleanest output):
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "exec", "-i", "gdrive-mcp-server",
        "node", "dist/index.js"
      ],
      "env": {
        "DOCKER_CLI_HINTS": "false"
      }
    }
  }
}
```

**Alternative Docker Compose Configuration** (if docker exec doesn't work):
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network", "gdrive_mcp-network",
        "-v", "/Users/ossieirondi/Projects/local-mcps/gdrive/credentials:/credentials:ro",
        "-e", "GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json",
        "-e", "GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json",
        "-e", "REDIS_URL=redis://redis:6379",
        "gdrive-mcp-server",
        "node", "dist/index.js"
      ]
    }
  }
}
```

### 3.2 Restart Claude Desktop
Close and reopen Claude Desktop to load the new configuration.

---

## ✅ Step 4: Verification

### 4.1 Test Connection
In Claude Desktop, try:
```
Can you list files in my Google Drive?
```

### 4.2 Test Features
Try these commands:
- **Search**: "Find spreadsheets modified this week"
- **Read**: "Show me the contents of [filename]" 
- **Create**: "Create a new document called 'Test Doc'"
- **Batch**: "Create multiple files: doc1.txt, doc2.txt, doc3.txt"

### 4.3 Check Logs
```bash
# Docker logs
docker-compose logs gdrive-mcp

# Or check log files
tail -f logs/combined.log
```

---

## 🛠️ Common Issues & Solutions

### ❌ "Credentials not found"
```bash
# Re-run authentication
docker-compose run --rm gdrive-mcp node dist/index.js auth
```

### ❌ "API not enabled"
- Verify all 4 APIs are enabled in Google Cloud Console
- Wait 2-3 minutes after enabling

### ❌ "Permission denied"
- Check OAuth consent screen is configured
- Add your email as test user if using External app

### ❌ "Redis connection failed"
```bash
# Check Redis is running
docker-compose ps
# Restart if needed
docker-compose restart redis
```

### ❌ "Docker permission denied"
```bash
# Add user to docker group (Linux/macOS)
sudo usermod -aG docker $USER
# Restart terminal
```

---

## 🔧 Advanced Configuration

### Environment Variables
Create `.env` file in project root:
```bash
NODE_ENV=production
LOG_LEVEL=info
REDIS_URL=redis://redis:6379
GDRIVE_CREDENTIALS_PATH=/credentials/.gdrive-server-credentials.json
GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
```

### Custom Ports
In `docker-compose.yml`, add:
```yaml
services:
  gdrive-mcp:
    ports:
      - "3000:3000"  # If using web interface
```

### Backup Credentials
```bash
# Backup your authentication
cp credentials/.gdrive-server-credentials.json ~/gdrive-backup.json
```

---

## 📊 Features Available

✅ **21 Tools Available:**
- **Drive**: search, read, createFile, updateFile, createFolder
- **Sheets**: listSheets, readSheet, updateCells, appendRows  
- **Docs**: createDocument, insertText, replaceText, applyTextStyle, insertTable
- **Forms**: createForm, getForm, addQuestion, listResponses
- **Advanced**: enhancedSearch, batchFileOperations

✅ **Performance Features:**
- Redis caching for faster responses
- Performance monitoring and structured logging
- Batch operations for efficiency
- Docker orchestration with health checks

---

## 🆘 Need Help?

1. **Check logs**: `docker-compose logs gdrive-mcp`
2. **Verify APIs**: Google Cloud Console → APIs & Services → Enabled APIs
3. **Test authentication**: `docker-compose run --rm gdrive-mcp node dist/index.js auth`
4. **Restart services**: `docker-compose restart`

---

## 🎉 You're Ready!

Your Google Drive MCP server is now configured and ready to use with Claude Desktop. You can now:
- Search and read Google Drive files
- Create and edit documents, spreadsheets, and forms
- Perform batch operations
- Enjoy high-performance caching

**Next Steps**: Explore the [API Documentation](./docs/API.md) to learn about all available tools and their capabilities.