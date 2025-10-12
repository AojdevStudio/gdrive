# Story 001: Setup Consolidated Sheets Tool (Phase 1)

**Story ID:** story-001
**Epic:** epic-001 - Consolidate Google Workspace Tools
**Created:** 2025-10-11
**Status:** Ready for Review 
**Priority:** High
**Estimate:** 15 minutes
**Assignee:** TBD

---

## User Story

**As a** MCP server developer
**I want** to consolidate 12 individual Sheets tools into 1 operation-based tool  
**So that** the LLM sees fewer tools (improved selection) and the codebase follows HOW2MCP 2025 patterns

---

## Description

Create the foundational components for the consolidated `sheets` tool following HOW2MCP patterns:
1. Zod schemas with discriminated unions for type safety
2. Operation handler with routing logic
3. Wire into main server with centralized tool registration

This story implements the core architecture that will be replicated for Drive, Forms, and Docs in Story 5.

---

## Acceptance Criteria

### AC-1: Create Zod Schemas File
- [x] Create file: `src/sheets/sheets-schemas.ts`
- [x] Implement base schema with `operation` discriminator
- [x] Implement 12 operation-specific schemas:
  - `SheetsListSchema` (operation: "list")
  - `SheetsReadSchema` (operation: "read", requires: range)
  - `SheetsCreateSchema` (operation: "create", requires: sheetName)
  - `SheetsRenameSchema` (operation: "rename", requires: sheetName|sheetId, newName)
  - `SheetsDeleteSchema` (operation: "delete", requires: sheetName|sheetId)
  - `SheetsUpdateSchema` (operation: "update", requires: range, values)
  - `SheetsUpdateFormulaSchema` (operation: "updateFormula", requires: range, formula)
  - `SheetsFormatSchema` (operation: "format", requires: range, format)
  - `SheetsConditionalFormatSchema` (operation: "conditionalFormat", requires: range, rule)
  - `SheetsAppendSchema` (operation: "append", requires: values)
  - `SheetsFreezeSchema` (operation: "freeze", requires: frozenRowCount, frozenColumnCount)
  - `SheetsSetColumnWidthSchema` (operation: "setColumnWidth", requires: columns)
- [x] Use Zod `.refine()` for either/or validation (rename/delete need sheetName OR sheetId)
- [x] Export discriminated union: `z.discriminatedUnion('operation', [...])`
- [x] Export TypeScript type: `export type SheetsToolInput = z.infer<typeof SheetsToolSchema>`

**Reference:** Consolidation Guide Lines 144-264

### AC-2: Create Operation Handler File
- [x] Create file: `src/sheets/sheets-handler.ts`
- [x] Implement main handler: `handleSheetsTool(args: any, context: { logger: Logger })`
- [x] Validate args with `SheetsToolSchema.parse(args)`
- [x] Implement operation router using switch statement on `validated.operation`
- [x] Implement 12 individual operation handlers:
  - `handleListSheets()` - Copy logic from existing `listSheets` handler
  - `handleReadSheet()` - Copy logic from existing `readSheet` handler
  - `handleCreateSheet()` - Copy logic from existing `createSheet` handler
  - `handleRenameSheet()` - Copy logic from existing `renameSheet` handler
  - `handleDeleteSheet()` - Copy logic from existing `deleteSheet` handler
  - `handleUpdateCells()` - Copy logic from existing `updateCells` handler
  - `handleUpdateFormula()` - Copy logic from existing `updateCellsWithFormula` handler
  - `handleFormatCells()` - Copy logic from existing `formatCells` handler
  - `handleConditionalFormat()` - Copy logic from existing `addConditionalFormatting` handler
  - `handleAppendRows()` - Copy logic from existing `appendRows` handler
  - `handleFreezeRowsColumns()` - Copy logic from existing `freezeRowsColumns` handler
  - `handleSetColumnWidth()` - Copy logic from existing `setColumnWidth` handler
- [x] Use TypeScript `Extract<>` utility for type-safe operation handlers
- [x] Pass centralized logger to all handlers (no new logger instances)
- [x] Return standard MCP response format: `{ content: [{ type: "text", text: "..." }] }`

**Reference:** Consolidation Guide Lines 401-788

### AC-3: Wire Into Main Server
- [x] Open `index.ts`
- [x] Import: `import { handleSheetsTool } from './src/sheets/sheets-handler.js'`
- [x] Add consolidated `sheets` tool definition to `ListToolsRequestSchema` handler
- [x] Tool schema includes:
  - `name: "sheets"`
  - `operation` enum with all 12 operations
  - All operation-specific parameters (range, sheetName, values, format, etc.)
  - `required: ["operation", "spreadsheetId"]`
- [x] Add case handler in `CallToolRequestSchema`:
  ```typescript
  case "sheets":
    return await handleSheetsTool(args, { logger: this.logger });
  ```
- [x] Ensure single `ListToolsRequestSchema` handler returns ALL tools (not just sheets)

**Reference:** Consolidation Guide Lines 797-956

