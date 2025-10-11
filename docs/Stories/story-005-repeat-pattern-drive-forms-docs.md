# Story 005: Repeat Pattern for Drive, Forms, Docs (Phase 5)

**Story ID:** story-005
**Epic:** epic-001 - Consolidate Google Workspace Tools
**Created:** 2025-10-11
**Status:** Ready for Development
**Priority:** High
**Estimate:** 30 minutes (parallel execution with 3 agents)
**Assignee:** Amelia (Developer Lead) + Team

---

## User Story

**As a** development team
**I want** to apply the proven Sheets consolidation pattern to Drive, Forms, and Docs
**So that** we complete the full 41+ → 5 tools refactoring efficiently

---

## Description

This story scales the consolidation pattern proven in Stories 1-3 (Sheets) to the remaining three Google Workspace services. Each service follows the EXACT same pattern:
1. **Setup**: Create Zod schemas + handler + wire into main server
2. **Test**: Validate all operations work correctly
3. **Cleanup**: Remove old individual tools

**CRITICAL SUCCESS FACTOR:** Execute these 3 consolidations **IN PARALLEL** with separate agents to meet the 1-hour timeline.

---

## Architecture Overview

### Consolidation Targets

**Track 1: Drive Consolidation**
- **Current**: 7 individual tools
- **Target**: 1 `drive` tool with 7 operations
- **Operations**: `search`, `enhancedSearch`, `read`, `create`, `update`, `createFolder`, `batch`
- **Estimated Time**: 30 minutes
- **Agent**: Amelia (Developer)

**Track 2: Forms Consolidation**
- **Current**: 4 individual tools
- **Target**: 1 `forms` tool with 4 operations
- **Operations**: `create`, `read`, `addQuestion`, `listResponses`
- **Estimated Time**: 30 minutes
- **Agent**: Winston (Architect)

**Track 3: Docs Consolidation**
- **Current**: 5 individual tools
- **Target**: 1 `docs` tool with 5 operations
- **Operations**: `create`, `insertText`, `replaceText`, `applyTextStyle`, `insertTable`
- **Estimated Time**: 30 minutes
- **Agent**: John (Product Manager)

**Reference:** Consolidation Guide Lines 1100-1105

---

## Acceptance Criteria

### AC-1: Drive Consolidation Complete
- [ ] Create `src/drive/drive-schemas.ts` with 7 operation schemas
- [ ] Create `src/drive/drive-handler.ts` with operation router
- [ ] Wire `drive` tool into `index.ts` ListToolsRequestSchema
- [ ] Test all 7 operations with MCP Inspector
- [ ] Remove old individual Drive tool definitions and handlers
- [ ] Verify `tools/list` shows only consolidated `drive` tool

**Drive Operations:**
1. `search` - Natural language search
2. `enhancedSearch` - Advanced search with filters
3. `read` - Read file contents
4. `create` - Create new file
5. `update` - Update file contents
6. `createFolder` - Create folder
7. `batch` - Batch operations (create, update, delete, move)

### AC-2: Forms Consolidation Complete
- [ ] Create `src/forms/forms-schemas.ts` with 4 operation schemas
- [ ] Create `src/forms/forms-handler.ts` with operation router
- [ ] Wire `forms` tool into `index.ts` ListToolsRequestSchema
- [ ] Test all 4 operations with MCP Inspector
- [ ] Remove old individual Forms tool definitions and handlers
- [ ] Verify `tools/list` shows only consolidated `forms` tool

**Forms Operations:**
1. `create` - Create new form
2. `read` - Get form details
3. `addQuestion` - Add question to form
4. `listResponses` - List form responses

### AC-3: Docs Consolidation Complete
- [ ] Create `src/docs/docs-schemas.ts` with 5 operation schemas
- [ ] Create `src/docs/docs-handler.ts` with operation router
- [ ] Wire `docs` tool into `index.ts` ListToolsRequestSchema
- [ ] Test all 5 operations with MCP Inspector
- [ ] Remove old individual Docs tool definitions and handlers
- [ ] Verify `tools/list` shows only consolidated `docs` tool

