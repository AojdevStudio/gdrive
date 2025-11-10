# Enhanced Google Docs Formatting Tools Implementation Plan

**Created**: October 14, 2025
**Status**: Planning
**Priority**: High
**Estimated Effort**: 4-5 weeks
**Target Users**: 10-20 concurrent users

---

## 📋 Problem Statement

The current Google Drive MCP server has limited Google Docs formatting capabilities, requiring significant manual post-processing for professional document creation. Key limitations include:

- **No batch operations** - Can't perform multiple formatting actions atomically
- **Limited text styling** - Can't combine bold, color, size, and font in one operation
- **No paragraph styling** - Can't apply heading styles, alignment, or spacing
- **Basic table support** - Can insert tables but not populate or style them
- **No table cell formatting** - Can't add background colors or borders to cells
- **Missing document introspection** - Can't read document structure to calculate indices

This prevents creating client-ready documents programmatically, requiring 15-25 minutes of manual formatting per document.

---

## 🎯 Objectives

1. **Enable atomic batch operations** via Google Docs `batchUpdate` API
2. **Support comprehensive text formatting** (bold, italic, size, font, colors)
3. **Add paragraph styling** (headings, alignment, spacing)
4. **Enable table cell formatting** (background colors, borders, padding)
5. **Provide document introspection** for index calculation
6. **Maintain backward compatibility** with existing tools
7. **Follow operation-based architecture** established in this MCP server

---

## 🏗️ Technical Approach

### Architecture Decision: Operation-Based Pattern

Following the existing MCP architecture, we'll **extend the `docs` tool** with new operations rather than creating separate tools:

```typescript
// Current operations
docs: ["create", "insertText", "replaceText", "applyTextStyle", "insertTable"]

// New operations to add
docs: [
  ...existing,
  "batchUpdate",           // Priority 1: Foundation
  "updateParagraphStyle",  // Priority 2: Document structure
  "updateTableCellStyle",  // Priority 3: Table formatting
  "getDocumentStructure",  // Priority 4: Introspection
  "insertImage"            // Priority 5: Visual elements
]
```

**Why this approach:**
- ✅ Consistent with existing architecture
- ✅ Single tool registration
- ✅ Type-safe operation routing
- ✅ Easier maintenance and testing

---

## 📐 Implementation Steps

### Phase 1: Foundation - Batch Update (Week 1-2)

#### 1.1 Update Docs Schema (`src/docs/docs-schemas.ts`)

Add new operation schemas:

```typescript
// Batch update request types
const BatchUpdateRequestSchema = z.object({
  insertText: z.object({
    location: z.object({ index: z.number() }),
    text: z.string(),
  }).optional(),

  updateTextStyle: z.object({
    range: z.object({
      startIndex: z.number(),
      endIndex: z.number(),
    }),
    textStyle: z.object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      underline: z.boolean().optional(),
      fontSize: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
      foregroundColor: z.object({
        color: z.object({
          rgbColor: z.object({
            red: z.number().min(0).max(1),
            green: z.number().min(0).max(1),
            blue: z.number().min(0).max(1),
          }),
        }),
      }).optional(),
      backgroundColor: z.object({
        color: z.object({
          rgbColor: z.object({
            red: z.number().min(0).max(1),
            green: z.number().min(0).max(1),
            blue: z.number().min(0).max(1),
          }),
        }),
      }).optional(),
      weightedFontFamily: z.object({
        fontFamily: z.string(),
      }).optional(),
    }),
    fields: z.string(), // Comma-separated field mask
  }).optional(),

  updateParagraphStyle: z.object({
    range: z.object({
      startIndex: z.number(),
      endIndex: z.number(),
    }),
    paragraphStyle: z.object({
      namedStyleType: z.enum([
        "NORMAL_TEXT",
        "TITLE",
        "SUBTITLE",
        "HEADING_1",
        "HEADING_2",
        "HEADING_3",
        "HEADING_4",
        "HEADING_5",
        "HEADING_6",
      ]).optional(),
      alignment: z.enum(["START", "CENTER", "END", "JUSTIFIED"]).optional(),
      spaceAbove: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
      spaceBelow: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
      lineSpacing: z.number().optional(),
    }),
    fields: z.string(),
  }).optional(),

  insertTable: z.object({
    rows: z.number().min(1),
    columns: z.number().min(1),
    location: z.object({ index: z.number() }),
  }).optional(),

  updateTableCellStyle: z.object({
    tableRange: z.object({
      tableCellLocation: z.object({
        tableStartLocation: z.object({ index: z.number() }),
        rowIndex: z.number(),
        columnIndex: z.number(),
      }),
    }),
    tableCellStyle: z.object({
      backgroundColor: z.object({
        color: z.object({
          rgbColor: z.object({
            red: z.number().min(0).max(1),
            green: z.number().min(0).max(1),
            blue: z.number().min(0).max(1),
          }),
        }),
      }).optional(),
      paddingTop: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
      paddingBottom: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
      paddingLeft: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
      paddingRight: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
    }),
    fields: z.string(),
  }).optional(),

  insertInlineImage: z.object({
    location: z.object({ index: z.number() }),
    uri: z.string(),
    objectSize: z.object({
      height: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
      width: z.object({
        magnitude: z.number(),
        unit: z.literal("PT"),
      }).optional(),
    }).optional(),
  }).optional(),
}).strict();

export const DocsBatchUpdateSchema = DocsBaseSchema.extend({
  operation: z.literal('batchUpdate'),
  requests: z.array(BatchUpdateRequestSchema).min(1),
  writeControl: z.object({
    requiredRevisionId: z.string().optional(),
  }).optional(),
});
```

