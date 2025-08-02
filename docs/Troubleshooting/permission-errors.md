# Permission Errors

This guide covers Google Drive permission and access issues, including insufficient permissions, scope configuration problems, and file access restrictions.

## 🔍 Quick Diagnosis

### Check Permission Status
```bash
# Test basic Drive access
echo '{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {"query": "test", "pageSize": 1}
  }
}' | node ./dist/index.js

# Check authentication scopes
node -e "
const fs = require('fs');
const tokens = JSON.parse(fs.readFileSync('credentials/gcp-oauth.keys.json'));
console.log('OAuth client type:', tokens.installed ? 'Desktop' : 'Web');
"

# Review recent permission errors
grep -i "permission\|forbidden\|unauthorized" logs/error.log | tail -10
```

### Verify API Enablement
```bash
# Check which APIs are enabled in your project
gcloud services list --enabled --project=YOUR_PROJECT_ID

# Or check manually in Google Cloud Console:
# https://console.cloud.google.com/apis/dashboard
```

## 🚨 Common Permission Issues

### 1. Insufficient OAuth Scopes

**Symptoms:**
- Error: `Insufficient Permission`
- Error: `Request had insufficient authentication scopes`
- Some operations work while others fail
- Authentication succeeds but API calls are rejected

**Required Scopes:**
The server requires these OAuth 2.0 scopes:

| Scope | Purpose | APIs Enabled |
|-------|---------|-------------|
| `https://www.googleapis.com/auth/drive` | Full Drive access | Files, folders, search |
| `https://www.googleapis.com/auth/spreadsheets` | Sheets access | Read/write spreadsheets |
| `https://www.googleapis.com/auth/documents` | Docs access | Create/edit documents |
| `https://www.googleapis.com/auth/forms` | Forms access | Create/manage forms |
| `https://www.googleapis.com/auth/script.projects.readonly` | Apps Script | Read project code |

**Solutions:**

#### Update OAuth Consent Screen
1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Click "Edit App"
3. Go to "Scopes" section
4. Add missing scopes:
   ```
   https://www.googleapis.com/auth/drive
   https://www.googleapis.com/auth/spreadsheets
   https://www.googleapis.com/auth/documents
   https://www.googleapis.com/auth/forms
   https://www.googleapis.com/auth/script.projects.readonly
   ```
5. Save changes

#### Re-authenticate with New Scopes
```bash
# Remove old tokens
rm credentials/.gdrive-mcp-tokens.json

# Re-authenticate to get new scopes
./scripts/auth.sh

# Verify all scopes are granted
node ./dist/index.js health
```

### 2. API Not Enabled

**Symptoms:**
- Error: `API has not been used in project`
- Error: `SERVICE_DISABLED`
- Specific API calls fail while others work

**Required APIs:**
Verify these APIs are enabled in your Google Cloud project:

- Google Drive API
- Google Sheets API  
- Google Docs API
- Google Forms API
- Google Apps Script API

**Solutions:**

#### Enable APIs via gcloud CLI
```bash
# Enable all required APIs
gcloud services enable drive.googleapis.com --project=YOUR_PROJECT_ID
gcloud services enable sheets.googleapis.com --project=YOUR_PROJECT_ID
gcloud services enable docs.googleapis.com --project=YOUR_PROJECT_ID
gcloud services enable forms.googleapis.com --project=YOUR_PROJECT_ID
gcloud services enable script.googleapis.com --project=YOUR_PROJECT_ID

# Verify APIs are enabled
gcloud services list --enabled --project=YOUR_PROJECT_ID | grep -E "drive|sheets|docs|forms|script"
```

