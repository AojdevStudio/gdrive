/**
 * Google Sheets operations module
 *
 * This module provides programmatic access to Google Sheets operations
 * for use in code execution environments.
 *
 * @example
 * ```typescript
 * import { readSheet, updateCells, formatCells } from './modules/sheets';
 *
 * // Read sheet data
 * const data = await readSheet({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!A1:D10'
 * });
 *
 * // Calculate sum
 * const total = data.values.slice(1).reduce((sum, row) => sum + Number(row[3] || 0), 0);
 *
 * // Update cell with result
 * await updateCells({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!E1',
 *   values: [[`Total: ${total}`]]
 * });
 * ```
 */

// List operations
export {
  listSheets,
  type ListSheetsOptions,
  type ListSheetsResult,
  type SheetInfo,
} from './list.js';

// Read operations
export {
  readSheet,
  type ReadSheetOptions,
  type ReadSheetResult,
} from './read.js';

// Sheet management (create, rename, delete)
export {
  createSheet,
  renameSheet,
  deleteSheet,
  type CreateSheetOptions,
  type CreateSheetResult,
  type RenameSheetOptions,
  type RenameSheetResult,
  type DeleteSheetOptions,
  type DeleteSheetResult,
  type TabColor,
} from './manage.js';

// Update operations
export {
  updateCells,
  updateFormula,
  appendRows,
  type UpdateCellsOptions,
  type UpdateCellsResult,
  type UpdateFormulaOptions,
  type UpdateFormulaResult,
  type AppendRowsOptions,
  type AppendRowsResult,
} from './update.js';

// Format operations
export {
  formatCells,
  addConditionalFormat,
  type FormatCellsOptions,
  type FormatCellsResult,
  type ConditionalFormatOptions,
  type ConditionalFormatResult,
  type CellFormatOptions,
  type Color,
  type NumberFormat,
  type ConditionalFormatRule,
  type ConditionalFormatRuleType,
} from './format.js';

// Advanced operations
export {
  freezeRowsColumns,
  setColumnWidth,
  type FreezeOptions,
  type FreezeResult,
  type SetColumnWidthOptions,
  type SetColumnWidthResult,
  type ColumnWidthConfig,
} from './advanced.js';
