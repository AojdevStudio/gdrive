# Epic: Consolidate All Google Workspace Tools to Operation-Based Architecture

**Epic ID:** EPIC-001
**Created:** 2025-10-11
**Status:** Ready for Development
**Priority:** High
**Target Completion:** 1 hour (aggressive timeline)

---

## Epic Overview

Refactor the Google Drive MCP server from **41+ individual tools** to **5 consolidated operation-based tools** following HOW2MCP 2025 best practices and the original architectural vision.

## Business Value

### Problem Statement
The current implementation exposes 41+ individual MCP tools (12 for Sheets, 7 for Drive, 4 for Forms, 5 for Docs, etc.), which:
- Overwhelms LLMs with too many tool choices during selection
- Increases cognitive load for AI decision-making
- Deviates from the original 5-tool architecture design
- Makes maintenance more complex with scattered implementations

### Solution
Consolidate related operations into **5 domain-specific tools** with operation parameters:
- `sheets` - 12 operations (list, read, create, rename, delete, update, updateFormula, format, conditionalFormat, append, freeze, setColumnWidth)
- `drive` - 7 operations (search, enhancedSearch, read, create, update, createFolder, batch)
- `forms` - 4 operations (create, read, addQuestion, listResponses)
- `docs` - 5 operations (create, insertText, replaceText, applyTextStyle, insertTable)
- `batch` - File operations

### Expected Outcomes
✅ Reduce tool count from 41+ to 5 (88% reduction)
✅ Improve LLM tool selection speed and accuracy
✅ Align with HOW2MCP 2025 architecture patterns
✅ Maintain 100% functional compatibility
✅ Establish repeatable pattern for future consolidations
✅ Reduce codebase complexity (~750 lines removed per service)

---

## Reference Architecture

**From HOW2MCP repository** (`/Users/ossieirondi/projects/scratch/how2mcp/`):

### Correct Pattern (Operation-Based)
```typescript
{
  name: "calculator",
  inputSchema: {
    properties: {
      operation: { enum: ["add", "subtract", "multiply", "divide"] },
      a: { type: "number" },
      b: { type: "number" }
    }
  }
}
```

### Incorrect Pattern (Individual Tools) - What We're Fixing
```typescript
{ name: "add", ... }
{ name: "subtract", ... }
{ name: "multiply", ... }
```

---

## Stories

### Story 1: Setup Consolidated Sheets Tool (Phase 1)
**Estimate:** 15 minutes
**Description:** Create Zod schemas with discriminated unions, operation handler with routing, and wire into main server
**Reference:** `docs/Migration/consolidation-guide.md` Lines 140-395

### Story 2: Testing & Validation of Sheets Tool (Phase 2)
**Estimate:** 10 minutes
**Description:** Test all 12 Sheets operations end-to-end using MCP Inspector
**Reference:** `docs/Migration/consolidation-guide.md` Lines 979-1014

### Story 3: Cleanup Deprecated Sheets Code (Phase 3)
**Estimate:** 10 minutes
**Description:** Remove old individual tool schemas and handlers, verify tools/list
**Reference:** `docs/Migration/consolidation-guide.md` Lines 1086-1092

### Story 4: Documentation & Versioning (Phase 4)
**Estimate:** 15 minutes
**Description:** Update README, CHANGELOG, API docs for v2.0.0 breaking change
**Reference:** `docs/Migration/consolidation-guide.md` Lines 1094-1099

### Story 5: Repeat Pattern for Drive, Forms, Docs (Phase 5)
**Estimate:** 30 minutes
**Description:** Apply proven Sheets consolidation pattern to remaining 3 services
**Reference:** `docs/Migration/consolidation-guide.md` Lines 1100-1105

---

## Technical Details

### Files Modified
- `index.ts` - Main server file (~750 lines removed, ~380 lines added per service)
- `src/sheets/sheets-schemas.ts` - New Zod schemas (Story 1)
- `src/sheets/sheets-handler.ts` - New operation router (Story 1)
- `src/drive/*` - Drive consolidation files (Story 5)
- `src/forms/*` - Forms consolidation files (Story 5)
- `src/docs/*` - Docs consolidation files (Story 5)
- `README.md`, `CHANGELOG.md` - Documentation (Story 4)

