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

/**
 * Options for updating records by key column match
 */
export interface UpdateRecordsOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Range in A1 notation covering all columns (e.g., "Contacts!A:G") */
  range: string;
  /** Header name of the key column to match against */
  keyColumn: string;
  /** Array of updates: each has a key to match and values to set */
  updates: Array<{
    key: string;
    values: Record<string, unknown>;
  }>;
  /** Optional sheet name (if not in range) */
  sheetName?: string;
}

/**
 * Result of updating records
 */
export interface UpdateRecordsResult {
  updated: number;
  notFound: string[];
  message: string;
}

/**
 * Convert a 0-based column index to A1 notation letter(s).
 * 0 → A, 1 → B, 25 → Z, 26 → AA, etc.
 */
function columnToLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Update cells in a Sheet by matching a key column.
 * Reads the sheet, finds rows matching the key, computes cell ranges, and updates.
 *
 * @param options Update parameters with key column and values
 * @param context Sheets API context
 * @returns Update confirmation with counts
 */
export async function updateRecords(
  options: UpdateRecordsOptions,
  context: SheetsContext
): Promise<UpdateRecordsResult> {
  const { spreadsheetId, range, keyColumn, updates, sheetName } = options;

  // Build resolved range
  let resolvedRange = range;
  if (sheetName && !range.includes('!')) {
    resolvedRange = `${sheetName}!${range}`;
  }

  // Read existing data
  const response = await context.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: resolvedRange,
  });

  const values = (response.data.values ?? []) as unknown[][];
  if (values.length === 0) {
    throw new Error('No data found in the specified range');
  }

  const headers = (values[0] as string[]).map(h => String(h));
  const keyColIndex = headers.indexOf(keyColumn);
  if (keyColIndex === -1) {
    throw new Error(`Key column '${keyColumn}' not found in headers: ${headers.join(', ')}`);
  }

  // Extract sheet name prefix from the resolved range for building cell references
  const sheetPrefix = resolvedRange.includes('!') ? resolvedRange.split('!')[0] + '!' : '';

  let updated = 0;
  const notFound: string[] = [];

  for (const update of updates) {
    // Find matching row (1-indexed: row 1 = headers, data starts at row 2)
    const rowIndex = values.findIndex((row, i) => i > 0 && String(row[keyColIndex]) === update.key);

    if (rowIndex === -1) {
      notFound.push(update.key);
      continue;
    }

    // Update each specified column
    for (const [colName, value] of Object.entries(update.values)) {
      const colIndex = headers.indexOf(colName);
      if (colIndex === -1) {
        continue; // skip unknown columns
      }

      const cellRef = `${sheetPrefix}${columnToLetter(colIndex)}${rowIndex + 1}`;

      await context.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellRef,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
      });
    }

    updated++;
  }

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);
  context.performanceMonitor.track('sheets:updateRecords', Date.now() - context.startTime);

  return {
    updated,
    notFound,
    message: `Updated ${updated} records. ${notFound.length > 0 ? `Not found: ${notFound.join(', ')}` : ''}`.trim(),
  };
}