#### 1.2 Implement Handler (`src/docs/docs-handler.ts`)

```typescript
async function handleBatchUpdate(
  args: Extract<DocsToolInput, { operation: 'batchUpdate' }>,
  context: DocsHandlerContext
) {
  const { documentId, requests, writeControl } = args;

  try {
    const response = await context.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests,
        writeControl,
      },
    });

    // Invalidate cache after document modification
    await context.cacheManager.invalidate(`docs:${documentId}:*`);

    context.performanceMonitor.track('docs:batchUpdate', Date.now() - context.startTime);
    context.logger.info('Batch update completed', {
      documentId,
      requestCount: requests.length,
      replies: response.data.replies?.length ?? 0,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          documentId,
          writeControl: response.data.writeControl,
          replies: response.data.replies,
        }, null, 2),
      }],
    };
  } catch (error) {
    context.performanceMonitor.track('docs:batchUpdate', Date.now() - context.startTime, true);
    context.logger.error('Batch update failed', {
      documentId,
      requestCount: requests.length,
      error,
    });
    throw error;
  }
}
```

#### 1.3 Update Tool Registration (`index.ts`)

Add to the `docs` tool inputSchema:

```typescript
{
  name: "docs",
  description: "Consolidated Google Docs tool supporting operations for create, insertText, replaceText, applyTextStyle, insertTable, batchUpdate, updateParagraphStyle, updateTableCellStyle, getDocumentStructure, insertImage",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: [
          "create",
          "insertText",
          "replaceText",
          "applyTextStyle",
          "insertTable",
          "batchUpdate",           // NEW
          "updateParagraphStyle",  // NEW
          "updateTableCellStyle",  // NEW
          "getDocumentStructure",  // NEW
          "insertImage"            // NEW
        ],
        description: "The docs operation to execute",
      },
      // ... existing properties

      // NEW: Batch update properties
      requests: {
        type: "array",
        description: "Array of batch update requests for batchUpdate operation",
        items: {
          type: "object",
          properties: {
            insertText: { type: "object" },
            updateTextStyle: { type: "object" },
            updateParagraphStyle: { type: "object" },
            insertTable: { type: "object" },
            updateTableCellStyle: { type: "object" },
            insertInlineImage: { type: "object" },
          },
        },
      },
      writeControl: {
        type: "object",
        description: "Optional write control for batchUpdate",
        properties: {
          requiredRevisionId: { type: "string" },
        },
      },
    },
    required: ["operation", "documentId"],
  },
}
```

---

### Phase 2: Document Structure & Paragraph Styling (Week 2-3)

#### 2.1 Get Document Structure Operation

