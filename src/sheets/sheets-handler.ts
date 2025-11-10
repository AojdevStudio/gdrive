import type { sheets_v4 } from 'googleapis';
import type { Logger } from 'winston';
import {
  buildFieldMask,
  buildFormulaRows,
  clearGridRangeCacheForSheet,
  clearSpreadsheetMetadata,
  getSheetId,
  parseA1Notation,
  parseRangeInput,
  resolveGridRange,
  toSheetsColor,
  type CellFormat,
  type FormatCellsInput,
  type TextFormat,
} from './helpers.js';
import {
  buildConditionalFormattingRequestBody,
  extractSheetNameFromRange,
  type ConditionalFormattingRuleInput,
} from './conditional-formatting.js';
import {
  createColumnWidthRequests,
  createFreezeRequest,
  resolveSheetDetails,
} from './layoutHelpers.js';
import type { ColumnWidthConfig } from './layoutHelpers.js';
import {
  SheetsToolSchema,
  type SheetsToolInput,
} from './sheets-schemas.js';

interface CacheManagerLike {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

interface PerformanceMonitorLike {
  track(operation: string, duration: number, error?: boolean): void;
}

export interface SheetsHandlerContext {
  logger: Logger;
  sheets: sheets_v4.Sheets;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  startTime: number;
}

interface SheetIdentifier {
  sheetId?: unknown;
  sheetName?: unknown;
  title?: unknown;
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const resolveSheetMetadata = async (
  context: SheetsHandlerContext,
  spreadsheetId: string,
  identifiers: SheetIdentifier,
  operation: string,
): Promise<{ sheetId: number; title?: string }> => {
  let numericId: number | undefined;

  if (typeof identifiers.sheetId === 'number') {
    numericId = identifiers.sheetId;
  } else if (typeof identifiers.sheetId === 'string' && identifiers.sheetId.trim() !== '') {
    const parsed = Number(identifiers.sheetId);
    if (Number.isNaN(parsed)) {
      throw new Error(`${operation} requires sheetId to be a number`);
    }
    numericId = parsed;
  }

  const providedName =
    typeof identifiers.sheetName === 'string' && identifiers.sheetName.trim() !== ''
      ? identifiers.sheetName
      : typeof identifiers.title === 'string' && identifiers.title.trim() !== ''
        ? identifiers.title
        : undefined;

  if (numericId !== undefined) {
    const result: { sheetId: number; title?: string } = { sheetId: numericId };
    if (providedName !== undefined) {
      result.title = providedName;
    }
    return result;
  }

  if (!providedName) {
    throw new Error(`${operation} requires either sheetId or sheetName`);
  }

  let response;
  try {
    response = await context.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))',
    });
  } catch (error) {
    context.logger.error('Failed to resolve sheet ID', { spreadsheetId, sheetName: providedName, operation, error });
    throw new Error(`Failed to resolve sheet ID for "${providedName}" in spreadsheet ${spreadsheetId}: ${toErrorMessage(error)}`);
  }

  const match = response.data.sheets?.find((sheet) => sheet.properties?.title === providedName);
  const sheetId = match?.properties?.sheetId;

  if (typeof sheetId !== 'number') {
    throw new Error(`Sheet "${providedName}" not found in spreadsheet ${spreadsheetId}`);
  }

  const result: { sheetId: number; title?: string } = { sheetId };
  const resolvedTitle = match?.properties?.title ?? providedName;
  if (resolvedTitle !== undefined) {
    result.title = resolvedTitle;
  }
  return result;
};

const fetchSheetTitleById = async (
  context: SheetsHandlerContext,
  spreadsheetId: string,
  sheetId: number,
  operation: string,
): Promise<string> => {
  try {
    const response = await context.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))',
    });

    const match = response.data.sheets?.find((sheet) => sheet.properties?.sheetId === sheetId);
    const title = match?.properties?.title;

    if (typeof title === 'string' && title.trim() !== '') {
      return title;
    }

    throw new Error(`Sheet ID ${sheetId} not found in spreadsheet ${spreadsheetId}`);
  } catch (error) {
    context.logger.error('Failed to resolve sheet title', {
      spreadsheetId,
      sheetId,
      operation,
      error,
    });
    throw new Error(`Failed to resolve sheet title for ${operation} in spreadsheet ${spreadsheetId}: ${toErrorMessage(error)}`);
  }
};

interface RangeResolutionArgs {
  spreadsheetId: string;
  range: string;
  sheetName?: string;
  sheetId?: number;
}

