import type { sheets_v4 } from "googleapis";

type SheetsClient = {
  spreadsheets: {
    get: (
      params: sheets_v4.Params$Resource$Spreadsheets$Get
    ) => Promise<{ data: sheets_v4.Schema$Spreadsheet }>;
    batchUpdate: (
      params: sheets_v4.Params$Resource$Spreadsheets$Batchupdate
    ) => Promise<unknown>;
  };
};

type CacheLike = {
  invalidate: (pattern: string) => Promise<void>;
};

type PerformanceLike = {
  track: (operation: string, duration: number, error?: boolean) => void;
};

type LoggerLike = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  debug?: (message: string, meta?: Record<string, unknown>) => void;
};

interface ToolContext {
  sheets: SheetsClient;
  cache: CacheLike;
  performance: PerformanceLike;
  logger: LoggerLike;
}

type MergeType = "MERGE_ALL" | "MERGE_COLUMNS" | "MERGE_ROWS";

interface MergeCellsArgs {
  spreadsheetId: string;
  range: string;
  mergeType?: MergeType;
}

interface DataValidationArgs {
  spreadsheetId: string;
  range: string;
  validation: {
    type: "LIST_OF_VALUES" | "NUMBER_BETWEEN" | "DATE_AFTER";
    values?: string[];
    min?: number | string;
    max?: number | string;
    strict?: boolean;
    showDropdown?: boolean;
  };
}

interface CreateChartArgs {
  spreadsheetId: string;
  sheetName?: string;
  chartType: string;
  dataRange: string;
  position: { row: number; column: number };
  title?: string;
}

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
}

type GridRange = sheets_v4.Schema$GridRange;
type ChartSourceRange = sheets_v4.Schema$ChartSourceRange;

const MERGE_TYPES: ReadonlySet<MergeType> = new Set([
  "MERGE_ALL",
  "MERGE_COLUMNS",
  "MERGE_ROWS",
]);

const CHART_TYPES: ReadonlySet<string> = new Set([
  "LINE",
  "BAR",
  "COLUMN",
  "PIE",
  "SCATTER",
]);

export async function mergeCellsTool(
  rawArgs: unknown,
  context: ToolContext,
  startTime: number
): Promise<ToolResponse> {
  const args = validateMergeCellsArgs(rawArgs);

  try {
    const { sheetId, title } = await resolveSheetId(
      context.sheets,
      args.spreadsheetId,
      context.logger,
      undefined,
      args.range
    );

    const gridRange = parseA1Notation(args.range, sheetId);

    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [
          {
            mergeCells: {
              range: gridRange,
              mergeType: args.mergeType ?? "MERGE_ALL",
            },
          },
        ],
      },
    });

    await context.cache.invalidate(`sheet:${args.spreadsheetId}:*`);

    context.performance.track("mergeCells", Date.now() - startTime);
    context.logger.info("Cells merged", {
      spreadsheetId: args.spreadsheetId,
      sheetId,
      sheetTitle: title,
      range: gridRange,
      mergeType: args.mergeType ?? "MERGE_ALL",
    });

    return {
      content: [
        {
          type: "text",
          text: `Merged range ${args.range} using ${args.mergeType ?? "MERGE_ALL"}`,
        },
      ],
    };
  } catch (error) {
    context.performance.track("mergeCells", Date.now() - startTime, true);
    context.logger.error("mergeCells tool failed", {
      error,
      spreadsheetId: args.spreadsheetId,
      range: args.range,
    });

    throw wrapError(error, (message) =>
      message.startsWith("Failed to")
        ? message
        : `Failed to merge cells in range ${args.range}: ${message}`
    );
  }
}

