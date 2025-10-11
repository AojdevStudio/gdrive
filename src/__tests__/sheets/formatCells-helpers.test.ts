import { describe, expect, it, afterEach } from '@jest/globals';
import {
  buildFieldMask,
  parseA1Notation,
  resetSheetHelperCaches,
  toSheetsColor,
  type CellFormat,
} from '../../sheets/helpers.js';

describe('Sheets formatting helpers', () => {
  afterEach(() => {
    resetSheetHelperCaches();
  });

  it('includes bold and italic fields when building field mask for text formatting', () => {
    const cellFormat: CellFormat = {
      textFormat: {
        bold: true,
        italic: true,
      },
    };

    const mask = buildFieldMask(cellFormat);
    const fields = mask.split(',').sort();

    expect(fields).toEqual([
      'userEnteredFormat.textFormat.bold',
      'userEnteredFormat.textFormat.italic',
    ]);
  });

  it('builds field mask for number format presets', () => {
    const cellFormat: CellFormat = {
      numberFormat: {
        type: 'CURRENCY',
        pattern: '$#,##0.00',
      },
    };

    const mask = buildFieldMask(cellFormat);

    expect(mask).toBe('userEnteredFormat.numberFormat');
  });

  it('captures combined formatting paths for text color, background color, and number format', () => {
    const cellFormat: CellFormat = {
      textFormat: {
        bold: true,
        foregroundColor: toSheetsColor({ red: 0.2, green: 0.4, blue: 0.6 }),
      },
      backgroundColor: toSheetsColor({ red: 0.95, green: 0.95, blue: 0.4 }),
      numberFormat: {
        type: 'PERCENT',
        pattern: '0.00%',
      },
    };

    const mask = buildFieldMask(cellFormat);
    const fields = mask.split(',').sort();

    expect(fields).toEqual([
      'userEnteredFormat.backgroundColor',
      'userEnteredFormat.numberFormat',
      'userEnteredFormat.textFormat.bold',
      'userEnteredFormat.textFormat.foregroundColor',
    ]);
  });

  it('converts A1 notation ranges into grid ranges with zero-based indexes', () => {
    const gridRange = parseA1Notation('B2:D5', 7);

    expect(gridRange).toEqual({
      sheetId: 7,
      startRowIndex: 1,
      endRowIndex: 5,
      startColumnIndex: 1,
      endColumnIndex: 4,
    });
  });
});