### AC-4: Verify TypeScript Compilation
- [x] Run `npm run build`
- [x] No TypeScript errors
- [x] Verify `dist/src/sheets/sheets-schemas.js` exists
- [x] Verify `dist/src/sheets/sheets-handler.js` exists
- [x] Verify `dist/index.js` updated

---

## Technical Notes

### Key Architectural Patterns (HOW2MCP 2025)

**1. Discriminated Unions**
```typescript
// Type-safe operation routing
const SheetsToolSchema = z.discriminatedUnion('operation', [
  SheetsListSchema,  // { operation: "list", spreadsheetId }
  SheetsReadSchema,  // { operation: "read", spreadsheetId, range }
  // ... 10 more
]);
```

**2. Centralized Logger**
```typescript
// NO new logger instances in handlers
export async function handleSheetsTool(args: any, context: { logger: Logger }) {
  const { logger } = context;  // Use passed logger
}
```

**3. Single Tool Registration**
```typescript
// ALL tools in ONE ListToolsRequestSchema handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "sheets", ... },
    // Drive, Forms, Docs will be added here in Story 5
  ]
}));
```

### Files to Reference
- **HOW2MCP Example:** `/Users/ossieirondi/projects/scratch/how2mcp/MCP_EXAMPLE_PROJECT/src/tools/index.ts`
  - See lines 30-76 for calculator tool with operations
- **Consolidation Guide:** `docs/Migration/consolidation-guide.md`
  - Lines 144-264: Zod schemas
  - Lines 401-788: Handlers
  - Lines 797-956: Main server

### Existing Code Locations (To Copy From)
Current individual tool handlers in `index.ts`:
- Line ~2023: `case "listSheets"`
- Line ~2051: `case "readSheet"`
- Line ~2381: `case "createSheet"`
- Line ~2501: `case "renameSheet"`
- Line ~2546: `case "deleteSheet"`
- (Find other handlers around lines 2000-2700)

---

## Dependencies

**Depends On:**
- None (First story in epic)

**Blocks:**
- story-002 (Testing requires this implementation)
- story-003 (Cleanup requires this to work first)

---

## Definition of Done

- [x] All acceptance criteria met
- [x] Code compiles without errors
- [x] No ESLint violations
- [x] TypeScript types are correct
- [x] Code follows HOW2MCP patterns exactly
- [x] Existing helper functions reused (no duplication)
- [x] Ready for testing in Story 2

---

## Testing Strategy

**Story 2 will test this implementation.** For Story 1, only verify:
- TypeScript compilation successful
- Files created in correct locations
- No import/export errors

---

## Notes

- **DO NOT delete old tools yet** - That's Story 3
- **DO NOT test operations yet** - That's Story 2
- **Focus:** Create the new architecture, keep old tools running
- This pattern will be replicated 3 more times in Story 5

---

## Time Breakdown

| Task | Estimated Time |
|------|---------------|
| Create Zod schemas file | 5 min |
| Create handler with 12 operations | 7 min |
| Wire into main server | 3 min |
| **Total** | **15 min** |

---

## Dev Agent Record

### Context Reference
- **Story Context XML**: `docs/story-context-epic-001.story-001.xml` (Generated: 2025-10-11)
  - Contains comprehensive context for implementation including:
    - All 12 acceptance criteria with detailed requirements
    - Code artifacts: 15 existing handlers and utilities to reference
    - Documentation artifacts: 5 key architectural documents
    - 7 implementation constraints (HOW2MCP patterns, Zod usage, centralized logger)
    - Interface definitions for SheetsToolInput, handleSheetsTool, Logger, CacheManager
    - Testing guidance (Story 1 = compilation only, Story 2 = runtime tests)
    - Dependency information (Zod available via @modelcontextprotocol/sdk)

### Debug Log
- Reviewed existing sheet switch cases to map required helper calls before implementing the consolidated handler.
- Authored `SheetsToolSchema` with discriminated union plus `.refine` checks for rename/delete, exporting `SheetsToolInput` (AC-1).
- Implemented `handleSheetsTool` with `Extract<>`-typed dispatchers, reusing caching, logging, and performance patterns from legacy cases (AC-2).
- Registered the consolidated tool in `ListToolsRequestSchema` and added the new `case "sheets"` branch in `CallToolRequestSchema` (AC-3).
- Ran `npm run build` verifying generated outputs (`dist/src/sheets/sheets-{schemas,handler}.js`, `dist/index.js`) to satisfy Story 1 testing scope (AC-4).

### Completion Notes
- Consolidated sheets workflows now route through a single handler while legacy per-operation cases remain for backward compatibility.
- Type-safe schemas and handlers align with HOW2MCP 2025 guidance; build passes and Story 1 is ready for Story 2 validation work.

### File List
- `index.ts`
- `src/sheets/sheets-handler.ts`
- `src/sheets/sheets-schemas.ts`

### Change Log
- Added consolidated Sheets schema/handler pair with discriminated-union validation.
- Updated server wiring to expose the new `sheets` tool alongside existing tool registrations.

---

*Generated by: Sarah (Product Owner) & Bob (Scrum Master)*
*Date: 2025-10-11*
*Based on: Consolidation Guide Lines 140-395*
