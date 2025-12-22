# Code Execution Architecture - Full Rewrite Implementation Plan

**Created:** 2025-11-10
**Project:** Google Drive MCP Server
**Status:** ⏸️ SUPERSEDED
**Superseded By:** `progressive-disclosure.md` (simpler approach, same token benefits)
**Scope:** Complete transformation to code execution-based architecture
**Estimated Duration:** 2-3 weeks
**Risk Level:** HIGH (Breaking changes for existing users)

> **Note:** This spec was superseded by the Progressive Disclosure approach implemented in v3.1.0.
> The simpler operation-based tools (drive, sheets, forms, docs) achieved 92% token reduction
> without the complexity of isolated-vm sandboxing. This document is retained for reference.

---

## 📋 Executive Summary

Transform the Google Drive MCP server from a traditional tool-based architecture to a code execution model inspired by Anthropic's MCP engineering article. This enables AI agents to write code that interacts with Google Drive APIs, achieving massive token efficiency improvements (up to 98.7% reduction) while maintaining functionality.

### Key Objectives
1. **Maximum Token Efficiency** - Eliminate tool definition bloat by using progressive discovery
2. **Data Processing** - Enable agents to filter/process large datasets in execution environment
3. **Complex Workflows** - Support loops, conditionals, and multi-step operations in code
4. **Scalable Architecture** - Build foundation for hundreds of operations without context overflow

---

## 🎯 Problem Statement

### Current Architecture Issues
The existing MCP server exposes 40+ individual tools (search, read, createFile, updateFile, createSheet, readSheet, updateCells, formatCells, createForm, addQuestion, createDocument, insertText, etc.). Each tool definition consumes context tokens upfront, even if unused.

**Token Costs:**
- Tool definitions: ~50-150 tokens per tool × 40 tools = 2,000-6,000 tokens before any work
- Intermediate results: Large data (e.g., 100 files × 2KB each) = 200KB passed through model multiple times
- Sequential tool calls: Each operation requires round-trip through model

### Anthropic's Solution
Code execution architecture where agents write JavaScript/TypeScript code to interact with APIs:
- **Progressive Discovery**: Load tool definitions on-demand via filesystem navigation
- **Local Processing**: Filter/transform data in execution environment before returning to model
- **Control Flow**: Agents write loops/conditionals directly instead of sequential tool calls

---

## 🏗️ Architecture Design

### New Component Structure

```
gdrive-mcp-server/
├── src/
│   ├── execution/
│   │   ├── sandbox.ts              # Code execution environment
│   │   ├── runtime.ts              # JavaScript runtime setup
│   │   ├── security.ts             # Resource limits & safety
│   │   └── module-loader.ts        # Dynamic module imports
│   │
│   ├── modules/                    # Importable API modules
│   │   ├── drive/
│   │   │   ├── index.ts           # Re-exports all drive operations
│   │   │   ├── search.ts          # export async function search()
│   │   │   ├── read.ts            # export async function read()
│   │   │   ├── create.ts          # export async function createFile()
│   │   │   └── update.ts          # export async function updateFile()
│   │   │
│   │   ├── sheets/
│   │   │   ├── index.ts           # Re-exports all sheets operations
│   │   │   ├── read.ts            # export async function readSheet()
│   │   │   ├── update.ts          # export async function updateCells()
│   │   │   ├── format.ts          # export async function formatCells()
│   │   │   └── advanced.ts        # conditionalFormatting, freeze, etc.
│   │   │
│   │   ├── forms/
│   │   │   ├── index.ts
│   │   │   ├── create.ts          # export async function createForm()
│   │   │   └── questions.ts       # export async function addQuestion()
│   │   │
│   │   ├── docs/
│   │   │   ├── index.ts
│   │   │   ├── create.ts          # export async function createDocument()
│   │   │   ├── text.ts            # insertText, replaceText
│   │   │   └── style.ts           # applyTextStyle
│   │   │
│   │   └── index.ts               # Top-level exports (gdrive, sheets, forms, docs)
│   │
│   ├── tools/
│   │   ├── executeCode.ts         # Main code execution tool
│   │   └── listTools.ts           # Tool discovery resource
│   │
│   └── index.ts                   # MCP server entry point
│
└── docs/
    └── code-execution-guide.md    # Usage documentation for agents
```

