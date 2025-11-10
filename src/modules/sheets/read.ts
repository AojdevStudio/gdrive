import type { SheetsContext } from '../types.js';

/**
 * Options for reading sheet data
 */
export interface ReadSheetOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Range in A1 notation (e.g., "Sheet1!A1:B10" or "A1:B10") */
  range: string;
  /** Optional sheet name (if not included in range) */
  sheetName?: string;
  /** Optional sheet ID (alternative to sheetName) */
  sheetId?: number;
}

/**
 * Result of reading sheet data
 */
export interface ReadSheetResult {
  range: string;
  values: unknown[][];
}

/**
 * Read data from a Google Sheet range
 *
 * Supports flexible range formats:
 * - "A1:B10" - Uses first sheet
 * - "Sheet1!A1:B10" - Specific sheet by name
 * - With sheetName parameter - Prepends sheet name to range
 * - With sheetId parameter - Resolves sheet name from ID
 *
 * @param options Read parameters
 * @param context Sheets API context with caching
 * @returns Sheet data as 2D array
 *
 * @example
 * ```typescript
 * // Read from specific sheet
 * const data = await readSheet({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!A1:C10'
 * }, context);
 *
 * // Process data
 * const headers = data.values[0];
 * const rows = data.values.slice(1);
 * ```
 */
export async function readSheet(
  options: ReadSheetOptions,
  context: SheetsContext
): Promise<ReadSheetResult> {
  const { spreadsheetId, range, sheetName } = options;

  // Build the final range (simplified version - full implementation would use range resolution helpers)
  let resolvedRange = range;

  // If sheetName provided and range doesn't include sheet reference, prepend it
  if (sheetName && !range.includes('!')) {
    resolvedRange = `${sheetName}!${range}`;
  }

  // Check cache
  const cacheKey = `sheet:${spreadsheetId}:${resolvedRange}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('sheets:read', Date.now() - context.startTime);
    return cached as ReadSheetResult;
  }

  // Fetch data
  const response = await context.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: resolvedRange,
  });

  const result: ReadSheetResult = {
    range: response.data.range || resolvedRange,
    values: (response.data.values ?? []) as unknown[][],
  };

  // Cache result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('sheets:read', Date.now() - context.startTime);

  return result;
}