```typescript
export const DocsGetStructureSchema = DocsBaseSchema.extend({
  operation: z.literal('getDocumentStructure'),
  // documentId is already in base schema
});

async function handleGetDocumentStructure(
  args: Extract<DocsToolInput, { operation: 'getDocumentStructure' }>,
  context: DocsHandlerContext
) {
  const { documentId } = args;

  // Check cache
  const cacheKey = `docs:structure:${documentId}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('docs:getStructure', Date.now() - context.startTime);
    return cached;
  }

  const response = await context.docs.documents.get({
    documentId,
  });

  // Extract useful structure information
  const structure = {
    documentId: response.data.documentId,
    title: response.data.title,
    body: {
      content: response.data.body?.content?.map(element => ({
        startIndex: element.startIndex,
        endIndex: element.endIndex,
        paragraph: element.paragraph ? {
          elements: element.paragraph.elements?.map(el => ({
            startIndex: el.startIndex,
            endIndex: el.endIndex,
            textRun: el.textRun ? {
              content: el.textRun.content,
              textStyle: el.textRun.textStyle,
            } : undefined,
          })),
          paragraphStyle: element.paragraph.paragraphStyle,
        } : undefined,
        table: element.table ? {
          rows: element.table.rows,
          columns: element.table.columns,
          tableRows: element.table.tableRows?.map(row => ({
            startIndex: row.startIndex,
            endIndex: row.endIndex,
            tableCells: row.tableCells?.map(cell => ({
              startIndex: cell.startIndex,
              endIndex: cell.endIndex,
            })),
          })),
        } : undefined,
        sectionBreak: element.sectionBreak,
      })),
    },
  };

  const result = {
    content: [{
      type: "text" as const,
      text: JSON.stringify(structure, null, 2),
    }],
  };

  // Cache for 60 seconds (document structure changes less frequently)
  await context.cacheManager.set(cacheKey, result);

  context.performanceMonitor.track('docs:getStructure', Date.now() - context.startTime);

  return result;
}
```

#### 2.2 Update Paragraph Style Operation

```typescript
export const DocsUpdateParagraphStyleSchema = DocsBaseSchema.extend({
  operation: z.literal('updateParagraphStyle'),
  startIndex: z.number(),
  endIndex: z.number(),
  namedStyleType: z.enum([
    "NORMAL_TEXT",
    "TITLE",
    "SUBTITLE",
    "HEADING_1",
    "HEADING_2",
    "HEADING_3",
    "HEADING_4",
    "HEADING_5",
    "HEADING_6",
  ]).optional(),
  alignment: z.enum(["START", "CENTER", "END", "JUSTIFIED"]).optional(),
  spaceAbove: z.number().optional(),
  spaceBelow: z.number().optional(),
  lineSpacing: z.number().optional(),
  indentStart: z.number().optional(),
  indentEnd: z.number().optional(),
  indentFirstLine: z.number().optional(),
});

async function handleUpdateParagraphStyle(
  args: Extract<DocsToolInput, { operation: 'updateParagraphStyle' }>,
  context: DocsHandlerContext
) {
  const { documentId, startIndex, endIndex, ...styleProps } = args;

  // Build paragraph style object
  const paragraphStyle: any = {};
  const fields: string[] = [];

  if (styleProps.namedStyleType) {
    paragraphStyle.namedStyleType = styleProps.namedStyleType;
    fields.push('namedStyleType');
  }

  if (styleProps.alignment) {
    paragraphStyle.alignment = styleProps.alignment;
    fields.push('alignment');
  }

  if (styleProps.spaceAbove !== undefined) {
    paragraphStyle.spaceAbove = { magnitude: styleProps.spaceAbove, unit: 'PT' };
    fields.push('spaceAbove');
  }

  if (styleProps.spaceBelow !== undefined) {
    paragraphStyle.spaceBelow = { magnitude: styleProps.spaceBelow, unit: 'PT' };
    fields.push('spaceBelow');
  }

  if (styleProps.lineSpacing !== undefined) {
    paragraphStyle.lineSpacing = styleProps.lineSpacing;
    fields.push('lineSpacing');
  }

  if (styleProps.indentStart !== undefined) {
    paragraphStyle.indentStart = { magnitude: styleProps.indentStart, unit: 'PT' };
    fields.push('indentStart');
  }

  if (styleProps.indentEnd !== undefined) {
    paragraphStyle.indentEnd = { magnitude: styleProps.indentEnd, unit: 'PT' };
    fields.push('indentEnd');
  }

  if (styleProps.indentFirstLine !== undefined) {
    paragraphStyle.indentFirstLine = { magnitude: styleProps.indentFirstLine, unit: 'PT' };
    fields.push('indentFirstLine');
  }

  if (fields.length === 0) {
    throw new Error('At least one paragraph style property must be provided');
  }

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle,
          fields: fields.join(','),
        },
      }],
    },
  });

  await context.cacheManager.invalidate(`docs:${documentId}:*`);

  context.performanceMonitor.track('docs:updateParagraphStyle', Date.now() - context.startTime);
  context.logger.info('Paragraph style updated', {
    documentId,
    startIndex,
    endIndex,
    fields: fields.join(','),
  });

  return {
    content: [{
      type: "text" as const,
      text: `Paragraph style applied from index ${startIndex} to ${endIndex}`,
    }],
  };
}
```

---

### Phase 3: Table Cell Formatting (Week 3)

#### 3.1 Update Table Cell Style Operation

```typescript
export const DocsUpdateTableCellStyleSchema = DocsBaseSchema.extend({
  operation: z.literal('updateTableCellStyle'),
  tableStartLocation: z.number(),
  rowIndex: z.number(),
  columnIndex: z.number(),
  backgroundColor: z.object({
    red: z.number().min(0).max(1),
    green: z.number().min(0).max(1),
    blue: z.number().min(0).max(1),
  }).optional(),
  paddingTop: z.number().optional(),
  paddingBottom: z.number().optional(),
  paddingLeft: z.number().optional(),
  paddingRight: z.number().optional(),
});

