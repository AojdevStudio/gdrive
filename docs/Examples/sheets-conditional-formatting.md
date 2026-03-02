# Google Sheets Conditional Formatting

## Overview

Apply color-coded highlighting to Google Sheets ranges using `sdk.sheets.addConditionalFormat()` inside the `execute` tool. This lets you emphasize positive and negative trends (e.g., profits vs. losses) without leaving your AI assistant.

## v4 Architecture

1. **Discover** the operation (optional): `search` with `service: "sheets"`, `operation: "addConditionalFormat"`
2. **Execute** code that calls `sdk.sheets.addConditionalFormat()` with the desired rule

## Prerequisites

- Authenticated Google Sheets access through the MCP server
- Spreadsheet ID for the target workbook
- A1 notation range (e.g., `Sheet1!P2:P24` or `P2:P24`)

## Highlight Gains and Losses

**Execute payload — gains in green:**

```json
{
  "name": "execute",
  "arguments": {
    "code": "await sdk.sheets.addConditionalFormat({ spreadsheetId: '<your-spreadsheet-id>', range: 'P2:P24', rule: { condition: { type: 'NUMBER_GREATER', values: ['0'] }, format: { backgroundColor: { red: 0, green: 1, blue: 0 } } }); return 'Conditional format applied';"
  }
}
```

**Execute payload — losses in red:**

```json
{
  "name": "execute",
  "arguments": {
    "code": "await sdk.sheets.addConditionalFormat({ spreadsheetId: '<your-spreadsheet-id>', range: 'P2:P24', rule: { condition: { type: 'NUMBER_LESS', values: ['0'] }, format: { backgroundColor: { red: 1, green: 0, blue: 0 }, bold: true } } }); return 'Conditional format applied';"
  }
}
```

## Custom Formulas

Use spreadsheet formulas for complex logic, such as highlighting overdue tasks:

```json
{
  "name": "execute",
  "arguments": {
    "code": "await sdk.sheets.addConditionalFormat({ spreadsheetId: '<your-spreadsheet-id>', range: 'Tasks!A2:A200', rule: { condition: { type: 'CUSTOM_FORMULA', formula: '=AND($C2=\"Overdue\", TODAY()-$B2>3)' }, format: { foregroundColor: { red: 0.8, green: 0.2, blue: 0.2 }, bold: true } } }); return 'Conditional format applied';"
  }
}
```

## Rule Structure Reference

| Field | Description |
|-------|-------------|
| `spreadsheetId` | Google Sheets ID (from the URL) |
| `range` | A1 notation, e.g. `Sheet1!B2:B100` or `P2:P24` |
| `rule.condition.type` | `NUMBER_GREATER`, `NUMBER_LESS`, `TEXT_CONTAINS`, or `CUSTOM_FORMULA` |
| `rule.condition.values` | Array of strings for numeric/text conditions (e.g. `["0"]`, `["90"]`) |
| `rule.condition.formula` | Formula string for `CUSTOM_FORMULA` (e.g. `"=A1>100"`) |
| `rule.format.backgroundColor` | `{ red, green, blue }` (0–1) |
| `rule.format.foregroundColor` | `{ red, green, blue }` (0–1) |
| `rule.format.bold` | `true` or `false` |

## Tips

- **Ranges without sheet names** default to the first worksheet.
- **Color values** use normalized RGB components between `0` and `1`.
- **Rule order**: new rules are inserted at the top (index `0`) and evaluate before existing ones.
- **Cache invalidation** is automatic—subsequent `readSheet` calls return fresh data after formatting changes.

---

**Next Steps**: Use `sdk.sheets.readSheet()` to read data, or `sdk.drive.search()` to find spreadsheets by name.
