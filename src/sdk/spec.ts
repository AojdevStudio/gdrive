/**
 * Static SDK spec for the search() tool.
 * Contains metadata for all 47 Google Workspace operations across 6 services.
 * Agent code queries this object to discover available operations before calling execute().
 *
 * Usage in search() tool:
 *   return spec.drive           // list all drive operations
 *   return Object.keys(spec)    // list all services
 *   return spec.sheets.readSheet  // get details for one operation
 */

export interface OperationSpec {
  signature: string;
  description: string;
  example: string;
  params: Record<string, string>;
  returns: string;
}

export type SDKSpec = {
  drive: Record<string, OperationSpec>;
  sheets: Record<string, OperationSpec>;
  forms: Record<string, OperationSpec>;
  docs: Record<string, OperationSpec>;
  gmail: Record<string, OperationSpec>;
  calendar: Record<string, OperationSpec>;
};

export const SDK_SPEC: SDKSpec = {
  // ─────────────────────────────────────────
  // Drive (7 operations)
  // ─────────────────────────────────────────
  drive: {
    search: {
      signature: "search(options: { query: string, pageSize?: number }): Promise<{ query: string, totalResults: number, files: DriveFile[] }>",
      description: "Search Google Drive files by name. The query searches file names (not content). Returns file metadata including IDs needed for read().",
      example: "const results = await sdk.drive.search({ query: 'Q3 report', pageSize: 20 });\nreturn results.files.map(f => ({ id: f.id, name: f.name }));",
      params: {
        query: "string (required) — search term matched against file names",
        pageSize: "number (optional, default 10, max 100) — maximum results to return",
      },
      returns: "{ query: string, totalResults: number, files: DriveFile[] } where DriveFile = { id, name, mimeType, createdTime, modifiedTime, webViewLink? }",
    },
    enhancedSearch: {
      signature: "enhancedSearch(options: EnhancedSearchOptions): Promise<{ query: string, totalResults: number, files: EnhancedDriveFile[], filters: object }>",
      description: "Advanced Drive search with filters for file type, owner, date ranges, and sorting. Use when basic search() isn't precise enough.",
      example: "const results = await sdk.drive.enhancedSearch({\n  query: 'budget',\n  fileType: 'spreadsheet',\n  modifiedAfter: '2024-01-01',\n  pageSize: 10\n});\nreturn results.files;",
      params: {
        query: "string (required) — search term",
        fileType: "string (optional) — 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'folder' | 'image' | 'video'",
        owner: "string (optional) — filter by owner email",
        modifiedAfter: "string (optional) — ISO 8601 date, e.g. '2024-01-01'",
        modifiedBefore: "string (optional) — ISO 8601 date",
        sharedWithMe: "boolean (optional) — only return files shared with me",
        orderBy: "string (optional) — 'modifiedTime' | 'createdTime' | 'name' | 'recency'",
        pageSize: "number (optional, default 10, max 100)",
        pageToken: "string (optional) — pagination token from previous result",
      },
      returns: "{ query, totalResults, files: EnhancedDriveFile[], filters } — EnhancedDriveFile includes size, shared, owners, parents",
    },
    read: {
      signature: "read(options: { fileId: string }): Promise<{ fileId: string, name: string, mimeType: string, content: string }>",
      description: "Read file content. Auto-exports Google Docs→Markdown, Sheets→CSV, Presentations→plain text. Binary files return base64.",
      example: "const file = await sdk.drive.read({ fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' });\nreturn file.content;",
      params: {
        fileId: "string (required) — Google Drive file ID (get from search results)",
      },
      returns: "{ fileId, name, mimeType, content: string } — content is text for docs/sheets/slides, base64 for binary",
    },
    createFile: {
      signature: "createFile(options: { name: string, content?: string, mimeType?: string, parentId?: string }): Promise<{ fileId: string, name: string, mimeType: string, webViewLink: string }>",
      description: "Create a new file in Google Drive. Use mimeType to create Google Docs/Sheets. Defaults to plain text.",
      example: "const file = await sdk.drive.createFile({\n  name: 'Meeting Notes.gdoc',\n  content: '# Meeting Notes\\n\\nDate: 2024-01-15',\n  mimeType: 'application/vnd.google-apps.document'\n});\nreturn file.webViewLink;",
      params: {
        name: "string (required) — file name",
        content: "string (optional) — initial content",
        mimeType: "string (optional, default 'text/plain') — 'application/vnd.google-apps.document' | 'application/vnd.google-apps.spreadsheet' | 'text/plain'",
        parentId: "string (optional) — folder ID to create file in",
      },
      returns: "{ fileId, name, mimeType, webViewLink }",
    },
    createFolder: {
      signature: "createFolder(options: { name: string, parentId?: string }): Promise<{ folderId: string, name: string, webViewLink: string }>",
      description: "Create a new folder in Google Drive.",
      example: "const folder = await sdk.drive.createFolder({ name: '2024 Projects' });\nreturn folder.folderId;",
      params: {
        name: "string (required) — folder name",
        parentId: "string (optional) — parent folder ID",
      },
      returns: "{ folderId, name, webViewLink }",
    },
    updateFile: {
      signature: "updateFile(options: { fileId: string, name?: string, content?: string, addParents?: string, removeParents?: string }): Promise<{ fileId: string, name: string, modifiedTime: string }>",
      description: "Update a file's name, content, or move it between folders.",
      example: "await sdk.drive.updateFile({\n  fileId: 'abc123',\n  content: 'Updated content here'\n});",
      params: {
        fileId: "string (required) — file ID to update",
        name: "string (optional) — new file name",
        content: "string (optional) — new file content (replaces existing)",
        addParents: "string (optional) — comma-separated folder IDs to add",
        removeParents: "string (optional) — comma-separated folder IDs to remove",
      },
      returns: "{ fileId, name, modifiedTime }",
    },
    batchOperations: {
      signature: "batchOperations(options: { operations: BatchOperation[] }): Promise<{ summary: object, results: BatchOperationResult[] }>",
      description: "Execute multiple Drive operations in one call. Operations: create, update, delete, move files.",
      example: "const results = await sdk.drive.batchOperations({\n  operations: [\n    { type: 'create', name: 'file1.txt', content: 'hello' },\n    { type: 'delete', fileId: 'oldFileId123' }\n  ]\n});",
      params: {
        "operations": "BatchOperation[] — array of operations, each with type: 'create' | 'update' | 'delete' | 'move'",
      },
      returns: "{ summary: { total, succeeded, failed }, results: BatchOperationResult[] }",
    },
  },

  // ─────────────────────────────────────────
  // Sheets (12 operations)
  // ─────────────────────────────────────────
  sheets: {
    listSheets: {
      signature: "listSheets(options: { spreadsheetId: string }): Promise<{ spreadsheetId: string, title: string, sheets: SheetInfo[] }>",
      description: "List all sheets (tabs) in a spreadsheet.",
      example: "const info = await sdk.sheets.listSheets({ spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' });\nreturn info.sheets.map(s => s.title);",
      params: {
        spreadsheetId: "string (required) — Google Sheets ID (from Drive URL)",
      },
      returns: "{ spreadsheetId, title, sheets: SheetInfo[] } — SheetInfo = { sheetId, title, index, rowCount, columnCount }",
    },
    readSheet: {
      signature: "readSheet(options: { spreadsheetId: string, range?: string, sheetName?: string }): Promise<{ spreadsheetId, range, values: string[][], rowCount, columnCount }>",
      description: "Read cell values from a sheet. Returns 2D array of string values.",
      example: "const data = await sdk.sheets.readSheet({\n  spreadsheetId: '1BxiMVs0XRA5...',\n  range: 'Sheet1!A1:D20'\n});\n// data.values is string[][]\nconst headers = data.values[0];\nreturn headers;",
      params: {
        spreadsheetId: "string (required) — spreadsheet ID",
        range: "string (optional, default 'A1:Z1000') — A1 notation range, e.g. 'Sheet1!A1:D10'",
        sheetName: "string (optional) — sheet tab name; alternative to including it in range",
      },
      returns: "{ spreadsheetId, range, values: string[][], rowCount, columnCount }",
    },
    createSheet: {
      signature: "createSheet(options: { spreadsheetId: string, title: string, index?: number }): Promise<{ spreadsheetId, sheetId, title, index }>",
      description: "Add a new sheet (tab) to an existing spreadsheet.",
      example: "await sdk.sheets.createSheet({ spreadsheetId: '1BxiMVs0XRA5...', title: 'Q4 Data' });",
      params: {
        spreadsheetId: "string (required)",
        title: "string (required) — new sheet name",
        index: "number (optional) — position (0-based); defaults to last",
      },
      returns: "{ spreadsheetId, sheetId, title, index }",
    },
    renameSheet: {
      signature: "renameSheet(options: { spreadsheetId: string, sheetId: number, newTitle: string }): Promise<{ spreadsheetId, sheetId, oldTitle, newTitle }>",
      description: "Rename a sheet tab.",
      example: "await sdk.sheets.renameSheet({ spreadsheetId: '...', sheetId: 0, newTitle: 'Summary' });",
      params: {
        spreadsheetId: "string (required)",
        sheetId: "number (required) — numeric sheet ID (from listSheets result)",
        newTitle: "string (required) — new tab name",
      },
      returns: "{ spreadsheetId, sheetId, oldTitle, newTitle }",
    },
    deleteSheet: {
      signature: "deleteSheet(options: { spreadsheetId: string, sheetId: number }): Promise<{ spreadsheetId, sheetId, message: string }>",
      description: "Delete a sheet tab from a spreadsheet.",
      example: "await sdk.sheets.deleteSheet({ spreadsheetId: '...', sheetId: 1234567890 });",
      params: {
        spreadsheetId: "string (required)",
        sheetId: "number (required) — numeric sheet ID to delete",
      },
      returns: "{ spreadsheetId, sheetId, message }",
    },
    updateCells: {
      signature: "updateCells(options: { spreadsheetId: string, range: string, values: string[][] }): Promise<{ spreadsheetId, updatedRange, updatedRows, updatedColumns, updatedCells }>",
      description: "Write values to a range of cells. Overwrites existing values.",
      example: "await sdk.sheets.updateCells({\n  spreadsheetId: '1BxiMVs0XRA5...',\n  range: 'Sheet1!A1:C3',\n  values: [['Name', 'Score', 'Grade'], ['Alice', '95', 'A'], ['Bob', '82', 'B']]\n});",
      params: {
        spreadsheetId: "string (required)",
        range: "string (required) — A1 notation, e.g. 'Sheet1!A1:C10'",
        "values": "string[][] (required) — 2D array of cell values",
      },
      returns: "{ spreadsheetId, updatedRange, updatedRows, updatedColumns, updatedCells }",
    },
    updateFormula: {
      signature: "updateFormula(options: { spreadsheetId: string, range: string, formula: string }): Promise<{ spreadsheetId, updatedRange, formula }>",
      description: "Write a formula to a cell or range.",
      example: "await sdk.sheets.updateFormula({\n  spreadsheetId: '...',\n  range: 'Sheet1!E2',\n  formula: '=SUM(B2:D2)'\n});",
      params: {
        spreadsheetId: "string (required)",
        range: "string (required) — target cell or range",
        formula: "string (required) — formula string starting with '='",
      },
      returns: "{ spreadsheetId, updatedRange, formula }",
    },
    formatCells: {
      signature: "formatCells(options: { spreadsheetId: string, range: string, format: CellFormatOptions }): Promise<{ spreadsheetId, formattedRange }>",
      description: "Apply formatting (bold, colors, borders, number formats) to cells.",
      example: "await sdk.sheets.formatCells({\n  spreadsheetId: '...',\n  range: 'Sheet1!A1:Z1',\n  format: { bold: true, backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 } }\n});",
      params: {
        spreadsheetId: "string (required)",
        range: "string (required) — A1 notation range",
        "format": "CellFormatOptions — { bold?, italic?, fontSize?, foregroundColor?, backgroundColor?, horizontalAlignment?, numberFormat? }",
      },
      returns: "{ spreadsheetId, formattedRange }",
    },
    addConditionalFormat: {
      signature: "addConditionalFormat(options: { spreadsheetId: string, range: string, rule: ConditionalFormatRule }): Promise<{ spreadsheetId, ruleIndex }>",
      description: "Add a conditional formatting rule to highlight cells based on conditions.",
      example: "await sdk.sheets.addConditionalFormat({\n  spreadsheetId: '...',\n  range: 'Sheet1!B2:B100',\n  rule: { type: 'NUMBER_GREATER', value: '90', format: { backgroundColor: { red: 0.7, green: 1, blue: 0.7 } } }\n});",
      params: {
        spreadsheetId: "string (required)",
        range: "string (required) — range to apply rule",
        "rule": "ConditionalFormatRule — { type: 'NUMBER_GREATER' | 'NUMBER_LESS' | 'TEXT_CONTAINS' | 'CUSTOM_FORMULA', value?: string, formula?: string, format: CellFormatOptions }",
      },
      returns: "{ spreadsheetId, ruleIndex }",
    },
    freezeRowsColumns: {
      signature: "freezeRowsColumns(options: { spreadsheetId: string, sheetId: number, frozenRowCount?: number, frozenColumnCount?: number }): Promise<{ spreadsheetId, sheetId, frozenRowCount, frozenColumnCount }>",
      description: "Freeze rows and/or columns so they stay visible when scrolling.",
      example: "await sdk.sheets.freezeRowsColumns({ spreadsheetId: '...', sheetId: 0, frozenRowCount: 1 }); // freeze header row",
      params: {
        spreadsheetId: "string (required)",
        sheetId: "number (required) — numeric sheet ID",
        frozenRowCount: "number (optional, default 0) — rows to freeze from top",
        frozenColumnCount: "number (optional, default 0) — columns to freeze from left",
      },
      returns: "{ spreadsheetId, sheetId, frozenRowCount, frozenColumnCount }",
    },
    setColumnWidth: {
      signature: "setColumnWidth(options: { spreadsheetId: string, sheetId: number, columns: ColumnWidthConfig[] }): Promise<{ spreadsheetId, sheetId, updatedColumns }>",
      description: "Set the width of one or more columns.",
      example: "await sdk.sheets.setColumnWidth({\n  spreadsheetId: '...',\n  sheetId: 0,\n  columns: [{ startIndex: 0, endIndex: 1, width: 200 }, { startIndex: 1, endIndex: 3, width: 120 }]\n});",
      params: {
        spreadsheetId: "string (required)",
        sheetId: "number (required)",
        "columns": "ColumnWidthConfig[] — [{ startIndex: number, endIndex: number, width: number }]",
      },
      returns: "{ spreadsheetId, sheetId, updatedColumns }",
    },
    appendRows: {
      signature: "appendRows(options: { spreadsheetId: string, range: string, values: string[][] }): Promise<{ spreadsheetId, tableRange, updatedRange, updatedRows }>",
      description: "Append rows after the last row with data in the sheet. Useful for logging or adding records.",
      example: "await sdk.sheets.appendRows({\n  spreadsheetId: '...',\n  range: 'Sheet1!A:C',\n  values: [['2024-01-15', 'New entry', '42']]\n});",
      params: {
        spreadsheetId: "string (required)",
        range: "string (required) — range to detect last row (e.g. 'Sheet1!A:Z')",
        "values": "string[][] (required) — rows to append",
      },
      returns: "{ spreadsheetId, tableRange, updatedRange, updatedRows }",
    },
    readAsRecords: {
      signature: "readAsRecords(options: { spreadsheetId: string, range: string, sheetName?: string }): Promise<{ records: Record<string, unknown>[], count: number, columns: string[] }>",
      description: "Read a Sheet range as an array of keyed objects. First row is treated as header row (keys). Each subsequent row becomes an object with header names as keys. Sparse rows map missing values to null.",
      example: "const { records } = await sdk.sheets.readAsRecords({ spreadsheetId: 'abc123', range: 'Contacts!A:G' });\nrecords.forEach(r => console.log(r.name, r.email));",
      params: {
        spreadsheetId: "string (required) — Google Sheets spreadsheet ID",
        range: "string (required) — A1 notation range (e.g., 'Contacts!A:G')",
        sheetName: "string (optional) — sheet name if not in range",
      },
      returns: "{ records: Record<string, unknown>[], count: number, columns: string[] }",
    },
    updateRecords: {
      signature: "updateRecords(options: { spreadsheetId: string, range: string, keyColumn: string, updates: Array<{ key: string, values: Record<string, unknown> }>, sheetName?: string }): Promise<{ updated: number, notFound: string[], message: string }>",
      description: "Update cells in a Sheet by matching a key column. Reads the sheet, finds rows where keyColumn matches each update's key, and writes the specified column values. Continues through all updates even if some keys aren't found.",
      example: "const result = await sdk.sheets.updateRecords({\n  spreadsheetId: 'abc123',\n  range: 'Contacts!A:G',\n  keyColumn: 'email',\n  updates: [\n    { key: 'alice@example.com', values: { status: 'sent', sentAt: '2024-01-15' } },\n    { key: 'bob@example.com', values: { status: 'sent', sentAt: '2024-01-15' } },\n  ],\n});\nconsole.log(`Updated: ${result.updated}, Not found: ${result.notFound}`);",
      params: {
        spreadsheetId: "string (required) — Google Sheets spreadsheet ID",
        range: "string (required) — A1 notation range covering all columns (e.g., 'Contacts!A:G')",
        keyColumn: "string (required) — header name of the column to match against",
        updates: "Array<{ key: string, values: Record<string, unknown> }> (required) — array of updates with key to match and column values to set",
        sheetName: "string (optional) — sheet name if not in range",
      },
      returns: "{ updated: number, notFound: string[], message: string }",
    },
  },

  // ─────────────────────────────────────────
  // Forms (4 operations)
  // ─────────────────────────────────────────
  forms: {
    createForm: {
      signature: "createForm(options: { title: string, description?: string }): Promise<{ formId: string, title: string, responderUri: string, editUri: string }>",
      description: "Create a new Google Form.",
      example: "const form = await sdk.forms.createForm({\n  title: 'Team Feedback Survey',\n  description: 'Please share your feedback'\n});\nreturn form.responderUri;",
      params: {
        title: "string (required) — form title",
        description: "string (optional) — form description",
      },
      returns: "{ formId, title, responderUri (shareable link), editUri (editor link) }",
    },
    readForm: {
      signature: "readForm(options: { formId: string }): Promise<{ formId, title, description, questions: Question[], responderUri, editUri }>",
      description: "Read form structure including all questions.",
      example: "const form = await sdk.forms.readForm({ formId: '1FAIpQLSf...' });\nreturn form.questions.map(q => q.title);",
      params: {
        formId: "string (required) — Google Form ID",
      },
      returns: "{ formId, title, description, questions: Question[], responderUri, editUri }",
    },
    addQuestion: {
      signature: "addQuestion(options: { formId: string, question: QuestionSpec }): Promise<{ formId, questionId, title, type }>",
      description: "Add a question to an existing form.",
      example: "await sdk.forms.addQuestion({\n  formId: '1FAIpQLSf...',\n  question: {\n    title: 'Rate your experience',\n    type: 'SCALE',\n    required: true,\n    scaleMin: 1, scaleMax: 5\n  }\n});",
      params: {
        formId: "string (required)",
        "question": "QuestionSpec — { title: string, type: 'SHORT_ANSWER' | 'PARAGRAPH' | 'MULTIPLE_CHOICE' | 'CHECKBOX' | 'DROPDOWN' | 'SCALE' | 'DATE' | 'TIME', required?: boolean, options?: string[], scaleMin?: number, scaleMax?: number }",
      },
      returns: "{ formId, questionId, title, type }",
    },
    listResponses: {
      signature: "listResponses(options: { formId: string, pageSize?: number, pageToken?: string }): Promise<{ formId, totalResponses, responses: FormResponse[] }>",
      description: "List form responses.",
      example: "const result = await sdk.forms.listResponses({ formId: '1FAIpQLSf...', pageSize: 50 });\nreturn result.responses;",
      params: {
        formId: "string (required)",
        pageSize: "number (optional, default 10) — responses per page",
        pageToken: "string (optional) — pagination token",
      },
      returns: "{ formId, totalResponses, responses: FormResponse[] } — FormResponse = { responseId, createTime, lastSubmittedTime, answers: Record<questionId, answer> }",
    },
  },

  // ─────────────────────────────────────────
  // Docs (5 operations)
  // ─────────────────────────────────────────
  docs: {
    createDocument: {
      signature: "createDocument(options: { title: string }): Promise<{ documentId: string, title: string, revisionId: string }>",
      description: "Create a new Google Doc.",
      example: "const doc = await sdk.docs.createDocument({ title: 'Project Proposal' });\nreturn doc.documentId;",
      params: {
        title: "string (required) — document title",
      },
      returns: "{ documentId, title, revisionId }",
    },
    insertText: {
      signature: "insertText(options: { documentId: string, text: string, index?: number }): Promise<{ documentId, insertedAt, textLength }>",
      description: "Insert text into a document at a specific position.",
      example: "await sdk.docs.insertText({\n  documentId: 'abc123',\n  text: '\\n## Introduction\\n\\nThis document covers...',\n  index: 1\n});",
      params: {
        documentId: "string (required)",
        text: "string (required) — text to insert",
        index: "number (optional, default 1) — document position to insert at",
      },
      returns: "{ documentId, insertedAt, textLength }",
    },
    replaceText: {
      signature: "replaceText(options: { documentId: string, searchText: string, replaceText: string, matchCase?: boolean }): Promise<{ documentId, replacements: number, searchText, replaceText }>",
      description: "Find and replace text throughout a document.",
      example: "const result = await sdk.docs.replaceText({\n  documentId: 'abc123',\n  searchText: 'TODO',\n  replaceText: 'DONE'\n});\nreturn result.replacements;",
      params: {
        documentId: "string (required)",
        searchText: "string (required) — text to find",
        replaceText: "string (required) — replacement text",
        matchCase: "boolean (optional, default false) — case-sensitive match",
      },
      returns: "{ documentId, replacements: number, searchText, replaceText }",
    },
    applyTextStyle: {
      signature: "applyTextStyle(options: { documentId: string, startIndex: number, endIndex: number, style: TextStyle }): Promise<{ documentId, styledRange }>",
      description: "Apply text formatting (bold, italic, font size, color) to a range of text.",
      example: "await sdk.docs.applyTextStyle({\n  documentId: 'abc123',\n  startIndex: 10,\n  endIndex: 25,\n  style: { bold: true, fontSize: 14 }\n});",
      params: {
        documentId: "string (required)",
        startIndex: "number (required) — start position (0-based)",
        endIndex: "number (required) — end position (exclusive)",
        "style": "TextStyle — { bold?: boolean, italic?: boolean, underline?: boolean, fontSize?: number, foregroundColor?: { red, green, blue } }",
      },
      returns: "{ documentId, styledRange }",
    },
    insertTable: {
      signature: "insertTable(options: { documentId: string, rows: number, columns: number, index?: number }): Promise<{ documentId, tableId, rows, columns, insertedAt }>",
      description: "Insert a table into a Google Doc.",
      example: "await sdk.docs.insertTable({ documentId: 'abc123', rows: 3, columns: 4, index: 1 });",
      params: {
        documentId: "string (required)",
        rows: "number (required) — number of rows",
        columns: "number (required) — number of columns",
        index: "number (optional, default 1) — document position",
      },
      returns: "{ documentId, tableId, rows, columns, insertedAt }",
    },
  },

  // ─────────────────────────────────────────
  // Gmail (10 operations)
  // ─────────────────────────────────────────
  gmail: {
    listMessages: {
      signature: "listMessages(options?: { maxResults?: number, pageToken?: string, labelIds?: string[], includeSpamTrash?: boolean }): Promise<{ messages: MessageSummary[], nextPageToken?, resultSizeEstimate: number }>",
      description: "List recent Gmail messages (IDs and thread IDs only). Use getMessage() to get full content.",
      example: "const result = await sdk.gmail.listMessages({ maxResults: 10 });\nconst firstMsg = await sdk.gmail.getMessage({ id: result.messages[0].id });\nreturn firstMsg.subject;",
      params: {
        maxResults: "number (optional, default 10, max 500)",
        pageToken: "string (optional) — pagination token",
        labelIds: "string[] (optional) — filter by label IDs, e.g. ['INBOX', 'UNREAD']",
        includeSpamTrash: "boolean (optional, default false)",
      },
      returns: "{ messages: MessageSummary[], nextPageToken?, resultSizeEstimate } — MessageSummary = { id, threadId }",
    },
    listThreads: {
      signature: "listThreads(options?: { maxResults?: number, pageToken?: string, labelIds?: string[], includeSpamTrash?: boolean }): Promise<{ threads: ThreadSummary[], nextPageToken?, resultSizeEstimate }>",
      description: "List email threads. Each thread groups related messages.",
      example: "const threads = await sdk.gmail.listThreads({ maxResults: 5, labelIds: ['INBOX'] });\nreturn threads.threads;",
      params: {
        maxResults: "number (optional, default 10)",
        pageToken: "string (optional)",
        labelIds: "string[] (optional)",
        includeSpamTrash: "boolean (optional, default false)",
      },
      returns: "{ threads: ThreadSummary[], nextPageToken?, resultSizeEstimate } — ThreadSummary = { id, snippet, historyId }",
    },
    getMessage: {
      signature: "getMessage(options: { id: string, format?: string }): Promise<MessageDetail>",
      description: "Get the full content of a specific email message by ID.",
      example: "const msg = await sdk.gmail.getMessage({ id: 'abc123' });\nreturn { subject: msg.subject, from: msg.from, body: msg.body };",
      params: {
        id: "string (required) — message ID from listMessages()",
        format: "string (optional, default 'full') — 'full' | 'metadata' | 'minimal'",
      },
      returns: "MessageDetail — { id, threadId, subject, from, to, date, body, snippet, labelIds, attachments? }",
    },
    getThread: {
      signature: "getThread(options: { id: string }): Promise<{ threadId, messages: MessageDetail[], messageCount }>",
      description: "Get all messages in a thread.",
      example: "const thread = await sdk.gmail.getThread({ id: 'thread123' });\nreturn thread.messages.map(m => m.subject);",
      params: {
        id: "string (required) — thread ID from listThreads()",
      },
      returns: "{ threadId, messages: MessageDetail[], messageCount }",
    },
    searchMessages: {
      signature: "searchMessages(options: { query: string, maxResults?: number, pageToken?: string }): Promise<{ messages: MessageDetail[], nextPageToken?, totalResults }>",
      description: "Search Gmail using Gmail search syntax. Returns full message details (not just IDs).",
      example: "const results = await sdk.gmail.searchMessages({ query: 'from:boss@company.com subject:urgent', maxResults: 5 });\nreturn results.messages.map(m => ({ subject: m.subject, from: m.from }));",
      params: {
        query: "string (required) — Gmail search query, e.g. 'from:user@example.com has:attachment after:2024/1/1'",
        maxResults: "number (optional, default 10)",
        pageToken: "string (optional)",
      },
      returns: "{ messages: MessageDetail[], nextPageToken?, totalResults }",
    },
    createDraft: {
      signature: "createDraft(options: { to: string | string[], subject: string, body: string, isHtml?: boolean, cc?: string | string[], bcc?: string | string[], inReplyTo?: string }): Promise<{ draftId, messageId, threadId }>",
      description: "Create an email draft (not sent). Use isHtml for rich HTML emails. Use sendDraft() to send it.",
      example: "// Plain text draft\nconst draft = await sdk.gmail.createDraft({\n  to: 'team@company.com',\n  subject: 'Weekly Update',\n  body: 'Hi team,\\n\\nHere is this week\\'s update...'\n});\n\n// HTML draft with branding\nconst htmlDraft = await sdk.gmail.createDraft({\n  to: 'client@example.com',\n  subject: 'Your Invoice',\n  body: '<div style=\"font-family: Arial;\"><h1>Invoice #1234</h1><p>Amount due: <strong>$500</strong></p></div>',\n  isHtml: true\n});\nreturn htmlDraft.draftId;",
      params: {
        "to": "string | string[] (required) — recipient email(s)",
        subject: "string (required)",
        body: "string (required) — email body (plain text or HTML)",
        isHtml: "boolean (optional, default false) — whether body is HTML",
        "cc": "string | string[] (optional)",
        "bcc": "string | string[] (optional)",
        inReplyTo: "string (optional) — message ID to reply to (for threading)",
      },
      returns: "{ draftId, messageId, threadId }",
    },
    sendMessage: {
      signature: "sendMessage(options: { to: string | string[], subject: string, body: string, isHtml?: boolean, cc?: string | string[], bcc?: string | string[], inReplyTo?: string }): Promise<{ messageId, threadId, labelIds }>",
      description: "Send an email immediately. Use isHtml for rich HTML emails.",
      example: "// Plain text email\nconst sent = await sdk.gmail.sendMessage({\n  to: 'recipient@example.com',\n  subject: 'Hello',\n  body: 'This is the message body.'\n});\n\n// HTML email with branding\nconst htmlSent = await sdk.gmail.sendMessage({\n  to: 'client@example.com',\n  subject: 'Welcome to Our Service',\n  body: '<div style=\"font-family: Arial; max-width: 600px;\"><h1 style=\"color: #2563eb;\">Welcome!</h1><p>Thank you for signing up.</p></div>',\n  isHtml: true\n});\nreturn htmlSent.messageId;",
      params: {
        "to": "string | string[] (required) — recipient email(s)",
        subject: "string (required)",
        body: "string (required) — email body (plain text or HTML)",
        isHtml: "boolean (optional, default false) — whether body is HTML",
        "cc": "string | string[] (optional)",
        "bcc": "string | string[] (optional)",
        inReplyTo: "string (optional) — message ID to reply to",
      },
      returns: "{ messageId, threadId, labelIds }",
    },
    sendDraft: {
      signature: "sendDraft(options: { draftId: string }): Promise<{ messageId, threadId, labelIds }>",
      description: "Send a previously created draft.",
      example: "const sent = await sdk.gmail.sendDraft({ draftId: 'r12345' });\nreturn sent.messageId;",
      params: {
        draftId: "string (required) — draft ID from createDraft()",
      },
      returns: "{ messageId, threadId, labelIds }",
    },
    listLabels: {
      signature: "listLabels(options?: {}): Promise<{ labels: Label[] }>",
      description: "List all Gmail labels (system labels like INBOX, SENT, and custom labels).",
      example: "const { labels } = await sdk.gmail.listLabels();\nreturn labels.filter(l => l.type === 'user').map(l => ({ id: l.id, name: l.name }));",
      params: {},
      returns: "{ labels: Label[] } — Label = { id, name, type: 'system' | 'user', messagesTotal, messagesUnread }",
    },
    modifyLabels: {
      signature: "modifyLabels(options: { messageId: string, addLabelIds?: string[], removeLabelIds?: string[] }): Promise<{ messageId, labelIds: string[] }>",
      description: "Add or remove labels from a message. Use to archive (remove INBOX), mark read (remove UNREAD), star, etc.",
      example: "// Archive a message (remove from INBOX)\nawait sdk.gmail.modifyLabels({ messageId: 'msg123', removeLabelIds: ['INBOX'] });\n// Mark as read\nawait sdk.gmail.modifyLabels({ messageId: 'msg123', removeLabelIds: ['UNREAD'] });",
      params: {
        messageId: "string (required) — message ID",
        addLabelIds: "string[] (optional) — label IDs to add, e.g. ['STARRED', 'IMPORTANT']",
        removeLabelIds: "string[] (optional) — label IDs to remove, e.g. ['INBOX', 'UNREAD']",
      },
      returns: "{ messageId, labelIds: string[] } — updated list of all label IDs on message",
    },
    replyToMessage: {
      signature: "replyToMessage(options: { messageId: string, body: string, isHtml?: boolean, cc?: string[], bcc?: string[], from?: string }): Promise<{ messageId, threadId, labelIds, message }>",
      description: "Reply to a specific message with proper MIME threading (In-Reply-To and References headers). Fetches the original to extract its MIME Message-ID. Reply is placed in the same thread.",
      example: "const result = await sdk.gmail.replyToMessage({\n  messageId: '18c123abc',\n  body: 'Thanks for the update, I will follow up shortly.',\n});\nreturn result.messageId;",
      params: {
        messageId: "string (required) — Gmail message ID to reply to",
        body: "string (required) — reply body text or HTML",
        isHtml: "boolean (optional, default false) — whether body is HTML",
        cc: "string[] (optional) — additional CC recipients",
        bcc: "string[] (optional) — BCC recipients",
        from: "string (optional) — send from a specific send-as alias",
      },
      returns: "{ messageId, threadId, labelIds: string[], message: string }",
    },
    replyAllToMessage: {
      signature: "replyAllToMessage(options: { messageId: string, body: string, isHtml?: boolean, bcc?: string[], from?: string }): Promise<{ messageId, threadId, labelIds, message }>",
      description: "Reply-all to a message. Automatically includes all original To/Cc recipients and excludes your own email. Deduplicates recipients.",
      example: "const result = await sdk.gmail.replyAllToMessage({\n  messageId: '18c123abc',\n  body: 'Thanks everyone, see you all at the meeting.',\n});\nreturn result.messageId;",
      params: {
        messageId: "string (required) — Gmail message ID to reply-all to",
        body: "string (required) — reply body text or HTML",
        isHtml: "boolean (optional, default false) — whether body is HTML",
        bcc: "string[] (optional) — additional BCC recipients",
        from: "string (optional) — send from a specific send-as alias",
      },
      returns: "{ messageId, threadId, labelIds: string[], message: string }",
    },
    forwardMessage: {
      signature: "forwardMessage(options: { messageId: string, to: string[], cc?: string[], bcc?: string[], body?: string, isHtml?: boolean, from?: string }): Promise<{ messageId, threadId, labelIds, message }>",
      description: "Forward a message to new recipients. Quotes the original message content. Optionally prepends a custom message. Creates a new thread (no threading headers).",
      example: "const result = await sdk.gmail.forwardMessage({\n  messageId: '18c123abc',\n  to: ['colleague@example.com'],\n  body: 'FYI — thought this might be relevant to you.',\n});\nreturn result.messageId;",
      params: {
        messageId: "string (required) — Gmail message ID to forward",
        to: "string[] (required) — recipients to forward to",
        cc: "string[] (optional) — CC recipients",
        bcc: "string[] (optional) — BCC recipients",
        body: "string (optional) — custom message to prepend before the forwarded content",
        isHtml: "boolean (optional, default false) — whether body is HTML",
        from: "string (optional) — send from a specific send-as alias",
      },
      returns: "{ messageId, threadId, labelIds: string[], message: string }",
    },
    listAttachments: {
      signature: "listAttachments(options: { messageId: string }): Promise<{ messageId, attachments: AttachmentInfo[] }>",
      description: "List all attachments for a message. Returns metadata (filename, mimeType, size, attachmentId). Use downloadAttachment() to get file content.",
      example: "const result = await sdk.gmail.listAttachments({ messageId: '18c123abc' });\nresult.attachments.forEach(att => {\n  console.log(`${att.filename} (${att.size} bytes)`);\n});",
      params: {
        messageId: "string (required) — Gmail message ID",
      },
      returns: "{ messageId, attachments: AttachmentInfo[] } — AttachmentInfo = { attachmentId, filename, mimeType, size }",
    },
    downloadAttachment: {
      signature: "downloadAttachment(options: { messageId: string, attachmentId: string }): Promise<{ messageId, attachmentId, filename, mimeType, size, data }>",
      description: "Download a specific attachment from a message. Returns base64url-encoded file content.",
      example: "const att = await sdk.gmail.downloadAttachment({\n  messageId: '18c123abc',\n  attachmentId: 'ANGjdJ...',\n});\n// Decode: Buffer.from(att.data, 'base64url')\nconsole.log(`Downloaded: ${att.filename}`);",
      params: {
        messageId: "string (required) — Gmail message ID",
        attachmentId: "string (required) — attachment ID from listAttachments()",
      },
      returns: "{ messageId, attachmentId, filename, mimeType, size, data: string } — data is base64url-encoded",
    },
    sendWithAttachments: {
      signature: "sendWithAttachments(options: { to: string[], subject: string, body: string, attachments: OutboundAttachment[], cc?: string[], bcc?: string[], isHtml?: boolean, from?: string }): Promise<{ messageId, threadId, labelIds, message }>",
      description: "Send an email with file attachments using multipart/mixed MIME encoding.",
      example: "const result = await sdk.gmail.sendWithAttachments({\n  to: ['recipient@example.com'],\n  subject: 'Here is the report',\n  body: 'Please find the quarterly report attached.',\n  attachments: [{\n    filename: 'report.pdf',\n    mimeType: 'application/pdf',\n    data: pdfBase64String,\n  }],\n});\nreturn result.messageId;",
      params: {
        to: "string[] (required) — recipient email addresses",
        subject: "string (required) — email subject",
        body: "string (required) — email body text or HTML",
        "attachments": "OutboundAttachment[] (required) — [{ filename, mimeType, data: base64 }]",
        cc: "string[] (optional) — CC recipients",
        bcc: "string[] (optional) — BCC recipients",
        isHtml: "boolean (optional, default false) — whether body is HTML",
        from: "string (optional) — send from a specific send-as alias",
      },
      returns: "{ messageId, threadId, labelIds: string[], message: string }",
    },
    trashMessage: {
      signature: "trashMessage(options: { id: string }): Promise<{ id, labelIds, message }>",
      description: "Move a message to the trash. Recoverable with untrashMessage(). Use deleteMessage() for permanent deletion.",
      example: "const result = await sdk.gmail.trashMessage({ id: '18c123abc' });\nconsole.log(result.message); // 'Message moved to trash'",
      params: {
        id: "string (required) — message ID to trash",
      },
      returns: "{ id, labelIds: string[], message: string }",
    },
    untrashMessage: {
      signature: "untrashMessage(options: { id: string }): Promise<{ id, labelIds, message }>",
      description: "Restore a message from the trash.",
      example: "const result = await sdk.gmail.untrashMessage({ id: '18c123abc' });\nconsole.log(result.message); // 'Message restored from trash'",
      params: {
        id: "string (required) — message ID to restore",
      },
      returns: "{ id, labelIds: string[], message: string }",
    },
    deleteMessage: {
      signature: "deleteMessage(options: { id: string, safetyAcknowledged: true }): Promise<{ id, message }>",
      description: "Permanently and irrecoverably delete a message. Cannot be undone. Requires safetyAcknowledged: true. Use trashMessage() for recoverable deletion.",
      example: "// PERMANENT — cannot be undone!\nconst result = await sdk.gmail.deleteMessage({\n  id: '18c123abc',\n  safetyAcknowledged: true,\n});\nconsole.log(result.message);",
      params: {
        id: "string (required) — message ID to permanently delete",
        safetyAcknowledged: "true (required) — must be true to confirm permanent deletion",
      },
      returns: "{ id, message: string }",
    },
    markAsRead: {
      signature: "markAsRead(options: { id: string }): Promise<{ id, labelIds, message }>",
      description: "Mark a message as read by removing the UNREAD label.",
      example: "await sdk.gmail.markAsRead({ id: '18c123abc' });",
      params: {
        id: "string (required) — message ID",
      },
      returns: "{ id, labelIds: string[], message: string }",
    },
    markAsUnread: {
      signature: "markAsUnread(options: { id: string }): Promise<{ id, labelIds, message }>",
      description: "Mark a message as unread by adding the UNREAD label.",
      example: "await sdk.gmail.markAsUnread({ id: '18c123abc' });",
      params: {
        id: "string (required) — message ID",
      },
      returns: "{ id, labelIds: string[], message: string }",
    },
    archiveMessage: {
      signature: "archiveMessage(options: { id: string }): Promise<{ id, labelIds, message }>",
      description: "Archive a message by removing the INBOX label. Message remains searchable.",
      example: "await sdk.gmail.archiveMessage({ id: '18c123abc' });",
      params: {
        id: "string (required) — message ID to archive",
      },
      returns: "{ id, labelIds: string[], message: string }",
    },
    dryRun: {
      signature: "dryRun(options: { to: string[], subject: string, template: string, variables: Record<string, string>, isHtml?: boolean }): DryRunResult",
      description: "Preview a rendered templated email without sending. Renders {{variable}} placeholders in subject and body, validates recipients, returns the fully rendered email. Pure function — no API calls.",
      example: "const preview = sdk.gmail.dryRun({\n  to: ['amy@todaysdental.com'],\n  subject: '{{firstName}}, quick follow-up',\n  template: 'Hey {{firstName}},\\n\\n{{personalNote}}',\n  variables: { firstName: 'Amy', personalNote: 'We rebuilt your claims sheet' },\n});\nconsole.log(preview.subject); // 'Amy, quick follow-up'\nconsole.log(preview.wouldSend); // false",
      params: {
        to: "string[] (required) — recipient email addresses",
        subject: "string (required) — subject line with {{variable}} placeholders",
        template: "string (required) — email body with {{variable}} placeholders",
        variables: "Record<string, string> (required) — key-value map for placeholder replacement",
        isHtml: "boolean (optional, default false) — when true, variable values are HTML-escaped",
      },
      returns: "{ to: string[], subject: string, body: string, isHtml: boolean, wouldSend: false }",
    },
    sendFromTemplate: {
      signature: "sendFromTemplate(options: { to: string[], subject: string, template: string, variables: Record<string, string>, cc?: string[], bcc?: string[], isHtml?: boolean, from?: string }): Promise<SendFromTemplateResult>",
      description: "Render {{variable}} placeholders in subject and body template, then send the resulting email via Gmail. Combines template rendering with sendMessage in a single call.",
      example: "const result = await sdk.gmail.sendFromTemplate({\n  to: ['amy@todaysdental.com'],\n  subject: '{{firstName}}, quick follow-up',\n  template: 'Hey {{firstName}},\\n\\n{{personalNote}}',\n  variables: { firstName: 'Amy', personalNote: 'We rebuilt your claims sheet' },\n});\nconsole.log(result.messageId);",
      params: {
        to: "string[] (required) — recipient email addresses",
        subject: "string (required) — subject line with {{variable}} placeholders",
        template: "string (required) — email body with {{variable}} placeholders",
        variables: "Record<string, string> (required) — key-value map for placeholder replacement",
        cc: "string[] (optional) — CC recipients",
        bcc: "string[] (optional) — BCC recipients",
        isHtml: "boolean (optional, default false) — when true, variable values are HTML-escaped",
        from: "string (optional) — send-as alias email address",
      },
      returns: "{ messageId: string, threadId: string, rendered: true }",
    },
    sendBatch: {
      signature: "sendBatch(options: { subject: string, template: string, recipients: BatchRecipient[], delayMs?: number, isHtml?: boolean, dryRun?: boolean, from?: string }): Promise<BatchSendResult>",
      description: "Send a templated email to multiple recipients with per-recipient variables. Sends sequentially with configurable delay for rate limiting. Set dryRun: true to preview all rendered emails without sending. Continues on individual failures, reporting per-recipient status.",
      example: "const result = await sdk.gmail.sendBatch({\n  subject: 'Hi {{name}}',\n  template: 'Hello {{name}}, {{note}}',\n  recipients: [\n    { to: 'alice@example.com', variables: { name: 'Alice', note: 'checking in' } },\n    { to: 'bob@example.com', variables: { name: 'Bob', note: 'quick update' } },\n  ],\n  delayMs: 5000,\n});\nconsole.log(`Sent: ${result.sent}, Failed: ${result.failed}`);",
      params: {
        subject: "string (required) — subject line with {{variable}} placeholders",
        template: "string (required) — email body with {{variable}} placeholders",
        recipients: "BatchRecipient[] (required) — array of { to: string, variables: Record<string, string> }",
        delayMs: "number (optional, default 5000) — milliseconds between sends for rate limiting",
        isHtml: "boolean (optional, default false) — when true, variable values are HTML-escaped",
        dryRun: "boolean (optional, default false) — preview all emails without sending",
        from: "string (optional) — send-as alias email address",
      },
      returns: "{ sent: number, failed: number, results?: BatchSendItemResult[], previews?: BatchPreviewItem[] }",
    },
    detectReplies: {
      signature: "detectReplies(options: { threadIds: string[] }): Promise<{ threads: Array<{ threadId: string, hasReply: boolean, replies: Array<{ messageId: string, from: string, date: string }> }> }>",
      description: "Check threads for replies from external participants. Filters out messages from the authenticated user to identify genuine replies. Useful for tracking outreach response rates.",
      example: "const { threads } = await sdk.gmail.detectReplies({ threadIds: ['thread1', 'thread2'] });\nconst replied = threads.filter(t => t.hasReply);\nconsole.log(`${replied.length} of ${threads.length} threads have replies`);",
      params: {
        threadIds: "string[] (required) — array of Gmail thread IDs to check for replies",
      },
      returns: "{ threads: Array<{ threadId, hasReply, replies: Array<{ messageId, from, date }> }> }",
    },
    getTrackingData: {
      signature: "getTrackingData(options: { campaignId: string }): Promise<{ campaignId: string, totalOpens: number, uniqueOpens: number, recipients: Array<{ recipientId: string, openCount: number, firstOpenedAt: string, lastOpenedAt: string }> }>",
      description: "Query open-tracking data for a campaign. Returns per-recipient open counts and timestamps. Only available in CF Workers runtime (requires KV namespace). Campaign IDs come from tracking pixels embedded in outreach emails.",
      example: "const data = await sdk.gmail.getTrackingData({ campaignId: 'campaign-2024-q1' });\nconsole.log(`Total opens: ${data.totalOpens}, Unique: ${data.uniqueOpens}`);",
      params: {
        campaignId: "string (required) — campaign identifier used in tracking pixel URLs",
      },
      returns: "{ campaignId, totalOpens, uniqueOpens, recipients: Array<{ recipientId, openCount, firstOpenedAt, lastOpenedAt }> }",
    },
  },

  // ─────────────────────────────────────────
  // Calendar (9 operations)
  // ─────────────────────────────────────────
  calendar: {
    listCalendars: {
      signature: "listCalendars(options?: { maxResults?: number, pageToken?: string, showHidden?: boolean }): Promise<{ calendars: CalendarSummary[], nextPageToken? }>",
      description: "List all calendars the user has access to.",
      example: "const { calendars } = await sdk.calendar.listCalendars();\nreturn calendars.map(c => ({ id: c.id, name: c.summary, primary: c.primary }));",
      params: {
        maxResults: "number (optional, default 100)",
        pageToken: "string (optional)",
        showHidden: "boolean (optional, default false)",
      },
      returns: "{ calendars: CalendarSummary[] } — CalendarSummary = { id, summary, description?, timeZone?, primary?, accessRole }",
    },
    getCalendar: {
      signature: "getCalendar(options: { calendarId: string }): Promise<{ id, summary, description?, location?, timeZone }>",
      description: "Get details for a specific calendar.",
      example: "const cal = await sdk.calendar.getCalendar({ calendarId: 'primary' });\nreturn cal.timeZone;",
      params: {
        calendarId: "string (required) — calendar ID or 'primary' for main calendar",
      },
      returns: "{ id, summary, description?, location?, timeZone, conferenceProperties? }",
    },
    listEvents: {
      signature: "listEvents(options?: { calendarId?: string, timeMin?: string, timeMax?: string, maxResults?: number, orderBy?: string, singleEvents?: boolean }): Promise<{ events: EventSummary[], nextPageToken?, timeZone?, summary? }>",
      description: "List calendar events in a time range.",
      example: "const today = new Date().toISOString();\nconst nextWeek = new Date(Date.now() + 7*24*60*60*1000).toISOString();\nconst { events } = await sdk.calendar.listEvents({\n  calendarId: 'primary',\n  timeMin: today,\n  timeMax: nextWeek,\n  singleEvents: true,\n  orderBy: 'startTime'\n});\nreturn events.map(e => ({ summary: e.summary, start: e.start }));",
      params: {
        calendarId: "string (optional, default 'primary')",
        timeMin: "string (optional) — ISO 8601 datetime, lower bound",
        timeMax: "string (optional) — ISO 8601 datetime, upper bound",
        maxResults: "number (optional, default 10)",
        orderBy: "string (optional) — 'startTime' | 'updated' (use 'startTime' with singleEvents:true)",
        singleEvents: "boolean (optional) — expand recurring events into individual instances",
        showDeleted: "boolean (optional, default false)",
        timeZone: "string (optional) — IANA time zone, e.g. 'America/New_York'",
      },
      returns: "{ events: EventSummary[], nextPageToken?, timeZone?, summary? } — EventSummary = { id, summary?, start?, end?, status?, attendeeCount?, location? }",
    },
    getEvent: {
      signature: "getEvent(options: { eventId: string, calendarId?: string }): Promise<EventResult>",
      description: "Get full details for a specific event including attendees, recurrence, and conference data.",
      example: "const event = await sdk.calendar.getEvent({ eventId: 'evt123', calendarId: 'primary' });\nreturn { title: event.summary, attendees: event.attendees };",
      params: {
        eventId: "string (required) — event ID from listEvents()",
        calendarId: "string (optional, default 'primary')",
      },
      returns: "EventResult — { eventId, status, htmlLink, summary, description, location, start, end, attendees: Attendee[], recurrence?, conferenceData?, reminders }",
    },
    createEvent: {
      signature: "createEvent(options: CreateEventOptions): Promise<CreateEventResult>",
      description: "Create a calendar event. Supports attendees (email or contact names if PAI_CONTACTS_PATH configured), Google Meet, recurring events.",
      example: "const event = await sdk.calendar.createEvent({\n  summary: 'Team Standup',\n  start: { dateTime: '2024-01-15T09:00:00', timeZone: 'America/New_York' },\n  end: { dateTime: '2024-01-15T09:30:00', timeZone: 'America/New_York' },\n  attendees: ['alice@company.com', 'bob@company.com'],\n  recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR']\n});\nreturn event.htmlLink;",
      params: {
        summary: "string (required) — event title",
        "start": "EventDateTime (required) — { dateTime: ISO8601 string, timeZone?: string } or { date: 'YYYY-MM-DD' } for all-day",
        "end": "EventDateTime (required) — same format as start",
        calendarId: "string (optional, default 'primary')",
        description: "string (optional) — event description",
        location: "string (optional) — physical location",
        attendees: "string[] (optional) — email addresses or contact names",
        recurrence: "string[] (optional) — RRULE strings, e.g. ['RRULE:FREQ=WEEKLY']",
        conferenceData: "ConferenceData (optional) — { createRequest: { requestId: string, conferenceSolutionKey: { type: 'hangoutsMeet' } } }",
        reminders: "ReminderSettings (optional) — { overrides: [{ method: 'email'|'popup', minutes: number }] }",
      },
      returns: "CreateEventResult — { eventId, htmlLink, summary, start, end, attendees, created, updated, hangoutLink? }",
    },
    updateEvent: {
      signature: "updateEvent(options: { eventId: string, calendarId?: string, updates: Partial<CreateEventOptions>, sendUpdates?: string }): Promise<EventResult>",
      description: "Update an existing calendar event. Only specified fields are changed.",
      example: "await sdk.calendar.updateEvent({\n  eventId: 'evt123',\n  updates: { summary: 'Updated Title', description: 'New description' },\n  sendUpdates: 'all'\n});",
      params: {
        eventId: "string (required)",
        calendarId: "string (optional, default 'primary')",
        updates: "Partial<CreateEventOptions> — only fields to change",
        sendUpdates: "string (optional) — 'all' | 'externalOnly' | 'none'",
      },
      returns: "EventResult — full updated event",
    },
    deleteEvent: {
      signature: "deleteEvent(options: { eventId: string, calendarId?: string, sendUpdates?: string }): Promise<{ eventId, message }>",
      description: "Delete a calendar event.",
      example: "await sdk.calendar.deleteEvent({ eventId: 'evt123', sendUpdates: 'all' });",
      params: {
        eventId: "string (required)",
        calendarId: "string (optional, default 'primary')",
        sendUpdates: "string (optional) — 'all' | 'externalOnly' | 'none'",
      },
      returns: "{ eventId, message: string }",
    },
    quickAdd: {
      signature: "quickAdd(options: { text: string, calendarId?: string }): Promise<{ eventId, htmlLink, summary, start, end }>",
      description: "Create an event from natural language text. Google parses the text to extract date/time, title, and location.",
      example: "const event = await sdk.calendar.quickAdd({\n  text: 'Lunch with Sarah at Nobu tomorrow at noon'\n});\nreturn event.htmlLink;",
      params: {
        text: "string (required) — natural language event description",
        calendarId: "string (optional, default 'primary')",
      },
      returns: "{ eventId, htmlLink, summary, start, end }",
    },
    checkFreeBusy: {
      signature: "checkFreeBusy(options: { timeMin: string, timeMax: string, items: Array<{ id: string }>, timeZone?: string }): Promise<FreeBusyResult>",
      description: "Check free/busy times for calendars. Useful for finding open slots for meetings.",
      example: "const now = new Date().toISOString();\nconst tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString();\nconst result = await sdk.calendar.checkFreeBusy({\n  timeMin: now,\n  timeMax: tomorrow,\n  items: [{ id: 'primary' }, { id: 'alice@company.com' }]\n});\nreturn result.calendars;",
      params: {
        timeMin: "string (required) — ISO 8601 datetime",
        timeMax: "string (required) — ISO 8601 datetime",
        "items": "Array<{ id: string }> (required) — calendar IDs to check",
        timeZone: "string (optional) — IANA timezone",
      },
      returns: "FreeBusyResult — { timeMin, timeMax, calendars: Record<calendarId, { busy: Array<{ start, end }>, errors? }> }",
    },
  },
};
