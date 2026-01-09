/**
 * Tool Discovery Resource - Progressive discovery of available operations
 *
 * This resource provides a hierarchical structure of all available Google Workspace
 * operations. Instead of loading 40+ tool definitions upfront (consuming thousands
 * of tokens), agents can explore available operations on-demand.
 *
 * Flow:
 * 1. Agent reads 'gdrive://tools' to see available modules (drive, sheets, forms, docs)
 * 2. Agent explores specific modules to see available operations
 * 3. Agent reads detailed documentation for specific operations
 * 4. Agent writes code using discovered operations
 *
 * This achieves Anthropic's "progressive discovery" pattern for token efficiency.
 */

// v3.0.0: Removed filesystem parsing dependencies (now using hardcoded structure)

/**
 * MCP Resource definition for tool discovery
 */
export const LIST_TOOLS_RESOURCE = {
  uri: 'gdrive://tools',
  name: 'Available Operations',
  description: 'Hierarchical structure of all available Google Workspace operations',
  mimeType: 'application/json',
};

/**
 * Definition of a single operation/function
 */
export interface ToolDefinition {
  /** Function name */
  name: string;
  /** Full TypeScript signature */
  signature: string;
  /** Description of what the function does */
  description: string;
  /** Example usage code (if available) */
  example?: string;
}

/**
 * Structure of all modules and their operations
 */
export interface ModuleStructure {
  [moduleName: string]: ToolDefinition[];
}

/**
 * Generate hierarchical structure of all available operations
 *
 * This function parses all TypeScript files in src/modules/ to extract:
 * - Exported function names
 * - Function signatures (parameters and return types)
 * - JSDoc documentation
 * - Usage examples
 *
 * The result is a complete map of available operations organized by module.
 *
 * @returns Structure of all modules and their operations
 */