**Docs Operations:**
1. `create` - Create new document
2. `insertText` - Insert text at location
3. `replaceText` - Replace all occurrences of text
4. `applyTextStyle` - Apply text styling
5. `insertTable` - Insert table at location

### AC-4: Final Verification
- [ ] Run `npm run build` - No TypeScript errors
- [ ] Run `tools/list` - Shows exactly 5 tools:
  - `sheets` (from Stories 1-3)
  - `drive` (Track 1)
  - `forms` (Track 2)
  - `docs` (Track 3)
  - Plus any non-consolidated tools (e.g., `batchFileOperations`)
- [ ] Verify total tool count reduced from 41+ to ~5-8 tools
- [ ] All operations tested end-to-end
- [ ] No old individual tools remain

---

## Parallel Execution Strategy

### Phase 1: Setup (10 minutes per track = 10 minutes total)
**All 3 agents work simultaneously:**
- Agent 1 (Amelia): Creates `src/drive/drive-schemas.ts` and `drive-handler.ts`
- Agent 2 (Winston): Creates `src/forms/forms-schemas.ts` and `forms-handler.ts`
- Agent 3 (John): Creates `src/docs/docs-schemas.ts` and `docs-handler.ts`

**Coordination Point:** All agents must complete setup before proceeding to wiring.

### Phase 2: Wiring (5 minutes per track = 5 minutes total)
**Sequential (to avoid merge conflicts):**
1. Amelia wires `drive` tool into `index.ts`
2. Winston wires `forms` tool into `index.ts` (after Amelia)
3. John wires `docs` tool into `index.ts` (after Winston)

**Why Sequential:** Prevents conflicts in the same `ListToolsRequestSchema` handler.

### Phase 3: Testing (5 minutes per track = 5 minutes total)
**All 3 agents work simultaneously:**
- Agent 1: Tests all 7 Drive operations
- Agent 2: Tests all 4 Forms operations
- Agent 3: Tests all 5 Docs operations

### Phase 4: Cleanup (10 minutes per track = 10 minutes total)
**All 3 agents work simultaneously:**
- Agent 1: Removes old Drive tools from `index.ts`
- Agent 2: Removes old Forms tools from `index.ts`
- Agent 3: Removes old Docs tools from `index.ts`

**Coordination Point:** Final verification done by lead agent after all cleanup complete.

**Total Time:** 10 + 5 + 5 + 10 = **30 minutes** (with parallel execution)

---

## Technical Implementation Details

### Drive Operations Detail

**1. search**
```typescript
{
  operation: "search",
  query: "budget spreadsheet"
}
```

**2. enhancedSearch**
```typescript
{
  operation: "enhancedSearch",
  query: "project plan",
  filters: {
    mimeType: "application/vnd.google-apps.spreadsheet",
    modifiedAfter: "2025-01-01"
  }
}
```

**3. read**
```typescript
{
  operation: "read",
  fileId: "abc123"
}
```

**4. create**
```typescript
{
  operation: "create",
  name: "New Document",
  content: "Hello world",
  mimeType: "text/plain"
}
```

**5. update**
```typescript
{
  operation: "update",
  fileId: "abc123",
  content: "Updated content"
}
```

**6. createFolder**
```typescript
{
  operation: "createFolder",
  name: "Projects",
  parentId: "parent123"
}
```

**7. batch**
```typescript
{
  operation: "batch",
  operations: [
    { type: "create", name: "File1", content: "..." },
    { type: "update", fileId: "abc", content: "..." },
    { type: "delete", fileId: "xyz" }
  ]
}
```

### Forms Operations Detail

**1. create**
```typescript
{
  operation: "create",
  title: "Survey Form",
  description: "Please complete this survey"
}
```

**2. read**
```typescript
{
  operation: "read",
  formId: "form123"
}
```

**3. addQuestion**
```typescript
{
  operation: "addQuestion",
  formId: "form123",
  title: "What is your name?",
  type: "TEXT",
  required: true
}
```

