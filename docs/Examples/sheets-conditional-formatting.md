# Google Sheets Conditional Formatting

## Overview

Apply color-coded highlighting to Google Sheets ranges using the `addConditionalFormatting` MCP tool. This capability lets you emphasize positive and negative trends (e.g., profits vs. losses) without leaving your AI assistant.

## Prerequisites

- Authenticated Google Sheets access through the MCP server
- Spreadsheet ID for the target workbook
- A1 notation range that contains numeric or text data

## Highlight Gains and Losses

```json
{
  "name": "addConditionalFormatting",
  "arguments": {
    "spreadsheetId": "<your-spreadsheet-id>",
    "range": "P2:P24",
    "rule": {
      "condition": { "type": "NUMBER_GREATER", "values": ["0"] },
      "format": {
        "backgroundColor": { "red": 0, "green": 1, "blue": 0 }
      }
    }
  }
}
```

Use a complementary rule to surface losses in red:

```json
{
  "name": "addConditionalFormatting",
  "arguments": {
    "spreadsheetId": "<your-spreadsheet-id>",
    "range": "P2:P24",
    "rule": {
      "condition": { "type": "NUMBER_LESS", "values": ["0"] },
      "format": {
        "backgroundColor": { "red": 1, "green": 0, "blue": 0 },
        "bold": true
      }
    }
  }
}
```

## Custom Formulas

Leverage spreadsheet formulas for complex logic, such as highlighting overdue tasks:

```json
{
  "name": "addConditionalFormatting",
  "arguments": {
    "spreadsheetId": "<your-spreadsheet-id>",
    "range": "Tasks!A2:A200",
    "rule": {
      "condition": {
        "type": "CUSTOM_FORMULA",
        "formula": "=AND($C2=\"Overdue\", TODAY()-$B2>3)"
      },
      "format": {
        "foregroundColor": { "red": 0.8, "green": 0.2, "blue": 0.2 },
        "bold": true
      }
    }
  }
}
```

## Tips

- **Ranges without sheet names** default to the first worksheet in the spreadsheet.
- **Color values** use normalized RGB components between `0` and `1`.
- **Rule order**: new rules are inserted at the top of the list (index `0`) so they evaluate before existing ones.
- **Cache invalidation** is automatic—subsequent `readSheet` calls return fresh data after formatting changes.
