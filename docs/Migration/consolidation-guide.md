# Google Workspace MCP Consolidation Guide

## Overview

This guide provides a step-by-step approach to consolidating your Google Workspace MCP server from 41+ individual tools to 5 operation-based tools, following the best practices from the HOW2MCP repository.

---

## 📊 Current Tools → Consolidated Architecture

### Google Sheets Tools Consolidation

| #   | Current Individual Tool  | →   | New Operation                           | Parameters                                          |
|-----|--------------------------|-----|-----------------------------------------|-----------------------------------------------------|
| 1   | listSheets               | →   | sheets + operation: "list"              | spreadsheetId                                       |
| 2   | readSheet                | →   | sheets + operation: "read"              | spreadsheetId, range                                |
| 3   | createSheet              | →   | sheets + operation: "create"            | spreadsheetId, sheetName, rowCount, columnCount, tabColor |
| 4   | renameSheet              | →   | sheets + operation: "rename"            | spreadsheetId, sheetName/sheetId, newName           |
| 5   | deleteSheet              | →   | sheets + operation: "delete"            | spreadsheetId, sheetName/sheetId                    |
| 6   | updateCells              | →   | sheets + operation: "update"            | spreadsheetId, range, values                        |
| 7   | updateCellsWithFormula   | →   | sheets + operation: "updateFormula"     | spreadsheetId, range, formula                       |
| 8   | formatCells              | →   | sheets + operation: "format"            | spreadsheetId, range, format                        |
| 9   | addConditionalFormatting | →   | sheets + operation: "conditionalFormat" | spreadsheetId, range, rule                          |
| 10  | appendRows               | →   | sheets + operation: "append"            | spreadsheetId, values, sheetName                    |
| 11  | freezeRowsColumns        | →   | sheets + operation: "freeze"            | spreadsheetId, frozenRowCount, frozenColumnCount    |
| 12  | setColumnWidth           | →   | sheets + operation: "setColumnWidth"    | spreadsheetId, columns, sheetName                   |

---

## 🎯 Architecture Diagram

### BEFORE (Current - Too Many Tools)

```
MCP Server exposes 41+ individual tools:

├─ Drive Tools (7)
│  ├─ search
│  ├─ enhancedSearch
│  ├─ read
│  ├─ createFile
│  ├─ updateFile
│  ├─ createFolder
│  └─ batchFileOperations
│
├─ Sheets Tools (12) ← WE'RE FIXING THIS
│  ├─ listSheets
│  ├─ readSheet
│  ├─ updateCells
│  ├─ updateCellsWithFormula
│  ├─ formatCells
│  ├─ addConditionalFormatting
│  ├─ appendRows
│  ├─ freezeRowsColumns
│  ├─ setColumnWidth
│  ├─ createSheet
│  ├─ renameSheet
│  └─ deleteSheet
│
├─ Forms Tools (4)
│  ├─ createForm
│  ├─ getForm
│  ├─ addQuestion
│  └─ listResponses
│
└─ Docs Tools (5)
   ├─ createDocument
   ├─ insertText
   ├─ replaceText
   ├─ applyTextStyle
   └─ insertTable
```

### AFTER (Target - Operation-Based)

```
MCP Server exposes 5 core tools:

├─ drive (operations: search, read, create, update, batch)
│
├─ sheets (operations: list, read, create, rename, delete,
│          update, updateFormula, format, conditionalFormat,
│          append, freeze, setColumnWidth)
│
├─ forms (operations: create, read, addQuestion, listResponses)
│
├─ docs (operations: create, insertText, replaceText,
│        applyTextStyle, insertTable)
│
└─ batch (operations: fileOperations)
```

---

## 🏗️ Original Architecture Pattern

Your original MCP had 5 tools with operations inside:

```typescript
// ORIGINAL PATTERN (What you want)
// ================

// 1. Drive Tool
{
  name: "drive",
  inputSchema: {
    properties: {
      operation: { enum: ["search", "read", "create", "update"] },
      // ... operation-specific params
    }
  }
}

// 2. Sheets Tool
{
  name: "sheets",
  inputSchema: {
    properties: {
      operation: { enum: ["list", "read", "update", "format", ...] },
      // ... operation-specific params
    }
  }
}

// 3-5. Forms, Docs, Batch tools following same pattern
```

### Why This Is Better

- ✅ LLM sees 5 tools (not 41+)
- ✅ Operations grouped logically by service
- ✅ Single tool call for sheets = "use the sheets tool"
- ✅ Less cognitive load for AI
- ✅ Easier to maintain and extend