### Core Architecture Principles

#### 1. **Two-Tool System**
Replace 40+ tools with just two MCP tools:

**Tool 1: `executeCode`**
```typescript
{
  name: "executeCode",
  description: "Execute JavaScript code to interact with Google Drive, Sheets, Forms, and Docs APIs",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "JavaScript/TypeScript code to execute"
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 30000, max: 120000)",
        default: 30000
      }
    },
    required: ["code"]
  }
}
```

**Tool 2: `listTools` (Resource)**
```typescript
{
  type: "resource",
  uri: "gdrive://tools",
  name: "Available Operations",
  description: "Filesystem structure of available Google Drive operations"
}
```

#### 2. **Module-Based Operations**
Every current tool operation becomes an importable function:

```typescript
// Current: MCP tool call
{ name: "drive", arguments: { operation: "search", query: "reports" } }

// New: Import and call in code
import { search } from './modules/drive';
const files = await search({ query: 'reports' });
```

#### 3. **Progressive Discovery**
Agents explore available operations via filesystem-like structure:

```
GET gdrive://tools
→ Returns: { "drive": [...], "sheets": [...], "forms": [...], "docs": [...] }

GET gdrive://tools/drive
→ Returns: ["search", "read", "createFile", "updateFile", ...]

GET gdrive://tools/drive/search
→ Returns: Full TypeScript signature + documentation
```

#### 4. **Sandboxed Execution**
Use `isolated-vm` for secure code execution:
- CPU/memory limits
- Timeout enforcement
- No filesystem access (except modules)
- No network access (except Google APIs via provided clients)

---

## 📐 Technical Approach

### Phase 1: Module System Foundation (Days 1-3)

#### Step 1.1: Restructure Existing Handlers
Extract operation logic from handlers into standalone functions.

**Before (drive-handler.ts):**
```typescript
async function handleSearch(args, context) {
  const { query, pageSize } = args;
  const cacheKey = `search:${query}`;
  // ... implementation
  return { files };
}

export async function handleDriveTool(operation, args, context) {
  switch (operation) {
    case 'search': return handleSearch(args, context);
    case 'read': return handleRead(args, context);
    // ...
  }
}
```

**After (modules/drive/search.ts):**
```typescript
import type { drive_v3 } from 'googleapis';
import type { DriveContext } from '../types';

export interface SearchOptions {
  query: string;
  pageSize?: number;
  orderBy?: string;
  fields?: string[];
}

export interface SearchResult {
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    size?: string;
  }>;
  nextPageToken?: string;
}

/**
 * Search Google Drive for files and folders
 * @param options Search parameters
 * @param context Drive API context
 * @returns Search results with file metadata
 */
export async function search(
  options: SearchOptions,
  context: DriveContext
): Promise<SearchResult> {
  const { query, pageSize = 100, orderBy, fields } = options;
  const cacheKey = `search:${query}:${pageSize}`;

  // Check cache
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    return cached as SearchResult;
  }

  // Execute search
  const response = await context.drive.files.list({
    q: query,
    pageSize,
    orderBy,
    fields: fields?.join(',') || 'files(id,name,mimeType,modifiedTime,size)',
  });

  const result: SearchResult = {
    files: response.data.files || [],
    nextPageToken: response.data.nextPageToken,
  };

  // Cache result
  await context.cacheManager.set(cacheKey, result);

  return result;
}
```

**Create barrel exports (modules/drive/index.ts):**
```typescript
export { search, type SearchOptions, type SearchResult } from './search.js';
export { read, type ReadOptions, type ReadResult } from './read.js';
export { createFile, type CreateFileOptions } from './create.js';
export { updateFile, type UpdateFileOptions } from './update.js';
export { createFolder, type CreateFolderOptions } from './create.js';
export { batchOperations, type BatchOperation } from './batch.js';
```

#### Step 1.2: Repeat for All API Groups
Apply same pattern to sheets, forms, docs:
- `modules/sheets/` - All sheets operations
- `modules/forms/` - All forms operations
- `modules/docs/` - All docs operations