**4. listResponses**
```typescript
{
  operation: "listResponses",
  formId: "form123"
}
```

### Docs Operations Detail

**1. create**
```typescript
{
  operation: "create",
  title: "New Document",
  content: "Initial content"
}
```

**2. insertText**
```typescript
{
  operation: "insertText",
  documentId: "doc123",
  text: "Hello world",
  index: 1
}
```

**3. replaceText**
```typescript
{
  operation: "replaceText",
  documentId: "doc123",
  searchText: "old",
  replaceText: "new",
  matchCase: false
}
```

**4. applyTextStyle**
```typescript
{
  operation: "applyTextStyle",
  documentId: "doc123",
  startIndex: 0,
  endIndex: 10,
  bold: true,
  fontSize: 14
}
```

**5. insertTable**
```typescript
{
  operation: "insertTable",
  documentId: "doc123",
  rows: 3,
  columns: 2,
  index: 1
}
```

---

## Code Reuse from Sheets Pattern

### Copy from Story 1 (Setup)
Each agent should use the Sheets pattern as template:
1. Copy `src/sheets/sheets-schemas.ts` → `src/{service}/{service}-schemas.ts`
2. Update operation names and parameters
3. Copy `src/sheets/sheets-handler.ts` → `src/{service}/{service}-handler.ts`
4. Update handler logic (copy from existing individual tool handlers)
5. Copy wiring pattern from `index.ts` (Sheets tool definition)

### Copy from Story 2 (Testing)
Each agent should use the Sheets testing approach:
1. MCP Inspector setup
2. Test each operation systematically
3. Verify response formats
4. Check error handling
5. Document results

### Copy from Story 3 (Cleanup)
Each agent should use the Sheets cleanup pattern:
1. Remove tool schemas from `ListToolsRequestSchema`
2. Remove case handlers from `CallToolRequestSchema`
3. Verify no dead code remains
4. Test consolidated tool after cleanup

---

## Dependencies

**Depends On:**
- story-001 (Pattern established)
- story-002 (Testing approach proven)
- story-003 (Cleanup process validated)
- story-004 (Documentation structure ready)

**Blocks:**
- Nothing (This is the final story in the epic)

---

## Definition of Done

- [ ] All 3 service consolidations complete (Drive, Forms, Docs)
- [ ] All 16 operations tested successfully (7 + 4 + 5)
- [ ] Old individual tools removed (16 individual tools → 3 consolidated)
- [ ] `tools/list` returns ~5 tools (down from 41+)
- [ ] TypeScript compilation successful
- [ ] No ESLint violations
- [ ] All agents report completion
- [ ] Lead developer verification complete
- [ ] Epic success criteria met:
  - ✅ Tool count reduced from 41+ to 5
  - ✅ All operations maintain functional compatibility
  - ✅ Follows HOW2MCP 2025 patterns
  - ✅ Centralized logger pattern used
  - ✅ Single ListTools handler implemented

---

## Team Coordination

### Pre-Kickoff Checklist
- [ ] All 3 agents available for parallel work
- [ ] Stories 1-4 completed and verified
- [ ] Git branch strategy agreed upon (feature branches or single branch)
- [ ] Communication channel established (Slack, Discord, etc.)
- [ ] Test spreadsheets/forms/docs prepared

### During Execution
- [ ] Agents report completion of each phase
- [ ] Lead developer monitors progress
- [ ] Merge conflicts resolved immediately
- [ ] Testing results shared in real-time

### Post-Execution
- [ ] All agents submit completion report
- [ ] Lead developer runs final verification
- [ ] Epic marked as complete
- [ ] Celebrate! 🎉 (41+ tools → 5 tools achieved)

---

## Risk Management

### Risk 1: Merge Conflicts in index.ts
**Mitigation:** Sequential wiring phase (Phase 2)

### Risk 2: Agent Unavailability
**Mitigation:** Each track is independent; can be completed sequentially if needed (60 min total instead of 30 min)

### Risk 3: Testing Failures
**Mitigation:** Each agent has Story 2 testing template to follow; failures caught early