async function handleUpdateTableCellStyle(
  args: Extract<DocsToolInput, { operation: 'updateTableCellStyle' }>,
  context: DocsHandlerContext
) {
  const {
    documentId,
    tableStartLocation,
    rowIndex,
    columnIndex,
    backgroundColor,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
  } = args;

  const tableCellStyle: any = {};
  const fields: string[] = [];

  if (backgroundColor) {
    tableCellStyle.backgroundColor = {
      color: {
        rgbColor: backgroundColor,
      },
    };
    fields.push('backgroundColor');
  }

  if (paddingTop !== undefined) {
    tableCellStyle.paddingTop = { magnitude: paddingTop, unit: 'PT' };
    fields.push('paddingTop');
  }

  if (paddingBottom !== undefined) {
    tableCellStyle.paddingBottom = { magnitude: paddingBottom, unit: 'PT' };
    fields.push('paddingBottom');
  }

  if (paddingLeft !== undefined) {
    tableCellStyle.paddingLeft = { magnitude: paddingLeft, unit: 'PT' };
    fields.push('paddingLeft');
  }

  if (paddingRight !== undefined) {
    tableCellStyle.paddingRight = { magnitude: paddingRight, unit: 'PT' };
    fields.push('paddingRight');
  }

  if (fields.length === 0) {
    throw new Error('At least one table cell style property must be provided');
  }

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        updateTableCellStyle: {
          tableRange: {
            tableCellLocation: {
              tableStartLocation: { index: tableStartLocation },
              rowIndex,
              columnIndex,
            },
          },
          tableCellStyle,
          fields: fields.join(','),
        },
      }],
    },
  });

  await context.cacheManager.invalidate(`docs:${documentId}:*`);

  context.performanceMonitor.track('docs:updateTableCellStyle', Date.now() - context.startTime);
  context.logger.info('Table cell style updated', {
    documentId,
    tableStartLocation,
    rowIndex,
    columnIndex,
    fields: fields.join(','),
  });

  return {
    content: [{
      type: "text" as const,
      text: `Table cell style applied at table index ${tableStartLocation}, row ${rowIndex}, column ${columnIndex}`,
    }],
  };
}
```

---

### Phase 4: Image Support (Week 4)

#### 4.1 Insert Image Operation

```typescript
export const DocsInsertImageSchema = DocsBaseSchema.extend({
  operation: z.literal('insertImage'),
  index: z.number(),
  uri: z.string().url(),
  width: z.number().optional(),
  height: z.number().optional(),
});

