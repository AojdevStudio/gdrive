/**
 * Google Workspace MCP Modules
 *
 * This is the main entry point for all Google Workspace operations
 * designed for code execution environments.
 *
 * All operations are organized by API:
 * - drive: File and folder operations
 * - sheets: Spreadsheet operations
 * - forms: Form creation and response handling
 * - docs: Document creation and editing
 *
 * @example
 * ```typescript
 * import { drive, sheets, forms, docs } from './modules';
 *
 * // Search Drive
 * const files = await drive.search({ query: 'reports', pageSize: 20 });
 *
 * // Read spreadsheet
 * const data = await sheets.readSheet({
 *   spreadsheetId: files.files[0].id,
 *   range: 'Sheet1!A1:D100'
 * });
 *
 * // Create form
 * const form = await forms.createForm({
 *   title: 'Feedback Survey'
 * });
 *
 * // Create document
 * const doc = await docs.createDocument({
 *   title: 'Report'
 * });
 * ```
 */

// Re-export all Drive operations
export * as drive from './drive/index.js';

// Re-export all Sheets operations
export * as sheets from './sheets/index.js';

// Re-export all Forms operations
export * as forms from './forms/index.js';

// Re-export all Docs operations
export * as docs from './docs/index.js';

// Re-export shared types
export type {
  CacheManagerLike,
  PerformanceMonitorLike,
  BaseContext,
  DriveContext,
  SheetsContext,
  FormsContext,
  DocsContext,
  OperationResult,
  toErrorMessage,
} from './types.js';
