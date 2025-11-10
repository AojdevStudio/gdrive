# Google Drive MCP Architecture Analysis & Optimization Plan

**Created**: October 14, 2025
**Status**: Analysis & Planning
**Priority**: High (Context Window Optimization)
**Impact**: Code reduction, improved maintainability, better LLM experience

---

## 📊 Current State Analysis

### Tool Registration (Good! ✅)

Currently **5 consolidated tools** are registered in `ListToolsRequestSchema`:

```typescript
1. sheets      - 12 operations (list, read, create, rename, delete, update, updateFormula, format, conditionalFormat, append, freeze, setColumnWidth)
2. drive       - 7 operations (search, enhancedSearch, read, create, update, createFolder, batch)
3. forms       - 4 operations (create, read, addQuestion, listResponses)
4. docs        - 5 operations (create, insertText, replaceText, applyTextStyle, insertTable)
5. getAppScript - 1 single-purpose tool
```

**This is the correct architecture!** Operation-based, consolidated tools. ✅

---

### Tool Handlers (Problem! ❌)

But in `CallToolRequestSchema` handler, you have **DUPLICATE** handlers:

**Modern (Operation-Based)** - Lines 1448-1486:
- `case "sheets"` → routes to `handleSheetsTool()`
- `case "drive"` → routes to `handleDriveTool()`
- `case "forms"` → routes to `handleFormsTool()`
- `case "docs"` → routes to `handleDocsTool()`

**Legacy (Individual Tools)** - Lines 1122-2141:
- `case "search"` → inline handler (duplicates `drive` operation)
- `case "enhancedSearch"` → inline handler (duplicates `drive` operation)
- `case "read"` → inline handler (duplicates `drive` operation)
- `case "createFile"` → inline handler (duplicates `drive` operation)
- `case "updateFile"` → inline handler (duplicates `drive` operation)
- `case "createFolder"` → inline handler (duplicates `drive` operation)
- `case "createForm"` → inline handler (duplicates `forms` operation)
- `case "getForm"` → inline handler (duplicates `forms` operation)
- `case "addQuestion"` → inline handler (duplicates `forms` operation)
- `case "listResponses"` → inline handler (duplicates `forms` operation)
- `case "createDocument"` → inline handler (duplicates `docs` operation)
- `case "insertText"` → inline handler (duplicates `docs` operation)
- `case "replaceText"` → inline handler (duplicates `docs` operation)
- `case "applyTextStyle"` → inline handler (duplicates `docs` operation)
- `case "insertTable"` → inline handler (duplicates `docs` operation)
- `case "batchFileOperations"` → inline handler (duplicates `drive` operation)

**Total duplicate code: ~1000+ lines** 🔥

These legacy handlers are **NEVER CALLED** because they're not registered as tools!

---

## 🔍 History Analysis

### Git History Shows Evolution:

```bash
254d2dd - 🚀 v2.0.0 - Complete MCP Server Rebuild with Operation-Based Architecture
6750659 - ✅ feat(epic-001): complete tool consolidation with review and fixes
a3a557b - refactor(sheets): Remove deprecated individual Sheets tools
```

**What happened:**
1. ✅ You DID consolidate tools into operation-based architecture (v2.0.0)
2. ✅ You registered ONLY consolidated tools
3. ❌ You kept legacy handlers in code (probably for "backward compatibility")
4. ❌ Those legacy handlers are dead code - they're never invoked!

**The problem:** You completed the migration but didn't remove the old implementation.

---

## 🎯 MCP Architecture Concepts

### 1. **Resources** vs **Tools** vs **Prompts**

#### **Resources** (`gdrive:///` URIs)
**Purpose**: Provide **read-only content** that LLMs can reference in context.

**How it works in your server:**
```typescript
// List available files as resources
resources: [
  {
    uri: "gdrive:///abc123",
    name: "My Document.docx",
    mimeType: "application/vnd.google-apps.document",
    description: "Google Drive file: My Document"
  }
]

// Read resource content
ReadResourceRequest("gdrive:///abc123")
→ Returns document content as markdown/CSV/text
```

**Use case:**
- LLM asks: "What's in document abc123?"
- MCP client fetches resource `gdrive:///abc123`
- Returns full content to LLM's context