**Completion Criteria:**
- [ ] All 40+ operations extracted to standalone functions
- [ ] TypeScript interfaces defined for all inputs/outputs
- [ ] JSDoc comments on all exported functions
- [ ] Barrel exports for each API group
- [ ] Existing tests updated to use new module paths

---

### Phase 2: Code Execution Engine (Days 4-7)

#### Step 2.1: Implement Sandbox Environment
Create secure execution environment using `isolated-vm`.

**Install dependencies:**
```bash
npm install isolated-vm --save
npm install @types/isolated-vm --save-dev
```

**Create sandbox.ts:**
```typescript
import ivm from 'isolated-vm';
import type { Logger } from 'winston';
import type { DriveContext } from '../modules/types';

export interface SandboxOptions {
  timeout: number;           // Max execution time (ms)
  memoryLimit: number;       // Max memory (MB)
  cpuLimit: number;          // Max CPU time (ms)
}

export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  stats: {
    executionTime: number;
    memoryUsed: number;
    cpuTime: number;
  };
}

export class CodeSandbox {
  private isolate: ivm.Isolate;
  private logger: Logger;

  constructor(
    private options: SandboxOptions,
    logger: Logger
  ) {
    this.logger = logger;
    this.isolate = new ivm.Isolate({
      memoryLimit: options.memoryLimit
    });
  }

  async execute(
    code: string,
    context: DriveContext
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const startCpu = process.cpuUsage();

    try {
      // Create context
      const ivmContext = await this.isolate.createContext();
      const jail = ivmContext.global;

      // Set up module loader
      await jail.set('__modules', new ivm.Reference(async (modulePath: string) => {
        return await this.loadModule(modulePath, context);
      }));

      // Create import function
      const importCode = `
        globalThis.import = async function(modulePath) {
          const module = await __modules.applySync(undefined, [modulePath]);
          return module;
        };
      `;
      await ivmContext.eval(importCode);

      // Execute user code
      const script = await this.isolate.compileScript(code);
      const result = await script.run(ivmContext, {
        timeout: this.options.timeout,
        promise: true,
      });

      // Get stats
      const endTime = Date.now();
      const endCpu = process.cpuUsage(startCpu);

      return {
        success: true,
        result: await result.copy(),
        stats: {
          executionTime: endTime - startTime,
          memoryUsed: this.isolate.getHeapStatisticsSync().used_heap_size / 1024 / 1024,
          cpuTime: (endCpu.user + endCpu.system) / 1000,
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const endCpu = process.cpuUsage(startCpu);

      this.logger.error('Sandbox execution error', { error });

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        stats: {
          executionTime: endTime - startTime,
          memoryUsed: this.isolate.getHeapStatisticsSync().used_heap_size / 1024 / 1024,
          cpuTime: (endCpu.user + endCpu.system) / 1000,
        },
      };
    }
  }

  private async loadModule(
    modulePath: string,
    context: DriveContext
  ): Promise<unknown> {
    // Dynamic module loading based on path
    switch (modulePath) {
      case './modules/drive':
        return await import('../modules/drive/index.js').then(m => ({
          search: this.wrapFunction(m.search, context),
          read: this.wrapFunction(m.read, context),
          createFile: this.wrapFunction(m.createFile, context),
          updateFile: this.wrapFunction(m.updateFile, context),
        }));

      case './modules/sheets':
        return await import('../modules/sheets/index.js').then(m => ({
          readSheet: this.wrapFunction(m.readSheet, context),
          updateCells: this.wrapFunction(m.updateCells, context),
          formatCells: this.wrapFunction(m.formatCells, context),
        }));

      case './modules/forms':
        return await import('../modules/forms/index.js').then(m => ({
          createForm: this.wrapFunction(m.createForm, context),
          addQuestion: this.wrapFunction(m.addQuestion, context),
        }));

      case './modules/docs':
        return await import('../modules/docs/index.js').then(m => ({
          createDocument: this.wrapFunction(m.createDocument, context),
          insertText: this.wrapFunction(m.insertText, context),
        }));

      default:
        throw new Error(`Unknown module: ${modulePath}`);
    }
  }

  private wrapFunction(fn: Function, context: DriveContext): Function {
    return new ivm.Reference(async (...args: unknown[]) => {
      const result = await fn(...args, context);
      return new ivm.ExternalCopy(result).copyInto();
    });
  }

  dispose(): void {
    this.isolate.dispose();
  }
}
```