---

## 🔄 Implementation Steps

### Step 1: Define Zod Schemas for Each Operation

Create a new file: `sheets-schemas.ts`

```typescript
import { z } from 'zod';

// Base schema with operation discriminator
const SheetsBaseSchema = z.object({
  operation: z.enum([
    'list', 'read', 'create', 'rename', 'delete',
    'update', 'updateFormula', 'format',
    'conditionalFormat', 'append', 'freeze', 'setColumnWidth'
  ]),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID is required'),
});

// Operation-specific schemas
const SheetsListSchema = SheetsBaseSchema.extend({
  operation: z.literal('list'),
});

const SheetsReadSchema = SheetsBaseSchema.extend({
  operation: z.literal('read'),
  range: z.string().describe('A1 notation range (e.g., "Sheet1!A1:D10")'),
});

const SheetsCreateSchema = SheetsBaseSchema.extend({
  operation: z.literal('create'),
  sheetName: z.string().min(1),
  rowCount: z.number().int().min(1).optional().default(1000),
  columnCount: z.number().int().min(1).optional().default(26),
  tabColor: z.object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional(),
  }).optional(),
});

const SheetsUpdateSchema = SheetsBaseSchema.extend({
  operation: z.literal('update'),
  range: z.string(),
  values: z.array(z.array(z.any())),
});

const SheetsUpdateFormulaSchema = SheetsBaseSchema.extend({
  operation: z.literal('updateFormula'),
  range: z.string(),
  formula: z.string(),
});

const SheetsRenameSchema = SheetsBaseSchema.extend({
  operation: z.literal('rename'),
  sheetName: z.string().optional(),
  sheetId: z.number().int().optional(),
  newName: z.string().min(1),
}).refine(
  (data) => data.sheetName || data.sheetId,
  { message: 'Either sheetName or sheetId must be provided' }
);

const SheetsDeleteSchema = SheetsBaseSchema.extend({
  operation: z.literal('delete'),
  sheetName: z.string().optional(),
  sheetId: z.number().int().optional(),
}).refine(
  (data) => data.sheetName || data.sheetId,
  { message: 'Either sheetName or sheetId must be provided' }
);

const SheetsFormatSchema = SheetsBaseSchema.extend({
  operation: z.literal('format'),
  range: z.string(),
  format: z.object({
    // Add your format object schema here
  }),
});

const SheetsConditionalFormatSchema = SheetsBaseSchema.extend({
  operation: z.literal('conditionalFormat'),
  range: z.string(),
  rule: z.object({
    // Add your rule object schema here
  }),
});

const SheetsAppendSchema = SheetsBaseSchema.extend({
  operation: z.literal('append'),
  values: z.array(z.array(z.any())),
  sheetName: z.string().optional(),
});

const SheetsFreezeSchema = SheetsBaseSchema.extend({
  operation: z.literal('freeze'),
  frozenRowCount: z.number().int().min(0).optional().default(0),
  frozenColumnCount: z.number().int().min(0).optional().default(0),
});

const SheetsSetColumnWidthSchema = SheetsBaseSchema.extend({
  operation: z.literal('setColumnWidth'),
  columns: z.array(z.object({
    index: z.number().int().min(0),
    width: z.number().int().min(1),
  })),
  sheetName: z.string().optional(),
});

// Union schema for runtime validation
export const SheetsToolSchema = z.discriminatedUnion('operation', [
  SheetsListSchema,
  SheetsReadSchema,
  SheetsCreateSchema,
  SheetsRenameSchema,
  SheetsDeleteSchema,
  SheetsUpdateSchema,
  SheetsUpdateFormulaSchema,
  SheetsFormatSchema,
  SheetsConditionalFormatSchema,
  SheetsAppendSchema,
  SheetsFreezeSchema,
  SheetsSetColumnWidthSchema,
]);

export type SheetsToolInput = z.infer<typeof SheetsToolSchema>;
```

---

### Step 2: Create the Consolidated Tool Definition (JSON Schema)

