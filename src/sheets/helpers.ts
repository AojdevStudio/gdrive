import type { sheets_v4 } from 'googleapis';

export type SheetsClient = sheets_v4.Sheets;
export type GridRange = sheets_v4.Schema$GridRange;
export type CellFormat = sheets_v4.Schema$CellFormat;
export type TextFormat = sheets_v4.Schema$TextFormat;
export type SheetsColor = sheets_v4.Schema$Color;

export interface ColorInput {
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
}

export interface FormatCellsNumberFormatInput {
  type: string;
  pattern?: string;
}

export interface FormatCellsInput {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  foregroundColor?: ColorInput;
  backgroundColor?: ColorInput;
  numberFormat?: FormatCellsNumberFormatInput;
}

interface SpreadsheetMetadata {
  byTitle: Map<string, number>;
  defaultSheetId?: number;
}

const spreadsheetMetadataCache = new Map<string, SpreadsheetMetadata>();
const gridRangeCache = new Map<string, GridRange>();

function normalizeRange(range: string): string {
  return range.replace(/\$/g, '').replace(/\s+/g, '').toUpperCase();
}

function columnLetterToIndex(letters: string): number {
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseCellReference(ref: string): { rowIndex?: number; columnIndex?: number } {
  if (!ref) {
    return {};
  }

  const match = ref.match(/^([A-Z]*)(\d*)$/);
  if (!match) {
    throw new Error(`Invalid A1 notation segment: ${ref}`);
  }

  const [, letters, numbers] = match;
  const result: { rowIndex?: number; columnIndex?: number } = {};

  if (letters) {
    result.columnIndex = columnLetterToIndex(letters);
  }
  if (numbers) {
    result.rowIndex = parseInt(numbers, 10) - 1;
  }

  return result;
}

function extractSheetName(range: string): { sheetName?: string; rangeA1: string } {
  const trimmed = range.trim();
  if (!trimmed) {
    return { rangeA1: '' };
  }

  const match = trimmed.match(/^(?:'((?:[^']|'')+)'|([^'!]+))!(.*)$/);
  if (!match) {
    return { rangeA1: trimmed };
  }

  const rawName = match[1] ?? match[2];
  const parsedName = rawName ? rawName.replace(/''/g, "'") : undefined;
  const rangeA1 = match[3] ?? '';

  const result: { sheetName?: string; rangeA1: string } = { rangeA1 };
  if (parsedName !== undefined) {
    result.sheetName = parsedName;
  }

  return result;
}

async function fetchSpreadsheetMetadata(
  sheetsClient: SheetsClient,
  spreadsheetId: string,
): Promise<SpreadsheetMetadata> {
  const response = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const byTitle = new Map<string, number>();
  let defaultSheetId: number | undefined;

  for (const sheet of response.data.sheets ?? []) {
    const id = sheet.properties?.sheetId;
    if (id === undefined || id === null) {
      continue;
    }

    const title = sheet.properties?.title;
    if (title) {
      byTitle.set(title, id);
    }

    if (defaultSheetId === undefined) {
      defaultSheetId = id;
    }
  }

  if (defaultSheetId === undefined) {
    throw new Error(`No sheets found in spreadsheet ${spreadsheetId}`);
  }

  const metadata: SpreadsheetMetadata = {
    byTitle,
    defaultSheetId,
  };

  spreadsheetMetadataCache.set(spreadsheetId, metadata);
  return metadata;
}

export async function getSheetId(
  sheetsClient: SheetsClient,
  spreadsheetId: string,
  sheetName?: string,
): Promise<number> {
  let metadata = spreadsheetMetadataCache.get(spreadsheetId);
  if (!metadata) {
    metadata = await fetchSpreadsheetMetadata(sheetsClient, spreadsheetId);
  }

  if (sheetName) {
    const sheetId = metadata.byTitle.get(sheetName);
    if (sheetId === undefined) {
      throw new Error(`Sheet "${sheetName}" not found in spreadsheet ${spreadsheetId}`);
    }
    return sheetId;
  }

  if (metadata.defaultSheetId === undefined) {
    throw new Error(`No sheets found in spreadsheet ${spreadsheetId}`);
  }

  return metadata.defaultSheetId;
}

