import type { SheetsContext } from '../types.js';

/**
 * Options for freezing rows/columns
 */
export interface FreezeOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Number of rows to freeze (default: 0) */
  frozenRowCount?: number;
  /** Number of columns to freeze (default: 0) */
  frozenColumnCount?: number;
  /** Sheet name (optional) */
  sheetName?: string;
}

/**
 * Result of freezing rows/columns
 */
export interface FreezeResult {
  sheetName: string;
  frozenRowCount: number;
  frozenColumnCount: number;
  message: string;
}

/**
 * Freeze rows and/or columns in a sheet
 *
 * Frozen rows/columns remain visible when scrolling.
 * Commonly used to keep headers visible.
 *
 * @param options Freeze parameters
 * @param context Sheets API context
 * @returns Freeze confirmation
 *
 * @example
 * ```typescript
 * // Freeze first row (header)
 * const result = await freezeRowsColumns({
 *   spreadsheetId: 'abc123',
 *   frozenRowCount: 1,
 *   frozenColumnCount: 0
 * }, context);
 * ```
 */
export async function freezeRowsColumns(
  options: FreezeOptions,
  context: SheetsContext
): Promise<FreezeResult> {
  const {
    frozenRowCount = 0,
    frozenColumnCount = 0,
    sheetName,
  } = options;

  // Note: Full implementation requires layoutHelpers to resolve sheet details
  // This is a simplified version

  context.logger.warn('freezeRowsColumns: Simplified implementation');

  // Full implementation would:
  // 1. Resolve sheet ID from sheetName using resolveSheetDetails
  // 2. Create freeze request using createFreezeRequest
  // 3. Call sheets.spreadsheets.batchUpdate

  context.performanceMonitor.track('sheets:freeze', Date.now() - context.startTime);

  return {
    sheetName: sheetName || 'Sheet1',
    frozenRowCount,
    frozenColumnCount,
    message: `Would freeze ${frozenRowCount} row(s) and ${frozenColumnCount} column(s) (requires helpers)`,
  };
}

/**
 * Column width configuration
 */
export interface ColumnWidthConfig {
  /** Column index (0-based) */
  columnIndex: number;
  /** Width in pixels (optional for auto-resize) */
  width?: number;
}

/**
 * Options for setting column widths
 */
export interface SetColumnWidthOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Array of column width configurations */
  columns: ColumnWidthConfig[];
  /** Sheet name (optional) */
  sheetName?: string;
}

/**
 * Result of setting column widths
 */
export interface SetColumnWidthResult {
  sheetName: string;
  columnsUpdated: number;
  message: string;
}

/**
 * Set column widths for specific columns
 *
 * Allows precise control over column widths in pixels.
 * Omit width to auto-resize column to fit content.
 *
 * @param options Column width parameters
 * @param context Sheets API context
 * @returns Column width update confirmation
 *
 * @example
 * ```typescript
 * // Set specific column widths
 * const result = await setColumnWidth({
 *   spreadsheetId: 'abc123',
 *   sheetName: 'Data',
 *   columns: [
 *     { columnIndex: 0, width: 150 },  // Column A = 150px
 *     { columnIndex: 1, width: 200 },  // Column B = 200px
 *     { columnIndex: 2 }                // Column C = auto-resize
 *   ]
 * }, context);
 * ```
 */
export async function setColumnWidth(
  options: SetColumnWidthOptions,
  context: SheetsContext
): Promise<SetColumnWidthResult> {
  const { columns, sheetName } = options;

  // Validate column configurations
  for (const column of columns) {
    if (column.width !== undefined && (Number.isNaN(column.width) || column.width <= 0)) {
      throw new Error(`width must be a positive number for column ${column.columnIndex}`);
    }
  }

  // Note: Full implementation requires layoutHelpers
  context.logger.warn('setColumnWidth: Simplified implementation');

  // Full implementation would:
  // 1. Resolve sheet details
  // 2. Create column width requests using createColumnWidthRequests
  // 3. Call sheets.spreadsheets.batchUpdate

  context.performanceMonitor.track('sheets:setColumnWidth', Date.now() - context.startTime);

  return {
    sheetName: sheetName || 'Sheet1',
    columnsUpdated: columns.length,
    message: `Would update width for ${columns.length} column(s) (requires helpers)`,
  };
}