export async function generateToolStructure(): Promise<ModuleStructure> {
  // v3.0.0: Hardcoded API structure for reliability
  // In production (Docker), we don't have access to TypeScript source files
  // This approach is simpler and guaranteed to work
  return {
    drive: [
      {
        name: 'files.list',
        signature: 'context.drive.files.list({ q: string, pageSize?: number, fields?: string })',
        description: 'List files in Google Drive with optional query filter',
        example: 'const response = await context.drive.files.list({ q: "name contains \'portfolio\'", pageSize: 10, fields: "files(id, name, mimeType)" });',
      },
      {
        name: 'files.get',
        signature: 'context.drive.files.get({ fileId: string, fields?: string, alt?: string })',
        description: 'Get file metadata or content from Google Drive',
        example: 'const file = await context.drive.files.get({ fileId: "abc123", fields: "id, name, mimeType" });',
      },
      {
        name: 'files.create',
        signature: 'context.drive.files.create({ requestBody: object, media?: object })',
        description: 'Create a new file in Google Drive',
      },
      {
        name: 'files.update',
        signature: 'context.drive.files.update({ fileId: string, requestBody: object, media?: object })',
        description: 'Update an existing file in Google Drive',
      },
      {
        name: 'files.export',
        signature: 'context.drive.files.export({ fileId: string, mimeType: string })',
        description: 'Export a Google Workspace file to different format',
        example: 'const pdf = await context.drive.files.export({ fileId: "abc123", mimeType: "application/pdf" });',
      },
    ],
    sheets: [
      {
        name: 'spreadsheets.get',
        signature: 'context.sheets.spreadsheets.get({ spreadsheetId: string, ranges?: string[], includeGridData?: boolean })',
        description: 'Get spreadsheet metadata and data',
        example: 'const sheet = await context.sheets.spreadsheets.get({ spreadsheetId: "abc123" });',
      },
      {
        name: 'spreadsheets.values.get',
        signature: 'context.sheets.spreadsheets.values.get({ spreadsheetId: string, range: string })',
        description: 'Read values from a spreadsheet range',
        example: 'const data = await context.sheets.spreadsheets.values.get({ spreadsheetId: "abc123", range: "Sheet1!A1:D10" });',
      },
      {
        name: 'spreadsheets.values.update',
        signature: 'context.sheets.spreadsheets.values.update({ spreadsheetId: string, range: string, valueInputOption: string, requestBody: { values: any[][] } })',
        description: 'Update values in a spreadsheet range',
      },
      {
        name: 'spreadsheets.values.append',
        signature: 'context.sheets.spreadsheets.values.append({ spreadsheetId: string, range: string, valueInputOption: string, requestBody: { values: any[][] } })',
        description: 'Append values to a spreadsheet',
      },
      {
        name: 'spreadsheets.batchUpdate',
        signature: 'context.sheets.spreadsheets.batchUpdate({ spreadsheetId: string, requestBody: { requests: object[] } })',
        description: 'Perform batch updates on a spreadsheet (format, add sheets, etc)',
      },
    ],
    forms: [
      {
        name: 'createForm',
        signature: 'createForm({ title: string, description?: string })',
        description: 'Create a new Google Form',
        example: 'forms.createForm({ title: "Customer Survey", description: "Feedback form" })',
      },
      {
        name: 'readForm',
        signature: 'readForm({ formId: string })',
        description: 'Get form metadata and structure',
        example: 'forms.readForm({ formId: "abc123" })',
      },
      {
        name: 'addQuestion',
        signature: 'addQuestion({ formId: string, title: string, questionType: string, ... })',
        description: 'Add a question to a form',
        example: 'forms.addQuestion({ formId: "abc123", title: "Your rating", questionType: "SCALE" })',
      },
      {
        name: 'listResponses',
        signature: 'listResponses({ formId: string })',
        description: 'List all responses to a form',
        example: 'forms.listResponses({ formId: "abc123" })',
      },
    ],
    docs: [
      {
        name: 'createDocument',
        signature: 'createDocument({ title: string })',
        description: 'Create a new Google Doc',
        example: 'docs.createDocument({ title: "Meeting Notes" })',
      },
      {
        name: 'insertText',
        signature: 'insertText({ documentId: string, text: string, index?: number })',
        description: 'Insert text at a position in the document',
        example: 'docs.insertText({ documentId: "abc123", text: "Hello World", index: 1 })',
      },
      {
        name: 'replaceText',
        signature: 'replaceText({ documentId: string, searchText: string, replaceText: string })',
        description: 'Replace text throughout the document',
        example: 'docs.replaceText({ documentId: "abc123", searchText: "old", replaceText: "new" })',
      },
      {
        name: 'applyTextStyle',
        signature: 'applyTextStyle({ documentId: string, startIndex: number, endIndex: number, style: object })',
        description: 'Apply formatting to a text range',
        example: 'docs.applyTextStyle({ documentId: "abc123", startIndex: 1, endIndex: 10, style: { bold: true } })',
      },
      {
        name: 'insertTable',
        signature: 'insertTable({ documentId: string, rows: number, columns: number, index?: number })',
        description: 'Insert a table at a position in the document',
        example: 'docs.insertTable({ documentId: "abc123", rows: 3, columns: 4, index: 1 })',
      },
    ],
    gmail: [
      {
        name: 'listMessages',
        signature: 'listMessages({ maxResults?: number, labelIds?: string[], pageToken?: string, includeSpamTrash?: boolean })',
        description: 'List messages in the user\'s mailbox',
        example: 'gmail.listMessages({ maxResults: 10, labelIds: ["INBOX"] })',
      },
      {
        name: 'listThreads',
        signature: 'listThreads({ maxResults?: number, labelIds?: string[], pageToken?: string, includeSpamTrash?: boolean })',
        description: 'List email threads in the user\'s mailbox',
        example: 'gmail.listThreads({ maxResults: 10, labelIds: ["INBOX"] })',
      },
      {
        name: 'getMessage',
        signature: 'getMessage({ id: string, format?: "minimal" | "full" | "raw" | "metadata" })',
        description: 'Get a specific message by ID with full content',
        example: 'gmail.getMessage({ id: "18c123abc", format: "full" })',
      },
      {
        name: 'getThread',
        signature: 'getThread({ id: string, format?: "minimal" | "full" | "metadata" })',
        description: 'Get a thread with all its messages',
        example: 'gmail.getThread({ id: "18c123abc", format: "full" })',
      },
      {
        name: 'searchMessages',
        signature: 'searchMessages({ query: string, maxResults?: number, pageToken?: string, includeSpamTrash?: boolean })',
        description: 'Search messages using Gmail query syntax',
        example: 'gmail.searchMessages({ query: "from:boss@company.com is:unread", maxResults: 20 })',
      },
      {
        name: 'createDraft',
        signature: 'createDraft({ to: string[], subject: string, body: string, cc?: string[], bcc?: string[], isHtml?: boolean, from?: string })',
        description: 'Create a draft email',
        example: 'gmail.createDraft({ to: ["user@example.com"], subject: "Hello", body: "Hi there!" })',
      },
      {
        name: 'sendMessage',
        signature: 'sendMessage({ to: string[], subject: string, body: string, cc?: string[], bcc?: string[], isHtml?: boolean, from?: string, threadId?: string })',
        description: 'Send a new email message (supports send-as aliases via from parameter)',
        example: 'gmail.sendMessage({ to: ["user@example.com"], subject: "Hello", body: "Hi there!" })',
      },
      {
        name: 'sendDraft',
        signature: 'sendDraft({ draftId: string })',
        description: 'Send an existing draft',
        example: 'gmail.sendDraft({ draftId: "r1234567890" })',
      },
      {
        name: 'listLabels',
        signature: 'listLabels({})',
        description: 'List all labels in the user\'s mailbox',
        example: 'gmail.listLabels({})',
      },
      {
        name: 'modifyLabels',
        signature: 'modifyLabels({ messageId: string, addLabelIds?: string[], removeLabelIds?: string[] })',
        description: 'Add or remove labels from a message',
        example: 'gmail.modifyLabels({ messageId: "18c123abc", removeLabelIds: ["UNREAD", "INBOX"] })',
      },
    ],
    calendar: [
      {
        name: 'listCalendars',
        signature: 'listCalendars({ maxResults?: number, pageToken?: string })',
        description: 'List all calendars accessible by the user',
        example: 'calendar.listCalendars({ maxResults: 10 })',
      },
      {
        name: 'getCalendar',
        signature: 'getCalendar({ calendarId: string })',
        description: 'Get details of a specific calendar',
        example: 'calendar.getCalendar({ calendarId: "primary" })',
      },
      {
        name: 'listEvents',
        signature: 'listEvents({ calendarId?: string, timeMin?: string, timeMax?: string, maxResults?: number })',
        description: 'List events in a calendar within a time range',
        example: 'calendar.listEvents({ timeMin: "2026-01-08T00:00:00Z", maxResults: 20 })',
      },
      {
        name: 'getEvent',
        signature: 'getEvent({ calendarId?: string, eventId: string })',
        description: 'Get details of a specific event',
        example: 'calendar.getEvent({ eventId: "abc123" })',
      },
      {
        name: 'createEvent',
        signature: 'createEvent({ summary: string, start: EventDateTime, end: EventDateTime, attendees?: string[], ... })',
        description: 'Create a new calendar event with optional attendees and recurrence',
        example: 'calendar.createEvent({ summary: "Team Standup", start: { dateTime: "2026-01-09T09:00:00-06:00" }, end: { dateTime: "2026-01-09T09:30:00-06:00" }, attendees: ["Mary", "Kelvin"] })',
      },
      {
        name: 'updateEvent',
        signature: 'updateEvent({ eventId: string, updates: Partial<EventOptions> })',
        description: 'Update an existing event',
        example: 'calendar.updateEvent({ eventId: "abc123", updates: { summary: "Updated Meeting Title" } })',
      },
      {
        name: 'deleteEvent',
        signature: 'deleteEvent({ eventId: string, sendUpdates?: "all" | "externalOnly" | "none" })',
        description: 'Delete an event and optionally notify attendees',
        example: 'calendar.deleteEvent({ eventId: "abc123", sendUpdates: "all" })',
      },
      {
        name: 'quickAdd',
        signature: 'quickAdd({ text: string, calendarId?: string })',
        description: 'Create an event from natural language text',
        example: 'calendar.quickAdd({ text: "Lunch with Mary tomorrow at noon" })',
      },
      {
        name: 'checkFreeBusy',
        signature: 'checkFreeBusy({ timeMin: string, timeMax: string, items: { id: string }[] })',
        description: 'Check availability for calendars or attendees in a time range',
        example: 'calendar.checkFreeBusy({ timeMin: "2026-01-09T00:00:00Z", timeMax: "2026-01-09T23:59:59Z", items: [{ id: "primary" }] })',
      },
    ],
  };
}