### Key Architectural Patterns

#### 1. Zod Discriminated Unions (Type Safety)
```typescript
export const SheetsToolSchema = z.discriminatedUnion('operation', [
  SheetsListSchema,
  SheetsReadSchema,
  SheetsCreateSchema,
  // ... all 12 operations
]);
```

#### 2. Centralized Logger Pattern (MCP_ARCHITECTURE_2025.md)
```typescript
export async function handleSheetsTool(args: any, context: { logger: Logger }) {
  const { logger } = context;
  // Single logger instance passed from main server
}
```

#### 3. Single ListTools Handler (Prevents Overwriting)
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ALL tools registered in ONE place
  ]
}));
```

#### 4. Operation Routing
```typescript
switch (operation) {
  case "list": return await handleListSheets(validated, context);
  case "read": return await handleReadSheet(validated, context);
  // ... route to appropriate handler
}
```

---

## Dependencies

- **HOW2MCP Reference Repository:** `/Users/ossieirondi/projects/scratch/how2mcp/`
- **Consolidation Guide:** `docs/Migration/consolidation-guide.md` (1117 lines)
- **Current Tool Count:** 41+ tools
- **Target Tool Count:** 5 tools

---

## Success Criteria

### Functional Requirements
- [ ] All 12 Sheets operations work identically to individual tools
- [ ] All 7 Drive operations consolidated and tested
- [ ] All 4 Forms operations consolidated and tested
- [ ] All 5 Docs operations consolidated and tested
- [ ] `tools/list` returns exactly 5 tools (not 41+)
- [ ] No regression in existing functionality
- [ ] All tests pass (37+ existing tests updated)

### Non-Functional Requirements
- [ ] Follows HOW2MCP 2025 patterns exactly
- [ ] Uses Zod discriminated unions for type safety
- [ ] Implements centralized logger pattern
- [ ] Single ListTools handler for all tools
- [ ] Operation-based routing in all handlers
- [ ] Complete documentation for v2.0.0

### Performance Requirements
- [ ] Tool selection time improved (fewer choices for LLM)
- [ ] No performance degradation in operations
- [ ] Redis caching still functional

---

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Timeline too aggressive (1 hour) | High | Medium | Parallel execution of Story 5 sub-tasks; clear guide exists |
| Breaking changes for existing users | High | Certain | Version bump to v2.0.0; migration guide in docs |
| Incomplete testing | Medium | Low | Story 2 dedicated to testing; all operations tested |
| Old tools still appearing | Medium | Medium | Story 3 cleanup phase with explicit verification |

---

## Timeline

**Total Estimated Time:** 80 minutes (20 minutes over target)

| Phase | Story | Time | Cumulative |
|-------|-------|------|------------|
| Phase 1 | Story 1: Setup Sheets | 15 min | 15 min |
| Phase 2 | Story 2: Test Sheets | 10 min | 25 min |
| Phase 3 | Story 3: Cleanup Sheets | 10 min | 35 min |
| Phase 4 | Story 4: Documentation | 15 min | 50 min |
| Phase 5 | Story 5: Repeat Pattern (3x parallel) | 30 min | 80 min |

**Optimization Strategy:** Execute Story 5 sub-tasks (Drive, Forms, Docs) in parallel to save ~20 minutes.

---

## Related Documentation

- **HOW2MCP Architecture Guide:** `/Users/ossieirondi/projects/scratch/how2mcp/MCP-DOCS/MCP_ARCHITECTURE_2025.md`
- **HOW2MCP Example Project:** `/Users/ossieirondi/projects/scratch/how2mcp/MCP_EXAMPLE_PROJECT/src/tools/index.ts`
- **Consolidation Guide:** `docs/Migration/consolidation-guide.md`
- **Original Spec:** `specs/sheets-tool-consolidation.md`

---

## Approvals

- [ ] Product Owner: Sarah
- [ ] Architect: Winston
- [ ] Tech Lead: Amelia
- [ ] QA Lead: Murat

**Epic Status:** ✅ Ready for Story Generation

---

*Generated by: Sarah (Product Owner) & BMad Master*
*Date: 2025-10-11*
*Based on: Consolidation Guide (1117 lines)*