### Risk 4: Timeline Overrun
**Mitigation:** Parallel execution saves 40 minutes; even sequential execution fits in 2-hour window

---

## Success Metrics

### Before Story 5
- Total tools: ~30 (after Sheets consolidation in Stories 1-3)
- Drive tools: 7 individual
- Forms tools: 4 individual
- Docs tools: 5 individual

### After Story 5
- Total tools: ~5-8
- Drive tools: 1 consolidated
- Forms tools: 1 consolidated
- Docs tools: 1 consolidated

**Total Reduction:** 88% (41+ → 5)

---

## Verification Commands

### Final Tool Count Check
```bash
# Build the project
npm run build

# Start server
node dist/index.js

# Use MCP Inspector to call tools/list
# Expected result: ~5 tools
# - sheets (12 operations)
# - drive (7 operations)
# - forms (4 operations)
# - docs (5 operations)
# - Plus any non-consolidated tools
```

### Smoke Test Each Service
```bash
# Test Drive: search operation
{ "name": "drive", "args": { "operation": "search", "query": "test" } }

# Test Forms: create operation
{ "name": "forms", "args": { "operation": "create", "title": "Test Form" } }

# Test Docs: create operation
{ "name": "docs", "args": { "operation": "create", "title": "Test Doc" } }

# All should return success responses
```

---

## Time Breakdown (Parallel Execution)

| Phase | Drive | Forms | Docs | Total (Parallel) |
|-------|-------|-------|------|------------------|
| Setup | 10 min | 10 min | 10 min | 10 min |
| Wiring | 2 min | 2 min | 1 min | 5 min (sequential) |
| Testing | 5 min | 5 min | 5 min | 5 min |
| Cleanup | 10 min | 10 min | 10 min | 10 min |
| **Total** | **27 min** | **27 min** | **26 min** | **30 min** |

---

## Time Breakdown (Sequential Execution - Fallback)

If parallel execution is not possible:

| Phase | Time |
|-------|------|
| Drive consolidation (complete) | 30 min |
| Forms consolidation (complete) | 25 min |
| Docs consolidation (complete) | 25 min |
| **Total** | **80 min** |

Still achievable within 2-hour window.

---

## Agent Assignments

**Lead Developer: Amelia**
- Coordinates all 3 tracks
- Handles Drive consolidation (Track 1)
- Performs final verification
- Reports epic completion

**Architect: Winston**
- Handles Forms consolidation (Track 2)
- Reviews schema implementations
- Validates architectural patterns

**Product Manager: John**
- Handles Docs consolidation (Track 3)
- Updates documentation as needed
- Validates user-facing API consistency

---

## Notes

- **Pattern Confidence**: Sheets consolidation in Stories 1-3 proves the pattern works
- **Code Reuse**: ~80% of code can be copied from Sheets implementation
- **Parallel Execution**: Key to meeting aggressive timeline
- **Final Mile**: This story completes the entire Epic vision
- **Celebration Worthy**: 88% tool reduction is a major architectural improvement

---

## Epic Completion Checklist

After Story 5 is complete, verify Epic success criteria:

- [ ] ✅ Tool count reduced from 41+ to 5 (88% reduction)
- [ ] ✅ LLM tool selection speed improved
- [ ] ✅ Aligned with HOW2MCP 2025 architecture patterns
- [ ] ✅ 100% functional compatibility maintained
- [ ] ✅ Repeatable pattern established
- [ ] ✅ Codebase complexity reduced (~2000+ lines removed)
- [ ] ✅ All 32 operations tested and working
- [ ] ✅ Documentation complete (Story 4)
- [ ] ✅ Version bumped to 2.0.0 (Story 4)
- [ ] ✅ Migration guide available (Story 4)

**Epic Status:** ✅ Ready to mark as COMPLETE

---

*Generated by: Amelia (Developer Lead), Winston (Architect), John (PM) & Bob (Scrum Master)*
*Date: 2025-10-11*
*Based on: Consolidation Guide Lines 1100-1105*