#### Enable APIs via Console
1. Go to [API Library](https://console.cloud.google.com/apis/library)
2. Search for and enable each API:
   - "Google Drive API" → Enable
   - "Google Sheets API" → Enable
   - "Google Docs API" → Enable
   - "Google Forms API" → Enable
   - "Google Apps Script API" → Enable

### 3. File Access Restrictions

**Symptoms:**
- Error: `File not found` for files that exist
- Error: `The user does not have sufficient permissions`
- Can see files in search but can't read content
- Operations work for some files but not others

**Causes:**
- Files are shared with limited permissions
- Files are in Team Drives with restrictions
- Files are owned by different accounts
- Organization policies restrict access

**Solutions:**

#### Check File Permissions
```bash
# Test file access with specific file ID
echo '{
  "method": "tools/call",
  "params": {
    "name": "read",
    "arguments": {"fileId": "YOUR_FILE_ID"}
  }
}' | node ./dist/index.js

# Search for files you own
echo '{
  "method": "tools/call",
  "params": {
    "name": "enhancedSearch",
    "arguments": {
      "query": "'me' in owners",
      "pageSize": 10
    }
  }
}' | node ./dist/index.js
```

#### Grant Proper File Permissions
1. **For individual files:**
   - Open file in Google Drive web interface
   - Click "Share" button
   - Add your OAuth email with "Editor" or "Owner" permissions

2. **For folders:**
   - Share the parent folder with appropriate permissions
   - Permissions inherit to contained files

3. **For Team Drives:**
   - Request access from Team Drive administrators
   - Ensure your account has appropriate Team Drive permissions

### 4. Organization Policy Restrictions

**Symptoms:**
- Error: `Access blocked by organization policy`
- Error: `External sharing is not allowed`
- Authentication works but all operations are blocked
- Different behavior between personal and work accounts

**Solutions:**

#### For Google Workspace Organizations
1. **Contact Admin:**
   - Work with your Google Workspace administrator
   - Request approval for the OAuth application
   - Provide application details and required scopes

2. **Admin Console Configuration:**
   Administrators need to:
   - Go to [Google Admin Console](https://admin.google.com)
   - Navigate to Security → API Controls
   - Add your OAuth Client ID to trusted applications
   - Configure appropriate API access settings

#### For Personal Accounts
```bash
# Switch to personal Google account for testing
# Remove organization-managed tokens
rm credentials/.gdrive-mcp-tokens.json

# Re-authenticate with personal account
./scripts/auth.sh
# Use personal Google account during OAuth flow
```

### 5. Service Account vs User Account Issues

**Symptoms:**
- Error: `Service accounts cannot access user files`
- Error: `Domain-wide delegation not configured`
- OAuth flow works but files are not accessible

**Note:** This server uses OAuth 2.0 user authentication, not service accounts.

**Solutions:**

#### Verify OAuth Configuration
```bash
# Check that you're using OAuth client credentials, not service account
node -e "
const fs = require('fs');
const oauth = JSON.parse(fs.readFileSync('credentials/gcp-oauth.keys.json'));
if (oauth.installed) {
  console.log('✅ Using OAuth client (correct)');
  console.log('Client ID:', oauth.installed.client_id);
} else if (oauth.web) {
  console.log('✅ Using OAuth web client (correct)');
  console.log('Client ID:', oauth.web.client_id);
} else if (oauth.type === 'service_account') {
  console.log('❌ Using service account (incorrect)');
  console.log('Please use OAuth client credentials instead');
} else {
  console.log('⚠️  Unknown credential type');
}
"
```

#### Convert from Service Account to OAuth
If you're accidentally using service account credentials:

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Create new "OAuth client ID" (not service account)
3. Choose "Desktop application"
4. Download JSON file and replace your current credentials

## ⚙️ Advanced Permission Management

### 1. Domain-Specific Configurations

#### For Google Workspace Domains
```bash
# Configure for domain-restricted access
export GDRIVE_DOMAIN_RESTRICTION="your-domain.com"
export GDRIVE_REQUIRE_DOMAIN_VALIDATION=true

# Test domain-restricted search
echo '{
  "method": "tools/call",
  "params": {
    "name": "enhancedSearch",
    "arguments": {
      "query": "domain:your-domain.com",
      "pageSize": 10
    }
  }
}' | node ./dist/index.js
```

### 2. Permission Scoping by Feature

Optimize permissions for specific use cases:

#### Read-Only Configuration
```bash
# For read-only applications, use minimal scopes
# Update OAuth consent screen to only include:
# - https://www.googleapis.com/auth/drive.readonly
# - https://www.googleapis.com/auth/spreadsheets.readonly
# - https://www.googleapis.com/auth/documents.readonly
```

#### Write-Heavy Configuration
```bash
# For applications that create many files
# Ensure these scopes are included:
# - https://www.googleapis.com/auth/drive.file
# - https://www.googleapis.com/auth/spreadsheets
# - https://www.googleapis.com/auth/documents
```

### 3. Permission Testing Framework

```bash
#!/bin/bash
# save as test-permissions.sh

echo "Testing Google Drive MCP Server Permissions"
echo "=========================================="

# Test basic Drive access
echo "1. Testing Drive API access..."
SEARCH_RESULT=$(echo '{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {"query": "test", "pageSize": 1}
  }
}' | node ./dist/index.js 2>&1)

if echo "$SEARCH_RESULT" | grep -q "error"; then
    echo "❌ Drive API: FAILED"
    echo "$SEARCH_RESULT" | grep "error"
else
    echo "✅ Drive API: OK"
fi

# Test Sheets access
echo "\n2. Testing Sheets API access..."
SHEETS_RESULT=$(echo '{
  "method": "tools/call",
  "params": {
    "name": "createFile",
    "arguments": {
      "name": "Permission Test Sheet",
      "mimeType": "application/vnd.google-apps.spreadsheet"
    }
  }
}' | node ./dist/index.js 2>&1)

if echo "$SHEETS_RESULT" | grep -q "error"; then
    echo "❌ Sheets API: FAILED"
else
    echo "✅ Sheets API: OK"
fi

# Test Docs access
echo "\n3. Testing Docs API access..."
DOCS_RESULT=$(echo '{
  "method": "tools/call",
  "params": {
    "name": "createDocument",
    "arguments": {
      "title": "Permission Test Document",
      "content": "Test content"
    }
  }
}' | node ./dist/index.js 2>&1)

if echo "$DOCS_RESULT" | grep -q "error"; then
    echo "❌ Docs API: FAILED"
else
    echo "✅ Docs API: OK"
fi

# Test Forms access
echo "\n4. Testing Forms API access..."
FORMS_RESULT=$(echo '{
  "method": "tools/call",
  "params": {
    "name": "createForm",
    "arguments": {
      "title": "Permission Test Form",
      "description": "Test form"
    }
  }
}' | node ./dist/index.js 2>&1)

if echo "$FORMS_RESULT" | grep -q "error"; then
    echo "❌ Forms API: FAILED"
else
    echo "✅ Forms API: OK"
fi

echo "\nPermission test completed."
```

## 🔧 Diagnostic Tools

### Permission Audit Script

```bash
#!/bin/bash
# save as audit-permissions.sh

echo "Google Drive MCP Server - Permission Audit"
echo "==========================================="

# Check OAuth configuration
echo "OAuth Configuration:"
if [[ -f "credentials/gcp-oauth.keys.json" ]]; then
    node -e "
    const fs = require('fs');
    const oauth = JSON.parse(fs.readFileSync('credentials/gcp-oauth.keys.json'));
    if (oauth.installed) {
        console.log('Type: Desktop Application');
        console.log('Client ID:', oauth.installed.client_id);
        console.log('Project ID:', oauth.installed.project_id || 'Not specified');
    } else if (oauth.web) {
        console.log('Type: Web Application');
        console.log('Client ID:', oauth.web.client_id);
    } else {
        console.log('Type: Unknown or invalid');
    }
    "
else
    echo "❌ OAuth configuration file not found"
fi

# Check API enablement
echo "\nAPI Status (requires gcloud CLI):"
if command -v gcloud &> /dev/null; then
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [[ -n "$PROJECT_ID" ]]; then
        echo "Project: $PROJECT_ID"
        
        APIS=("drive.googleapis.com" "sheets.googleapis.com" "docs.googleapis.com" "forms.googleapis.com" "script.googleapis.com")
        for api in "${APIS[@]}"; do
            if gcloud services list --enabled --filter="name:$api" --project="$PROJECT_ID" 2>/dev/null | grep -q "$api"; then
                echo "✅ $api: Enabled"
            else
                echo "❌ $api: Not enabled"
            fi
        done
    else
        echo "No gcloud project configured"
    fi
else
    echo "gcloud CLI not available"
fi

# Check recent permission errors
echo "\nRecent Permission Errors (last 24 hours):"
if [[ -f "logs/error.log" ]]; then
    grep "$(date '+%Y-%m-%d')" logs/error.log | grep -i "permission\|forbidden\|unauthorized" | tail -5
else
    echo "No error log found"
fi

echo "\nRecommendations:"
echo "- Verify all required APIs are enabled"
echo "- Check OAuth consent screen includes all necessary scopes"
echo "- Test with files you own before accessing shared files"
echo "- Contact organization admin if using Google Workspace"
```

### Scope Verification Tool

```bash
#!/bin/bash
# save as verify-scopes.sh

echo "OAuth Scope Verification"
echo "======================="

# Required scopes
REQUIRED_SCOPES=(
    "https://www.googleapis.com/auth/drive"
    "https://www.googleapis.com/auth/spreadsheets"
    "https://www.googleapis.com/auth/documents"
    "https://www.googleapis.com/auth/forms"
    "https://www.googleapis.com/auth/script.projects.readonly"
)

echo "Required scopes for full functionality:"
for scope in "${REQUIRED_SCOPES[@]}"; do
    echo "- $scope"
done

echo "\nTo update scopes:"
echo "1. Go to: https://console.cloud.google.com/apis/credentials/consent"
echo "2. Edit your OAuth consent screen"
echo "3. Add missing scopes in the 'Scopes' section"
echo "4. Save changes"
echo "5. Re-authenticate: ./scripts/auth.sh"
```

## 🛡️ Prevention Strategies

### 1. Automated Permission Monitoring

```bash
# Add to crontab for daily permission checks
0 9 * * * /path/to/test-permissions.sh >> /path/to/permission-check.log 2>&1
```

### 2. Documentation for Team

```markdown
# Team Permission Setup Guide

## For New Team Members:

1. **Google Cloud Setup:**
   - Access to project: PROJECT_ID
   - Required role: Editor or Owner

2. **OAuth Configuration:**
   - Use provided gcp-oauth.keys.json
   - Never share this file publicly

3. **Required Google Account Permissions:**
   - Access to shared Drive folders
   - Permission to create files in team folders
   - Organization policy exceptions (if applicable)

## For Administrators:

1. **Project Configuration:**
   - Enable all required APIs
   - Configure OAuth consent screen
   - Set up appropriate IAM permissions

2. **Organization Policies:**
   - Allow OAuth application in Admin Console
   - Configure API access controls
   - Set up audit logging
```

### 3. Permission Recovery Procedures

```bash
# Emergency permission recovery
#!/bin/bash
# save as recover-permissions.sh

echo "Emergency Permission Recovery"
echo "============================"

# Step 1: Verify basic authentication
echo "1. Testing authentication..."
if node ./dist/index.js health | grep -q "HEALTHY"; then
    echo "✅ Authentication working"
else
    echo "❌ Authentication failed - run: ./scripts/auth.sh"
    exit 1
fi

# Step 2: Test with minimal permissions
echo "\n2. Testing basic Drive access..."
echo '{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "'me' in owners", "pageSize": 1}}}' | \
    node ./dist/index.js > /tmp/permission-test.json 2>&1

if grep -q "error" /tmp/permission-test.json; then
    echo "❌ Basic access failed"
    echo "Likely causes:"
    echo "- Missing OAuth scopes"
    echo "- APIs not enabled"
    echo "- Organization restrictions"
    
    echo "\nImmediate actions:"
    echo "1. Check: https://console.cloud.google.com/apis/dashboard"
    echo "2. Verify: https://console.cloud.google.com/apis/credentials/consent"
    echo "3. Re-authenticate: ./scripts/auth.sh"
else
    echo "✅ Basic access working"
fi

# Step 3: Test advanced features
echo "\n3. Testing advanced features..."
echo "Run: ./test-permissions.sh for detailed testing"
```

## 🆘 Emergency Recovery

If permissions are completely broken:

### Complete Permission Reset
```bash
#!/bin/bash
echo "Complete Permission Reset"
echo "========================"

# 1. Clean slate authentication
rm -f credentials/.gdrive-mcp-tokens.json
echo "Removed existing tokens"

# 2. Verify OAuth configuration
if [[ ! -f "credentials/gcp-oauth.keys.json" ]]; then
    echo "❌ Missing OAuth configuration"
    echo "Download from: https://console.cloud.google.com/apis/credentials"
    exit 1
fi

# 3. Check API enablement
echo "Verify these APIs are enabled:"
echo "https://console.cloud.google.com/apis/library/drive.googleapis.com"
echo "https://console.cloud.google.com/apis/library/sheets.googleapis.com"
echo "https://console.cloud.google.com/apis/library/docs.googleapis.com"
echo "https://console.cloud.google.com/apis/library/forms.googleapis.com"
echo "https://console.cloud.google.com/apis/library/script.googleapis.com"

# 4. Update OAuth consent screen
echo "\nUpdate OAuth consent screen:"
echo "https://console.cloud.google.com/apis/credentials/consent"
echo "Add all required scopes (see verify-scopes.sh)"

# 5. Re-authenticate
echo "\nPress Enter after completing API/OAuth setup to re-authenticate..."
read
./scripts/auth.sh

# 6. Verify recovery
echo "\nTesting recovery..."
node ./dist/index.js health
```

---

For specific permission-related error messages, see the [Error Messages Reference](./error-messages.md).