const resolveRangeWithSheet = async (
  context: SheetsHandlerContext,
  args: RangeResolutionArgs,
  operation: string,
): Promise<{ resolvedRange: string; sheetTitle?: string }> => {
  const trimmedRange = args.range.trim();
  const { sheetName: rangeSheetName } = parseRangeInput(trimmedRange);

  const providedSheetName = typeof args.sheetName === 'string' ? args.sheetName.trim() : undefined;
  const providedSheetId = args.sheetId;

  if (rangeSheetName) {
    if (providedSheetName && providedSheetName !== rangeSheetName) {
      throw new Error('sheetName does not match the sheet specified in range');
    }

    if (providedSheetId !== undefined) {
      const resolved = await resolveSheetMetadata(
        context,
        args.spreadsheetId,
        {
          sheetId: providedSheetId,
          sheetName: providedSheetName ?? rangeSheetName,
        },
        operation,
      );

      const resolvedTitle = resolved.title ?? rangeSheetName;
      if (resolvedTitle !== rangeSheetName) {
        throw new Error('sheetId does not match the sheet specified in range');
      }
    }

    return { resolvedRange: trimmedRange, sheetTitle: rangeSheetName };
  }

  if (providedSheetName !== undefined || providedSheetId !== undefined) {
    const identifier: SheetIdentifier = {
      ...(providedSheetId !== undefined ? { sheetId: providedSheetId } : {}),
      ...(providedSheetName ? { sheetName: providedSheetName } : {}),
    };

    context.logger.info('DEBUG: Resolving sheet with identifier', { identifier, operation });

    const resolved = await resolveSheetMetadata(
      context,
      args.spreadsheetId,
      identifier,
      operation,
    );

    context.logger.info('DEBUG: Resolved metadata', { resolved, operation });

    const title = resolved.title ?? providedSheetName ?? await fetchSheetTitleById(
      context,
      args.spreadsheetId,
      resolved.sheetId,
      operation,
    );

    context.logger.info('DEBUG: Final title and range', { title, trimmedRange, operation });

    const normalizedRange = trimmedRange === title ? title : `${title}!${trimmedRange}`;

    context.logger.info('DEBUG: Normalized range', { normalizedRange, operation });

    return { resolvedRange: normalizedRange, sheetTitle: title };
  }

  return { resolvedRange: trimmedRange };
};

export async function handleSheetsTool(
  rawArgs: unknown,
  context: SheetsHandlerContext,
) {
  const validated = SheetsToolSchema.parse(rawArgs);

  context.logger.info('Executing consolidated sheets tool', {
    operation: validated.operation,
    spreadsheetId: validated.spreadsheetId,
  });

  switch (validated.operation) {
    case 'list':
      return handleListSheets(validated, context);
    case 'read':
      return handleReadSheet(validated, context);
    case 'create':
      return handleCreateSheet(validated, context);
    case 'rename':
      return handleRenameSheet(validated, context);
    case 'delete':
      return handleDeleteSheet(validated, context);
    case 'update':
      return handleUpdateCells(validated, context);
    case 'updateFormula':
      return handleUpdateFormula(validated, context);
    case 'format':
      return handleFormatCells(validated, context);
    case 'conditionalFormat':
      return handleConditionalFormat(validated, context);
    case 'append':
      return handleAppendRows(validated, context);
    case 'freeze':
      return handleFreezeRowsColumns(validated, context);
    case 'setColumnWidth':
      return handleSetColumnWidth(validated, context);
    default:
      throw new Error(`Unsupported sheets operation: ${(validated as SheetsToolInput).operation}`);
  }
}

type ListArgs = Extract<SheetsToolInput, { operation: 'list' }>;
type ReadArgs = Extract<SheetsToolInput, { operation: 'read' }>;
type CreateArgs = Extract<SheetsToolInput, { operation: 'create' }>;
type RenameArgs = Extract<SheetsToolInput, { operation: 'rename' }>;
type DeleteArgs = Extract<SheetsToolInput, { operation: 'delete' }>;
type UpdateArgs = Extract<SheetsToolInput, { operation: 'update' }>;
type UpdateFormulaArgs = Extract<SheetsToolInput, { operation: 'updateFormula' }>;
type FormatArgs = Extract<SheetsToolInput, { operation: 'format' }>;
type ConditionalFormatArgs = Extract<SheetsToolInput, { operation: 'conditionalFormat' }>;
type AppendArgs = Extract<SheetsToolInput, { operation: 'append' }>;
type FreezeArgs = Extract<SheetsToolInput, { operation: 'freeze' }>;
type SetColumnWidthArgs = Extract<SheetsToolInput, { operation: 'setColumnWidth' }>;

