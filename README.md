<div align="center">

![Google Drive MCP Server](docs/images/hero-banner.png)

### **Your AI can reason. But can it check your calendar?**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-blueviolet)](https://modelcontextprotocol.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![v3.3.0](https://img.shields.io/badge/version-3.3.0-green)](https://github.com/AojdevStudio/gdrive/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/AojdevStudio/gdrive/pulls)

*The complete Google Workspace bridge for AI agents — 6 tools, 47 operations, one MCP server.*

[**See It In Action**](#see-it-in-action) · [**Quick Start**](#quick-start) · [**Documentation**](./docs/README.md)

</div>

---

## The Problem

AI agents can write code, analyze documents, and plan complex projects. But ask one to send an email, schedule a meeting, or update a spreadsheet — and it hits a wall.

- Your agent drafts a project plan but can't put it in Google Docs
- It analyzes data but can't write results back to Sheets
- It schedules tasks but can't check anyone's calendar
- It composes emails but can't actually send them

**Google Workspace is where work lives.** If your AI can't touch it, your AI can't finish the job.

> *You don't need a smarter model. You need a model that can reach the tools people actually use.*

---

## The Insight

<div align="center">

### **AI agents don't lack intelligence.**
### **They lack hands.**

</div>

The [Model Context Protocol](https://modelcontextprotocol.io) gives AI agents a standardized way to interact with external tools. But most MCP servers offer narrow integrations — a single API, a single service.

Google Workspace isn't a single service. It's six deeply interconnected products that 3 billion people use to do real work. An AI agent needs access to *all of them* — with proper auth, caching, and the kind of operation depth that goes beyond basic CRUD.

<div align="center">

## **One server. Six services. Full autonomy.**

</div>

---

## Introducing gdrive MCP Server

A production-ready MCP server that gives AI agents complete, secure access to Google Workspace.

| Service | Operations | Highlights |
|:--------|:-----------|:-----------|
| **Drive** | 7 | Search, enhanced search, read, create, update, batch operations |
| **Sheets** | 12 | Read/write cells, formulas, formatting, conditional formatting, freeze, column width |
| **Gmail** | 10 | List, search, read, draft, **send emails**, send drafts, manage labels |
| **Calendar** | 9 | Full CRUD, **natural language quickAdd**, free/busy checks |
| **Docs** | 5 | Create, insert text, replace, **rich text styling**, insert tables |
| **Forms** | 4 | Create forms, add questions, read responses |
| | **47 total** | |

Every tool uses an **operation-based pattern** — one tool per service with an `operation` parameter, not 47 separate tools cluttering your agent's context window.

---

## See It In Action

<details>
<summary><b>Send an email and schedule a follow-up — in two calls</b></summary>

```json
// 1. Send the email
{
  "tool": "gmail",
  "args": {
    "operation": "sendMessage",
    "to": "team@company.com",
    "subject": "Q1 Report Ready",
    "body": "The Q1 report is complete. Link: https://docs.google.com/..."
  }
}

// 2. Schedule the review meeting
{
  "tool": "calendar",
  "args": {
    "operation": "quickAdd",
    "text": "Q1 Report Review with team tomorrow at 2pm",
    "calendarId": "primary"
  }
}
```

</details>

<details>
<summary><b>Build a formatted spreadsheet from scratch</b></summary>

```json
// 1. Create the spreadsheet
{ "tool": "drive", "args": { "operation": "createFile", "name": "Sales Dashboard", "mimeType": "application/vnd.google-apps.spreadsheet" } }

// 2. Add data
{ "tool": "sheets", "args": { "operation": "updateCells", "spreadsheetId": "...", "range": "Sheet1!A1:D4",
    "values": [["Region", "Q1", "Q2", "Total"], ["North", 50000, 62000, ""], ["South", 43000, 51000, ""], ["West", 67000, 71000, ""]] } }

// 3. Add formulas
{ "tool": "sheets", "args": { "operation": "updateFormula", "spreadsheetId": "...", "range": "D2:D4", "formula": "=B2+C2" } }

// 4. Format the header row
{ "tool": "sheets", "args": { "operation": "formatCells", "spreadsheetId": "...", "sheetId": 0,
    "range": { "startRowIndex": 0, "endRowIndex": 1 },
    "format": { "textFormat": { "bold": true }, "backgroundColor": { "red": 0.2, "green": 0.4, "blue": 0.8 } } } }

// 5. Freeze the header
{ "tool": "sheets", "args": { "operation": "freezeRowsColumns", "spreadsheetId": "...", "sheetId": 0, "frozenRowCount": 1 } }
```

</details>

<details>
<summary><b>Check availability and book a meeting</b></summary>

```json
// 1. Check if everyone is free
{ "tool": "calendar", "args": { "operation": "checkFreeBusy",
    "timeMin": "2025-03-15T14:00:00Z", "timeMax": "2025-03-15T15:00:00Z",
    "items": ["alice@company.com", "bob@company.com"] } }

// 2. Book it
{ "tool": "calendar", "args": { "operation": "createEvent", "calendarId": "primary",
    "summary": "Design Review", "start": "2025-03-15T14:00:00Z", "end": "2025-03-15T15:00:00Z",
    "attendees": ["alice@company.com", "bob@company.com"],
    "description": "Reviewing the new dashboard designs" } }
```

</details>

---

## What's New in v3.3.0

The latest release brings major upgrades across every service:

### Sheets — Full Spreadsheet Control
| Operation | What It Does |
|:----------|:-------------|
| `updateFormula` | Write formulas to cells with automatic relative reference adjustment |
| `formatCells` | Cell formatting — colors, fonts, borders, number formats |
| `addConditionalFormat` | Conditional formatting rules (highlight trends, flag outliers) |
| `freezeRowsColumns` | Freeze header rows and columns |
| `setColumnWidth` | Adjust column widths for readability |
| `appendRows` | Native row appending (cleaner than manual range calculation) |

### Gmail — Actually Send Email
| Operation | What It Does |
|:----------|:-------------|
| `sendMessage` | Send emails directly — supports send-as aliases via `from` param |
| `sendDraft` | Send an existing draft |
| `modifyLabels` | Add/remove labels (archive, mark read, organize) |

### Calendar — Full CRUD + Smart Scheduling
| Operation | What It Does |
|:----------|:-------------|
| `quickAdd` | Natural language event creation — "Lunch with Mary tomorrow at noon" |
| `updateEvent` | Modify existing events |
| `deleteEvent` | Delete events with attendee notification options |
| `checkFreeBusy` | Check calendar availability for scheduling |

### Docs — Rich Document Editing
| Operation | What It Does |
|:----------|:-------------|
| `applyTextStyle` | Bold, italic, underline, colors, font sizes on text ranges |
| `insertTable` | Insert tables with custom dimensions |

### Drive — Smarter Search & Bulk Operations
| Operation | What It Does |
|:----------|:-------------|
| `enhancedSearch` | Natural language file search with intelligent filtering |
| `batchOperations` | Bulk create, update, delete, move operations |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Google Cloud project with OAuth credentials

> **New to Google Cloud?** Follow the [detailed setup guide](./docs/Guides/01-initial-setup.md).

### Install

```bash
git clone https://github.com/AojdevStudio/gdrive.git
cd gdrive
npm install && npm run build
```

### Authenticate

```bash
# Copy your OAuth credentials
mkdir -p credentials
cp /path/to/gcp-oauth.keys.json credentials/

# Generate encryption key and authenticate
export GDRIVE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
node ./dist/index.js auth
```

### Connect to Claude

**Claude Desktop** — add to your MCP config:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": ["/absolute/path/to/gdrive/dist/index.js"],
      "env": {
        "GDRIVE_TOKEN_ENCRYPTION_KEY": "your-key-here"
      }
    }
  }
}
```

**Claude Code CLI:**

```bash
claude mcp add --transport stdio gdrive -- node /path/to/gdrive/dist/index.js
```

### Docker (Recommended for Production)

```bash
# Authenticate on host first (opens browser)
./scripts/auth.sh

