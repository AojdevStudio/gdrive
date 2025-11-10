import type { sheets_v4 } from 'googleapis';
import type { SheetsContext } from '../types.js';

/**
 * Color definition for sheet tab
 */
export interface TabColor {
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
}

/**
 * Options for creating a new sheet
 */
export interface CreateSheetOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Name for the new sheet (optional) */
  sheetName?: string;
  /** Position index (optional) */
  index?: number;
  /** Number of rows (default: 1000) */
  rowCount?: number;
  /** Number of columns (default: 26) */
  columnCount?: number;
  /** Number of frozen rows (optional) */
  frozenRowCount?: number;
  /** Number of frozen columns (optional) */
  frozenColumnCount?: number;
  /** Tab color (optional) */
  tabColor?: TabColor;
  /** Hidden status (optional) */
  hidden?: boolean;
  /** Right-to-left layout (optional) */
  rightToLeft?: boolean;
}

/**
 * Result of creating a sheet
 */
export interface CreateSheetResult {
  sheetId: number;
  title: string;
  message: string;
}

/**
 * Create a new sheet in a spreadsheet
 *
 * @param options Sheet creation parameters
 * @param context Sheets API context
 * @returns Created sheet metadata
 *
 * @example
 * ```typescript
 * const result = await createSheet({
 *   spreadsheetId: 'abc123',
 *   sheetName: '2025 Q1 Data',
 *   rowCount: 500,
 *   columnCount: 10,
 *   frozenRowCount: 1,
 *   tabColor: { red: 0.2, green: 0.6, blue: 1, alpha: 1 }
 * }, context);
 *
 * console.log(`Created sheet ID: ${result.sheetId}`);
 * ```
 */
export async function createSheet(
  options: CreateSheetOptions,
  context: SheetsContext
): Promise<CreateSheetResult> {
  const {
    spreadsheetId,
    sheetName,
    index,
    rowCount = 1000,
    columnCount = 26,
    frozenRowCount,
    frozenColumnCount,
    tabColor,
    hidden,
    rightToLeft,
  } = options;

  const sheetProperties: sheets_v4.Schema$SheetProperties = {
    gridProperties: {
      rowCount,
      columnCount,
    },
  };

  if (sheetName) {
    sheetProperties.title = sheetName;
  }

  if (index !== undefined) {
    sheetProperties.index = index;
  }

  if (hidden !== undefined) {
    sheetProperties.hidden = hidden;
  }

  if (rightToLeft !== undefined) {
    sheetProperties.rightToLeft = rightToLeft;
  }

  if (frozenRowCount !== undefined) {
    sheetProperties.gridProperties!.frozenRowCount = frozenRowCount;
  }

  if (frozenColumnCount !== undefined) {
    sheetProperties.gridProperties!.frozenColumnCount = frozenColumnCount;
  }

  if (tabColor) {
    const validatedColor: sheets_v4.Schema$Color = {};
    for (const channel of ['red', 'green', 'blue', 'alpha'] as const) {
      const value = tabColor[channel];
      if (value !== undefined) {
        if (Number.isNaN(value) || value < 0 || value > 1) {
          throw new Error(`tabColor.${channel} must be between 0 and 1`);
        }
        validatedColor[channel] = value;
      }
    }

    if (Object.keys(validatedColor).length > 0) {
      sheetProperties.tabColor = validatedColor;
    }
  }

  const response = await context.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: sheetProperties,
        },
      }],
    },
  });

  const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
  const newSheetTitle = response.data.replies?.[0]?.addSheet?.properties?.title ?? sheetName ?? 'Untitled Sheet';

  if (typeof newSheetId !== 'number') {
    throw new Error('Failed to get sheet ID from response');
  }

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

  context.performanceMonitor.track('sheets:create', Date.now() - context.startTime);
  context.logger.info('Sheet created', {
    spreadsheetId,
    sheetId: newSheetId,
    title: newSheetTitle,
  });

  return {
    sheetId: newSheetId,
    title: newSheetTitle,
    message: `Successfully created sheet "${newSheetTitle}" with ID ${newSheetId}`,
  };
}

/**
 * Options for renaming a sheet
 */
export interface RenameSheetOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Sheet ID or sheet name to identify the sheet */
  sheetId?: number;
  /** Sheet name (alternative to sheetId) */
  sheetName?: string;
  /** New name for the sheet */
  newName: string;
}

