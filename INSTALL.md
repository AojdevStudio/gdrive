# INSTALL.md — Agentic Cloudflare Workers Setup

<!--
  FOR AI AGENTS: This file is written for you to read and execute interactively.

  Rules:
  - Read this entire file before starting.
  - Use the AskUserQuestion tool for every step marked ASK:
  - Run all bash commands directly — do NOT ask the user to run them.
  - Steps marked USER ACTION: require browser interaction — provide clear instructions
    and wait for the user to confirm before proceeding.
  - Verify each phase passes before moving to the next.
  - If a command fails, diagnose the root cause and fix it. Do not ask the user to
    re-run the command themselves.

  Estimated time: 15–20 minutes.
-->

## Overview

This guide deploys the gdrive MCP server to Cloudflare Workers, giving any MCP client
(Claude Code, Claude Desktop, etc.) access to your Google Workspace via a permanent URL.

After setup, token refresh is automatic — you authenticate once and it works forever.

---

## Phase 1: Prerequisites Check

### 1.1 Node.js

Run: `node --version`

- If the output is `v18.x.x` or higher: proceed.
- If lower than 18 or not found: tell the user they need Node.js 18+ and link to
  https://nodejs.org — pause until they confirm it is installed.

### 1.2 Wrangler CLI

Run: `npx wrangler --version`

- If it prints a version: proceed.
- If not found: run `npm install -g wrangler`, then verify with `npx wrangler --version`.

### 1.3 Cloudflare Login

Run: `npx wrangler whoami`

- If it shows an account name: note the account name and proceed to Phase 2.
- If it says "not authenticated": run `npx wrangler login`.
  This opens a browser for Cloudflare OAuth. Tell the user to complete it,
  then re-run `npx wrangler whoami` to confirm.

---

## Phase 2: Google Cloud Project

**ASK:** "Do you already have a Google Cloud project with OAuth credentials (`gcp-oauth.keys.json`)?"

Options:
- "Yes — I have the credentials file ready"
- "No — I need to set up a Google Cloud project"

### If YES — credentials ready

**ASK:** "What is the full path to your `gcp-oauth.keys.json` file?"

Run:
```bash
mkdir -p credentials
cp "[path from user]" credentials/gcp-oauth.keys.json
```

Verify it is valid JSON:
```bash
node -e "JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json')); console.log('Valid credentials file')"
```

Skip to Phase 3.

---

### If NO — full Google Cloud setup

#### 2.1 Create Google Cloud Project

**USER ACTION:** Open https://console.cloud.google.com/projectcreate

Tell the user:
> "Create a new project with any name (e.g. `gdrive-mcp`). Click **Create** and wait for
> it to finish. Then make sure the new project is selected in the top dropdown.
> Tell me when you're on the project dashboard."

#### 2.2 Enable Required APIs

**USER ACTION:** Tell the user to open each link below and click **Enable** for each API:

1. Google Drive API — https://console.cloud.google.com/apis/library/drive.googleapis.com
2. Google Sheets API — https://console.cloud.google.com/apis/library/sheets.googleapis.com
3. Google Docs API — https://console.cloud.google.com/apis/library/docs.googleapis.com
4. Google Forms API — https://console.cloud.google.com/apis/library/forms.googleapis.com
5. Gmail API — https://console.cloud.google.com/apis/library/gmail.googleapis.com
6. Google Calendar API — https://console.cloud.google.com/apis/library/calendar-json.googleapis.com

> "Open each link, click Enable, and wait for the status to show 'API enabled'.
> Come back and tell me when all 6 are done."

#### 2.3 OAuth Consent Screen

**USER ACTION:** Open https://console.cloud.google.com/apis/credentials/consent

Tell the user:
> "Configure the OAuth consent screen:
> 1. User type: choose **External** (unless you have a Google Workspace org, then **Internal**)
> 2. App name: `Google Drive MCP Server`
> 3. User support email: your email address
> 4. Developer contact: your email address
> 5. Click **Save and Continue**
> 6. On the Scopes page, click **Add or Remove Scopes** and add these exact scopes:
>    - `https://www.googleapis.com/auth/drive`
>    - `https://www.googleapis.com/auth/spreadsheets`
>    - `https://www.googleapis.com/auth/documents`
>    - `https://www.googleapis.com/auth/forms.body`
>    - `https://www.googleapis.com/auth/gmail.modify`
>    - `https://www.googleapis.com/auth/calendar`
> 7. Click **Save and Continue**
> 8. On the Test users page, click **Add Users** and add your Google email
> 9. Click **Save and Continue**, then **Back to Dashboard**
> Tell me when done."

#### 2.4 Create OAuth Client ID

**USER ACTION:** Open https://console.cloud.google.com/apis/credentials

Tell the user:
> "Create OAuth credentials:
> 1. Click **Create Credentials** → **OAuth client ID**
> 2. Application type: **Desktop application**
> 3. Name: `gdrive-mcp-server`
> 4. Click **Create**
> 5. In the popup, click **Download JSON**
> 6. Save the file — you'll need to tell me the path"

**ASK:** "What is the full path to the JSON file you just downloaded?"