#### Step 2.2: Create executeCode Tool
Implement the main code execution tool.

**Create tools/executeCode.ts:**
```typescript
import type { Logger } from 'winston';
import type { DriveContext } from '../modules/types';
import { CodeSandbox, type SandboxOptions } from '../execution/sandbox.js';

export const EXECUTE_CODE_SCHEMA = {
  name: "executeCode",
  description: `Execute JavaScript code to interact with Google Drive APIs.

Available modules:
- './modules/drive' - search, read, createFile, updateFile, createFolder, batchOperations
- './modules/sheets' - readSheet, updateCells, formatCells, createSheet, appendRows
- './modules/forms' - createForm, addQuestion, listResponses
- './modules/docs' - createDocument, insertText, replaceText, applyTextStyle

Example usage:
\`\`\`javascript
import { search, read } from './modules/drive';

// Search for files
const results = await search({ query: 'type:spreadsheet' });

// Filter large dataset locally
const filtered = results.files.filter(f => f.name.includes('2025'));

// Return only what's needed
return { count: filtered.length, names: filtered.map(f => f.name) };
\`\`\`
`,
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "JavaScript code to execute (supports async/await and ES modules)",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 30000, max: 120000)",
        default: 30000,
        minimum: 1000,
        maximum: 120000,
      },
    },
    required: ["code"],
  },
};

export async function executeCode(
  code: string,
  timeout: number = 30000,
  context: DriveContext,
  logger: Logger
): Promise<unknown> {
  logger.info('Executing code in sandbox', {
    codeLength: code.length,
    timeout,
  });

  const sandboxOptions: SandboxOptions = {
    timeout,
    memoryLimit: 128, // 128MB
    cpuLimit: timeout,
  };

  const sandbox = new CodeSandbox(sandboxOptions, logger);

  try {
    const result = await sandbox.execute(code, context);

    logger.info('Code execution completed', {
      success: result.success,
      stats: result.stats,
    });

    if (!result.success) {
      throw new Error(`Execution failed: ${result.error?.message}`);
    }

    return result.result;
  } finally {
    sandbox.dispose();
  }
}
```

#### Step 2.3: Implement Tool Discovery
Create resource for progressive tool discovery.

**Create tools/listTools.ts:**
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export const LIST_TOOLS_RESOURCE = {
  uri: "gdrive://tools",
  name: "Available Operations",
  description: "Filesystem structure of available Google Drive operations",
};

interface ToolDefinition {
  name: string;
  signature: string;
  description: string;
  example?: string;
}

interface ModuleStructure {
  [moduleName: string]: ToolDefinition[];
}

/**
 * Generate tool structure from modules directory
 */
export async function generateToolStructure(): Promise<ModuleStructure> {
  const modulesDir = path.join(__dirname, '../modules');
  const structure: ModuleStructure = {};

  // Read all API group directories
  const groups = await fs.readdir(modulesDir, { withFileTypes: true });

  for (const group of groups) {
    if (!group.isDirectory() || group.name === 'types') continue;

    const groupPath = path.join(modulesDir, group.name);
    const files = await fs.readdir(groupPath);

    structure[group.name] = [];

    // Parse each TypeScript file for exported functions
    for (const file of files) {
      if (file === 'index.ts' || !file.endsWith('.ts')) continue;

      const filePath = path.join(groupPath, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Extract function signatures and JSDoc comments
      const tools = parseToolDefinitions(content);
      structure[group.name].push(...tools);
    }
  }

  return structure;
}

function parseToolDefinitions(content: string): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Simple regex-based parsing (could use TypeScript compiler API for robustness)
  const exportPattern = /export async function (\w+)\((.*?)\):\s*Promise<(.*?)>/gs;
  const docPattern = /\/\*\*(.*?)\*\//gs;

  let match;
  while ((match = exportPattern.exec(content)) !== null) {
    const [, name, params, returnType] = match;

    // Find JSDoc before this function
    const beforeFunction = content.substring(0, match.index);
    const docMatches = [...beforeFunction.matchAll(docPattern)];
    const doc = docMatches[docMatches.length - 1]?.[1] || '';

    const description = doc
      .split('\n')
      .map(line => line.trim().replace(/^\*\s?/, ''))
      .filter(line => !line.startsWith('@'))
      .join(' ')
      .trim();

    tools.push({
      name,
      signature: `async function ${name}(${params}): Promise<${returnType}>`,
      description,
    });
  }

  return tools;
}
```