**When to use:**
- ✅ Document content for analysis
- ✅ File previews
- ✅ Reference data
- ❌ NOT for write operations
- ❌ NOT for search/list operations

---

#### **Tools** (Your current implementation)
**Purpose**: **Actions** the LLM can perform (read, write, search, create).

**How it works:**
```typescript
// LLM calls tool
CallToolRequest({
  name: "sheets",
  arguments: {
    operation: "create",
    spreadsheetId: "xyz",
    sheetName: "Q4 Data"
  }
})
→ Executes action, returns result
```

**When to use:**
- ✅ Search, create, update, delete operations
- ✅ Complex operations with parameters
- ✅ State-changing actions

---

#### **Prompts** (Missing from your server!)
**Purpose**: Pre-defined **templates** LLMs can use for common tasks.

**Example implementation:**
```typescript
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "create-branded-doc",
        description: "Create a professional branded document with Today's Dental styling",
        arguments: [
          {
            name: "title",
            description: "Document title",
            required: true
          },
          {
            name: "content",
            description: "Document body content",
            required: true
          }
        ]
      },
      {
        name: "create-staff-form",
        description: "Create a staff feedback form with standard questions",
        arguments: [
          {
            name: "formTitle",
            description: "Form title",
            required: true
          }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "create-branded-doc") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a professional document titled "${args.title}" with Today's Dental branding:

1. Use the docs tool with batchUpdate operation
2. Apply teal color (#4DB8AC) to headers
3. Format with 24pt title, 14pt body text
4. Content: ${args.content}

Use this exact structure:
- Centered HEADING_1 title in teal
- Body paragraphs with proper spacing
- Professional footer with company info`
          }
        }
      ]
    };
  }

  // ... other prompts
});
```

**Benefits:**
- ✅ Reduce repetitive prompting
- ✅ Enforce best practices
- ✅ Guide LLMs to use tools correctly
- ✅ Save context window space

---

### 2. **Resources vs Tools: When to Use What?**

| Scenario | Use Resource | Use Tool | Why |
|----------|--------------|----------|-----|
| Read document content | ✅ Yes | ❌ No | Resources are optimized for large content |
| Search for files | ❌ No | ✅ Yes | Search is an action, not content |
| Create new document | ❌ No | ✅ Yes | Write operation |
| List all sheets in spreadsheet | Either | Either | Could be resource metadata or tool call |
| Get file metadata | ✅ Yes (in list) | ✅ Yes (via tool) | Resources include metadata |
| Update cell values | ❌ No | ✅ Yes | Write operation |

**Your current approach:**
- ✅ **Resources**: Provide file content via `gdrive:///` URIs
- ✅ **Tools**: Perform all operations (search, create, update)
- ❌ **Missing**: Prompts for common workflows

**Recommendation:**
Keep both! They serve different purposes:
- **Resources** = "Here's what exists" (discovery)
- **Tools** = "Do this action" (operations)
- **Prompts** = "Here's how to do common tasks" (guidance)

---

## 🧹 Cleanup Strategy

### Phase 1: Remove Dead Code (Week 1)

#### Step 1.1: Delete Legacy Tool Handlers

**Current code** (lines 1122-2141):
```typescript
case "search": { /* ~60 lines */ }
case "enhancedSearch": { /* ~90 lines */ }
case "read": { /* ~60 lines */ }
case "createFile": { /* ~50 lines */ }
case "updateFile": { /* ~30 lines */ }
case "createFolder": { /* ~35 lines */ }
case "createForm": { /* ~45 lines */ }
case "getForm": { /* ~35 lines */ }
case "addQuestion": { /* ~100 lines */ }
case "listResponses": { /* ~30 lines */ }
case "createDocument": { /* ~50 lines */ }
case "insertText": { /* ~30 lines */ }
case "replaceText": { /* ~35 lines */ }
case "applyTextStyle": { /* ~65 lines */ }
case "insertTable": { /* ~30 lines */ }
case "batchFileOperations": { /* ~145 lines */ }
```