async function handleInsertImage(
  args: Extract<DocsToolInput, { operation: 'insertImage' }>,
  context: DocsHandlerContext
) {
  const { documentId, index, uri, width, height } = args;

  const objectSize: any = {};
  if (width !== undefined) {
    objectSize.width = { magnitude: width, unit: 'PT' };
  }
  if (height !== undefined) {
    objectSize.height = { magnitude: height, unit: 'PT' };
  }

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        insertInlineImage: {
          location: { index },
          uri,
          objectSize: Object.keys(objectSize).length > 0 ? objectSize : undefined,
        },
      }],
    },
  });

  await context.cacheManager.invalidate(`docs:${documentId}:*`);

  context.performanceMonitor.track('docs:insertImage', Date.now() - context.startTime);
  context.logger.info('Image inserted', {
    documentId,
    index,
    uri,
    width,
    height,
  });

  return {
    content: [{
      type: "text" as const,
      text: `Image inserted at index ${index}`,
    }],
  };
}
```

---

### Phase 5: Helper Utilities (Week 4)

#### 5.1 Index Calculation Helper

```typescript
// src/docs/docs-helpers.ts

/**
 * Calculates the index for inserting content after a paragraph
 */
export function getIndexAfterParagraph(
  paragraphElement: any
): number {
  return paragraphElement.endIndex ?? 0;
}

/**
 * Calculates the index for a specific table cell
 */
export function getTableCellIndex(
  tableElement: any,
  rowIndex: number,
  columnIndex: number
): number {
  const row = tableElement.tableRows?.[rowIndex];
  if (!row) {
    throw new Error(`Row ${rowIndex} not found in table`);
  }

  const cell = row.tableCells?.[columnIndex];
  if (!cell) {
    throw new Error(`Column ${columnIndex} not found in row ${rowIndex}`);
  }

  // Return the start index of the cell + 2 (for cell structure)
  return (cell.startIndex ?? 0) + 2;
}

/**
 * Converts RGB 0-255 to 0-1 range for Google Docs API
 */
export function normalizeRgb(rgb: { red: number; green: number; blue: number }) {
  return {
    red: rgb.red / 255,
    green: rgb.green / 255,
    blue: rgb.blue / 255,
  };
}

/**
 * Converts hex color to RGB 0-1 range
 */