export async function setDataValidationTool(
  rawArgs: unknown,
  context: ToolContext,
  startTime: number
): Promise<ToolResponse> {
  const args = validateDataValidationArgs(rawArgs);

  try {
    const { sheetId, title } = await resolveSheetId(
      context.sheets,
      args.spreadsheetId,
      context.logger,
      undefined,
      args.range
    );

    const gridRange = parseA1Notation(args.range, sheetId);
    const rule = buildDataValidationRule(args.validation);

    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: gridRange,
              rule,
            },
          },
        ],
      },
    });

    await context.cache.invalidate(`sheet:${args.spreadsheetId}:*`);

    context.performance.track("setDataValidation", Date.now() - startTime);
    context.logger.info("Data validation applied", {
      spreadsheetId: args.spreadsheetId,
      sheetId,
      sheetTitle: title,
      range: gridRange,
      type: args.validation.type,
    });

    return {
      content: [
        {
          type: "text",
          text: `Applied ${args.validation.type} validation to ${args.range}`,
        },
      ],
    };
  } catch (error) {
    context.performance.track("setDataValidation", Date.now() - startTime, true);
    context.logger.error("setDataValidation tool failed", {
      error,
      spreadsheetId: args.spreadsheetId,
      range: args.range,
    });

    throw wrapError(error, (message) =>
      message.startsWith("Failed to")
        ? message
        : `Failed to set data validation on ${args.range}: ${message}`
    );
  }
}

export async function createChartTool(
  rawArgs: unknown,
  context: ToolContext,
  startTime: number
): Promise<ToolResponse> {
  const args = validateCreateChartArgs(rawArgs);

  try {
    const { sheetId, title } = await resolveSheetId(
      context.sheets,
      args.spreadsheetId,
      context.logger,
      args.sheetName,
      args.dataRange
    );

    const gridRange = parseA1Notation(args.dataRange, sheetId);
    const chartRequest = buildChartRequest(gridRange, args);

    await context.sheets.spreadsheets.batchUpdate({
      spreadsheetId: args.spreadsheetId,
      requestBody: {
        requests: [chartRequest],
      },
    });

    await context.cache.invalidate(`sheet:${args.spreadsheetId}:*`);

    context.performance.track("createChart", Date.now() - startTime);
    context.logger.info("Chart created", {
      spreadsheetId: args.spreadsheetId,
      sheetId,
      sheetTitle: title,
      dataRange: gridRange,
      chartType: args.chartType,
      anchor: args.position,
    });

    return {
      content: [
        {
          type: "text",
          text: `${args.chartType} chart created at row ${args.position.row}, column ${args.position.column}`,
        },
      ],
    };
  } catch (error) {
    context.performance.track("createChart", Date.now() - startTime, true);
    context.logger.error("createChart tool failed", {
      error,
      spreadsheetId: args.spreadsheetId,
      dataRange: args.dataRange,
    });

    throw wrapError(error, (message) =>
      message.startsWith("Failed to")
        ? message
        : `Failed to create chart from ${args.dataRange}: ${message}`
    );
  }
}

function validateMergeCellsArgs(rawArgs: unknown): MergeCellsArgs {
  if (!rawArgs || typeof rawArgs !== "object") {
    throw new Error("Arguments are required for mergeCells");
  }

  const { spreadsheetId, range, mergeType } = rawArgs as Partial<MergeCellsArgs>;

  if (typeof spreadsheetId !== "string" || spreadsheetId.trim() === "") {
    throw new Error("spreadsheetId must be a non-empty string");
  }

  if (typeof range !== "string" || range.trim() === "") {
    throw new Error("range must be provided in A1 notation");
  }

  if (mergeType && !MERGE_TYPES.has(mergeType)) {
    throw new Error(
      "mergeType must be one of MERGE_ALL, MERGE_COLUMNS, or MERGE_ROWS"
    );
  }

  const normalized: MergeCellsArgs = {
    spreadsheetId,
    range,
  };

  if (mergeType !== undefined) {
    normalized.mergeType = mergeType;
  }

  return normalized;
}

