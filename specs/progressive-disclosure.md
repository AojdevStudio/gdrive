# Progressive Disclosure Implementation Plan

**Date:** 2025-11-10
**Status:** Planning
**Goal:** Reduce token usage from 2,500 tokens (40+ tools) to ~200 tokens (operation-based tools)

---

## Problem Statement

Current v2.x implementation registers 40+ individual tools upfront:
- `search`, `read`, `createFile`, `updateFile`, `listSheets`, `readSheet`, `updateCells`, etc.
- Each tool has full schema definition with parameters
- **Total token cost:** ~2,500 tokens per session
- **Impact:** Fills context window before user even starts

---

## Solution: Progressive Disclosure with Operation-Based Tools

### Concept
Instead of 40+ tools, register **ONE tool per API domain** that takes an `operation` parameter:

```typescript
// Upfront tools (200 tokens):
- drive (operations: search, read, create, update, delete)
- sheets (operations: listSheets, readSheet, updateCells, formatCells, etc.)
- forms (operations: createForm, readForm, addQuestion, listResponses)
- docs (operations: createDocument, insertText, replaceText, applyTextStyle)
```

When Claude needs details about operations, it reads `gdrive://tools` resource.

---

## Architecture

### 1. Tools Registration (Minimal)

**File:** `index.ts` - `ListToolsRequestSchema` handler

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "drive",
        description: "Google Drive operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["search", "enhancedSearch", "read", "createFile", "createFolder", "updateFile", "batchOperations"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "sheets",
        description: "Google Sheets operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["listSheets", "readSheet", "createSheet", "renameSheet", "deleteSheet", "updateCells", "updateFormula", "formatCells", "addConditionalFormat", "freezeRowsColumns", "setColumnWidth", "appendRows"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "forms",
        description: "Google Forms operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["createForm", "readForm", "addQuestion", "listResponses"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "docs",
        description: "Google Docs operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["createDocument", "insertText", "replaceText", "applyTextStyle", "insertTable"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      }
    ]
  };
});
```

**Token estimate:** ~200 tokens (vs 2,500 for v2.x)

---

### 2. Tool Handler (Dynamic Dispatch)

**File:** `index.ts` - `CallToolRequestSchema` handler

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();

  try {
    if (!authManager || authManager.getState() !== AuthState.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run with "auth" argument first.');
    }

    const { name, arguments: args } = request.params;
    const { operation, params } = args as { operation: string; params: unknown };

    logger.info('Tool called', { tool: name, operation, params });

    // Build context for operations
    const context = {
      logger,
      drive,
      sheets,
      forms,
      docs,
      cacheManager,
      performanceMonitor,
      startTime,
    };

    let result;

    switch (name) {
      case "drive": {
        const driveModule = await import('./src/modules/drive/index.js');

        switch (operation) {
          case "search":
            result = await driveModule.search(params, context);
            break;
          case "enhancedSearch":
            result = await driveModule.enhancedSearch(params, context);
            break;
          case "read":
            result = await driveModule.read(params, context);
            break;
          case "createFile":
            result = await driveModule.createFile(params, context);
            break;
          case "createFolder":
            result = await driveModule.createFolder(params, context);
            break;
          case "updateFile":
            result = await driveModule.updateFile(params, context);
            break;
          case "batchOperations":
            result = await driveModule.batchOperations(params, context);
            break;
          default:
            throw new Error(`Unknown drive operation: ${operation}`);
        }
        break;
      }

      case "sheets": {
        const sheetsModule = await import('./src/modules/sheets/index.js');

        switch (operation) {
          case "listSheets":
            result = await sheetsModule.listSheets(params, context);
            break;
          case "readSheet":
            result = await sheetsModule.readSheet(params, context);
            break;
          case "createSheet":
            result = await sheetsModule.createSheet(params, context);
            break;
          case "renameSheet":
            result = await sheetsModule.renameSheet(params, context);
            break;
          case "deleteSheet":
            result = await sheetsModule.deleteSheet(params, context);
            break;
          case "updateCells":
            result = await sheetsModule.updateCells(params, context);
            break;
          case "updateFormula":
            result = await sheetsModule.updateFormula(params, context);
            break;
          case "formatCells":
            result = await sheetsModule.formatCells(params, context);
            break;
          case "addConditionalFormat":
            result = await sheetsModule.addConditionalFormat(params, context);
            break;
          case "freezeRowsColumns":
            result = await sheetsModule.freezeRowsColumns(params, context);
            break;
          case "setColumnWidth":
            result = await sheetsModule.setColumnWidth(params, context);
            break;
          case "appendRows":
            result = await sheetsModule.appendRows(params, context);
            break;
          default:
            throw new Error(`Unknown sheets operation: ${operation}`);
        }
        break;
      }

      case "forms": {
        const formsModule = await import('./src/modules/forms/index.js');

        switch (operation) {
          case "createForm":
            result = await formsModule.createForm(params, context);
            break;
          case "readForm":
            result = await formsModule.readForm(params, context);
            break;
          case "addQuestion":
            result = await formsModule.addQuestion(params, context);
            break;
          case "listResponses":
            result = await formsModule.listResponses(params, context);
            break;
          default:
            throw new Error(`Unknown forms operation: ${operation}`);
        }
        break;
      }

      case "docs": {
        const docsModule = await import('./src/modules/docs/index.js');

        switch (operation) {
          case "createDocument":
            result = await docsModule.createDocument(params, context);
            break;
          case "insertText":
            result = await docsModule.insertText(params, context);
            break;
          case "replaceText":
            result = await docsModule.replaceText(params, context);
            break;
          case "applyTextStyle":
            result = await docsModule.applyTextStyle(params, context);
            break;
          case "insertTable":
            result = await docsModule.insertTable(params, context);
            break;
          default:
            throw new Error(`Unknown docs operation: ${operation}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    performanceMonitor.track(`${name}.${operation}`, Date.now() - startTime);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    performanceMonitor.track(request.params.name, Date.now() - startTime, true);
    logger.error('Tool execution failed', {
      tool: request.params.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
});
```

---

### 3. Resource for Detailed Documentation

**File:** `src/tools/listTools.ts` - Already implemented!

The `gdrive://tools` resource already provides detailed documentation:
```json
{
  "drive": [
    {
      "name": "search",
      "signature": "search({ query: string, pageSize?: number })",
      "description": "Search for files in Google Drive",
      "example": "..."
    }
  ],
  "sheets": [...],
  "forms": [...],
  "docs": [...]
}
```