export function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return {
    red: parseInt(result[1], 16) / 255,
    green: parseInt(result[2], 16) / 255,
    blue: parseInt(result[3], 16) / 255,
  };
}
```

---

## 🧪 Testing Strategy

### Unit Tests

Create tests for each operation handler:

```typescript
// src/__tests__/docs/batchUpdate.test.ts
describe('handleBatchUpdate', () => {
  it('should execute multiple requests in one batch', async () => {
    const mockDocs = createMockDocsClient();
    const context = createTestContext({ docs: mockDocs });

    const args = {
      operation: 'batchUpdate' as const,
      documentId: 'test-doc-123',
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: 'Hello World',
          },
        },
        {
          updateTextStyle: {
            range: { startIndex: 1, endIndex: 6 },
            textStyle: {
              bold: true,
              fontSize: { magnitude: 24, unit: 'PT' },
            },
            fields: 'bold,fontSize',
          },
        },
      ],
    };

    await handleBatchUpdate(args, context);

    expect(mockDocs.documents.batchUpdate).toHaveBeenCalledWith({
      documentId: 'test-doc-123',
      requestBody: {
        requests: args.requests,
      },
    });
  });

  it('should invalidate cache after batch update', async () => {
    const context = createTestContext();

    await handleBatchUpdate(validArgs, context);

    expect(context.cacheManager.invalidate).toHaveBeenCalledWith('docs:test-doc-123:*');
  });

  it('should track performance metrics', async () => {
    const context = createTestContext();

    await handleBatchUpdate(validArgs, context);

    expect(context.performanceMonitor.track).toHaveBeenCalledWith(
      'docs:batchUpdate',
      expect.any(Number)
    );
  });
});
```

### Integration Tests

Test real API calls against a test document:

```typescript
// src/__tests__/integration/docs-formatting.test.ts
describe('Docs Formatting Integration', () => {
  let testDocumentId: string;

  beforeEach(async () => {
    // Create a test document
    const result = await handleCreate({
      operation: 'create',
      title: 'Test Document for Formatting',
    }, context);

    testDocumentId = extractDocumentId(result);
  });

  afterEach(async () => {
    // Clean up test document
    await deleteDocument(testDocumentId);
  });

  it('should create a formatted document with batch update', async () => {
    await handleBatchUpdate({
      operation: 'batchUpdate',
      documentId: testDocumentId,
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: 'Test Header\n\nBody text here.',
          },
        },
        {
          updateTextStyle: {
            range: { startIndex: 1, endIndex: 12 },
            textStyle: {
              bold: true,
              fontSize: { magnitude: 24, unit: 'PT' },
              foregroundColor: {
                color: {
                  rgbColor: { red: 0.3, green: 0.72, blue: 0.67 },
                },
              },
            },
            fields: 'bold,fontSize,foregroundColor',
          },
        },
        {
          updateParagraphStyle: {
            range: { startIndex: 1, endIndex: 12 },
            paragraphStyle: {
              namedStyleType: 'HEADING_1',
              alignment: 'CENTER',
            },
            fields: 'namedStyleType,alignment',
          },
        },
      ],
    }, context);

    // Verify the document was formatted correctly
    const structure = await handleGetDocumentStructure({
      operation: 'getDocumentStructure',
      documentId: testDocumentId,
    }, context);

    expect(structure).toMatchSnapshot();
  });
});
```

### End-to-End Test: Staff Referral Document

```typescript
// tests/e2e/staff-referral-document.test.ts
describe('Staff Referral Document E2E', () => {
  it('should create a complete professional document', async () => {
    const TEAL_COLOR = { red: 0.3, green: 0.72, blue: 0.67 };

    // Step 1: Create document
    const createResult = await handleCreate({
      operation: 'create',
      title: 'Staff Referral Incentive Program',
    }, context);

    const documentId = extractDocumentId(createResult);

    // Step 2: Build complete document with batch update
    await handleBatchUpdate({
      operation: 'batchUpdate',
      documentId,
      requests: [
        // Title
        {
          insertText: {
            location: { index: 1 },
            text: 'STAFF REFERRAL INCENTIVE PROGRAM\n\n',
          },
        },
        {
          updateTextStyle: {
            range: { startIndex: 1, endIndex: 35 },
            textStyle: {
              bold: true,
              fontSize: { magnitude: 24, unit: 'PT' },
              foregroundColor: { color: { rgbColor: TEAL_COLOR } },
            },
            fields: 'bold,fontSize,foregroundColor',
          },
        },
        {
          updateParagraphStyle: {
            range: { startIndex: 1, endIndex: 35 },
            paragraphStyle: {
              namedStyleType: 'HEADING_1',
              alignment: 'CENTER',
            },
            fields: 'namedStyleType,alignment',
          },
        },

        // Body text
        {
          insertText: {
            location: { index: 37 },
            text: 'Help Us Build Our Amazing Team!\n\n',
          },
        },

        // Table
        {
          insertTable: {
            rows: 4,
            columns: 4,
            location: { index: 70 },
          },
        },

        // Table headers (indices calculated based on table structure)
        { insertText: { location: { index: 73 }, text: 'Position' } },
        { insertText: { location: { index: 83 }, text: 'Total Bonus' } },
        { insertText: { location: { index: 97 }, text: 'At Hire (30%)' } },
        { insertText: { location: { index: 113 }, text: 'After 90 Days (70%)' } },

        // Style header cells
        {
          updateTableCellStyle: {
            tableRange: {
              tableCellLocation: {
                tableStartLocation: { index: 70 },
                rowIndex: 0,
                columnIndex: 0,
              },
            },
            tableCellStyle: {
              backgroundColor: { color: { rgbColor: TEAL_COLOR } },
            },
            fields: 'backgroundColor',
          },
        },
        // ... repeat for other header cells
      ],
    }, context);

    // Verify document was created successfully
    const structure = await handleGetDocumentStructure({
      operation: 'getDocumentStructure',
      documentId,
    }, context);

    expect(structure.content[0].text).toContain('STAFF REFERRAL INCENTIVE PROGRAM');
    expect(structure.content[0].text).toContain('Position');
    expect(structure.content[0].text).toContain('Total Bonus');
  });
});
```

---

## 🚧 Potential Challenges & Solutions

### Challenge 1: Index Calculation Complexity

**Problem**: Calculating correct indices after each insertion is error-prone.

**Solutions**:
1. **Provide `getDocumentStructure` tool** to inspect current document state
2. **Document index calculation rules** in helper functions
3. **Create batch update examples** showing proper index calculation
4. **Add validation** to catch common index errors before API calls

### Challenge 2: RGB Color Format Confusion

**Problem**: Users might provide RGB in 0-255 range instead of 0-1.

**Solutions**:
1. **Add helper functions** (`normalizeRgb`, `hexToRgb`)
2. **Clear documentation** specifying 0-1 range
3. **Consider auto-detection** - if value > 1, automatically normalize
4. **Validation in schemas** with helpful error messages

### Challenge 3: Backward Compatibility

**Problem**: Existing `applyTextStyle` tool should continue working.

**Solutions**:
1. **Keep existing operations** - don't remove or break them
2. **Mark as deprecated** in documentation
3. **Suggest migration path** in console warnings
4. **Add tests** to ensure old operations still work

### Challenge 4: API Rate Limits

**Problem**: Google Docs API has 300 requests/minute limit.

**Solutions**:
1. **Use batch operations** - counts as 1 request
2. **Implement rate limiting** in the handler
3. **Add retry logic** with exponential backoff
4. **Log warnings** when approaching rate limits

```typescript
// src/docs/rate-limiter.ts
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 300;
  private readonly windowMs = 60000; // 1 minute

  async checkAndWait(): Promise<void> {
    const now = Date.now();

    // Remove requests outside the current window
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);

      logger.warn('Rate limit approaching, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requests.push(now);
  }
}
```

### Challenge 5: Field Mask Generation

**Problem**: Google Docs API requires explicit field masks for updates.

**Solutions**:
1. **Auto-generate field masks** from provided properties
2. **Validate field names** against API schema
3. **Provide examples** in documentation
4. **Helper functions** to build field masks

```typescript
function buildFieldMask(obj: any, prefix = ''): string {
  const fields: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && !Array.isArray(value)) {
        fields.push(...buildFieldMask(value, fieldPath).split(','));
      } else {
        fields.push(fieldPath);
      }
    }
  }

  return fields.join(',');
}
```

---

## ✅ Success Criteria

### Functional Requirements

- ✅ Can execute batch updates with multiple operations
- ✅ Can apply text formatting (bold, italic, size, font, color)
- ✅ Can apply paragraph styles (headings, alignment, spacing)
- ✅ Can format table cells (background color, padding)
- ✅ Can insert images with sizing
- ✅ Can introspect document structure
- ✅ All existing operations remain functional

### Performance Requirements

- ✅ Batch operations complete in < 3 seconds for 50 requests
- ✅ Cache hit rate > 80% for read operations
- ✅ Stay within Google API rate limits (300 req/min)

### Quality Requirements

- ✅ Unit test coverage > 90%
- ✅ Integration tests for all new operations
- ✅ E2E test for complete document creation
- ✅ No TypeScript errors or warnings
- ✅ All ESLint rules passing

### User Experience Requirements

- ✅ Can create professional documents without manual formatting
- ✅ Time savings: 15-25 minutes per document
- ✅ Clear error messages for common mistakes
- ✅ Comprehensive documentation with examples

---

## 📚 Documentation Plan

### 1. API Reference Documentation

Create comprehensive docs for each new operation:

```markdown
# Docs Tool: batchUpdate Operation