**Replace with:**
```typescript
// Only keep these 5 handlers:
case "sheets": {
  return await handleSheetsTool(args ?? {}, { logger, sheets, cacheManager, performanceMonitor, startTime });
}

case "drive": {
  return await handleDriveTool(args ?? {}, { logger, drive, cacheManager, performanceMonitor, startTime });
}

case "forms": {
  return await handleFormsTool(args ?? {}, { logger, forms, cacheManager, performanceMonitor, startTime });
}

case "docs": {
  return await handleDocsTool(args ?? {}, { logger, docs, drive, cacheManager, performanceMonitor, startTime });
}

case "getAppScript": {
  // Keep this inline since it's simple and not operation-based
  return await handleGetAppScript(args ?? {}, { logger, script, cacheManager, performanceMonitor, startTime });
}

default:
  throw new Error(`Unknown tool: ${name}`);
```

**Result:**
- Remove ~800-1000 lines of duplicate code
- Reduce `index.ts` from 2424 lines to ~1400 lines
- Improve maintainability

---

#### Step 1.2: Verify No Breaking Changes

**Test that existing clients still work:**
```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Check that consolidated tools work
# (The legacy individual tools were never registered, so no clients use them)
```

---

### Phase 2: Add Prompts Support (Week 1-2)

#### Step 2.1: Create Prompts Handler

Create `src/prompts/prompts-handler.ts`:

```typescript
import type { Logger } from 'winston';

export interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export const PROMPTS: Prompt[] = [
  {
    name: "create-professional-doc",
    description: "Create a professional document with proper formatting and branding",
    arguments: [
      { name: "title", description: "Document title", required: true },
      { name: "content", description: "Document content", required: true },
      { name: "brandColor", description: "Brand color in hex (e.g., #4DB8AC)", required: false },
    ],
  },
  {
    name: "create-staff-survey",
    description: "Create a staff feedback survey with standard question types",
    arguments: [
      { name: "title", description: "Survey title", required: true },
      { name: "includeAnonymous", description: "Make responses anonymous", required: false },
    ],
  },
  {
    name: "create-data-spreadsheet",
    description: "Create a formatted spreadsheet with headers and data validation",
    arguments: [
      { name: "title", description: "Spreadsheet title", required: true },
      { name: "headers", description: "Comma-separated column headers", required: true },
    ],
  },
  {
    name: "export-form-responses",
    description: "Export form responses to a formatted spreadsheet",
    arguments: [
      { name: "formId", description: "Google Form ID", required: true },
      { name: "includeCharts", description: "Include response charts", required: false },
    ],
  },
];

export function getPromptTemplate(name: string, args: Record<string, string>): string {
  switch (name) {
    case "create-professional-doc":
      return `Create a professional Google Doc with the following specifications:

Title: "${args.title}"
Brand Color: ${args.brandColor || "#4DB8AC (teal)"}

Use the docs tool with batchUpdate operation to:

1. **Insert and format title:**
   - Text: "${args.title}"
   - Style: HEADING_1, centered, bold
   - Font size: 24pt
   - Color: ${args.brandColor || "rgb(0.3, 0.72, 0.67)"}

2. **Insert body content:**
   - Text: ${args.content}
   - Font size: 14pt
   - Line spacing: 1.5

3. **Add professional footer:**
   - Horizontal line separator
   - Small text (10pt) with date and company info

