import type { sheets_v4 } from 'googleapis';

export type SupportedConditionType =
  | 'NUMBER_GREATER'
  | 'NUMBER_LESS'
  | 'TEXT_CONTAINS'
  | 'CUSTOM_FORMULA';

export interface ConditionalFormatConditionInput {
  type: SupportedConditionType;
  values?: Array<string>;
  formula?: string;
}

export interface ConditionalFormatFormatInput {
  backgroundColor?: sheets_v4.Schema$Color;
  foregroundColor?: sheets_v4.Schema$Color;
  bold?: boolean;
}

export interface ConditionalFormattingRuleInput {
  condition: ConditionalFormatConditionInput;
  format: ConditionalFormatFormatInput;
}

export interface SplitRangeResult {
  sheetName?: string;
  range: string;
}

const CONDITION_TYPES: readonly SupportedConditionType[] = [
  'NUMBER_GREATER',
  'NUMBER_LESS',
  'TEXT_CONTAINS',
  'CUSTOM_FORMULA',
] as const;

const VALUE_REQUIRED_TYPES: readonly SupportedConditionType[] = [
  'NUMBER_GREATER',
  'NUMBER_LESS',
  'TEXT_CONTAINS',
] as const;

const COLOR_CHANNELS = ['red', 'green', 'blue', 'alpha'] as const;

type ColorChannel = (typeof COLOR_CHANNELS)[number];

interface ParsedCellReference {
  columnIndex?: number;
  rowIndex?: number;
}

const RANGE_WITH_QUOTED_SHEET = /^'((?:[^']|'')+)'!(.*)$/;
const RANGE_WITH_SHEET = /^(?<sheet>[^!]+)!(?<range>.*)$/;

const isSupportedConditionType = (value: unknown): value is SupportedConditionType =>
  typeof value === 'string' && CONDITION_TYPES.includes(value as SupportedConditionType);

const requiresValues = (type: SupportedConditionType): boolean =>
  VALUE_REQUIRED_TYPES.includes(type);

export const extractSheetNameFromRange = (input: string): SplitRangeResult => {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { range: '' };
  }

  const quotedMatch = trimmed.match(RANGE_WITH_QUOTED_SHEET);
  if (quotedMatch) {
    const [, rawSheetName = '', rawRange = ''] = quotedMatch;
    const sheetName = rawSheetName.replace(/''/g, "'");
    const result: SplitRangeResult = { range: rawRange.trim() };
    if (sheetName !== '') {
      result.sheetName = sheetName;
    }
    return result;
  }

  const namedMatch = trimmed.match(RANGE_WITH_SHEET);
  if (namedMatch?.groups) {
    const sheetPart = (namedMatch.groups.sheet ?? '').trim();
    const rangePart = (namedMatch.groups.range ?? '').trim();
    const result: SplitRangeResult = { range: rangePart };
    if (sheetPart !== '') {
      result.sheetName = sheetPart;
    }
    return result;
  }

  return { range: trimmed };
};

