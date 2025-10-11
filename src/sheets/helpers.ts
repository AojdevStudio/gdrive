import type { sheets_v4 } from 'googleapis';

/**
 * Represents a grid range in Google Sheets API format with zero-based indices.
 * Used by the Sheets API batchUpdate method.
 */
export interface GridRange {
  /** The sheet ID within the spreadsheet */
  sheetId: number;
  /** The starting row index (zero-based, inclusive) */
  startRowIndex: number;
  /** The ending row index (zero-based, exclusive) */
  endRowIndex: number;
  /** The starting column index (zero-based, inclusive) */
  startColumnIndex: number;
  /** The ending column index (zero-based, exclusive) */
  endColumnIndex: number;
}

/**
 * Represents a parsed range input that may contain a sheet name and A1 notation.
 */
export interface ParsedRange {
  /** Optional sheet name extracted from the range (e.g., "Sheet1" from "Sheet1!A1") */
  sheetName?: string;
  /** The A1 notation range without the sheet name (e.g., "A1" or "A1:B5") */
  a1Range: string;
}

const A1_RANGE_SEPARATOR = ':';

/**
 * Converts column letters (A, B, AA, etc.) to a column number (1, 2, 27, etc.).
 *
 * Uses base-26 conversion where:
 * - A=1, B=2, ..., Z=26
 * - AA=27, AB=28, ..., AZ=52
 * - BA=53, etc.
 *
 * @param letters - Column letters (case-insensitive)
 * @returns Column number (1-based)
 * @throws Error if letters contain non-alphabetic characters
 *
 * @example
 * columnLettersToNumber('A')   // Returns 1
 * columnLettersToNumber('Z')   // Returns 26
 * columnLettersToNumber('AA')  // Returns 27
 * columnLettersToNumber('ZZ')  // Returns 702
 */
function columnLettersToNumber(letters: string): number {
  let value = 0;
  for (const char of letters) {
    const upper = char.toUpperCase();
    if (upper < 'A' || upper > 'Z') {
      throw new Error(`Invalid column letter '${char}' in range`);
    }
    value = value * 26 + (upper.charCodeAt(0) - 64);
  }
  return value;
}

/**
 * Parses a single cell reference in A1 notation to row and column numbers.
 *
 * Handles absolute references by stripping $ signs before parsing.
 *
 * @param cell - Cell reference in A1 notation (e.g., "A1", "$B$5", "AA100")
 * @returns Object with row and column numbers (both 1-based)
 * @throws Error if the cell reference format is invalid
 *
 * @example
 * parseCellReference('A1')     // Returns { row: 1, column: 1 }
 * parseCellReference('$B$5')   // Returns { row: 5, column: 2 }
 * parseCellReference('AA10')   // Returns { row: 10, column: 27 }
 */
function parseCellReference(cell: string): { row: number; column: number } {
  const normalized = cell.replace(/\$/g, '').trim();
  const match = normalized.match(/^([A-Z]+)(\d+)$/i);

  if (!match) {
    throw new Error(`Invalid A1 notation segment: '${cell}'`);
  }

  const columnPart = match[1];
  const rowPart = match[2];

  if (!columnPart || !rowPart) {
    throw new Error(`Invalid A1 notation segment: '${cell}'`);
  }

  const column = columnLettersToNumber(columnPart);
  const row = Number.parseInt(rowPart, 10);

  if (!Number.isInteger(row) || row <= 0) {
    throw new Error(`Invalid row index in A1 notation: '${cell}'`);
  }

  return { row, column };
}

/**
 * Parses a range input that may include a sheet name into its components.
 *
 * Handles various formats:
 * - "Sheet1!A1" → { sheetName: "Sheet1", a1Range: "A1" }
 * - "A1:B5" → { a1Range: "A1:B5" }
 * - "A1" → { a1Range: "A1" }
 *
 * @param range - Range string with optional sheet name
 * @returns Parsed range object with optional sheetName and a1Range
 * @throws Error if range is empty or invalid
 *
 * @example
 * parseRangeInput('Sheet1!A1')      // { sheetName: 'Sheet1', a1Range: 'A1' }
 * parseRangeInput('A1:B5')          // { a1Range: 'A1:B5' }
 * parseRangeInput('Budget!C2:D10')  // { sheetName: 'Budget', a1Range: 'C2:D10' }
 */
export function parseRangeInput(range: string): ParsedRange {
  if (typeof range !== 'string') {
    throw new Error('range must be a string');
  }

  const trimmed = range.trim();
  if (!trimmed) {
    throw new Error('range cannot be empty');
  }

  const [sheetSegment, ...rest] = trimmed.split('!');

  if (rest.length === 0) {
    return { a1Range: trimmed };
  }

  const a1Range = rest.join('!').trim();
  if (!a1Range) {
    throw new Error('range must include cell coordinates after the sheet name');
  }

  const sheetName = sheetSegment?.trim();
  const parsed: ParsedRange = {
    a1Range,
  };

  if (sheetName) {
    parsed.sheetName = sheetName;
  }

  return parsed;
}

/**
 * Converts an A1 notation range (without sheet name) to a GridRange object.
 *
 * Supports:
 * - Single cells: "A1"
 * - Ranges: "A1:B5"
 * - Absolute references: "$A$1:$B$5"
 *
 * The resulting GridRange uses zero-based indices as required by the Sheets API.
 *
 * @param range - A1 notation range WITHOUT sheet name (e.g., "A1" or "A1:B5")
 * @param sheetId - The sheet ID (integer) within the spreadsheet
 * @returns GridRange object with zero-based indices for the Sheets API
 * @throws Error if range is invalid or includes a sheet name
 *
 * @example
 * parseA1Notation('A1', 0)
 * // Returns: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }
 *
 * parseA1Notation('A1:C5', 0)
 * // Returns: { sheetId: 0, startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 3 }
 */