Example batch update request structure:
\`\`\`typescript
{
  operation: "batchUpdate",
  documentId: "<created-doc-id>",
  requests: [
    { insertText: { location: { index: 1 }, text: "${args.title}\\n\\n" } },
    { updateTextStyle: { /* title formatting */ } },
    { updateParagraphStyle: { /* title paragraph style */ } },
    { insertText: { location: { index: N }, text: "${args.content}\\n\\n" } },
    // ... footer requests
  ]
}
\`\`\``;

    case "create-staff-survey":
      return `Create a staff feedback survey using the forms tool:

1. Create form with title: "${args.title}"
2. Add standard feedback questions:
   - Overall satisfaction (LINEAR_SCALE, 1-5)
   - What's working well? (PARAGRAPH_TEXT)
   - What could be improved? (PARAGRAPH_TEXT)
   - Suggestions for management (PARAGRAPH_TEXT, optional)
${args.includeAnonymous === "true" ? "   - Make form anonymous (don't collect email)" : ""}

Use these operations:
1. forms tool, operation: "create"
2. forms tool, operation: "addQuestion" (repeat for each question)

Return the form URL for sharing.`;

    case "create-data-spreadsheet":
      const headers = args.headers.split(',').map(h => h.trim());
      return `Create a formatted Google Sheet for data entry:

1. Create spreadsheet: "${args.title}"
2. Set up header row with: ${headers.join(', ')}
3. Format headers:
   - Bold text
   - Background color: light blue (rgb(0.8, 0.9, 1))
   - Freeze first row
4. Set column widths for readability

Use sheets tool with these operations:
1. operation: "create" (with sheetName)
2. operation: "update" (to add headers)
3. operation: "format" (to style header row)
4. operation: "freeze" (frozenRowCount: 1)
5. operation: "setColumnWidth" (for each column)`;

    case "export-form-responses":
      return `Export Google Form responses to a formatted spreadsheet:

1. Get form responses using forms tool:
   - operation: "listResponses"
   - formId: "${args.formId}"

2. Create new spreadsheet for responses
3. Format the data:
   - First row: Question headers (bold, colored background)
   - Subsequent rows: Responses
   - Include timestamp, respondent email if available

4. ${args.includeCharts === "true" ? "Add charts for multiple choice/scale questions" : "Basic table format"}

5. Return spreadsheet URL`;

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
```

#### Step 2.2: Register Prompts in MCP Server

Add to `index.ts`:

```typescript
import { ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { PROMPTS, getPromptTemplate } from './src/prompts/prompts-handler.js';

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: PROMPTS };
});

// Get specific prompt
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const template = getPromptTemplate(name, args ?? {});

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: template,
        },
      },
    ],
  };
});
```

**Benefits:**
- LLMs can discover and use pre-built workflows
- Reduces need for users to write complex prompts
- Ensures consistent usage patterns
- Guides LLMs to use tools correctly

---

### Phase 3: Optimize Context Window (Week 2)

#### Strategy 1: Lazy-Load Handler Modules

**Current problem:** All handlers are imported at startup, even if not used.

**Solution:** Use dynamic imports in tool handlers.

**Before:**
```typescript
import { handleSheetsTool } from './src/sheets/sheets-handler.js';
import { handleDriveTool } from './src/drive/drive-handler.js';
// ... etc
```

**After:**
```typescript
case "sheets": {
  const { handleSheetsTool } = await import('./src/sheets/sheets-handler.js');
  return await handleSheetsTool(args ?? {}, context);
}