function validateDataValidationArgs(rawArgs: unknown): DataValidationArgs {
  if (!rawArgs || typeof rawArgs !== "object") {
    throw new Error("Arguments are required for setDataValidation");
  }

  const { spreadsheetId, range, validation } = rawArgs as Partial<DataValidationArgs>;

  if (typeof spreadsheetId !== "string" || spreadsheetId.trim() === "") {
    throw new Error("spreadsheetId must be a non-empty string");
  }

  if (typeof range !== "string" || range.trim() === "") {
    throw new Error("range must be provided in A1 notation");
  }

  if (!validation || typeof validation !== "object") {
    throw new Error("validation configuration is required");
  }

  const { type } = validation;
  if (type !== "LIST_OF_VALUES" && type !== "NUMBER_BETWEEN" && type !== "DATE_AFTER") {
    throw new Error(
      "validation.type must be LIST_OF_VALUES, NUMBER_BETWEEN, or DATE_AFTER"
    );
  }

  const normalizedValidation = validation;

  return {
    spreadsheetId,
    range,
    validation: normalizedValidation,
  };
}

function validateCreateChartArgs(rawArgs: unknown): CreateChartArgs {
  if (!rawArgs || typeof rawArgs !== "object") {
    throw new Error("Arguments are required for createChart");
  }

  const { spreadsheetId, sheetName, chartType, dataRange, position, title } =
    rawArgs as Partial<CreateChartArgs>;

  if (typeof spreadsheetId !== "string" || spreadsheetId.trim() === "") {
    throw new Error("spreadsheetId must be a non-empty string");
  }

  if (typeof chartType !== "string" || chartType.trim() === "") {
    throw new Error("chartType must be provided");
  }

  const normalizedChartType = chartType.toUpperCase();
  if (!CHART_TYPES.has(normalizedChartType)) {
    throw new Error(
      "chartType must be one of LINE, BAR, COLUMN, PIE, or SCATTER"
    );
  }

  if (typeof dataRange !== "string" || dataRange.trim() === "") {
    throw new Error("dataRange must be provided in A1 notation");
  }

  if (!position || typeof position !== "object") {
    throw new Error("position with row and column is required");
  }

  if (!Number.isInteger(position.row) || position.row < 0) {
    throw new Error("position.row must be a non-negative integer");
  }

  if (!Number.isInteger(position.column) || position.column < 0) {
    throw new Error("position.column must be a non-negative integer");
  }

  const normalized: CreateChartArgs = {
    spreadsheetId,
    chartType: normalizedChartType,
    dataRange,
    position,
  };

  if (sheetName !== undefined) {
    normalized.sheetName = sheetName;
  }

  if (title !== undefined) {
    normalized.title = title;
  }

  return normalized;
}

function buildDataValidationRule(
  validation: DataValidationArgs["validation"]
): sheets_v4.Schema$DataValidationRule {
  let values: Array<{ userEnteredValue: string }> | undefined;

  switch (validation.type) {
    case "LIST_OF_VALUES": {
      if (!validation.values || validation.values.length === 0) {
        throw new Error(
          "validation.values must be a non-empty array for LIST_OF_VALUES"
        );
      }
      values = validation.values.map((value) => ({
        userEnteredValue: value,
      }));
      break;
    }
    case "NUMBER_BETWEEN": {
      if (validation.min === undefined || validation.max === undefined) {
        throw new Error(
          "validation.min and validation.max are required for NUMBER_BETWEEN"
        );
      }
      values = [
        { userEnteredValue: String(validation.min) },
        { userEnteredValue: String(validation.max) },
      ];
      break;
    }
    case "DATE_AFTER": {
      if (validation.min === undefined) {
        throw new Error(
          "validation.min is required for DATE_AFTER validations"
        );
      }
      values = [{ userEnteredValue: String(validation.min) }];
      break;
    }
  }

  return {
    condition: {
      type: validation.type,
      values,
    },
    strict: validation.strict ?? true,
    showCustomUi: validation.showDropdown ?? true,
  };
}

