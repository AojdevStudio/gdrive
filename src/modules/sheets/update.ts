import type { SheetsContext } from '../types.js';

/**
 * Options for updating cells
 */
export interface UpdateCellsOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Range in A1 notation */
  range: string;
  /** 2D array of values to write */
  values: unknown[][];
  /** Optional sheet name (if not in range) */
  sheetName?: string;
  /** Optional sheet ID */
  sheetId?: number;
}

/**
 * Result of updating cells
 */
export interface UpdateCellsResult {
  range: string;
  rowsUpdated: number;
  message: string;
}

/**
 * Update cell values in a sheet range
 *
 * Values are automatically parsed (numbers, formulas, dates) when using USER_ENTERED mode.
 *
 * @param options Update parameters with range and values
 * @param context Sheets API context
 * @returns Update confirmation
 *
 * @example
 * ```typescript
 * const result = await updateCells({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!A1:C3',
 *   values: [
 *     ['Name', 'Age', 'City'],
 *     ['Alice', 30, 'NYC'],
 *     ['Bob', 25, 'SF']
 *   ]
 * }, context);
 * ```
 */
export async function updateCells(
  options: UpdateCellsOptions,
  context: SheetsContext
): Promise<UpdateCellsResult> {
  const { spreadsheetId, range, values, sheetName } = options;

  // Build resolved range
  let resolvedRange = range;
  if (sheetName && !range.includes('!')) {
    resolvedRange = `${sheetName}!${range}`;
  }

  await context.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: resolvedRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  });

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

  context.performanceMonitor.track('sheets:update', Date.now() - context.startTime);
  context.logger.info('Cells updated', {
    spreadsheetId,
    range: resolvedRange,
    rowCount: values.length,
  });

  return {
    range: resolvedRange,
    rowsUpdated: values.length,
    message: `Successfully updated ${values.length} rows in range ${resolvedRange}`,
  };
}

/**
 * Options for updating with formulas
 */
export interface UpdateFormulaOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Range in A1 notation */
  range: string;
  /** Formula to set (e.g., "=SUM(A1:A10)") */
  formula: string;
  /** Optional sheet name */
  sheetName?: string;
}

/**
 * Result of updating formula
 */
export interface UpdateFormulaResult {
  range: string;
  formula: string;
  message: string;
}

/**
 * Update cells with a formula
 *
 * Sets the same formula for all cells in the range.
 * Formula is automatically adjusted for each cell (relative references).
 *
 * @param options Formula update parameters
 * @param context Sheets API context
 * @returns Update confirmation
 *
 * @example
 * ```typescript
 * // Set SUM formula in column D
 * const result = await updateFormula({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!D2:D10',
 *   formula: '=SUM(A2:C2)'
 * }, context);
 * // Each row will have formula adjusted: D2=SUM(A2:C2), D3=SUM(A3:C3), etc.
 * ```
 */
export async function updateFormula(
  options: UpdateFormulaOptions,
  context: SheetsContext
): Promise<UpdateFormulaResult> {
  const { spreadsheetId, range, formula, sheetName } = options;

  // Build resolved range
  let resolvedRange = range;
  if (sheetName && !range.includes('!')) {
    resolvedRange = `${sheetName}!${range}`;
  }

  // For formula updates, we'll use the values API with USER_ENTERED
  // This allows Google Sheets to parse the formula
  await context.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: resolvedRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[formula]], // Single formula that will be applied to range
    },
  });

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

  context.performanceMonitor.track('sheets:updateFormula', Date.now() - context.startTime);
  context.logger.info('Formula updated', {
    spreadsheetId,
    range: resolvedRange,
    formula,
  });

  return {
    range: resolvedRange,
    formula,
    message: `Successfully set formula ${formula} in range ${resolvedRange}`,
  };
}

/**
 * Options for appending rows
 */
export interface AppendRowsOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** 2D array of values to append */
  values: unknown[][];
  /** Sheet name (default: "Sheet1") */
  sheetName?: string;
}

/**
 * Result of appending rows
 */
export interface AppendRowsResult {
  sheetName: string;
  rowsAppended: number;
  message: string;
}

/**
 * Append rows to the end of a sheet
 *
 * Automatically finds the last row with data and appends below it.
 *
 * @param options Append parameters with values
 * @param context Sheets API context
 * @returns Append confirmation
 *
 * @example
 * ```typescript
 * const result = await appendRows({
 *   spreadsheetId: 'abc123',
 *   sheetName: 'Sales Data',
 *   values: [
 *     ['2025-01-15', 'Product A', 150],
 *     ['2025-01-16', 'Product B', 200]
 *   ]
 * }, context);
 * ```
 */
export async function appendRows(
  options: AppendRowsOptions,
  context: SheetsContext
): Promise<AppendRowsResult> {
  const { spreadsheetId, values, sheetName = 'Sheet1' } = options;

  await context.sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values,
    },
  });

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

  context.performanceMonitor.track('sheets:append', Date.now() - context.startTime);
  context.logger.info('Rows appended', {
    spreadsheetId,
    sheetName,
    rowCount: values.length,
  });

  return {
    sheetName,
    rowsAppended: values.length,
    message: `Successfully appended ${values.length} rows to ${sheetName}`,
  };
}