## Description
Execute multiple document operations in a single atomic transaction.

## Parameters
- `documentId` (string, required) - The ID of the document
- `requests` (array, required) - Array of request objects
- `writeControl` (object, optional) - Revision control

## Request Types
- `insertText` - Insert text at a location
- `updateTextStyle` - Apply text formatting
- `updateParagraphStyle` - Apply paragraph formatting
- `insertTable` - Insert a table
- `updateTableCellStyle` - Format table cells
- `insertInlineImage` - Insert an image

## Example: Create Formatted Document

```typescript
await mcp__gdrive__docs({
  operation: "batchUpdate",
  documentId: "abc123",
  requests: [
    {
      insertText: {
        location: { index: 1 },
        text: "Hello World\n"
      }
    },
    {
      updateTextStyle: {
        range: { startIndex: 1, endIndex: 6 },
        textStyle: {
          bold: true,
          fontSize: { magnitude: 24, unit: "PT" }
        },
        fields: "bold,fontSize"
      }
    }
  ]
});
```

## Common Patterns

### Creating a Heading
### Formatting a Table
### Inserting an Image
```

### 2. Migration Guide

```markdown
# Migration Guide: Legacy to New Docs Operations

## Old vs New

### Text Styling

**Before:**
```typescript
await mcp__gdrive__applyTextStyle({
  documentId: "abc123",
  startIndex: 1,
  endIndex: 10,
  bold: true
});
```