/**
 * Result of renaming a sheet
 */
export interface RenameSheetResult {
  sheetId: number;
  oldName?: string | undefined;
  newName: string;
  message: string;
}

/**
 * Rename an existing sheet
 *
 * @param options Rename parameters (requires sheetId or sheetName + newName)
 * @param context Sheets API context
 * @returns Rename confirmation
 *
 * @example
 * ```typescript
 * const result = await renameSheet({
 *   spreadsheetId: 'abc123',
 *   sheetName: 'Sheet1',
 *   newName: '2025 Q1 Sales'
 * }, context);
 * ```
 */
export async function renameSheet(
  options: RenameSheetOptions,
  context: SheetsContext
): Promise<RenameSheetResult> {
  const { spreadsheetId, sheetId, sheetName, newName } = options;

  // Resolve sheet ID (simplified - full implementation would use helper)
  let resolvedSheetId: number;

  if (typeof sheetId === 'number') {
    resolvedSheetId = sheetId;
  } else if (sheetName) {
    // Fetch sheet metadata to get ID
    const response = await context.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))',
    });

    const match = response.data.sheets?.find(s => s.properties?.title === sheetName);
    if (!match || typeof match.properties?.sheetId !== 'number') {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    resolvedSheetId = match.properties.sheetId;
  } else {
    throw new Error('Either sheetId or sheetName is required');
  }

  await context.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: resolvedSheetId,
            title: newName,
          },
          fields: 'title',
        },
      }],
    },
  });

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

  context.performanceMonitor.track('sheets:rename', Date.now() - context.startTime);
  context.logger.info('Sheet renamed', {
    spreadsheetId,
    sheetId: resolvedSheetId,
    oldName: sheetName,
    newName,
  });

  return {
    sheetId: resolvedSheetId,
    oldName: sheetName || undefined,
    newName,
    message: `Successfully renamed sheet to "${newName}"`,
  };
}

/**
 * Options for deleting a sheet
 */
export interface DeleteSheetOptions {
  /** Spreadsheet ID */
  spreadsheetId: string;
  /** Sheet ID or sheet name to identify the sheet */
  sheetId?: number;
  /** Sheet name (alternative to sheetId) */
  sheetName?: string;
}

/**
 * Result of deleting a sheet
 */
export interface DeleteSheetResult {
  sheetId: number;
  title?: string | undefined;
  message: string;
}

/**
 * Delete a sheet from a spreadsheet
 *
 * @param options Delete parameters (requires sheetId or sheetName)
 * @param context Sheets API context
 * @returns Delete confirmation
 *
 * @example
 * ```typescript
 * const result = await deleteSheet({
 *   spreadsheetId: 'abc123',
 *   sheetName: 'Old Data'
 * }, context);
 * ```
 */
export async function deleteSheet(
  options: DeleteSheetOptions,
  context: SheetsContext
): Promise<DeleteSheetResult> {
  const { spreadsheetId, sheetId, sheetName } = options;

  // Resolve sheet ID (simplified - full implementation would use helper)
  let resolvedSheetId: number;
  let resolvedTitle: string | undefined;

  if (typeof sheetId === 'number') {
    resolvedSheetId = sheetId;
    resolvedTitle = sheetName;
  } else if (sheetName) {
    // Fetch sheet metadata to get ID
    const response = await context.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))',
    });

    const match = response.data.sheets?.find(s => s.properties?.title === sheetName);
    if (!match || typeof match.properties?.sheetId !== 'number') {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    resolvedSheetId = match.properties.sheetId;
    resolvedTitle = match.properties.title || undefined;
  } else {
    throw new Error('Either sheetId or sheetName is required');
  }

  await context.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteSheet: {
          sheetId: resolvedSheetId,
        },
      }],
    },
  });

  // Invalidate cache
  await context.cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

  context.performanceMonitor.track('sheets:delete', Date.now() - context.startTime);
  context.logger.info('Sheet deleted', {
    spreadsheetId,
    sheetId: resolvedSheetId,
    title: resolvedTitle,
  });

  return {
    sheetId: resolvedSheetId,
    title: resolvedTitle || undefined,
    message: `Successfully deleted sheet "${resolvedTitle || resolvedSheetId}"`,
  };
}