**Completion Criteria:**
- [ ] isolated-vm sandbox implementation working
- [ ] executeCode tool implemented and tested
- [ ] Module loader supporting all API groups
- [ ] Resource limits enforced (CPU, memory, timeout)
- [ ] Tool discovery generating accurate structure
- [ ] Error handling and logging comprehensive

---

### Phase 3: MCP Server Integration (Days 8-10)

#### Step 3.1: Update Main Server
Modify index.ts to expose only executeCode and listTools.

**Update index.ts:**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { executeCode, EXECUTE_CODE_SCHEMA } from './src/tools/executeCode.js';
import { generateToolStructure, LIST_TOOLS_RESOURCE } from './src/tools/listTools.js';

// ... existing imports for auth, logging, etc.

const server = new Server(
  {
    name: "gdrive-mcp-server",
    version: "3.0.0", // Major version bump for breaking change
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Register single tool: executeCode
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [EXECUTE_CODE_SCHEMA],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "executeCode") {
    const { code, timeout } = request.params.arguments as {
      code: string;
      timeout?: number;
    };

    const result = await executeCode(code, timeout, driveContext, logger);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Register resource: tool discovery
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [LIST_TOOLS_RESOURCE],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "gdrive://tools") {
    const structure = await generateToolStructure();

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(structure, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${request.params.uri}`);
});

// ... rest of server setup
```

#### Step 3.2: Migration Guide
Create comprehensive documentation for users.

**Create docs/code-execution-guide.md:**
```markdown
# Code Execution Architecture Guide

## Overview
Version 3.0 introduces a code execution architecture. Instead of calling individual tools, you write JavaScript code to interact with Google Drive APIs.

## Migration from 2.x

### Before (v2.x)
```
Tool: drive
Arguments: { operation: "search", query: "reports" }

Tool: drive
Arguments: { operation: "read", fileId: "abc123" }
```

### After (v3.x)
```javascript
import { search, read } from './modules/drive';

const files = await search({ query: 'reports' });
const content = await read({ fileId: files[0].id });

return { fileName: files[0].name, content };
```

## Benefits
- **Token Efficiency**: Only load operations you use
- **Data Processing**: Filter/transform data before returning
- **Complex Workflows**: Write loops, conditionals, multi-step logic

## Available Modules

### Drive (`./modules/drive`)
- `search(options)` - Search for files
- `read(options)` - Read file content
- `createFile(options)` - Create new file
- `updateFile(options)` - Update existing file

### Sheets (`./modules/sheets`)
- `readSheet(options)` - Read spreadsheet data
- `updateCells(options)` - Update cell values
- `formatCells(options)` - Apply formatting

[Full API reference...]

## Examples

### Example 1: Search and Filter
```javascript
import { search } from './modules/drive';

const results = await search({ query: 'type:spreadsheet' });
const q1Reports = results.files.filter(f =>
  f.name.includes('Q1') &&
  f.modifiedTime > '2025-01-01'
);

return { count: q1Reports.length, files: q1Reports };
```

### Example 2: Batch Processing
```javascript
import { search, read } from './modules/drive';

const files = await search({ query: 'type:document' });
const summaries = [];

for (const file of files.slice(0, 10)) {
  const content = await read({ fileId: file.id });
  summaries.push({
    name: file.name,
    wordCount: content.split(/\s+/).length,
    hasKeyword: content.includes('important'),
  });
}

return summaries;
```

## Security & Limits
- **Timeout**: Max 120 seconds per execution
- **Memory**: Max 128MB per execution
- **CPU**: Limited to timeout duration
- **No Network**: Only Google APIs accessible
- **No Filesystem**: Isolated environment

## Troubleshooting
[Common issues and solutions...]
```

**Completion Criteria:**
- [ ] Server only exposes executeCode and listTools
- [ ] All 40+ legacy tools removed
- [ ] Migration guide complete with examples
- [ ] Backward compatibility layer (optional) for gradual migration
- [ ] Version bumped to 3.0.0

---

### Phase 4: Testing & Validation (Days 11-14)

#### Step 4.1: Unit Tests
Create comprehensive test suite for new architecture.

**Create tests/execution/sandbox.test.ts:**
```typescript
import { CodeSandbox } from '../../src/execution/sandbox';
import type { DriveContext } from '../../src/modules/types';

describe('CodeSandbox', () => {
  let sandbox: CodeSandbox;
  let mockContext: DriveContext;

  beforeEach(() => {
    sandbox = new CodeSandbox(
      { timeout: 5000, memoryLimit: 64, cpuLimit: 5000 },
      mockLogger
    );
    mockContext = createMockContext();
  });

  afterEach(() => {
    sandbox.dispose();
  });

  it('should execute simple code', async () => {
    const result = await sandbox.execute('return 2 + 2;', mockContext);
    expect(result.success).toBe(true);
    expect(result.result).toBe(4);
  });

  it('should import drive module', async () => {
    const code = `
      import { search } from './modules/drive';
      const results = await search({ query: 'test' });
      return results.files.length;
    `;
    const result = await sandbox.execute(code, mockContext);
    expect(result.success).toBe(true);
  });

  it('should enforce timeout', async () => {
    const code = `
      while (true) { }
    `;
    const result = await sandbox.execute(code, mockContext);
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('timeout');
  });

  it('should enforce memory limit', async () => {
    const code = `
      const huge = new Array(1000000000);
      return huge.length;
    `;
    const result = await sandbox.execute(code, mockContext);
    expect(result.success).toBe(false);
  });

  // ... more tests
});
```

**Create tests/integration/code-execution.test.ts:**
```typescript
describe('Code Execution Integration', () => {
  it('should search and filter files', async () => {
    const code = `
      import { search } from './modules/drive';
      const results = await search({ query: 'test' });
      return results.files.filter(f => f.name.includes('.txt'));
    `;

    const result = await executeCodeTool(code);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should read and process spreadsheet', async () => {
    const code = `
      import { readSheet } from './modules/sheets';
      const data = await readSheet({ fileId: 'test123', range: 'A1:B10' });

      // Calculate sum of column B
      const sum = data.values
        .slice(1)
        .reduce((acc, row) => acc + Number(row[1] || 0), 0);

      return { rowCount: data.values.length, sum };
    `;

    const result = await executeCodeTool(code);
    expect(result).toHaveProperty('rowCount');
    expect(result).toHaveProperty('sum');
  });

  // ... more integration tests
});
```

#### Step 4.2: Performance Testing
Measure token efficiency improvements.

**Create tests/performance/token-efficiency.test.ts:**
```typescript
describe('Token Efficiency', () => {
  it('should reduce tokens vs legacy tool calls', async () => {
    // Simulate legacy approach: 10 sequential tool calls
    const legacyTokens = calculateTokens([
      toolDefinition('search'),
      toolDefinition('read'),
      // ... all 40 tools loaded upfront
      toolResult({ files: [...100 files...] }), // Large intermediate result
      toolResult({ content: '...' }),
      // ... 10 sequential results
    ]);

    // Code execution approach: Load only what's needed
    const codeExecTokens = calculateTokens([
      toolDefinition('executeCode'),
      codeResult({ filteredFiles: [...5 files...] }), // Only filtered result
    ]);

    const reduction = ((legacyTokens - codeExecTokens) / legacyTokens) * 100;

    expect(reduction).toBeGreaterThan(80); // Expect >80% reduction
  });
});
```

#### Step 4.3: Security Testing
Validate sandbox security.

**Create tests/security/sandbox-security.test.ts:**
```typescript
describe('Sandbox Security', () => {
  it('should prevent filesystem access', async () => {
    const code = `
      const fs = require('fs');
      return fs.readdirSync('/');
    `;
    const result = await sandbox.execute(code, mockContext);
    expect(result.success).toBe(false);
  });

  it('should prevent network access', async () => {
    const code = `
      const https = require('https');
      return new Promise(resolve => {
        https.get('https://evil.com', resolve);
      });
    `;
    const result = await sandbox.execute(code, mockContext);
    expect(result.success).toBe(false);
  });

  it('should prevent process manipulation', async () => {
    const code = `
      process.exit(1);
    `;
    const result = await sandbox.execute(code, mockContext);
    expect(result.success).toBe(false);
  });

  // ... more security tests
});
```

**Completion Criteria:**
- [ ] 90%+ code coverage on new modules
- [ ] All integration tests passing
- [ ] Performance tests showing >80% token reduction
- [ ] Security tests validating sandbox isolation
- [ ] Load testing for 10-20 concurrent users

---

### Phase 5: Documentation & Deployment (Days 15-17)

#### Step 5.1: Complete Documentation

**Update README.md:**
```markdown
# Google Drive MCP Server v3.0 - Code Execution Architecture

Execute JavaScript code to interact with Google Drive, Sheets, Forms, and Docs.

## Quick Start

```typescript
// Search and process files
import { search, read } from './modules/drive';

const files = await search({ query: 'reports 2025' });
const summaries = [];

for (const file of files.slice(0, 5)) {
  const content = await read({ fileId: file.id });
  summaries.push({
    name: file.name,
    preview: content.substring(0, 100),
  });
}

return summaries;
```

## Benefits Over v2.x
- **98.7% Token Reduction**: Load only operations you use
- **Local Processing**: Filter/transform data in execution environment
- **Complex Workflows**: Write loops, conditionals, multi-step logic

## Migration from v2.x
See [MIGRATION.md](./docs/MIGRATION.md) for complete guide.

[Full documentation...]
```

**Create MIGRATION.md:**
```markdown
# Migration Guide: v2.x → v3.0

## Breaking Changes
Version 3.0 removes all 40+ individual tools. You must now write code.

### Tool Mapping

| v2.x Tool | v3.0 Module Function |
|-----------|---------------------|
| `drive` (operation: search) | `import { search } from './modules/drive'` |
| `drive` (operation: read) | `import { read } from './modules/drive'` |
| `sheets` (operation: readSheet) | `import { readSheet } from './modules/sheets'` |
| ... | ... |

### Example Migrations

**Before:**
```json
{
  "name": "drive",
  "arguments": {
    "operation": "search",
    "query": "reports"
  }
}
```

**After:**
```javascript
import { search } from './modules/drive';
const results = await search({ query: 'reports' });
return results;
```

[Full mapping table and examples...]
```

#### Step 5.2: Deployment Strategy

**Versioning:**
- Tag v3.0.0 on main branch
- Keep v2.x branch for legacy support (6 months)
- Publish both versions to npm

**Rollout Plan:**
1. **Week 1**: Beta release (v3.0.0-beta.1)
2. **Week 2**: Gather feedback, fix issues
3. **Week 3**: Stable release (v3.0.0)
4. **Month 2-6**: Parallel support for v2.x and v3.x

**Communication:**
- Blog post announcing v3.0
- GitHub Discussions for Q&A
- Migration workshop/tutorial video

**Completion Criteria:**
- [ ] All documentation complete
- [ ] Migration guide with 20+ examples
- [ ] Changelog documenting breaking changes
- [ ] Docker images built for v3.0.0
- [ ] npm package published
- [ ] Announcement materials ready

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (unit, integration, performance, security)
- [ ] Code coverage >90%
- [ ] Documentation complete
- [ ] Migration guide reviewed
- [ ] Docker builds successful
- [ ] Performance benchmarks meet targets (>80% token reduction)

### Deployment
- [ ] Create v2.x maintenance branch
- [ ] Tag v3.0.0-beta.1 on main
- [ ] Publish beta to npm
- [ ] Update Docker Hub with v3.0.0-beta tag
- [ ] Announce beta release

### Post-Deployment
- [ ] Monitor error rates
- [ ] Gather user feedback
- [ ] Address critical issues
- [ ] Stable release (v3.0.0)
- [ ] Update Claude Desktop configurations

---

## 📊 Success Metrics

### Technical Metrics
- **Token Efficiency**: >80% reduction vs v2.x for typical workflows
- **Performance**: Execution time <2x of direct tool calls
- **Reliability**: 99.9% uptime, <1% error rate
- **Security**: Zero sandbox escapes

### User Metrics
- **Adoption**: 50% of active users migrate within 3 months
- **Satisfaction**: >4.5/5 rating on migration experience
- **Support**: <10 migration-related issues per week after month 1

### Business Metrics
- **Cost**: 30% reduction in API costs due to token efficiency
- **Scalability**: Support 100+ concurrent users (up from 10-20)
- **Velocity**: Enable 3x more complex workflows

---

## ⚠️ Risk Analysis

### High Risks

**1. Sandbox Security Vulnerabilities**
- **Impact**: Critical - Could expose credentials or data
- **Mitigation**:
  - Extensive security testing
  - External security audit before stable release
  - Bug bounty program
  - Rapid patching process

**2. Performance Degradation**
- **Impact**: High - Could make server unusable
- **Mitigation**:
  - Comprehensive benchmarking
  - Load testing with 100+ concurrent users
  - Performance regression tests in CI
  - Resource limit tuning

**3. Breaking Changes Cause User Churn**
- **Impact**: Medium - Could lose existing users
- **Mitigation**:
  - Extended v2.x support (6 months)
  - Comprehensive migration guide
  - Migration assistance (office hours, support)
  - Backward compatibility layer (optional)

### Medium Risks

**4. Module Loading Complexity**
- **Impact**: Medium - Could cause confusion
- **Mitigation**:
  - Clear error messages
  - Extensive documentation
  - Interactive examples

**5. Debugging Difficulty**
- **Impact**: Medium - Sandboxed code harder to debug
- **Mitigation**:
  - Detailed execution logs
  - Stack traces with source maps
  - Debug mode with verbose output

### Low Risks

**6. Documentation Gaps**
- **Impact**: Low - Slows adoption but doesn't break functionality
- **Mitigation**:
  - Iterative documentation updates
  - User-contributed examples
  - FAQ based on support questions

---

## 🔄 Rollback Plan

If critical issues arise post-deployment:

1. **Immediate Response** (<1 hour)
   - Revert npm to v2.x latest
   - Update Docker tags to point to v2.x
   - Post incident notice

2. **Investigation** (<4 hours)
   - Analyze root cause
   - Assess fix complexity
   - Decide: patch v3.0 or extend v2.x support

3. **Communication** (<8 hours)
   - Notify users of rollback
   - Explain issue and timeline
   - Provide workarounds

4. **Resolution**
   - Fix critical issues
   - Re-release as v3.0.1 or v3.1.0
   - Resume migration support

---

## 📈 Future Enhancements (Post-v3.0)

### Phase 6: Advanced Features (Weeks 4-6)

**Persistent Skills**
- Save reusable code functions as "Skills"
- Agents learn from previous executions
- Skill library shared across sessions

**Streaming Results**
- Stream large datasets incrementally
- Real-time progress updates
- Reduced memory footprint

**Enhanced Caching**
- Cache compiled code
- Warm module loader
- Faster repeated executions

**TypeScript Support**
- Accept TypeScript code
- On-the-fly transpilation
- Type-aware error messages

---

## 🎯 Conclusion

This full rewrite transforms the Google Drive MCP server into a cutting-edge code execution architecture. While the investment is significant (2-3 weeks), the benefits are transformative:

- **98.7% token reduction** for complex workflows
- **Scalable to hundreds of operations** without context overflow
- **Enables sophisticated multi-step workflows** impossible with tool calls
- **Positions project as MCP architecture leader** following Anthropic's vision

The risks are manageable with proper testing, security measures, and migration support. The rollout strategy balances innovation with stability through phased deployment and extended v2.x support.

---

**Ready to Begin?** Start with Phase 1: Module System Foundation (Days 1-3)