// v3.2.0: Removed deprecated parseToolDefinitions function
// The function was unused since v3.0.0 (hardcoded structure is used instead)

/**
 * Format tool structure as human-readable text
 *
 * Converts the structured data into a formatted string suitable for display
 * to agents or in documentation.
 *
 * @param structure - Module structure to format
 * @returns Formatted text representation
 */
export function formatToolStructure(structure: ModuleStructure): string {
  const sections: string[] = [];

  sections.push('# Google Workspace MCP Operations\n');
  sections.push('Available modules and operations for code execution.\n');

  for (const [moduleName, tools] of Object.entries(structure)) {
    sections.push(`\n## ./modules/${moduleName}\n`);

    for (const tool of tools) {
      sections.push(`### ${tool.name}\n`);
      sections.push(`**Signature:** \`${tool.signature}\`\n`);
      sections.push(`**Description:** ${tool.description}\n`);

      if (tool.example) {
        sections.push(`\n**Example:**\n\`\`\`typescript\n${tool.example}\n\`\`\`\n`);
      }

      sections.push('\n---\n');
    }
  }

  return sections.join('\n');
}

/**
 * Get tool definitions for a specific module
 *
 * Filters the full structure to return only operations for the requested module.
 *
 * @param moduleName - Name of the module (e.g., 'drive', 'sheets')
 * @returns Array of tool definitions for that module
 */
export async function getModuleTools(moduleName: string): Promise<ToolDefinition[]> {
  const structure = await generateToolStructure();
  return structure[moduleName] || [];
}

/**
 * Get definition for a specific tool
 *
 * Finds a specific operation within a module.
 *
 * @param moduleName - Name of the module (e.g., 'drive')
 * @param toolName - Name of the operation (e.g., 'search')
 * @returns Tool definition or undefined if not found
 */
export async function getToolDefinition(
  moduleName: string,
  toolName: string
): Promise<ToolDefinition | undefined> {
  const moduleTools = await getModuleTools(moduleName);
  return moduleTools.find(tool => tool.name === toolName);
}
