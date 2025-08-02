# Initial Setup and Installation Guide

This guide walks you through the complete setup process for the Google Drive MCP Server, from Google Cloud configuration to local installation.

## Prerequisites

Before starting, ensure you have:
- **Node.js 18+** installed
- **Git** for cloning the repository
- **Google Account** with access to Google Cloud Console
- **Terminal/Command Line** access

## Step 1: Google Cloud Project Setup

### 1.1 Create Google Cloud Project

1. **Navigate to Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/projectcreate)
   - Sign in with your Google account if prompted

2. **Create New Project**
   ```
   Project Name: gdrive-mcp-server (or your preferred name)
   Project ID: Will be auto-generated or customize
   Location: No organization (for personal projects)
   ```

3. **Select Your New Project**
   - Click "Create" and wait for project creation
   - Ensure the new project is selected in the project dropdown

### 1.2 Enable Required APIs

**Method 1: Using gcloud CLI (Recommended)**

1. **Install Google Cloud CLI** (if not already installed)
   - Follow instructions at [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)

2. **Authenticate and Set Project**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Enable All Required APIs**
   ```bash
   # Enable all Google Workspace APIs
   gcloud services enable drive.googleapis.com
   gcloud services enable sheets.googleapis.com
   gcloud services enable docs.googleapis.com
   gcloud services enable forms.googleapis.com
   gcloud services enable script.googleapis.com
   
   # Verify APIs are enabled
   gcloud services list --enabled --filter="name:(drive|sheets|docs|forms|script)"
   ```

**Method 2: Using Google Cloud Console**

