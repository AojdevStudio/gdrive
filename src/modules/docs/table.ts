import type { DocsContext } from '../types.js';

/**
 * Options for inserting a table
 */
export interface InsertTableOptions {
  /** Document ID */
  documentId: string;
  /** Number of rows */
  rows: number;
  /** Number of columns */
  columns: number;
  /** Position index to insert table (default: 1) */
  index?: number;
}

/**
 * Result of inserting a table
 */
export interface InsertTableResult {
  documentId: string;
  rows: number;
  columns: number;
  index: number;
  message: string;
}

/**
 * Insert a table into a document
 *
 * Creates an empty table with the specified dimensions.
 * Table cells can be populated by inserting text at specific indices after creation.
 *
 * @param options Table insertion parameters
 * @param context Docs API context
 * @returns Table insertion confirmation
 *
 * @example
 * ```typescript
 * // Insert 3x4 table at beginning
 * await insertTable({
 *   documentId: 'abc123',
 *   rows: 3,
 *   columns: 4,
 *   index: 1
 * }, context);
 *
 * // Insert table after some content
 * await insertTable({
 *   documentId: 'abc123',
 *   rows: 5,
 *   columns: 3,
 *   index: 200
 * }, context);
 * ```
 */
export async function insertTable(
  options: InsertTableOptions,
  context: DocsContext
): Promise<InsertTableResult> {
  const { documentId, rows, columns, index = 1 } = options;

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        insertTable: {
          location: { index },
          rows,
          columns,
        },
      }],
    },
  });

  context.performanceMonitor.track('docs:insertTable', Date.now() - context.startTime);
  context.logger.info('Table inserted', { documentId, rows, columns, index });

  return {
    documentId,
    rows,
    columns,
    index,
    message: `Table with ${rows} rows and ${columns} columns inserted at index ${index}`,
  };
}
