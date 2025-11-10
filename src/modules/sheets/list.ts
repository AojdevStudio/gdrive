import type { SheetsContext } from '../types.js';

/**
 * Options for listing sheets
 */
export interface ListSheetsOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
}

/**
 * Sheet metadata
 */
export interface SheetInfo {
  sheetId?: number | undefined;
  title?: string | undefined;
  index?: number | undefined;
  rowCount?: number | undefined;
  columnCount?: number | undefined;
}

/**
 * Result of listing sheets
 */
export interface ListSheetsResult {
  sheets: SheetInfo[];
}

/**
 * List all sheets in a spreadsheet
 *
 * @param options List parameters with spreadsheetId
 * @param context Sheets API context
 * @returns Array of sheet metadata
 *
 * @example
 * ```typescript
 * const result = await listSheets({ spreadsheetId: 'abc123' }, context);
 * result.sheets.forEach(sheet => {
 *   console.log(`${sheet.title} (ID: ${sheet.sheetId})`);
 * });
 * ```
 */
export async function listSheets(
  options: ListSheetsOptions,
  context: SheetsContext
): Promise<ListSheetsResult> {
  const response = await context.sheets.spreadsheets.get({
    spreadsheetId: options.spreadsheetId,
  });

  const sheets = response.data.sheets?.map((sheet) => ({
    sheetId: sheet.properties?.sheetId ?? undefined,
    title: sheet.properties?.title ?? undefined,
    index: sheet.properties?.index ?? undefined,
    rowCount: sheet.properties?.gridProperties?.rowCount ?? undefined,
    columnCount: sheet.properties?.gridProperties?.columnCount ?? undefined,
  })) ?? [];

  context.performanceMonitor.track('sheets:list', Date.now() - context.startTime);

  return { sheets };
}