1. **Navigate to API Library**
   - Go to [API Library](https://console.cloud.google.com/apis/library)
   - Ensure your project is selected

2. **Enable Each API Individually**
   - Search for "Google Drive API" → Click → Enable
   - Search for "Google Sheets API" → Click → Enable
   - Search for "Google Docs API" → Click → Enable
   - Search for "Google Forms API" → Click → Enable
   - Search for "Google Apps Script API" → Click → Enable

3. **Verify APIs are Enabled**
   - Go to [Enabled APIs](https://console.cloud.google.com/apis/dashboard)
   - Confirm all 5 APIs are listed

## Step 2: OAuth Consent Screen Configuration

### 2.1 Configure OAuth Consent Screen

1. **Navigate to OAuth Consent Screen**
   - Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)

2. **Choose User Type**
   - **Internal**: If you have a Google Workspace organization
   - **External**: For personal Google accounts (recommended for most users)
   - Click "Create"

3. **Fill Required Information**
   ```
   App name: Google Drive MCP Server
   User support email: your-email@example.com
   Developer contact information: your-email@example.com
   ```

4. **Add Required Scopes**
   - Click "Add or Remove Scopes"
   - Add these exact scopes:
     ```
     https://www.googleapis.com/auth/drive
     https://www.googleapis.com/auth/spreadsheets
     https://www.googleapis.com/auth/documents
     https://www.googleapis.com/auth/forms
     https://www.googleapis.com/auth/script.projects.readonly
     ```

5. **Add Test Users** (for External apps)
   - Add your Google account email
   - Add any other accounts that need access

6. **Review and Submit**
   - Review all information
   - Click "Save and Continue" through all steps

### 2.2 Create OAuth Credentials

1. **Navigate to Credentials**
   - Go to [Credentials](https://console.cloud.google.com/apis/credentials)

2. **Create OAuth Client ID**
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Desktop application**
   - Name: `Google Drive MCP Server`
   - Click "Create"

3. **Download Credentials**
   - Click "Download JSON" in the popup
   - Save as `gcp-oauth.keys.json`
   - **Keep this file secure - it contains sensitive information**

## Step 3: Local Installation

### 3.1 Clone Repository

```bash
# Clone the repository
git clone <repository-url>
cd gdrive-mcp-server

# Or if you have the source locally
cd /path/to/gdrive-mcp-server
```

### 3.2 Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Build the TypeScript project
npm run build

# Verify build completed successfully
ls -la dist/
# Should see index.js and other compiled files
```

### 3.3 Set Up Credentials Directory

```bash
# Create credentials directory
mkdir -p credentials

# Move your OAuth keys file
cp /path/to/downloaded/gcp-oauth.keys.json credentials/

# Verify file is in place
ls -la credentials/
# Should see: gcp-oauth.keys.json

# Set secure permissions
chmod 600 credentials/gcp-oauth.keys.json
```

### 3.4 Generate Encryption Key

```bash
# Generate a secure 32-byte base64 encryption key
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "Generated encryption key: $ENCRYPTION_KEY"

# Create .env file with the key
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" > .env

# Add other optional environment variables
cat >> .env << EOF
# Performance settings
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
NODE_ENV=development

# Token refresh settings (optional)
GDRIVE_TOKEN_REFRESH_INTERVAL=1800000
GDRIVE_TOKEN_PREEMPTIVE_REFRESH=600000
GDRIVE_TOKEN_MAX_RETRIES=3
EOF

# Verify .env file
cat .env
```

### 3.5 Create Required Directories

```bash
# Create logs directory
mkdir -p logs

# Create data directory for Docker volumes
mkdir -p data

# Set appropriate permissions
chmod 755 logs data
chmod 700 credentials

# Verify directory structure
tree . -I 'node_modules|dist'
```

## Step 4: Verify Installation

### 4.1 Check Dependencies

```bash
# Verify Node.js version
node --version
# Should be 18.0.0 or higher

# Verify npm installation
npm --version

# Check TypeScript compilation
npm run build
# Should complete without errors

# Verify all required files exist
ls -la credentials/gcp-oauth.keys.json
ls -la .env
ls -la dist/index.js
```

### 4.2 Test OAuth Configuration

```bash
# Validate OAuth keys file format
node -e "console.log('OAuth keys valid:', !!JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json')))"

# Check if all required fields are present
node -e "const keys = JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json')); console.log('Required fields present:', !!(keys.installed || keys.web))"
```

### 4.3 Test Environment Configuration

```bash
# Source environment variables
source .env

# Verify encryption key is set and valid
echo $GDRIVE_TOKEN_ENCRYPTION_KEY | base64 -d | wc -c
# Should output: 32

# Test environment loading in Node.js
node -e "require('dotenv').config(); console.log('Encryption key set:', !!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY)"
```

## Step 5: Initial Configuration

### 5.1 Project Structure Verification

Your project should now look like this:

```
gdrive-mcp-server/
├── credentials/
│   └── gcp-oauth.keys.json     # OAuth credentials (secure)
├── dist/                       # Compiled JavaScript
│   ├── index.js               # Main server
│   └── src/                   # Compiled modules
├── logs/                      # Application logs (will be created)
├── data/                      # Application data (Docker volume)
├── .env                       # Environment variables (secure)
├── package.json              # Node.js configuration
├── tsconfig.json            # TypeScript configuration
└── README.md               # Documentation
```

### 5.2 Security Verification

```bash
# Check file permissions are secure
ls -la credentials/
# gcp-oauth.keys.json should be -rw------- (600)

ls -la .env
# .env should be -rw------- (600) or -rw-r--r-- (644)

# Verify .gitignore excludes sensitive files
grep -E "(credentials|.env)" .gitignore
# Should show these files are ignored
```

## Troubleshooting Common Setup Issues

### Issue: "APIs not enabled" Error

**Symptoms:**
- Error messages about missing APIs during authentication
- 403 Forbidden errors

**Solutions:**
```bash
# Re-enable APIs with explicit project ID
gcloud config set project YOUR_PROJECT_ID
gcloud services enable drive.googleapis.com --project=YOUR_PROJECT_ID

# Wait 5-10 minutes for API enablement to propagate
# Verify APIs are enabled
gcloud services list --enabled --filter="name:drive"
```

### Issue: "Invalid OAuth Configuration" Error

**Symptoms:**
- Authentication fails immediately
- "Client ID not found" errors

**Solutions:**
```bash
# Verify OAuth keys file format
node -e "
const keys = JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json'));
console.log('OAuth Config Type:', keys.installed ? 'Desktop' : keys.web ? 'Web' : 'Unknown');
console.log('Client ID present:', !!(keys.installed?.client_id || keys.web?.client_id));
"

# Re-download OAuth credentials if needed
# Ensure "Desktop application" type was selected
```

### Issue: "Permission Denied" Errors

**Symptoms:**
- Cannot read credentials files
- Cannot write to logs directory

**Solutions:**
```bash
# Fix file permissions
chmod 600 credentials/gcp-oauth.keys.json
chmod 644 .env
chmod 755 logs data
chmod 700 credentials

# Ensure you own the files
sudo chown -R $(whoami):$(whoami) .
```

### Issue: "Encryption Key Invalid" Error

**Symptoms:**
- Token encryption/decryption failures
- "Invalid key length" errors

**Solutions:**
```bash
# Regenerate encryption key
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$ENCRYPTION_KEY" > .env

# Verify key length (should be 32 bytes)
echo $ENCRYPTION_KEY | base64 -d | wc -c
```

### Issue: Node.js Version Compatibility

**Symptoms:**
- Build failures
- Runtime errors with ES modules

**Solutions:**
```bash
# Check Node.js version
node --version

# Install Node.js 18+ if needed
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or using package manager
# Ubuntu/Debian:
sudo apt update
sudo apt install nodejs npm

# macOS:
brew install node
```

### Issue: Build Failures

**Symptoms:**
- TypeScript compilation errors
- Missing dependencies

**Solutions:**
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Rebuild with verbose output
npm run build -- --verbose

# Check TypeScript version
npx tsc --version
```

## Next Steps

Once setup is complete, proceed to:
1. **[Authentication Guide](./02-authentication-flow.md)** - Complete OAuth flow
2. **[Claude Desktop Integration](./05-claude-desktop-integration.md)** - Connect to Claude
3. **[Docker Deployment](./03-docker-deployment.md)** - Optional containerized setup

## Security Best Practices

### File Security
- Never commit `credentials/` directory to version control
- Keep `.env` file secure and never share
- Regularly rotate encryption keys
- Use secure file permissions (600 for sensitive files)

### OAuth Security
- Use "Internal" user type for organization accounts when possible
- Regularly review and rotate OAuth credentials
- Monitor OAuth consent screen for unauthorized changes
- Use specific scopes, avoid overly broad permissions

### Access Control
- Limit test users to necessary accounts only
- Regularly audit who has access to your Google Cloud project
- Enable 2FA on your Google account
- Monitor API usage in Google Cloud Console

---

**Installation Complete!** ✅

Your Google Drive MCP Server is now installed and configured. The next step is to complete the authentication flow to start using the server.