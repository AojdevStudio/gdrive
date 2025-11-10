/**
 * Google Docs operations module
 *
 * This module provides programmatic access to Google Docs operations
 * for use in code execution environments.
 *
 * @example
 * ```typescript
 * import { createDocument, insertText, applyTextStyle, insertTable } from './modules/docs';
 *
 * // Create a new document
 * const doc = await createDocument({
 *   title: 'Project Report',
 *   content: 'Executive Summary\n\n'
 * });
 *
 * // Add content
 * await insertText({
 *   documentId: doc.documentId,
 *   text: 'This report covers the Q1 findings...\n\n',
 *   index: 20
 * });
 *
 * // Format the title
 * await applyTextStyle({
 *   documentId: doc.documentId,
 *   startIndex: 1,
 *   endIndex: 18,
 *   bold: true,
 *   fontSize: 18
 * });
 *
 * // Add a data table
 * await insertTable({
 *   documentId: doc.documentId,
 *   rows: 4,
 *   columns: 3,
 *   index: 100
 * });
 * ```
 */

// Create operations
export {
  createDocument,
  type CreateDocumentOptions,
  type CreateDocumentResult,
} from './create.js';

// Text operations
export {
  insertText,
  replaceText,
  type InsertTextOptions,
  type InsertTextResult,
  type ReplaceTextOptions,
  type ReplaceTextResult,
} from './text.js';

// Style operations
export {
  applyTextStyle,
  type ApplyTextStyleOptions,
  type ApplyTextStyleResult,
  type TextStyleOptions,
  type RgbColor,
} from './style.js';

// Table operations
export {
  insertTable,
  type InsertTableOptions,
  type InsertTableResult,
} from './table.js';