Create a new file: `tools/sheets-tool.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export function registerSheetsTool(server: Server) {

  // Tool definition - MUST use JSON Schema format
  // IMPORTANT: This handler should MERGE with existing tools, not replace them
  // If you have other tools (drive, forms, docs), you'll need to register them all together
  // or use a central tool registry pattern
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'sheets',
        description: 'Perform Google Sheets operations including list, read, create, update, format, and more',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: [
                'list', 'read', 'create', 'rename', 'delete',
                'update', 'updateFormula', 'format',
                'conditionalFormat', 'append', 'freeze', 'setColumnWidth'
              ],
              description: 'The operation to perform on the spreadsheet',
            },
            spreadsheetId: {
              type: 'string',
              description: 'The ID of the spreadsheet',
            },
            // Read operation params
            range: {
              type: 'string',
              description: 'A1 notation range (e.g., "Sheet1!A1:D10") - required for read, update, format operations',
            },
            // Create operation params
            sheetName: {
              type: 'string',
              description: 'Name of the sheet - required for create, rename operations',
            },
            rowCount: {
              type: 'number',
              description: 'Number of rows for new sheet',
              default: 1000,
            },
            columnCount: {
              type: 'number',
              description: 'Number of columns for new sheet',
              default: 26,
            },
            tabColor: {
              type: 'object',
              description: 'RGB color for sheet tab',
              properties: {
                red: { type: 'number', minimum: 0, maximum: 1 },
                green: { type: 'number', minimum: 0, maximum: 1 },
                blue: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
            // Update operation params
            values: {
              type: 'array',
              description: 'Array of arrays containing cell values - required for update, append',
              items: {
                type: 'array',
                items: {},
              },
            },
            // Formula operation params
            formula: {
              type: 'string',
              description: 'Formula to apply - required for updateFormula',
            },
            // Format operation params
            format: {
              type: 'object',
              description: 'Cell formatting options - required for format operation',
            },
            // Conditional formatting params
            rule: {
              type: 'object',
              description: 'Conditional formatting rule - required for conditionalFormat',
            },
            // Rename operation params
            sheetId: {
              type: 'number',
              description: 'Numeric sheet ID - alternative to sheetName for rename/delete',
            },
            newName: {
              type: 'string',
              description: 'New name for sheet - required for rename operation',
            },
            // Freeze operation params
            frozenRowCount: {
              type: 'number',
              description: 'Number of rows to freeze',
              default: 0,
            },
            frozenColumnCount: {
              type: 'number',
              description: 'Number of columns to freeze',
              default: 0,
            },
            // Column width params
            columns: {
              type: 'array',
              description: 'Array of column indices and widths',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number' },
                  width: { type: 'number' },
                },
              },
            },
          },
          required: ['operation', 'spreadsheetId'],
        },
      },
    ],
  }));
}
```

---

### Step 3: Create the Handler with Operation Routing

Create a new file: `tools/sheets-handler.ts`

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SheetsToolSchema, type SheetsToolInput } from './sheets-schemas.js';
import type { Logger } from '../utils/logger.js';