**After (Recommended):**
```typescript
await mcp__gdrive__docs({
  operation: "batchUpdate",
  documentId: "abc123",
  requests: [{
    updateTextStyle: {
      range: { startIndex: 1, endIndex: 10 },
      textStyle: { bold: true },
      fields: "bold"
    }
  }]
});
```

### Benefits
- Combine multiple operations
- Atomic transactions
- Better performance
```

### 3. Recipe Book

```markdown
# Google Docs Recipes

## Professional Header

Create a centered, colored, bold header:

```typescript
await mcp__gdrive__docs({
  operation: "batchUpdate",
  documentId: docId,
  requests: [
    {
      insertText: {
        location: { index: 1 },
        text: "My Professional Header\n\n"
      }
    },
    {
      updateTextStyle: {
        range: { startIndex: 1, endIndex: 24 },
        textStyle: {
          bold: true,
          fontSize: { magnitude: 24, unit: "PT" },
          foregroundColor: {
            color: {
              rgbColor: { red: 0.2, green: 0.4, blue: 0.8 }
            }
          }
        },
        fields: "bold,fontSize,foregroundColor"
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: 24 },
        paragraphStyle: {
          namedStyleType: "HEADING_1",
          alignment: "CENTER"
        },
        fields: "namedStyleType,alignment"
      }
    }
  ]
});
```

## Styled Table

Create a table with colored headers:

[More recipes...]
```

---

## 🔄 Rollout Plan

### Week 1-2: Development & Testing
1. Implement `batchUpdate` operation
2. Add schema validation
3. Write unit tests
4. Create integration tests

### Week 3: Feature Expansion
1. Implement `updateParagraphStyle`
2. Implement `updateTableCellStyle`
3. Implement `getDocumentStructure`
4. Add helper utilities

### Week 4: Polish & Documentation
1. Implement `insertImage`
2. Write comprehensive documentation
3. Create example recipes
4. E2E testing

### Week 5: Deploy & Monitor
1. Deploy to production
2. Monitor performance metrics
3. Gather user feedback
4. Fix bugs and iterate

---

## 📊 Metrics to Track

### Usage Metrics
- Number of `batchUpdate` calls per day
- Average requests per batch
- Operation type distribution

### Performance Metrics
- Average batch update duration
- Cache hit rate for `getDocumentStructure`
- API error rate
- Rate limit violations

### Business Metrics
- Documents created per week
- Time saved vs manual formatting
- User satisfaction scores

---

## 🎯 Future Enhancements

### Phase 6 (Post-Launch)
1. **Template system** - Pre-built document templates
2. **Diff operations** - Compare document versions
3. **Collaborative editing** - Multi-user support
4. **Export formats** - PDF, DOCX, etc.
5. **Advanced tables** - Merged cells, nested tables
6. **Footnotes and headers** - Document sections
7. **Comments and suggestions** - Review workflow

---

## 📖 References

- [Google Docs API Reference](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents)
- [Batch Update Guide](https://developers.google.com/workspace/docs/api/how-tos/batch)
- [Format Text Tutorial](https://developers.google.com/workspace/docs/api/how-tos/format-text)
- [Working with Tables](https://developers.google.com/workspace/docs/api/how-tos/tables)
- [MCP SDK Documentation](https://modelcontextprotocol.io)
- [how2mcp Repository](file:///Users/ossieirondi/projects/scratch/how2mcp/)

---

## ✨ Summary

This implementation plan provides a comprehensive roadmap for enhancing the Google Drive MCP server's document formatting capabilities. By following the operation-based architecture pattern and implementing these features in phases, we'll enable professional document creation that saves 15-25 minutes per document while maintaining code quality and backward compatibility.

**Key Deliverables:**
1. ✅ Batch update operation for atomic multi-operation requests
2. ✅ Paragraph styling for document structure
3. ✅ Table cell formatting for professional tables
4. ✅ Document introspection for index calculation
5. ✅ Image insertion for visual elements
6. ✅ Comprehensive testing suite
7. ✅ Detailed documentation and examples

**Expected Outcome:** Create client-ready documents programmatically without manual formatting, saving 2.5-8 hours per month.