**No changes needed here!**

---

## Implementation Steps

### Step 1: Backup Current State (2 minutes)
```bash
git checkout -b backup-v3-code-execution
git push origin backup-v3-code-execution
git checkout main
```

### Step 2: Remove Code Execution Components (5 minutes)

**Delete these files:**
```bash
rm -rf src/execution/
rm src/tools/executeCode.ts
```

**Keep these files:**
- ✅ `src/modules/` (all operation modules)
- ✅ `src/tools/listTools.ts` (gdrive://tools resource)

### Step 3: Update Tool Registration (10 minutes)

**File:** `index.ts`

1. Remove imports:
```typescript
// DELETE:
import { EXECUTE_CODE_SCHEMA, executeCode } from './src/tools/executeCode.js';
```

2. Replace `ListToolsRequestSchema` handler with operation-based tools (code above)

3. Replace `CallToolRequestSchema` handler with dynamic dispatch (code above)

### Step 4: Update Resource Handler (Already Done!)

**File:** `index.ts` - `ListResourcesRequestSchema`

Current code is correct:
```typescript
server.setRequestHandler(ListResourcesRequestSchema, async (_request) => {
  return {
    resources: [LIST_TOOLS_RESOURCE]  // Only gdrive://tools
  };
});
```

### Step 5: Update package.json (1 minute)

```json
{
  "version": "3.1.0",
  "description": "MCP server for Google Workspace with operation-based progressive disclosure",
  "dependencies": {
    "@google-cloud/local-auth": "^3.0.1",
    "@modelcontextprotocol/sdk": "1.0.1",
    "googleapis": "^144.0.0",
    "redis": "^5.6.1",
    "winston": "^3.17.0"
    // Remove: isolated-vm (no longer needed)
  }
}
```

Then:
```bash
npm uninstall isolated-vm
```

### Step 6: Update Dockerfile (1 minute)

**File:** `Dockerfile`

```dockerfile
FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --ignore-scripts
# REMOVE: RUN npm rebuild isolated-vm (no longer needed)

# Copy source code
COPY . .

# Build TypeScript
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Create directories
RUN mkdir -p /credentials /app/logs && \
    chmod 700 /credentials && \
    chmod 755 /app/logs

VOLUME ["/credentials"]

ENV GDRIVE_OAUTH_PATH=/credentials/gcp-oauth.keys.json
ENV GDRIVE_TOKEN_STORAGE_PATH=/credentials/.gdrive-mcp-tokens.json
ENV GDRIVE_TOKEN_AUDIT_LOG_PATH=/app/logs/gdrive-mcp-audit.log
ENV NODE_ENV=production

HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
  CMD ["node", "dist/health-check.js"]

CMD ["node", "dist/index.js"]
```

### Step 7: Build and Test (5 minutes)

```bash
# Build TypeScript
npm run build

# Test locally (no Docker)
node dist/index.js

# Build Docker
docker-compose build

# Start containers
docker-compose up -d

# Check logs
docker logs gdrive-mcp-server
```

### Step 8: Test with Claude Desktop (5 minutes)

1. Restart Claude Desktop
2. Test resource reading:
   - Read `gdrive://tools` to see available operations
3. Test tool calls:
   ```
   Use drive tool with operation "search" and params { query: "test", pageSize: 5 }
   ```

---

## Testing Checklist

### Resource Tests
- [ ] Read `gdrive://tools` returns full operation list
- [ ] Shows all drive operations (7)
- [ ] Shows all sheets operations (12)
- [ ] Shows all forms operations (4)
- [ ] Shows all docs operations (5)

### Tool Tests (Drive)
- [ ] `drive` tool with operation "search" works
- [ ] `drive` tool with operation "read" works
- [ ] `drive` tool with operation "createFile" works
- [ ] `drive` tool with operation "updateFile" works

### Tool Tests (Sheets)
- [ ] `sheets` tool with operation "listSheets" works
- [ ] `sheets` tool with operation "readSheet" works
- [ ] `sheets` tool with operation "updateCells" works

### Tool Tests (Forms)
- [ ] `forms` tool with operation "createForm" works
- [ ] `forms` tool with operation "addQuestion" works

### Tool Tests (Docs)
- [ ] `docs` tool with operation "createDocument" works
- [ ] `docs` tool with operation "insertText" works

---

## Token Usage Comparison

### v2.x (Current)
```
Tools registered: 40+
Token cost: ~2,500 tokens
Example: search, read, createFile, updateFile, listSheets, readSheet, ...
```

### v3.1.0 (Progressive Disclosure)
```
Tools registered: 4
Token cost: ~200 tokens (92% reduction!)
Tools: drive, sheets, forms, docs
Resource: gdrive://tools (on-demand details)
```

---

## Migration Path

### For Users on v2.x
```bash
# Backup current setup
git tag v2-backup

# Pull v3.1.0
git pull origin main

# Rebuild Docker
docker-compose down
docker-compose build
docker-compose up -d

# Test with Claude Desktop
# No config changes needed - same MCP server name
```

### Breaking Changes
- Tool names changed from individual operations to domain-based
- Old: `search`, `readSheet`, `createForm`
- New: `drive` with `operation: "search"`, `sheets` with `operation: "readSheet"`, etc.

### Compatibility
- ❌ v3.1.0 is NOT backward compatible with v2.x tool calls
- ✅ All functionality is preserved (just different interface)
- ✅ `gdrive://tools` resource provides migration guide

---

## Success Metrics

**Goal:** Reduce token usage while maintaining full functionality

### Metrics
- **Token reduction:** 92% (2,500 → 200 tokens)
- **Functionality:** 100% preserved (all 28 operations work)
- **Performance:** No degradation (module loading is fast)
- **UX:** Improved (simpler tool interface)

### Validation
```bash
# Check token count (approximate)
echo "v2.x: ~2,500 tokens"
echo "v3.1.0: ~200 tokens"
echo "Savings: 92%"
```

---

## Rollback Plan

If progressive disclosure causes issues:

```bash
# Option A: Revert to v2.x
git checkout v2-backup
docker-compose build
docker-compose up -d

# Option B: Use backup branch
git checkout backup-v3-code-execution
docker-compose build
docker-compose up -d
```

---

## Future Enhancements

1. **Dynamic operation loading:** Load only requested operations from modules
2. **Caching operation schemas:** Cache frequently-used operation details
3. **Streaming responses:** For large file reads
4. **Batch operations:** Execute multiple operations in single call

---

## Notes

- **Modules are already built:** `src/modules/` contains all operation code
- **No logic changes needed:** Only tool registration and dispatch
- **Testing is straightforward:** Same operations, different interface
- **Docker rebuild required:** isolated-vm removal changes dependencies

---

## Timeline Estimate

- Step 1-2 (Backup & cleanup): 7 minutes
- Step 3-4 (Update handlers): 10 minutes
- Step 5-6 (Dependencies & Docker): 2 minutes
- Step 7-8 (Build & test): 10 minutes

**Total: ~30 minutes**

---

## Questions & Answers

**Q: Why not keep code execution AND operation-based tools?**
A: Code execution (isolated-vm) adds complexity without clear benefit. Direct operation calls are simpler and equally token-efficient.

**Q: Can we add code execution later?**
A: Yes, modules are structured to support it. But operation-based approach is cleaner.

**Q: What if Claude doesn't understand the new interface?**
A: The `gdrive://tools` resource provides examples. Claude adapts quickly.

**Q: Is this truly progressive disclosure?**
A: Yes - minimal tools upfront, detailed schemas available via resource when needed.

---

## Approval Required

**Before proceeding, confirm:**
- [ ] Backup branch created
- [ ] Token reduction goal understood (2,500 → 200)
- [ ] Operation-based interface acceptable
- [ ] Breaking changes acknowledged
- [ ] Timeline acceptable (~30 minutes)

**Approved by:** _________________
**Date:** _________________
