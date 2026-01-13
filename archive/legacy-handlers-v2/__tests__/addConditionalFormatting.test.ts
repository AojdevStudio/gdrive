import { buildConditionalFormattingRequestBody } from '../../sheets/conditional-formatting.js';

describe('buildConditionalFormattingRequestBody', () => {
  it('builds batchUpdate request for highlighting positive numbers in green', () => {
    const requestBody = buildConditionalFormattingRequestBody({
      sheetId: 42,
      range: 'P2:P24',
      rule: {
        condition: { type: 'NUMBER_GREATER', values: ['0'] },
        format: {
          backgroundColor: { red: 0, green: 1, blue: 0 },
        },
      },
    });

    expect(requestBody).toEqual({
      requests: [
        {
          addConditionalFormatRule: {
            index: 0,
            rule: {
              ranges: [
                {
                  sheetId: 42,
                  startColumnIndex: 15,
                  endColumnIndex: 16,
                  startRowIndex: 1,
                  endRowIndex: 24,
                },
              ],
              booleanRule: {
                condition: {
                  type: 'NUMBER_GREATER',
                  values: [{ userEnteredValue: '0' }],
                },
                format: {
                  backgroundColor: { red: 0, green: 1, blue: 0 },
                },
              },
            },
          },
        },
      ],
    });
  });

  it('builds batchUpdate request for highlighting negative numbers in red', () => {
    const requestBody = buildConditionalFormattingRequestBody({
      sheetId: 42,
      range: 'P2:P24',
      rule: {
        condition: { type: 'NUMBER_LESS', values: ['0'] },
        format: {
          backgroundColor: { red: 1, green: 0, blue: 0 },
          bold: true,
        },
      },
    });

    expect(requestBody).toEqual({
      requests: [
        {
          addConditionalFormatRule: {
            index: 0,
            rule: {
              ranges: [
                {
                  sheetId: 42,
                  startColumnIndex: 15,
                  endColumnIndex: 16,
                  startRowIndex: 1,
                  endRowIndex: 24,
                },
              ],
              booleanRule: {
                condition: {
                  type: 'NUMBER_LESS',
                  values: [{ userEnteredValue: '0' }],
                },
                format: {
                  backgroundColor: { red: 1, green: 0, blue: 0 },
                  textFormat: {
                    bold: true,
                  },
                },
              },
            },
          },
        },
      ],
    });
  });

  it('throws descriptive error when required condition values are missing', () => {
    expect(() =>
      buildConditionalFormattingRequestBody({
        sheetId: 42,
        range: 'P2:P24',
        rule: {
          condition: { type: 'NUMBER_GREATER' },
          format: {
            backgroundColor: { red: 0, green: 1, blue: 0 },
          },
        },
      })
    ).toThrow('Conditional format type NUMBER_GREATER requires at least one value');
  });
});