# Start with Redis caching
docker compose up -d --build

# Verify
docker compose ps
```

**Claude Desktop with Docker:**

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "docker",
      "args": ["exec", "-i", "gdrive-mcp-server", "node", "dist/index.js"]
    }
  }
}
```

---

## How It Works

<div align="center">

![Architecture](docs/images/architecture.png)

</div>

### Operation-Based Tool Pattern

Instead of 47 separate tools competing for your agent's attention, the server exposes **6 tools** with an `operation` parameter:

```typescript
// One tool per service, operation parameter for routing
{
  name: "sheets",
  args: {
    operation: "formatCells",    // ← The operation discriminator
    spreadsheetId: "abc123",
    sheetId: 0,
    range: { startRowIndex: 0, endRowIndex: 1 },
    format: { textFormat: { bold: true } }
  }
}
```

This means **88% fewer tools** in your agent's context window — faster tool selection, lower token cost, better results.

### Security

- **AES-256-GCM encryption** for all stored tokens
- **Automatic OAuth refresh** — authenticate once, works forever
- **Key rotation** with V1-V4 versioned keys
- **Redis caching** with intelligent invalidation (optional, graceful fallback)
- **Sandboxed execution** via isolated-vm
- **Comprehensive audit trail** in structured logs

---

## The Story

This project started because we kept hitting the same wall: AI agents that could think brilliantly but couldn't *do* anything in the real world.

Every time we wanted an agent to update a spreadsheet, check a calendar, or send an email, we had to leave the AI loop, do it manually, and come back. The agent was a great thinker trapped in a box.

MCP changed the game by giving agents a standard way to use tools. But the existing Google integrations were shallow — basic file read/write, no formatting, no email sending, no calendar management. We needed something that matched the depth of what people actually do in Google Workspace every day.

