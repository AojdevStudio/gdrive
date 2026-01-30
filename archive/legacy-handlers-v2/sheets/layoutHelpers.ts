import type { sheets_v4 } from 'googleapis';

export interface ResolveSheetDetailsOptions {
  sheetsClient: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName?: string;
}

export interface SheetDetails {
  sheetId: number;
  title: string;
}

export interface ColumnWidthConfig {
  columnIndex: number;
  width?: number;
  span?: number;
}

/**
 * Builds a column dimension range for Google Sheets API.
 *
 * @param sheetId - The sheet ID within the spreadsheet
 * @param columnIndex - Zero-based column index (A=0, B=1, etc.)
 * @param span - Number of columns to include (default: 1)
 * @returns DimensionRange object for the Sheets API
 * @throws Error if parameters are invalid
 *
 * @example
 * buildColumnDimensionRange(0, 2, 3) // Columns C, D, E on sheet 0
 */
export const buildColumnDimensionRange = (
  sheetId: number,
  columnIndex: number,
  span = 1,
): sheets_v4.Schema$DimensionRange => {
  if (!Number.isInteger(sheetId)) {
    throw new Error('sheetId must be an integer');
  }
  if (!Number.isInteger(columnIndex) || columnIndex < 0) {
    throw new Error('columnIndex must be a non-negative integer');
  }
  if (!Number.isInteger(span) || span <= 0) {
    throw new Error('span must be a positive integer');
  }

  return {
    sheetId,
    dimension: 'COLUMNS',
    startIndex: columnIndex,
    endIndex: columnIndex + span,
  };
};

/**
 * Creates a freeze request for rows and columns in a sheet.
 *
 * Frozen rows/columns remain visible when scrolling.
 *
 * @param sheetId - The sheet ID within the spreadsheet
 * @param frozenRowCount - Number of rows to freeze from the top
 * @param frozenColumnCount - Number of columns to freeze from the left
 * @returns Request object for batchUpdate
 * @throws Error if counts are negative
 *
 * @example
 * createFreezeRequest(0, 1, 2) // Freeze 1 row and 2 columns
 */
export const createFreezeRequest = (
  sheetId: number,
  frozenRowCount: number,
  frozenColumnCount: number,
): sheets_v4.Schema$Request => {
  if (!Number.isInteger(frozenRowCount) || frozenRowCount < 0) {
    throw new Error('frozenRowCount must be a non-negative integer');
  }
  if (!Number.isInteger(frozenColumnCount) || frozenColumnCount < 0) {
    throw new Error('frozenColumnCount must be a non-negative integer');
  }

  return {
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: {
          frozenRowCount,
          frozenColumnCount,
        },
      },
      fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
    },
  };
};

/**
 * Creates batch requests for setting column widths.
 *
 * Allows setting multiple column widths in a single API call.
 *
 * @param sheetId - The sheet ID within the spreadsheet
 * @param columns - Array of column configurations with index, width, and optional span
 * @returns Array of Request objects for batchUpdate
 * @throws Error if column configurations are invalid
 *
 * @example
 * createColumnWidthRequests(0, [
 *   { columnIndex: 0, width: 150 },      // Column A: 150px
 *   { columnIndex: 2, width: 200, span: 2 } // Columns C-D: 200px each
 * ])
 */
export const createColumnWidthRequests = (
  sheetId: number,
  columns: ColumnWidthConfig[],
): sheets_v4.Schema$Request[] => {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('At least one column definition is required');
  }

  return columns.map((column, index) => {
    if (column === null || column === undefined || typeof column !== 'object') {
      throw new Error(`Column definition at index ${index} must be an object`);
    }

    const { columnIndex, width, span } = column;

    if (!Number.isInteger(columnIndex) || columnIndex < 0) {
      throw new Error(`columnIndex must be a non-negative integer (index ${index})`);
    }

    if (width !== undefined && (typeof width !== 'number' || Number.isNaN(width) || width <= 0)) {
      throw new Error(`width must be a positive number when provided (index ${index})`);
    }

    if (span !== undefined && (!Number.isInteger(span) || span <= 0)) {
      throw new Error(`span must be a positive integer when provided (index ${index})`);
    }

    const pixelSize = width ?? 100;
    const range = buildColumnDimensionRange(sheetId, columnIndex, span ?? 1);

    return {
      updateDimensionProperties: {
        range,
        properties: {
          pixelSize,
        },
        fields: 'pixelSize',
      },
    };
  });
};

/**
 * Resolves sheet details from spreadsheet ID and optional sheet name.
 *
 * If no sheet name is provided, returns the first sheet.
 * Similar to resolveSheetMetadata but optimized for layout operations.
 *
 * @param options - Configuration object with sheetsClient, spreadsheetId, and optional sheetName
 * @returns Promise resolving to SheetDetails with sheetId and title
 * @throws Error if sheet not found or spreadsheet has no sheets
 *
 * @example
 * const details = await resolveSheetDetails({
 *   sheetsClient: sheets,
 *   spreadsheetId: 'abc123',
 *   sheetName: 'Budget'
 * });
 * // Returns: { sheetId: 42, title: 'Budget' }
 */
export const resolveSheetDetails = async ({
  sheetsClient,
  spreadsheetId,
  sheetName,
}: ResolveSheetDetailsOptions): Promise<SheetDetails> => {
  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });

  const sheetList = response.data.sheets ?? [];
  if (sheetList.length === 0) {
    throw new Error(`No sheets found in spreadsheet ${spreadsheetId}`);
  }

  const match = sheetName
    ? sheetList.find((sheet) => sheet.properties?.title === sheetName)
    : sheetList[0];

  if (match?.properties?.sheetId === undefined || match.properties.sheetId === null) {
    if (sheetName) {
      throw new Error(`Sheet "${sheetName}" not found in spreadsheet ${spreadsheetId}`);
    }
    throw new Error(`Unable to resolve sheet in spreadsheet ${spreadsheetId}`);
  }

  const sheetId = match.properties.sheetId;
  const title = match.properties.title ?? sheetName ?? `Sheet${match.properties.index ?? ''}`;

  return {
    sheetId,
    title,
  };
};
