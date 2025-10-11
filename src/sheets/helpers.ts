import type { sheets_v4 } from 'googleapis';

export interface GridRange {
  sheetId: number;
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}

export interface ParsedRange {
  sheetName?: string;
  a1Range: string;
}

const A1_RANGE_SEPARATOR = ':';

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

  return Array.from({ length: rowCount }, () => ({
    values: Array.from({ length: columnCount }, () => ({
      userEnteredValue: {
        formulaValue: trimmedFormula,
      },
    })),
  }));
}