async function handleListSheets(args: ListArgs, context: SheetsHandlerContext) {
  const response = await context.sheets.spreadsheets.get({
    spreadsheetId: args.spreadsheetId,
  });

  const sheetList = response.data.sheets?.map((sheet) => ({
    sheetId: sheet.properties?.sheetId,
    title: sheet.properties?.title,
    index: sheet.properties?.index,
    rowCount: sheet.properties?.gridProperties?.rowCount,
    columnCount: sheet.properties?.gridProperties?.columnCount,
  })) ?? [];

  context.performanceMonitor.track('listSheets', Date.now() - context.startTime);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(sheetList, null, 2),
    }],
  };
}

async function handleReadSheet(args: ReadArgs, context: SheetsHandlerContext) {
  const { resolvedRange } = await resolveRangeWithSheet(
    context,
    {
      spreadsheetId: args.spreadsheetId,
      range: args.range,
      ...(args.sheetName !== undefined ? { sheetName: args.sheetName } : {}),
      ...(args.sheetId !== undefined ? { sheetId: args.sheetId } : {}),
    },
    'readSheet',
  );

  const cacheKey = `sheet:${args.spreadsheetId}:${resolvedRange}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('readSheet', Date.now() - context.startTime);
    return cached;
  }

  const response = await context.sheets.spreadsheets.values.get({
    spreadsheetId: args.spreadsheetId,
    range: resolvedRange,
  });

  const result = {
    content: [{
      type: 'text',
      text: JSON.stringify({
        range: response.data.range,
        values: response.data.values ?? [],
      }, null, 2),
    }],
  };

  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('readSheet', Date.now() - context.startTime);

  return result;
}

async function handleCreateSheet(args: CreateArgs, context: SheetsHandlerContext) {
  const sheetProperties: sheets_v4.Schema$SheetProperties = {};

  if (args.sheetName) {
    sheetProperties.title = args.sheetName;
  }

  if (args.index !== undefined) {
    sheetProperties.index = args.index;
  }

  if (args.hidden !== undefined) {
    sheetProperties.hidden = args.hidden;
  }

  if (args.rightToLeft !== undefined) {
    sheetProperties.rightToLeft = args.rightToLeft;
  }

  const rowCount = args.rowCount ?? 1000;
  const columnCount = args.columnCount ?? 26;

  sheetProperties.gridProperties = {
    rowCount,
    columnCount,
  };

  if (args.frozenRowCount !== undefined) {
    sheetProperties.gridProperties.frozenRowCount = args.frozenRowCount;
  }

  if (args.frozenColumnCount !== undefined) {
    sheetProperties.gridProperties.frozenColumnCount = args.frozenColumnCount;
  }

  if (args.tabColor) {
    const validatedColor: sheets_v4.Schema$Color = {};
    for (const channel of ['red', 'green', 'blue', 'alpha'] as const) {
      const value = args.tabColor[channel];
      if (value !== undefined) {
        if (Number.isNaN(value) || value < 0 || value > 1) {
          throw new Error(`tabColor.${channel} must be a number between 0 and 1`);
        }
        validatedColor[channel] = value;
      }
    }

    if (Object.keys(validatedColor).length > 0) {
      sheetProperties.tabColor = validatedColor;
    }
  }

  let response;
  try {
    response = await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: sheetProperties,
          },
        }],
      },
    });
  } catch (error) {
    context.performanceMonitor.track('createSheet', Date.now() - context.startTime, true);
    const message = toErrorMessage(error);
    context.logger.error('Failed to create sheet with batchUpdate', { spreadsheetId: args.spreadsheetId, error });
    throw new Error(`Failed to create sheet in spreadsheet ${args.spreadsheetId}: ${message}`);
  }

  const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
  const newSheetTitle = response.data.replies?.[0]?.addSheet?.properties?.title ?? sheetProperties.title ?? 'Untitled Sheet';

  const resolvedSheet = await resolveSheetMetadata(
    context,
    args.spreadsheetId,
    {
      sheetId: typeof newSheetId === 'number' ? newSheetId : undefined,
      sheetName: newSheetTitle,
      title: newSheetTitle,
    },
    'createSheet',
  );

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('createSheet', Date.now() - context.startTime);
  context.logger.info('Sheet created', {
    spreadsheetId: args.spreadsheetId,
    sheetId: resolvedSheet.sheetId,
    title: resolvedSheet.title,
  });

  return {
    content: [{
      type: 'text',
      text: `Successfully created sheet "${resolvedSheet.title}" with ID ${resolvedSheet.sheetId} in spreadsheet ${args.spreadsheetId}`,
    }],
  };
}

async function handleRenameSheet(args: RenameArgs, context: SheetsHandlerContext) {
  const resolved = await resolveSheetMetadata(context, args.spreadsheetId, args, 'renameSheet');

  try {
    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId: resolved.sheetId,
              title: args.newName,
            },
            fields: 'title',
          },
        }],
      },
    });
  } catch (error) {
    context.performanceMonitor.track('renameSheet', Date.now() - context.startTime, true);
    context.logger.error('Failed to rename sheet', {
      spreadsheetId: args.spreadsheetId,
      sheetId: resolved.sheetId,
      newName: args.newName,
      error,
    });
    throw error;
  }

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('renameSheet', Date.now() - context.startTime);
  context.logger.info('Sheet renamed', {
    spreadsheetId: args.spreadsheetId,
    sheetId: resolved.sheetId,
    oldName: resolved.title,
    newName: args.newName,
  });

  return {
    content: [{
      type: 'text',
      text: `Successfully renamed sheet to "${args.newName}" in spreadsheet ${args.spreadsheetId}`,
    }],
  };
}

async function handleDeleteSheet(args: DeleteArgs, context: SheetsHandlerContext) {
  const resolved = await resolveSheetMetadata(context, args.spreadsheetId, args, 'deleteSheet');

  try {
    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [{
          deleteSheet: {
            sheetId: resolved.sheetId,
          },
        }],
      },
    });
  } catch (error) {
    context.performanceMonitor.track('deleteSheet', Date.now() - context.startTime, true);
    context.logger.error('Failed to delete sheet', {
      spreadsheetId: args.spreadsheetId,
      sheetId: resolved.sheetId,
      error,
    });
    throw error;
  }

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('deleteSheet', Date.now() - context.startTime);
  context.logger.info('Sheet deleted', {
    spreadsheetId: args.spreadsheetId,
    sheetId: resolved.sheetId,
    title: resolved.title,
  });

  return {
    content: [{
      type: 'text',
      text: `Successfully deleted sheet "${resolved.title}" from spreadsheet ${args.spreadsheetId}`,
    }],
  };
}

async function handleUpdateCells(args: UpdateArgs, context: SheetsHandlerContext) {
  const { resolvedRange } = await resolveRangeWithSheet(
    context,
    {
      spreadsheetId: args.spreadsheetId,
      range: args.range,
      ...(args.sheetName !== undefined ? { sheetName: args.sheetName } : {}),
      ...(args.sheetId !== undefined ? { sheetId: args.sheetId } : {}),
    },
    'updateSheet',
  );

  await context.sheets.spreadsheets.values.update({
    spreadsheetId: args.spreadsheetId,
    range: resolvedRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: args.values,
    },
  });

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('updateCells', Date.now() - context.startTime);
  context.logger.info('Cells updated', {
    spreadsheetId: args.spreadsheetId,
    range: resolvedRange,
  });

  return {
    content: [{
      type: 'text',
      text: `Successfully updated ${args.values.length} rows in range ${resolvedRange}`,
    }],
  };
}

async function handleUpdateFormula(args: UpdateFormulaArgs, context: SheetsHandlerContext) {
  const spreadsheetId = args.spreadsheetId;
  const rawRange = args.range;
  const formula = args.formula;
  const providedSheetName = args.sheetName;

  try {
    const { sheetName: rangeSheetName, a1Range } = parseRangeInput(rawRange);

    if (providedSheetName && rangeSheetName && providedSheetName !== rangeSheetName) {
      throw new Error('sheetName does not match the sheet specified in range');
    }

    const { sheetId, title } = await getSheetId(
      context.sheets,
      spreadsheetId,
      providedSheetName ?? rangeSheetName,
    );

    const gridRange = parseA1Notation(a1Range, sheetId);
    const normalizedFormula = formula.trim();
    const rows = buildFormulaRows(gridRange, normalizedFormula);

    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: gridRange,
              fields: 'userEnteredValue',
              rows,
            },
          },
        ],
      },
    });

    await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

    context.performanceMonitor.track('updateCellsWithFormula', Date.now() - context.startTime);
    context.logger.info('Formula updated', {
      spreadsheetId,
      sheetId,
      sheetTitle: title,
      range: `${title}!${a1Range}`,
      formula: normalizedFormula,
    });

    return {
      content: [{
        type: 'text',
        text: `Successfully set formula ${normalizedFormula} in range ${title}!${a1Range}`,
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.logger.error('Formula update failed', {
      spreadsheetId,
      range: rawRange,
      formula,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    });

    context.performanceMonitor.track('updateCellsWithFormula', Date.now() - context.startTime, true);
    throw error;
  }
}

async function handleFormatCells(args: FormatArgs, context: SheetsHandlerContext) {
  const formatOptions = args.format as FormatCellsInput;

  const { sheetId, gridRange } = await resolveGridRange(
    context.sheets,
    args.spreadsheetId,
    args.range,
  );

  const cellFormat: CellFormat = {};
  const textFormat: TextFormat = {};

  if (typeof formatOptions.bold === 'boolean') {
    textFormat.bold = formatOptions.bold;
  }
  if (typeof formatOptions.italic === 'boolean') {
    textFormat.italic = formatOptions.italic;
  }
  if (typeof formatOptions.fontSize === 'number') {
    textFormat.fontSize = formatOptions.fontSize;
  }
  if (formatOptions.foregroundColor && typeof formatOptions.foregroundColor === 'object') {
    textFormat.foregroundColor = toSheetsColor(formatOptions.foregroundColor);
  }

  if (Object.keys(textFormat).length > 0) {
    cellFormat.textFormat = textFormat;
  }

  if (formatOptions.backgroundColor && typeof formatOptions.backgroundColor === 'object') {
    cellFormat.backgroundColor = toSheetsColor(formatOptions.backgroundColor);
  }

  if (
    formatOptions.numberFormat &&
    typeof formatOptions.numberFormat === 'object' &&
    typeof formatOptions.numberFormat.type === 'string'
  ) {
    const numberFormat: { type: string; pattern?: string } = {
      type: formatOptions.numberFormat.type,
    };
    if (typeof formatOptions.numberFormat.pattern === 'string') {
      numberFormat.pattern = formatOptions.numberFormat.pattern;
    }
    cellFormat.numberFormat = numberFormat;
  }

  if (!cellFormat.textFormat && !cellFormat.backgroundColor && !cellFormat.numberFormat) {
    throw new Error('At least one formatting option must be provided');
  }

  const fieldMask = buildFieldMask(cellFormat);
  if (!fieldMask) {
    throw new Error('Unable to determine fields to update for formatCells');
  }

  await context.sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: gridRange,
            cell: { userEnteredFormat: cellFormat },
            fields: fieldMask,
          },
        },
      ],
    },
  });

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);
  clearSpreadsheetMetadata(args.spreadsheetId);
  clearGridRangeCacheForSheet(sheetId);

  context.performanceMonitor.track('formatCells', Date.now() - context.startTime);
  context.logger.info('Cell formatting applied', {
    spreadsheetId: args.spreadsheetId,
    range: args.range,
    fields: fieldMask,
  });

  return {
    content: [{
      type: 'text',
      text: `Formatting applied to ${args.range}`,
    }],
  };
}

async function handleConditionalFormat(args: ConditionalFormatArgs, context: SheetsHandlerContext) {
  if (typeof args.rule !== 'object' || args.rule === null) {
    throw new Error('rule parameter is required');
  }

  const rangeInput = args.range;
  const { sheetName, range } = extractSheetNameFromRange(rangeInput);

  const sheetIdResult = await getSheetId(
    context.sheets,
    args.spreadsheetId,
    sheetName,
  );
  const sheetId = typeof sheetIdResult === 'object' ? sheetIdResult.sheetId : sheetIdResult;

  const ruleInput = args.rule as ConditionalFormattingRuleInput;

  const requestBody = buildConditionalFormattingRequestBody({
    sheetId,
    range,
    rule: ruleInput,
    index: 0,
  });

  try {
    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody,
    });
  } catch (error) {
    context.performanceMonitor.track('addConditionalFormatting', Date.now() - context.startTime, true);
    context.logger.error('Failed to add conditional formatting', {
      spreadsheetId: args.spreadsheetId,
      range: rangeInput,
      error,
    });
    throw error;
  }

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('addConditionalFormatting', Date.now() - context.startTime);
  context.logger.info('Conditional formatting added', {
    spreadsheetId: args.spreadsheetId,
    range: rangeInput,
    sheetId,
  });

  return {
    content: [{
      type: 'text',
      text: `Conditional formatting added to ${rangeInput}`,
    }],
  };
}

async function handleAppendRows(args: AppendArgs, context: SheetsHandlerContext) {
  const sheetName = args.sheetName ?? 'Sheet1';

  await context.sheets.spreadsheets.values.append({
    spreadsheetId: args.spreadsheetId,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: args.values,
    },
  });

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('appendRows', Date.now() - context.startTime);
  context.logger.info('Rows appended', {
    spreadsheetId: args.spreadsheetId,
    sheetName,
    rowCount: args.values.length,
  });

  return {
    content: [{
      type: 'text',
      text: `Successfully appended ${args.values.length} rows to ${sheetName}`,
    }],
  };
}

async function handleFreezeRowsColumns(args: FreezeArgs, context: SheetsHandlerContext) {
  const sheetName = args.sheetName;
  const frozenRowCount = args.frozenRowCount ?? 0;
  const frozenColumnCount = args.frozenColumnCount ?? 0;

  const sheetDetails = await resolveSheetDetails({
    sheetsClient: context.sheets,
    spreadsheetId: args.spreadsheetId,
    ...(sheetName !== undefined ? { sheetName } : {}),
  });

  const request = createFreezeRequest(sheetDetails.sheetId, frozenRowCount, frozenColumnCount);

  try {
    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [request],
      },
    });
  } catch (error) {
    context.performanceMonitor.track('freezeRowsColumns', Date.now() - context.startTime, true);
    context.logger.error('Failed to update frozen rows/columns', {
      error,
      spreadsheetId: args.spreadsheetId,
      sheetId: sheetDetails.sheetId,
      sheetName: sheetDetails.title,
      frozenRowCount,
      frozenColumnCount,
    });
    throw error;
  }

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('freezeRowsColumns', Date.now() - context.startTime);
  context.logger.info('Updated frozen rows/columns', {
    spreadsheetId: args.spreadsheetId,
    sheetId: sheetDetails.sheetId,
    sheetName: sheetDetails.title,
    frozenRowCount,
    frozenColumnCount,
  });

  const summary = `Frozen ${frozenRowCount} row${frozenRowCount === 1 ? '' : 's'} and ${frozenColumnCount} column${frozenColumnCount === 1 ? '' : 's'} on sheet "${sheetDetails.title}"`;

  return {
    content: [{
      type: 'text',
      text: summary,
    }],
  };
}

async function handleSetColumnWidth(args: SetColumnWidthArgs, context: SheetsHandlerContext) {
  const sheetName = args.sheetName;

  const normalizedColumns: ColumnWidthConfig[] = args.columns.map((column, index) => {
    if (column.width !== undefined && (Number.isNaN(column.width) || column.width <= 0)) {
      throw new Error(`width must be a positive number when provided at index ${index}`);
    }
    const result: ColumnWidthConfig = { columnIndex: column.columnIndex };
    if (column.width !== undefined) {
      result.width = column.width;
    }
    return result;
  });

  const sheetDetails = await resolveSheetDetails({
    sheetsClient: context.sheets,
    spreadsheetId: args.spreadsheetId,
    ...(sheetName !== undefined ? { sheetName } : {}),
  });

  const requests = createColumnWidthRequests(sheetDetails.sheetId, normalizedColumns);

  try {
    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests,
      },
    });
  } catch (error) {
    context.performanceMonitor.track('setColumnWidth', Date.now() - context.startTime, true);
    context.logger.error('Failed to update column widths', {
      error,
      spreadsheetId: args.spreadsheetId,
      sheetId: sheetDetails.sheetId,
      sheetName: sheetDetails.title,
      columns: normalizedColumns,
    });
    throw error;
  }

  await context.cacheManager.invalidate(`sheet:${args.spreadsheetId}:*`);

  context.performanceMonitor.track('setColumnWidth', Date.now() - context.startTime);
  context.logger.info('Updated column widths', {
    spreadsheetId: args.spreadsheetId,
    sheetId: sheetDetails.sheetId,
    sheetName: sheetDetails.title,
    columnCount: normalizedColumns.length,
  });

  const summary = `Updated width for ${normalizedColumns.length} column${normalizedColumns.length === 1 ? '' : 's'} on sheet "${sheetDetails.title}"`;

  return {
    content: [{
      type: 'text',
      text: summary,
    }],
  };
}