case "drive": {
  const { handleDriveTool } = await import('./src/drive/drive-handler.js');
  return await handleDriveTool(args ?? {}, context);
}
```

**Benefits:**
- Only load code for tools being used
- Faster startup time
- Smaller memory footprint

---

#### Strategy 2: Split InputSchema Definitions

**Current problem:** All tool schemas defined inline in `ListToolsRequestSchema` (lines 640-1105 = **465 lines**).

**Solution:** Move schemas to separate files, generate from Zod schemas.

**Create** `src/schemas/tool-schemas.ts`:
```typescript
import { SheetsToolSchema } from '../sheets/sheets-schemas.js';
import { DriveToolSchema } from '../drive/drive-schemas.js';
import { FormsToolSchema } from '../forms/forms-schemas.js';
import { DocsToolSchema } from '../docs/docs-schemas.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function generateMcpToolSchemas() {
  return [
    {
      name: "sheets",
      description: "Consolidated Google Sheets tool supporting 12 operations",
      inputSchema: zodToJsonSchema(SheetsToolSchema),
    },
    {
      name: "drive",
      description: "Consolidated Google Drive tool supporting 7 operations",
      inputSchema: zodToJsonSchema(DriveToolSchema),
    },
    {
      name: "forms",
      description: "Consolidated Google Forms tool supporting 4 operations",
      inputSchema: zodToJsonSchema(FormsToolSchema),
    },
    {
      name: "docs",
      description: "Consolidated Google Docs tool supporting 5 operations",
      inputSchema: zodToJsonSchema(DocsToolSchema),
    },
  ];
}
```

**Update** `index.ts`:
```typescript
import { generateMcpToolSchemas } from './src/schemas/tool-schemas.js';

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: generateMcpToolSchemas(),
  };
});
```

**Benefits:**
- Single source of truth (Zod schemas)
- Automatic JSON Schema generation
- Type safety guaranteed
- Reduced duplication

---

#### Strategy 3: Compress Tool Descriptions

**Current:** Verbose descriptions with all parameters explained inline.

**Better:** Concise descriptions, detailed docs in prompts.

**Before:**
```typescript
{
  name: "sheets",
  description: "Consolidated Google Sheets tool supporting operations for list, read, create, rename, delete, update, updateFormula, format, conditionalFormat, append, freeze, and setColumnWidth",
  // ... 200 lines of schema
}
```

**After:**
```typescript
{
  name: "sheets",
  description: "Google Sheets operations (12 ops). Use prompts for examples.",
  inputSchema: { /* generated from Zod */ }
}
```

Then provide detailed examples in prompts:
```typescript
{
  name: "sheets-examples",
  description: "Examples of common Google Sheets operations",
  // ... detailed examples
}
```

---

### Phase 4: Optimize for LLM Context (Week 2-3)

#### Technique 1: Operation Grouping by Complexity

Split tools by complexity level to reduce context for simple tasks:

**Option A: Current Approach** (All operations in one tool)
```typescript
sheets: [list, read, create, rename, delete, update, updateFormula, format, conditionalFormat, append, freeze, setColumnWidth]
// LLM always sees ALL 12 operations + all their parameters
```

**Option B: Split by Complexity** (Better for context)
```typescript
sheets-basic: [list, read, create, update, append]
sheets-advanced: [rename, delete, updateFormula, format, conditionalFormat, freeze, setColumnWidth]
```

**Trade-off:**
- ❌ More tools to register
- ✅ Smaller context per tool
- ✅ LLM can pick appropriate tool
- ✅ Faster for simple operations

**Recommendation:** Keep current approach, but add prompts for common operations.

---

#### Technique 2: Smart Schema Filtering

Only show relevant parameters based on operation:

**Current:** All parameters shown for all operations (confusing!)

**Better:** Use JSON Schema `if/then/else` to conditionally show parameters:

```json
{
  "if": {
    "properties": { "operation": { "const": "create" } }
  },
  "then": {
    "required": ["operation", "spreadsheetId", "sheetName"],
    "properties": {
      "sheetName": { "type": "string" },
      "rowCount": { "type": "number" },
      "columnCount": { "type": "number" }
    }
  }
}
```

This makes LLMs see only relevant parameters for each operation!

---

#### Technique 3: Resource-Based Discovery

Use resources to help LLMs discover what's available:

**Add resource types:**
```typescript
server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  // Current: List recent files
  // Better: List by category

  return {
    resources: [
      // Recent documents
      { uri: "gdrive:///recent/docs", name: "Recent Documents" },
      { uri: "gdrive:///recent/sheets", name: "Recent Spreadsheets" },
      { uri: "gdrive:///recent/forms", name: "Recent Forms" },

      // Folders
      { uri: "gdrive:///folder/clients", name: "Client Documents" },
      { uri: "gdrive:///folder/templates", name: "Templates" },

      // Individual files (current approach)
      // ...
    ]
  };
});
```

This gives LLMs structure for discovery without tool calls!

---

## 📏 Metrics: Before vs After Cleanup

### Code Size

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| `index.ts` total lines | 2,424 | ~1,400 | -42% |
| Tool handler cases | 21 | 5 | -76% |
| Duplicate code (lines) | ~1,000 | 0 | -100% |
| Schema definitions (inline) | 465 lines | Generated | Dynamic |

### Context Window Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Registered tools | 5 | 5 + prompts | Better guidance |
| Schema verbosity | High | Medium | Conditional schemas |
| Example patterns | None | 4-6 prompts | Built-in help |
| Dead code sent to LLM | Yes (via source) | No | Cleaner |

### Maintainability

| Aspect | Before | After | Benefit |
|--------|--------|-------|---------|
| Single source of truth | No (Zod + JSON) | Yes (Zod only) | Consistency |
| Test coverage | Partial | Complete | Reliability |
| Adding new operation | 3 places | 2 places | Faster dev |
| Schema validation | Manual sync | Auto-generated | No drift |

---

## 🎯 Optimal MCP Architecture

### Final Recommended Structure

```
google-drive-mcp/
├── index.ts                      # MCP server (< 500 lines)
│   ├── Server setup
│   ├── Resource handlers (list, read)
│   ├── Tool routing (5 cases)
│   └── Prompt handlers
│
├── src/
│   ├── schemas/
│   │   └── tool-schemas.ts       # JSON Schema generation
│   │
│   ├── prompts/
│   │   ├── prompts-handler.ts    # Prompt templates
│   │   └── prompt-examples.ts    # Common patterns
│   │
│   ├── sheets/
│   │   ├── sheets-schemas.ts     # Zod validation
│   │   ├── sheets-handler.ts     # Operation router
│   │   └── operations/
│   │       ├── list.ts
│   │       ├── read.ts
│   │       ├── create.ts
│   │       └── ... (one file per operation)
│   │
│   ├── drive/ (same structure)
│   ├── forms/ (same structure)
│   ├── docs/ (same structure)
│   │
│   ├── auth/
│   └── utils/
│
└── package.json
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Easy to add new operations
- ✅ Minimal context window usage
- ✅ Self-documenting via prompts
- ✅ Type-safe throughout