function buildChartRequest(
  gridRange: GridRange,
  args: CreateChartArgs
): sheets_v4.Schema$Request {
  const startColumn = gridRange.startColumnIndex ?? null;
  const endColumn = gridRange.endColumnIndex ?? null;

  if (startColumn === null) {
    throw new Error("dataRange must specify a starting column");
  }

  if (endColumn === null) {
    throw new Error("dataRange must specify an ending column");
  }

  if (endColumn - startColumn < 2) {
    throw new Error("dataRange must include at least two columns for charting");
  }

  const domainRange = cloneRange(gridRange, {
    startColumnIndex: startColumn,
    endColumnIndex: startColumn + 1,
  });

  const seriesRanges: GridRange[] = [];
  for (let column = startColumn + 1; column < endColumn; column++) {
    seriesRanges.push(
      cloneRange(gridRange, {
        startColumnIndex: column,
        endColumnIndex: column + 1,
      })
    );
  }

  const domainSource: ChartSourceRange = {
    sources: [domainRange],
  };

  const seriesSources: ChartSourceRange[] = seriesRanges.map((range) => ({
    sources: [range],
  }));

  const sheetIdValue = gridRange.sheetId;
  if (sheetIdValue === undefined || sheetIdValue === null) {
    throw new Error("A sheetId is required to position the chart");
  }

  const chartTypeValue = args.chartType as Exclude<
    sheets_v4.Schema$BasicChartSpec["chartType"],
    undefined
  >;

  return {
    addChart: {
      chart: {
        spec: {
          title: args.title ?? null,
          basicChart: {
            chartType: chartTypeValue,
            domains: [
              {
                domain: {
                  sourceRange: domainSource,
                },
              },
            ],
            series: seriesSources.map((sourceRange) => ({
              series: {
                sourceRange,
              },
            })),
          },
        },
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId: sheetIdValue,
              rowIndex: args.position.row,
              columnIndex: args.position.column,
            },
          },
        },
      },
    },
  };
}

function resolveSheetId(
  sheets: SheetsClient,
  spreadsheetId: string,
  logger: LoggerLike,
  sheetName?: string,
  range?: string
): Promise<{ sheetId: number; title: string }> {
  const desiredSheetName = (sheetName ?? extractSheetName(range))?.trim();

  return sheets.spreadsheets
    .get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    })
    .then((response) => {
      const sheetsData = response.data.sheets ?? [];

      let match = sheetsData[0];
      if (desiredSheetName) {
        match = sheetsData.find(
          (sheet) => sheet.properties?.title === desiredSheetName
        );
      }

      const matchedSheetId = match?.properties?.sheetId;

      if (!match || matchedSheetId === undefined || matchedSheetId === null) {
        throw new Error(
          desiredSheetName
            ? `Sheet "${desiredSheetName}" not found`
            : "No sheets available in spreadsheet"
        );
      }

      const resolvedTitle = match?.properties?.title ?? desiredSheetName ?? "";

      return {
        sheetId: matchedSheetId,
        title: resolvedTitle,
      };
    })
    .catch((error) => {
      logger.error("Failed to resolve sheet ID", {
        error,
        spreadsheetId,
        sheetName: desiredSheetName,
      });
      throw wrapError(error, (message) =>
        `Failed to resolve sheet in spreadsheet ${spreadsheetId}${
          desiredSheetName ? ` for sheet "${desiredSheetName}"` : ""
        }: ${message}`
      );
    });
}

function extractSheetName(range?: string): string | undefined {
  if (!range) {
    return undefined;
  }

  const delimiterIndex = range.indexOf("!");
  if (delimiterIndex === -1) {
    return undefined;
  }

  const sheetPart = range.slice(0, delimiterIndex).trim();
  return unescapeSheetName(sheetPart);
}