So we built it. Starting with Drive and Sheets, then Forms and Docs, then Gmail (with actual sending, not just drafts), and finally Calendar with full CRUD and natural language scheduling. Each release driven by the same question: *"What does an agent need to actually finish this job without human intervention?"*

<div align="center">

### The best AI assistant isn't the smartest one. It's the one that can actually get things done.

</div>

---

## Complete API Reference

### All 47 Operations

<details>
<summary><b>Drive — 7 operations</b></summary>

| Operation | Description |
|:----------|:------------|
| `search` | Search files with queries |
| `enhancedSearch` | Natural language search with intelligent filtering |
| `read` | Read file content (auto-converts Google formats) |
| `createFile` | Create new files |
| `createFolder` | Create new folders |
| `updateFile` | Update existing files |
| `batchOperations` | Bulk create/update/delete/move |

</details>

<details>
<summary><b>Sheets — 12 operations</b></summary>

| Operation | Description |
|:----------|:------------|
| `listSheets` | List all sheets in a spreadsheet |
| `readSheet` | Read data from a range |
| `createSheet` | Create a new sheet tab |
| `renameSheet` | Rename a sheet tab |
| `deleteSheet` | Delete a sheet tab |
| `updateCells` | Write values to cells |
| `updateFormula` | Write formulas with relative reference support |
| `formatCells` | Apply formatting (bold, colors, borders, number formats) |
| `addConditionalFormat` | Add conditional formatting rules |
| `freezeRowsColumns` | Freeze header rows/columns |
| `setColumnWidth` | Adjust column widths |
| `appendRows` | Append rows to end of data |

</details>

<details>
<summary><b>Gmail — 10 operations</b></summary>

| Operation | Description |
|:----------|:------------|
| `listMessages` | List messages with optional query |
| `listThreads` | List email threads |
| `getMessage` | Get full message content |
| `getThread` | Get full thread content |
| `searchMessages` | Advanced message search |
| `createDraft` | Create email draft |
| `sendMessage` | Send email (supports send-as aliases) |
| `sendDraft` | Send an existing draft |
| `listLabels` | List all Gmail labels |
| `modifyLabels` | Add/remove labels on messages |

</details>

<details>
<summary><b>Calendar — 9 operations</b></summary>

| Operation | Description |
|:----------|:------------|
| `listCalendars` | List available calendars |
| `getCalendar` | Get calendar details |
| `listEvents` | List events in a time range |
| `getEvent` | Get event details |
| `createEvent` | Create a new event with attendees |
| `updateEvent` | Modify an existing event |
| `deleteEvent` | Delete event with notification options |
| `quickAdd` | Natural language event creation |
| `checkFreeBusy` | Check availability for scheduling |

</details>

<details>
<summary><b>Docs — 5 operations</b></summary>

| Operation | Description |
|:----------|:------------|
| `createDocument` | Create a new document |
| `insertText` | Insert text at a position |
| `replaceText` | Find and replace text |
| `applyTextStyle` | Apply formatting (bold, italic, colors, fonts) |
| `insertTable` | Insert a table with custom dimensions |

</details>

<details>
<summary><b>Forms — 4 operations</b></summary>

| Operation | Description |
|:----------|:------------|
| `createForm` | Create a new form |
| `readForm` | Get form structure and details |
| `addQuestion` | Add questions (text, multiple choice, checkboxes, scales) |
| `listResponses` | Retrieve form responses |

</details>

---

## Roadmap

- [x] Google Drive — file management and search
- [x] Google Sheets — full spreadsheet control with formatting
- [x] Google Forms — form creation and response management
- [x] Google Docs — document creation and rich text editing
- [x] Gmail — complete email management including send
- [x] Calendar — full CRUD with natural language scheduling
- [ ] Google Slides — presentation creation and editing
- [ ] Google Chat — workspace messaging integration
- [ ] Contacts — contact management and lookup
- [ ] Tasks — Google Tasks integration

## Contributing

We welcome contributions! The codebase is TypeScript with a clean module structure:

```
src/modules/
  drive/     — 9 files
  sheets/    — 9 files
  gmail/     — 12 files
  calendar/  — 13 files
  docs/      — 2 files
  forms/     — 7 files
```

1. Fork and create a feature branch
2. Follow existing TypeScript/ESLint conventions
3. Add tests (Jest) and update docs
4. `npm run lint && npm test && npm run build`
5. Open a PR with a clear description

**[Contributing Guide](./CONTRIBUTING.md)** · **[Development Setup](./docs/Developer-Guidelines/README.md)**

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<div align="center">

**Your AI agent can now do everything you do in Google Workspace.**

If this project helps your agents get work done, [give it a star](https://github.com/AojdevStudio/gdrive).

[![Star History Chart](https://api.star-history.com/svg?repos=AojdevStudio/gdrive&type=Date)](https://star-history.com/#AojdevStudio/gdrive&Date)

</div>