export function parseA1Notation(range: string, sheetId: number): GridRange {
  if (!range.trim()) {
    return { sheetId };
  }

  const normalized = normalizeRange(range);
  const cacheKey = `${sheetId}:${normalized}`;
  const cached = gridRangeCache.get(cacheKey);
  if (cached) {
    return { ...cached };
  }

  const parts = normalized.split(':');
  const [startPart, endPart] = parts;
  const startRef = parseCellReference(startPart ?? '');
  const endRef = parseCellReference(parts.length > 1 ? endPart ?? '' : startPart ?? '');

  const gridRange: GridRange = { sheetId };

  if (startRef.rowIndex !== undefined) {
    gridRange.startRowIndex = startRef.rowIndex;
  }
  if (startRef.columnIndex !== undefined) {
    gridRange.startColumnIndex = startRef.columnIndex;
  }

  if (parts.length === 1) {
    if (startRef.rowIndex !== undefined) {
      gridRange.endRowIndex = startRef.rowIndex + 1;
    }
    if (startRef.columnIndex !== undefined) {
      gridRange.endColumnIndex = startRef.columnIndex + 1;
    }
  } else {
    if (endRef.rowIndex !== undefined) {
      gridRange.endRowIndex = endRef.rowIndex + 1;
    }
    if (endRef.columnIndex !== undefined) {
      gridRange.endColumnIndex = endRef.columnIndex + 1;
    }
  }

  gridRangeCache.set(cacheKey, gridRange);
  return { ...gridRange };
}

export async function resolveGridRange(
  sheetsClient: SheetsClient,
  spreadsheetId: string,
  rangeInput: string,
): Promise<{ sheetId: number; gridRange: GridRange; sheetName?: string }> {
  const trimmed = rangeInput.trim();
  const { sheetName: explicitSheetName, rangeA1 } = extractSheetName(trimmed);

  let targetSheetId: number;
  let sheetName = explicitSheetName;
  let innerRange = rangeA1;

  if (sheetName !== undefined) {
    targetSheetId = await getSheetId(sheetsClient, spreadsheetId, sheetName);
  } else {
    targetSheetId = await getSheetId(sheetsClient, spreadsheetId);

    if (innerRange) {
      try {
        targetSheetId = await getSheetId(sheetsClient, spreadsheetId, innerRange);
        sheetName = innerRange;
        innerRange = '';
      } catch {
        // Not a sheet name - treat as range on default sheet
      }
    }
  }

  const gridRange = innerRange
    ? parseA1Notation(innerRange, targetSheetId)
    : { sheetId: targetSheetId };

  const result: { sheetId: number; gridRange: GridRange; sheetName?: string } = {
    sheetId: targetSheetId,
    gridRange,
  };

  if (sheetName !== undefined) {
    result.sheetName = sheetName;
  }

  return result;
}

function collectFieldMask(value: unknown, prefix: string): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  const entries = Object.entries(value).filter(([, val]) => val !== undefined && val !== null);
  if (entries.length === 0) {
    return [];
  }

  const hasNestedObject = entries.some(([, val]) => typeof val === 'object' && val !== null && !Array.isArray(val));

  const shouldExpandChildren = hasNestedObject || (prefix.endsWith('textFormat') && entries.length > 0);

  if (!shouldExpandChildren) {
    return prefix ? [prefix] : [];
  }

  const result: string[] = [];
  for (const [key, val] of entries) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result.push(...collectFieldMask(val, prefix ? `${prefix}.${key}` : key));
    } else if (prefix) {
      result.push(`${prefix}.${key}`);
    } else {
      result.push(key);
    }
  }

  return result;
}

export function buildFieldMask(format: CellFormat): string {
  const fields = collectFieldMask({ userEnteredFormat: format }, '');
  const uniqueFields = Array.from(new Set(fields.filter((field) => field.length > 0)));
  return uniqueFields.join(',');
}

export function toSheetsColor(color: ColorInput): SheetsColor {
  const sheetsColor: SheetsColor = {};

  if (typeof color.red === 'number') {
    sheetsColor.red = color.red;
  }
  if (typeof color.green === 'number') {
    sheetsColor.green = color.green;
  }
  if (typeof color.blue === 'number') {
    sheetsColor.blue = color.blue;
  }
  if (typeof color.alpha === 'number') {
    sheetsColor.alpha = color.alpha;
  }

  return sheetsColor;
}

export function clearSpreadsheetMetadata(spreadsheetId: string): void {
  spreadsheetMetadataCache.delete(spreadsheetId);
}

export function clearGridRangeCacheForSheet(sheetId: number): void {
  const prefix = `${sheetId}:`;
  for (const key of Array.from(gridRangeCache.keys())) {
    if (key.startsWith(prefix)) {
      gridRangeCache.delete(key);
    }
  }
}

export function resetSheetHelperCaches(): void {
  spreadsheetMetadataCache.clear();
  gridRangeCache.clear();
}