function parseA1Notation(range: string, sheetId: number): GridRange {
  const trimmed = stripSheetPrefix(range).trim();

  if (!trimmed) {
    return { sheetId };
  }

  if (trimmed.includes(",")) {
    throw new Error(`Invalid A1 range: ${range}`);
  }

  const parts = trimmed.split(":");
  if (parts.length > 2) {
    throw new Error(`Invalid A1 range: ${range}`);
  }

  const startToken = parts[0] ?? "";
  const startRef = parseSingleReference(startToken);
  const endToken = parts[1];
  const hasEnd = parts.length === 2 && (endToken?.trim() ?? "") !== "";
  const endRef = hasEnd ? parseSingleReference(endToken ?? "") : undefined;

  const gridRange: GridRange = { sheetId };

  if (startRef.row !== undefined) {
    gridRange.startRowIndex = startRef.row;
    if (hasEnd && endRef?.row !== undefined) {
      gridRange.endRowIndex = endRef.row + 1;
    } else if (!hasEnd) {
      gridRange.endRowIndex = startRef.row + 1;
    }
  } else if (hasEnd && endRef?.row !== undefined) {
    gridRange.startRowIndex = 0;
    gridRange.endRowIndex = endRef.row + 1;
  }

  if (startRef.column !== undefined) {
    gridRange.startColumnIndex = startRef.column;
    if (hasEnd && endRef?.column !== undefined) {
      gridRange.endColumnIndex = endRef.column + 1;
    } else if (!hasEnd) {
      gridRange.endColumnIndex = startRef.column + 1;
    }
  } else if (hasEnd && endRef?.column !== undefined) {
    gridRange.startColumnIndex = 0;
    gridRange.endColumnIndex = endRef.column + 1;
  }

  return gridRange;
}

function parseSingleReference(reference: string): {
  row?: number;
  column?: number;
} {
  const normalized = reference.trim().toUpperCase();
  if (normalized === "") {
    return {};
  }

  const match = normalized.match(/^([A-Z]+)?(\d+)?$/);
  if (!match) {
    throw new Error(`Invalid A1 reference: ${reference}`);
  }

  const [, columnPart, rowPart] = match;
  const result: { row?: number; column?: number } = {};

  if (columnPart) {
    result.column = columnLabelToIndex(columnPart);
  }

  if (rowPart) {
    result.row = parseInt(rowPart, 10) - 1;
  }

  return result;
}

function columnLabelToIndex(label: string): number {
  let index = 0;
  for (const char of label) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) {
      throw new Error(`Invalid column label: ${label}`);
    }
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

function stripSheetPrefix(range: string): string {
  const delimiterIndex = range.indexOf("!");
  return delimiterIndex === -1 ? range : range.slice(delimiterIndex + 1);
}

function unescapeSheetName(name: string): string {
  if (name.startsWith("'") && name.endsWith("'")) {
    const inner = name.slice(1, -1);
    return inner.replace(/''/g, "'");
  }
  return name;
}

function cloneRange(range: GridRange, overrides: Partial<GridRange>): GridRange {
  const cloned: GridRange = {};

  if (range.sheetId !== undefined) {
    cloned.sheetId = range.sheetId;
  }
  if (range.startRowIndex !== undefined) {
    cloned.startRowIndex = range.startRowIndex;
  }
  if (range.endRowIndex !== undefined) {
    cloned.endRowIndex = range.endRowIndex;
  }
  if (range.startColumnIndex !== undefined) {
    cloned.startColumnIndex = range.startColumnIndex;
  }
  if (range.endColumnIndex !== undefined) {
    cloned.endColumnIndex = range.endColumnIndex;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      (cloned as Record<string, unknown>)[key] = value;
    }
  }

  return cloned;
}

function wrapError(
  error: unknown,
  messageBuilder: (message: string) => string
): Error {
  const message = messageBuilder(toErrorMessage(error));
  return new Error(message);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