Run:
```bash
mkdir -p credentials
cp "[path from user]" credentials/gcp-oauth.keys.json
```

Verify:
```bash
node -e "const k=JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json')); console.log('Type:', k.installed ? 'Desktop app (correct)' : k.web ? 'Web app (wrong type)' : 'Unknown')"
```

If the output says "Web app (wrong type)": tell the user they need to go back and create
a **Desktop application** credential, not a Web application. Walk them through it again.

---

## Phase 3: Local Authentication

This step authenticates with Google locally. The tokens are saved to `.tokens.json`,
then uploaded to Cloudflare KV so the Worker can use them.

### 3.1 Build the project

```bash
npm run build
```

If the build fails: check the error, fix TypeScript issues, and retry.

### 3.2 Generate encryption key

```bash
GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "GDRIVE_TOKEN_ENCRYPTION_KEY=$GDRIVE_TOKEN_ENCRYPTION_KEY" > .env
echo "Encryption key generated and saved to .env"
```

### 3.3 Run the OAuth flow

```bash
node ./dist/index.js auth
```

**USER ACTION:** Tell the user:
> "A browser window should have opened. Sign in with your Google account and grant
> all the requested permissions (Drive, Sheets, Docs, Forms, Gmail, Calendar).
> After approving, you'll see a success message in the terminal.
> Come back and tell me when it's done."

### 3.4 Verify tokens saved

```bash
ls -la .tokens.json 2>/dev/null && echo "Tokens saved successfully" || echo "ERROR: .tokens.json not found — auth may have failed"
```

If `.tokens.json` is missing: ask the user what error appeared in the terminal and
diagnose the auth failure before proceeding.

---

## Phase 4: Cloudflare KV Setup

### 4.1 Create KV namespace

```bash
npx wrangler kv:namespace create GDRIVE_KV --preview false
```

Parse the output. It will contain a line like:
```
{ binding = "GDRIVE_KV", id = "abc123..." }
```

Extract the namespace ID from the output.

### 4.2 Update wrangler.toml with namespace ID

Read the current `wrangler.toml`, find the `[[kv_namespaces]]` section,
and replace the `id` value with the namespace ID you just created.

Verify:
```bash
grep "id" wrangler.toml
```

The id should match what wrangler printed.

### 4.3 Upload tokens to KV

```bash
NAMESPACE_ID=$(grep -A2 '\[\[kv_namespaces\]\]' wrangler.toml | grep '^id' | awk -F'"' '{print $2}')
npx wrangler kv:key put --namespace-id="$NAMESPACE_ID" "gdrive:oauth:tokens" "$(cat .tokens.json)"
```

If this fails because `$NAMESPACE_ID` is empty: read `wrangler.toml` directly and use
the literal ID value from the file.

### 4.4 Extract OAuth credentials from credentials file

```bash
CLIENT_ID=$(node -e "const k=JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json')); console.log(k.installed?.client_id || k.web?.client_id)")
CLIENT_SECRET=$(node -e "const k=JSON.parse(require('fs').readFileSync('credentials/gcp-oauth.keys.json')); console.log(k.installed?.client_secret || k.web?.client_secret)")
echo "Client ID: $CLIENT_ID"
```

### 4.5 Set Wrangler secrets

```bash
echo "$CLIENT_ID" | npx wrangler secret put GDRIVE_CLIENT_ID
echo "$CLIENT_SECRET" | npx wrangler secret put GDRIVE_CLIENT_SECRET
```

Verify both are set:
```bash
npx wrangler secret list
```

Should show `GDRIVE_CLIENT_ID` and `GDRIVE_CLIENT_SECRET`.

---

## Phase 5: Deploy

```bash
npx wrangler deploy
```

Note the URL printed in the output — it looks like `https://gdrive-mcp.[account].workers.dev`.

Verify the worker is alive:
```bash
WORKER_URL=$(npx wrangler deployments list 2>/dev/null | grep -o 'https://[^ ]*' | head -1)
if [ -z "$WORKER_URL" ]; then
  # Fallback: ask the user for the URL from the deploy output
  echo "Please tell me the URL from the deploy output above."
else
  curl -s "$WORKER_URL" && echo "Worker is responding"
fi
```

---

## Phase 6: Configure Claude Code

**ASK:** "How would you like to connect this MCP server to Claude Code?"

Options:
- "User scope — available in all my projects (Recommended)"
- "Project scope — only this project"

Use the worker URL from Phase 5 deploy output.

**For user scope:**
```bash
claude mcp add --scope user --transport http gdrive [WORKER_URL]/mcp
```

**For project scope:**
```bash
claude mcp add --scope project --transport http gdrive [WORKER_URL]/mcp
```

Verify it was added:
```bash
claude mcp list
```

Should show `gdrive` with the worker URL.

---

## Done

Summarize for the user what was set up:

- **Worker URL:** [URL from Phase 5]
- **KV namespace:** [ID from Phase 4]
- **Claude Code scope:** [user/project from Phase 6]
- **Token refresh:** Automatic — the Worker refreshes tokens as needed

**Next step:** Start a new Claude Code session. The `gdrive` MCP tool is now available.
Try: *"List my Google Drive files"* or *"What's on my calendar today?"*