// IMPORTANT: Following MCP_ARCHITECTURE_2025.md guidance:
// Use centralized logging passed from the main server instance
// rather than creating new logger instances in handlers
export async function handleSheetsTool(args: any, context: { logger: Logger }) {
  const { logger } = context;

  // Validate with Zod (discriminated union handles operation-specific validation)
  const validated = SheetsToolSchema.parse(args);

  logger.info(`Executing sheets operation: ${validated.operation}`, {
    spreadsheetId: validated.spreadsheetId,
  });

  // Route to appropriate handler based on operation
  switch (validated.operation) {
    case 'list':
      return await handleListSheets(validated, context);

    case 'read':
      return await handleReadSheet(validated, context);

    case 'create':
      return await handleCreateSheet(validated, context);

    case 'rename':
      return await handleRenameSheet(validated, context);

    case 'delete':
      return await handleDeleteSheet(validated, context);

    case 'update':
      return await handleUpdateCells(validated, context);

    case 'updateFormula':
      return await handleUpdateFormula(validated, context);

    case 'format':
      return await handleFormatCells(validated, context);

    case 'conditionalFormat':
      return await handleConditionalFormat(validated, context);

    case 'append':
      return await handleAppendRows(validated, context);

    case 'freeze':
      return await handleFreezeRowsColumns(validated, context);

    case 'setColumnWidth':
      return await handleSetColumnWidth(validated, context);

    default:
      // TypeScript will ensure this is never reached if all cases are covered
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown sheets operation: ${(validated as any).operation}`
      );
  }
}

// Individual operation handlers (keep your existing logic)
async function handleListSheets(
  args: Extract<SheetsToolInput, { operation: 'list' }>,
  context: { logger: Logger }
) {
  // Your existing listSheets implementation
  const { spreadsheetId } = args;
  const { logger } = context;

  logger.debug('Listing sheets', { spreadsheetId });

  // ... Google Sheets API call
  // const sheets = await googleSheetsAPI.listSheets(spreadsheetId);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'list',
          spreadsheetId,
          sheets: [/* results */],
        }, null, 2),
      },
    ],
  };
}

async function handleReadSheet(
  args: Extract<SheetsToolInput, { operation: 'read' }>,
  context: { logger: Logger }
) {
  // Your existing readSheet implementation
  const { spreadsheetId, range } = args;
  const { logger } = context;

  logger.debug('Reading sheet', { spreadsheetId, range });

  // ... Google Sheets API call
  // const values = await googleSheetsAPI.readSheet(spreadsheetId, range);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'read',
          spreadsheetId,
          range,
          values: [/* results */],
        }, null, 2),
      },
    ],
  };
}

async function handleCreateSheet(
  args: Extract<SheetsToolInput, { operation: 'create' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, sheetName, rowCount, columnCount, tabColor } = args;
  const { logger } = context;

  logger.debug('Creating sheet', { spreadsheetId, sheetName });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'create',
          spreadsheetId,
          sheetName,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleRenameSheet(
  args: Extract<SheetsToolInput, { operation: 'rename' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, sheetName, sheetId, newName } = args;
  const { logger } = context;

  logger.debug('Renaming sheet', { spreadsheetId, sheetName, sheetId, newName });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'rename',
          spreadsheetId,
          oldName: sheetName,
          newName,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleDeleteSheet(
  args: Extract<SheetsToolInput, { operation: 'delete' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, sheetName, sheetId } = args;
  const { logger } = context;

  logger.debug('Deleting sheet', { spreadsheetId, sheetName, sheetId });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'delete',
          spreadsheetId,
          deletedSheet: sheetName || sheetId,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleUpdateCells(
  args: Extract<SheetsToolInput, { operation: 'update' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, range, values } = args;
  const { logger } = context;

  logger.debug('Updating cells', { spreadsheetId, range });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'update',
          spreadsheetId,
          range,
          updatedCells: values.length,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleUpdateFormula(
  args: Extract<SheetsToolInput, { operation: 'updateFormula' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, range, formula } = args;
  const { logger } = context;

  logger.debug('Updating formula', { spreadsheetId, range, formula });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'updateFormula',
          spreadsheetId,
          range,
          formula,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleFormatCells(
  args: Extract<SheetsToolInput, { operation: 'format' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, range, format } = args;
  const { logger } = context;

  logger.debug('Formatting cells', { spreadsheetId, range });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'format',
          spreadsheetId,
          range,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleConditionalFormat(
  args: Extract<SheetsToolInput, { operation: 'conditionalFormat' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, range, rule } = args;
  const { logger } = context;

  logger.debug('Adding conditional formatting', { spreadsheetId, range });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'conditionalFormat',
          spreadsheetId,
          range,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleAppendRows(
  args: Extract<SheetsToolInput, { operation: 'append' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, values, sheetName } = args;
  const { logger } = context;

  logger.debug('Appending rows', { spreadsheetId, sheetName, rowCount: values.length });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'append',
          spreadsheetId,
          sheetName,
          appendedRows: values.length,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleFreezeRowsColumns(
  args: Extract<SheetsToolInput, { operation: 'freeze' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, frozenRowCount, frozenColumnCount } = args;
  const { logger } = context;

  logger.debug('Freezing rows/columns', { spreadsheetId, frozenRowCount, frozenColumnCount });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'freeze',
          spreadsheetId,
          frozenRowCount,
          frozenColumnCount,
          success: true,
        }, null, 2),
      },
    ],
  };
}

async function handleSetColumnWidth(
  args: Extract<SheetsToolInput, { operation: 'setColumnWidth' }>,
  context: { logger: Logger }
) {
  const { spreadsheetId, columns, sheetName } = args;
  const { logger } = context;

  logger.debug('Setting column width', { spreadsheetId, sheetName, columnCount: columns.length });

  // ... Google Sheets API call

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          operation: 'setColumnWidth',
          spreadsheetId,
          sheetName,
          columns,
          success: true,
        }, null, 2),
      },
    ],
  };
}
```

---

### Step 4: Wire It All Together in Main Server

Update your `index.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from './utils/logger.js';

// Import handlers (not registration functions)
import { handleSheetsTool } from './tools/sheets-handler.js';
// import { handleDriveTool } from './tools/drive-handler.js';
// import { handleFormsTool } from './tools/forms-handler.js';
// import { handleDocsTool } from './tools/docs-handler.js';

class GoogleWorkspaceMCPServer {
  private server: Server;
  private logger: Logger;

  constructor() {
    this.server = new Server(
      { name: 'google-workspace-mcp', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );

    // Centralized logger instance (MCP_ARCHITECTURE_2025.md pattern)
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Google Workspace MCP Server...');

    // IMPORTANT: Register ALL tools in ONE handler to avoid overwriting
    // This ensures tools/list returns ALL available tools
    this.registerAllTools();

    // Register call handler (routes to appropriate tool handlers)
    this.registerCallHandler();

    this.logger.info('Google Workspace MCP Server initialized');
  }

  private registerAllTools(): void {
    // Register a single ListTools handler that returns ALL consolidated tools
    // This prevents individual tool registration functions from overwriting each other
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Sheets tool definition
        {
          name: 'sheets',
          description: 'Perform Google Sheets operations including list, read, create, update, format, and more',
          inputSchema: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: [
                  'list', 'read', 'create', 'rename', 'delete',
                  'update', 'updateFormula', 'format',
                  'conditionalFormat', 'append', 'freeze', 'setColumnWidth'
                ],
                description: 'The operation to perform on the spreadsheet',
              },
              spreadsheetId: {
                type: 'string',
                description: 'The ID of the spreadsheet',
              },
              // ... all other sheet parameters from the full definition above
            },
            required: ['operation', 'spreadsheetId'],
          },
        },
        // TODO: Add drive tool definition here
        // TODO: Add forms tool definition here
        // TODO: Add docs tool definition here
      ],
    }));

    this.logger.info('All tool definitions registered');
  }

  private registerCallHandler(): void {
    // Register a single CallTool handler that routes to appropriate handlers
    // Pass centralized logger to all handlers (MCP_ARCHITECTURE_2025.md pattern)
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        this.logger.info(`Executing tool: ${name}`);

        switch (name) {
          case 'sheets':
            return await handleSheetsTool(args, { logger: this.logger });

          case 'drive':
            // TODO: Consolidate drive operations
            // return await handleDriveTool(args, { logger: this.logger });
            throw new McpError(ErrorCode.MethodNotFound, 'Drive tool not yet consolidated');

          case 'forms':
            // TODO: Consolidate forms operations
            // return await handleFormsTool(args, { logger: this.logger });
            throw new McpError(ErrorCode.MethodNotFound, 'Forms tool not yet consolidated');

          case 'docs':
            // TODO: Consolidate docs operations
            // return await handleDocsTool(args, { logger: this.logger });
            throw new McpError(ErrorCode.MethodNotFound, 'Docs tool not yet consolidated');

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Error in tool ${name}:`, error);
        throw error;
      }
    });

    this.logger.info('Call handler registered');
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Google Workspace MCP Server started on stdio');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Google Workspace MCP Server...');
    // Cleanup resources
  }
}