export function parseA1Notation(range: string, sheetId: number): GridRange {
  if (!Number.isInteger(sheetId)) {
    throw new Error('sheetId must be an integer');
  }

  const trimmed = range.trim();
  if (!trimmed) {
    throw new Error('range cannot be empty');
  }

  if (trimmed.includes('!')) {
    throw new Error('parseA1Notation expects a range without sheet name');
  }

  const segments = trimmed.split(A1_RANGE_SEPARATOR);
  if (segments.length > 2) {
    throw new Error(`Invalid A1 range '${range}'`);
  }

  const startSegment = segments[0];
  if (!startSegment) {
    throw new Error(`Invalid A1 range '${range}'`);
  }

  const start = parseCellReference(startSegment);
  const endSegment = segments[1];
  const end = endSegment ? parseCellReference(endSegment) : start;

  if (end.row < start.row || end.column < start.column) {
    throw new Error(`Invalid A1 range '${range}': end must be after start`);
  }

  return {
    sheetId,
    startRowIndex: start.row - 1,
    endRowIndex: end.row,
    startColumnIndex: start.column - 1,
    endColumnIndex: end.column,
  };
}

/**
 * Retrieves the sheet ID and title for a specified sheet within a spreadsheet.
 *
 * If no sheet name is provided, returns information for the first sheet.
 *
 * @param sheetsClient - Authenticated Google Sheets API client
 * @param spreadsheetId - The spreadsheet ID
 * @param sheetName - Optional sheet name to find (defaults to first sheet)
 * @returns Promise resolving to object with sheetId (number) and title (string)
 * @throws Error if spreadsheet has no sheets or specified sheet is not found
 *
 * @example
 * const { sheetId, title } = await getSheetId(sheets, 'abc123', 'Budget');
 * // Returns: { sheetId: 42, title: 'Budget' }
 *
 * const { sheetId, title } = await getSheetId(sheets, 'abc123');
 * // Returns first sheet: { sheetId: 0, title: 'Sheet1' }
 */
export async function getSheetId(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName?: string
): Promise<{ sheetId: number; title: string }> {
  const response = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const sheets = response.data.sheets ?? [];

  if (sheets.length === 0) {
    throw new Error(`No sheets found in spreadsheet ${spreadsheetId}`);
  }

  const sheet = sheetName
    ? sheets.find((s) => s.properties?.title === sheetName)
    : sheets[0];

  if (!sheet || !sheet.properties) {
    const name = sheetName ?? '(first sheet)';
    throw new Error(`Sheet '${name}' not found in spreadsheet ${spreadsheetId}`);
  }

  const sheetId = sheet.properties.sheetId;

  if (sheetId === undefined || sheetId === null) {
    const name = sheetName ?? '(first sheet)';
    throw new Error(`Sheet '${name}' not found in spreadsheet ${spreadsheetId}`);
  }

  return {
    sheetId,
    title: sheet.properties.title ?? sheetName ?? 'Sheet1',
  };
}

/**
 * Builds RowData array for applying a formula to a range of cells.
 *
 * The same formula is applied to all cells in the range. Google Sheets will
 * adjust relative references automatically (e.g., "=A1*2" becomes "=A2*2" in row 2).
 *
 * @param gridRange - The grid range specifying where to apply the formula
 * @param formula - The formula string (must start with "=")
 * @returns Array of RowData objects for the Sheets API batchUpdate request
 * @throws Error if formula is empty or doesn't start with "="
 *
 * @example
 * const gridRange = parseA1Notation('A1:A5', 0);
 * const rows = buildFormulaRows(gridRange, '=B1*2');
 * // Returns array of 5 rows, each with the formula (relative references will auto-adjust)
 *
 * @example
 * const gridRange = parseA1Notation('C10', 0);
 * const rows = buildFormulaRows(gridRange, '=SUM(C2:C9)');
 * // Returns array with 1 row containing the SUM formula
 */
/**
 * Maximum number of cells allowed in a single formula update operation.
 * Prevents memory exhaustion from very large ranges.
 * For example, A1:Z1000 = 26,000 cells
 */
const MAX_FORMULA_CELLS = 10000;

export function buildFormulaRows(
  gridRange: GridRange,
  formula: string
): sheets_v4.Schema$RowData[] {
  const trimmedFormula = formula.trim();
  if (!trimmedFormula) {
    throw new Error('formula cannot be empty');
  }
  if (!trimmedFormula.startsWith('=')) {
    throw new Error('formula must start with "="');
  }

  const rowCount = gridRange.endRowIndex - gridRange.startRowIndex;
  const columnCount = gridRange.endColumnIndex - gridRange.startColumnIndex;

  if (rowCount <= 0 || columnCount <= 0) {
    throw new Error('Grid range must have positive size');
  }

  const totalCells = rowCount * columnCount;
  if (totalCells > MAX_FORMULA_CELLS) {
    throw new Error(
      `Range too large: ${totalCells} cells exceeds maximum of ${MAX_FORMULA_CELLS}. ` +
      `Consider breaking into smaller ranges.`
    );
  }

  return Array.from({ length: rowCount }, () => ({
    values: Array.from({ length: columnCount }, () => ({
      userEnteredValue: {
        formulaValue: trimmedFormula,
      },
    })),
  }));
}
