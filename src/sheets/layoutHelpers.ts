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

export const createColumnWidthRequests = (
  sheetId: number,
  columns: ColumnWidthConfig[],
): sheets_v4.Schema$Request[] => {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('At least one column definition is required');
  }

  return columns.map((column, index) => {
    if (column == null || typeof column !== 'object') {
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

  if (!match || match.properties?.sheetId === undefined || match.properties.sheetId === null) {
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