---

## 🚀 Implementation Roadmap

### Week 1: Cleanup
- [ ] Remove legacy tool handlers from `index.ts`
- [ ] Verify all tests pass
- [ ] Deploy and monitor for issues

### Week 2: Prompts
- [ ] Implement prompts handler
- [ ] Create 4-6 common workflow prompts
- [ ] Register prompts with MCP server
- [ ] Document prompt usage

### Week 3: Optimization
- [ ] Implement lazy-loading for handlers
- [ ] Generate schemas from Zod
- [ ] Add conditional parameter visibility
- [ ] Optimize resource listing

### Week 4: Documentation & Polish
- [ ] Update API documentation
- [ ] Create migration guide (none needed - no breaking changes!)
- [ ] Add performance benchmarks
- [ ] User acceptance testing

---

## ✅ Success Criteria

### Functional
- [ ] All existing functionality preserved
- [ ] No breaking changes for clients
- [ ] Prompts working end-to-end
- [ ] Resources enhanced with categories

### Performance
- [ ] Code size reduced by >40%
- [ ] Faster server startup
- [ ] Smaller context window footprint
- [ ] Better LLM guidance

### Quality
- [ ] 100% test coverage maintained
- [ ] No TypeScript errors
- [ ] ESLint passing
- [ ] Documentation complete

---

## 📚 Key Learnings

### 1. **You Already Have Good Architecture!**
Your v2.0.0 consolidation was correct. You just have leftover code to remove.

### 2. **Resources ≠ Tools**
- **Resources**: Content for LLM to read
- **Tools**: Actions for LLM to execute
- Both are valuable, serve different purposes

### 3. **Prompts Are Essential**
- Guide LLMs to use tools correctly
- Reduce context window usage
- Provide best practice examples
- Make complex workflows simple

### 4. **Context Window Optimization**
Not just about code size, but:
- Clear tool descriptions
- Conditional parameter visibility
- Built-in examples (prompts)
- Smart resource categorization

---

## 🎓 References

- [MCP Specification - Resources](https://spec.modelcontextprotocol.io/specification/server/resources/)
- [MCP Specification - Tools](https://spec.modelcontextprotocol.io/specification/server/tools/)
- [MCP Specification - Prompts](https://spec.modelcontextprotocol.io/specification/server/prompts/)
- [Zod to JSON Schema](https://github.com/StefanTerdell/zod-to-json-schema)
- [how2mcp Repository](file:///Users/ossieirondi/projects/scratch/how2mcp/)

---

## 💡 Next Steps

1. **Start with Week 1 cleanup** - Remove dead code (safe, no breaking changes)
2. **Add prompts in Week 2** - Huge UX improvement for LLMs
3. **Optimize in Week 3** - Technical improvements
4. **Document in Week 4** - Share learnings

**Estimated effort:** 3-4 weeks
**Risk level:** Low (mostly additive changes)
**Impact:** High (better performance, maintainability, and UX)