const columnLabelToIndex = (label: string): number => {
  let index = 0;
  const upper = label.toUpperCase();
  for (const char of upper) {
    if (char < 'A' || char > 'Z') {
      throw new Error(`Invalid column label: ${label}`);
    }
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
};

const parseCellReference = (reference: string): ParsedCellReference => {
  const trimmed = reference.trim();
  if (trimmed === '') {
    return {};
  }

  const match = trimmed.match(/^([A-Za-z]+)?(\d+)?$/);
  if (!match) {
    throw new Error(`Invalid A1 cell reference: ${reference}`);
  }

  const [, column, row] = match;
  const columnIndex = column ? columnLabelToIndex(column) : undefined;
  const rowIndex = row ? parseInt(row, 10) - 1 : undefined;

  const result: ParsedCellReference = {};
  if (columnIndex !== undefined) {
    result.columnIndex = columnIndex;
  }
  if (rowIndex !== undefined) {
    result.rowIndex = rowIndex;
  }

  return result;
};

export const parseA1Notation = (
  range: string,
  sheetId: number,
): sheets_v4.Schema$GridRange => {
  const trimmed = range.trim();
  const gridRange: sheets_v4.Schema$GridRange = { sheetId };

  if (trimmed === '') {
    return gridRange;
  }

  const segments = trimmed.split(':');
  if (segments.length > 2) {
    throw new Error(`Invalid A1 range: ${range}`);
  }

  const [startSegment = ''] = segments;
  const start = parseCellReference(startSegment);
  const hasEnd = segments.length === 2 && segments[1] !== '';
  const endSegment = hasEnd ? segments[1] ?? '' : '';
  const end = hasEnd ? parseCellReference(endSegment) : start;

  if (start.columnIndex !== undefined) {
    gridRange.startColumnIndex = start.columnIndex;
  }
  if (start.rowIndex !== undefined) {
    gridRange.startRowIndex = start.rowIndex;
  }

  if (hasEnd) {
    if (end.columnIndex !== undefined) {
      if (
        start.columnIndex !== undefined &&
        end.columnIndex < start.columnIndex
      ) {
        throw new Error(`End column must be greater than or equal to start column in range ${range}`);
      }
      gridRange.endColumnIndex = end.columnIndex + 1;
    }

    if (end.rowIndex !== undefined) {
      if (start.rowIndex !== undefined && end.rowIndex < start.rowIndex) {
        throw new Error(`End row must be greater than or equal to start row in range ${range}`);
      }
      gridRange.endRowIndex = end.rowIndex + 1;
    }
  } else {
    if (start.columnIndex !== undefined) {
      gridRange.endColumnIndex = start.columnIndex + 1;
    }
    if (start.rowIndex !== undefined) {
      gridRange.endRowIndex = start.rowIndex + 1;
    }
  }

  return gridRange;
};

const normalizeColor = (
  color: sheets_v4.Schema$Color | undefined,
): sheets_v4.Schema$Color | undefined => {
  if (!color || typeof color !== 'object') {
    return undefined;
  }

  const normalized: sheets_v4.Schema$Color = {};
  for (const channel of COLOR_CHANNELS) {
    const value = (color as Record<ColorChannel, unknown>)[channel];
    if (value !== undefined) {
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
        throw new Error(`Color channel ${channel} must be a number between 0 and 1`);
      }
      normalized[channel] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const buildBooleanCondition = (
  conditionInput: ConditionalFormatConditionInput,
): sheets_v4.Schema$BooleanCondition => {
  if (!conditionInput || typeof conditionInput !== 'object') {
    throw new Error('Conditional formatting rule requires a condition object');
  }

  const { type, values, formula } = conditionInput;
  if (!isSupportedConditionType(type)) {
    throw new Error(`Unsupported conditional format type: ${String(type)}`);
  }

  if (type === 'CUSTOM_FORMULA') {
    const normalizedFormula = typeof formula === 'string' ? formula.trim() : '';
    if (normalizedFormula === '') {
      throw new Error('CUSTOM_FORMULA conditional formatting requires a formula');
    }

    return {
      type,
      values: [{ userEnteredValue: normalizedFormula }],
    };
  }

  if (values !== undefined && !Array.isArray(values)) {
    throw new Error('Conditional formatting values must be an array of strings');
  }

  const normalizedValues = (values ?? []).map((value) => {
    if (value === undefined || value === null) {
      throw new Error('Conditional formatting values must be non-null strings');
    }
    const asString = String(value).trim();
    if (asString === '') {
      throw new Error('Conditional formatting values cannot be empty');
    }
    return { userEnteredValue: asString };
  });

  if (normalizedValues.length === 0 && requiresValues(type)) {
    throw new Error(`Conditional format type ${type} requires at least one value`);
  }

  return normalizedValues.length > 0
    ? { type, values: normalizedValues }
    : { type };
};

const buildBooleanRuleFormat = (
  formatInput: ConditionalFormatFormatInput,
): sheets_v4.Schema$CellFormat => {
  if (!formatInput || typeof formatInput !== 'object') {
    throw new Error('Conditional formatting rule requires a format object');
  }

  const backgroundColor = normalizeColor(formatInput.backgroundColor);
  const foregroundColor = normalizeColor(formatInput.foregroundColor);
  const textFormat: sheets_v4.Schema$TextFormat = {};

  if (foregroundColor) {
    textFormat.foregroundColor = foregroundColor;
  }

  if (typeof formatInput.bold === 'boolean') {
    textFormat.bold = formatInput.bold;
  }

  const cellFormat: sheets_v4.Schema$CellFormat = {};
  if (backgroundColor) {
    cellFormat.backgroundColor = backgroundColor;
  }
  if (Object.keys(textFormat).length > 0) {
    cellFormat.textFormat = textFormat;
  }

  if (!cellFormat.backgroundColor && !cellFormat.textFormat) {
    throw new Error('Conditional formatting format must include at least one style property');
  }

  return cellFormat;
};

export const buildConditionalFormatBooleanRule = (
  ruleInput: ConditionalFormattingRuleInput,
): sheets_v4.Schema$BooleanRule => {
  if (!ruleInput || typeof ruleInput !== 'object') {
    throw new Error('Conditional formatting requires a rule object');
  }

  const { condition, format } = ruleInput;

  return {
    condition: buildBooleanCondition(condition),
    format: buildBooleanRuleFormat(format),
  };
};

export const buildConditionalFormattingRequestBody = (
  params: {
    sheetId: number;
    range: string;
    rule: ConditionalFormattingRuleInput;
    index?: number;
  },
): sheets_v4.Schema$BatchUpdateSpreadsheetRequest => {
  const { sheetId, range, rule, index } = params;
  const gridRange = parseA1Notation(range, sheetId);
  const booleanRule = buildConditionalFormatBooleanRule(rule);

  return {
    requests: [
      {
        addConditionalFormatRule: {
          index: index ?? 0,
          rule: {
            ranges: [gridRange],
            booleanRule,
          },
        },
      },
    ],
  };
};