// Main execution
async function main(): Promise<void> {
  const server = new GoogleWorkspaceMCPServer();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Received SIGINT, shutting down...');
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, shutting down...');
    await server.shutdown();
    process.exit(0);
  });

  try {
    await server.initialize();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
```

---

## 📊 Benefits of This Approach

Following HOW2MCP patterns gives you:

1. **Type Safety**: Zod discriminated unions ensure TypeScript knows which fields are available for each operation
2. **Validation**: Runtime validation with helpful error messages
3. **Maintainability**: Each operation handler is separate and testable
4. **Extensibility**: Easy to add new operations without touching other code
5. **Best Practices**: Follows 2025 MCP patterns from this repo
6. **Reduced Cognitive Load**: LLM sees 5 tools instead of 41+
7. **Logical Grouping**: Operations grouped by service domain
8. **Backward Compatible**: Same functionality, better structure
9. **Centralized Logging**: Single logger instance passed to all handlers (no duplicate stderr config)
10. **Single Source of Truth**: All tool definitions in one ListTools handler (no conflicts)
11. **Clean Tool Registry**: Deprecated tools removed, preventing confusion

---

## 🎯 Testing Your Consolidated Server

### 1. Build the project
```bash
npm run build
```

### 2. Test with MCP Inspector (Interactive)
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### 3. Quick JSON-RPC test (list tools)
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

### 4. Test specific operation
```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"sheets","arguments":{"operation":"list","spreadsheetId":"your-spreadsheet-id"}}}' | node dist/index.js
```

### 5. Update Claude Desktop config
```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/absolute/path/to/your/dist/index.js"],
      "env": {
        "GOOGLE_CREDENTIALS_PATH": "/path/to/credentials.json"
      }
    }
  }
}
```

---

## 🎯 Next Steps

1. ✅ **Start with Sheets** (what you're doing now)
2. **Test thoroughly** using MCP Inspector
3. **Repeat for Drive** following the same pattern
4. **Repeat for Forms** following the same pattern
5. **Repeat for Docs** following the same pattern
6. **Update your tests** to use the new consolidated tool format
7. **Version bump** to 2.0.0 to indicate breaking changes
8. **Update documentation** for users migrating from v1

---

## 📚 Key Implementation Rules (from HOW2MCP)

1. **Never use stdout for logging** - it's reserved for JSON-RPC responses
2. **Always use JSON Schema format** in ListToolsRequestSchema (not Zod)
3. **Always validate tool arguments** before processing
4. **Implement graceful shutdown** handlers for SIGINT/SIGTERM
5. **Use stderr for all logs** (console.error)
6. **Return structured content** in the standard format
7. **Use descriptive error messages** without exposing internals
8. **Use discriminated unions** for operation-based tools (type safety)
9. **Centralized logging** - Pass shared logger instance to handlers (MCP_ARCHITECTURE_2025.md)
10. **Single ListTools handler** - Register ALL tools in one place to avoid overwriting
11. **Clean up deprecated exports** - Remove old tool files so they don't appear in tools/list

---

## ✅ Confidence Check

### What We're Fixing

**Before**: 41+ individual tools
- `listSheets`, `readSheet`, `createSheet`, etc. (12 separate tools)
- Overwhelms LLM with too many choices
- Hard to maintain and extend

**After**: 5 consolidated tools
- `sheets` with 12 operations
- Clean, logical grouping by service
- Easy to understand and use
- Follows your original design intent

### Why This Works

1. **Discriminated Unions**: TypeScript knows which fields are valid for each operation
2. **Operation-Based Routing**: Single entry point, clean switch statement
3. **Modular Handlers**: Each operation handler is independent and testable
4. **Type Safety**: Full TypeScript support throughout
5. **Validation**: Zod validates at runtime, JSON Schema defines for LLM

---

## 🚀 Migration Checklist

### Phase 1: Setup Consolidated Sheets Tool
- [ ] Create `sheets-schemas.ts` with all 12 operation schemas
- [ ] Create `tools/sheets-handler.ts` with operation routing
- [ ] Update `index.ts` with centralized tool registration
- [ ] Ensure centralized logger is passed to all handlers
- [ ] Build and test with MCP Inspector

### Phase 2: Testing & Validation
- [ ] Test that `tools/list` shows ONLY the new `sheets` tool (not old tools)
- [ ] Test each of the 12 operations individually
- [ ] Verify error handling works correctly
- [ ] Check that logging goes to stderr only

### Phase 3: Cleanup Deprecated Code
- [ ] **CRITICAL**: Remove old tool files (listSheets.ts, readSheet.ts, etc.)
- [ ] **CRITICAL**: Remove old tool exports from index files
- [ ] **CRITICAL**: Verify `tools/list` doesn't show deprecated tools
- [ ] Delete old test files for individual tools
- [ ] Remove old tool registration code

### Phase 4: Documentation & Versioning
- [ ] Update API documentation for new tool format
- [ ] Update tests to use new consolidated format
- [ ] Create migration guide for users
- [ ] Version bump to 2.0.0 (breaking change)
- [ ] Update CHANGELOG.md

### Phase 5: Repeat Pattern
- [ ] Repeat for Drive (7 operations → 1 tool)
- [ ] Repeat for Forms (4 operations → 1 tool)
- [ ] Repeat for Docs (5 operations → 1 tool)
- [ ] Final verification: `tools/list` shows exactly 5 tools

---

## 📖 Additional Resources

- [HOW2MCP Documentation](./MCP-DOCS/)
- [MCP Quick Reference](./MCP-DOCS/MCP_QUICK_REFERENCE.md)
- [MCP Implementation Guide](./MCP-DOCS/MCP_IMPLEMENTATION_GUIDE.md)
- [MCP Best Practices 2025](./MCP-DOCS/MCP_ARCHITECTURE_2025.md)
- [Example Implementation](./MCP_EXAMPLE_PROJECT/)

Good luck with your consolidation! 🎉
