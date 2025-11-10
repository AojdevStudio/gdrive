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
        name: 'Available via context',
        signature: 'See Google Forms API documentation',
        description: 'Forms API not yet exposed in v3.0.0 sandbox',
      },
    ],
    docs: [
      {
        name: 'Available via context',
        signature: 'See Google Docs API documentation',
        description: 'Docs API not yet exposed in v3.0.0 sandbox',
      },
    ],
  };
}

/**
 * Parse TypeScript file content to extract function definitions
 *
 * DEPRECATED in v3.0.0: No longer used (hardcoded structure instead)
 * Keeping for potential future use
 *
 * @param content - TypeScript file content
 * @returns Array of tool definitions found in the file
 */
// @ts-ignore - Unused in v3.0.0 but kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseToolDefinitions(content: string): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Regex to find exported async functions
  // Matches: export async function name(params): Promise<ReturnType>
  const exportPattern = /export\s+async\s+function\s+(\w+)\s*\((.*?)\)\s*:\s*Promise<(.*?)>\s*\{/gs;

  // Regex to find JSDoc comments
  // Matches: /** ... */
  const docPattern = /\/\*\*([\s\S]*?)\*\//g;

  let match;
  while ((match = exportPattern.exec(content)) !== null) {
    const [, functionName, params, returnType] = match;

    // Guard against undefined matches
    if (!functionName || !params || !returnType) {
      continue;
    }

    // Find the JSDoc comment immediately before this function
    const beforeFunction = content.substring(0, match.index);
    const docMatches = [...beforeFunction.matchAll(docPattern)];
    const lastDoc = docMatches[docMatches.length - 1];

    let description = '';
    let example: string | undefined;

    if (lastDoc && lastDoc[1]) {
      const docContent = lastDoc[1];

      // Extract description (lines without @tags)
      const descriptionLines: string[] = [];
      const exampleLines: string[] = [];
      let inExample = false;

      for (const line of docContent.split('\n')) {
        const trimmed = line.trim().replace(/^\*\s?/, '');

        if (trimmed.startsWith('@example')) {
          inExample = true;
          continue;
        }

        if (trimmed.startsWith('@')) {
          inExample = false;
          continue;
        }

        if (inExample) {
          exampleLines.push(trimmed);
        } else if (trimmed && !trimmed.startsWith('*')) {
          descriptionLines.push(trimmed);
        }
      }

      description = descriptionLines.join(' ').trim();
      const exampleText = exampleLines.join('\n').trim();
      example = exampleText.length > 0 ? exampleText : undefined;
    }

    // Build the full signature
    const signature = `async function ${functionName}(${params}): Promise<${returnType}>`;

    // Create tool definition with explicit handling of optional example property
    // Using spread to handle exactOptionalPropertyTypes strictness
    const tool: ToolDefinition = example
      ? {
          name: functionName,
          signature,
          description: description || `${functionName} operation`,
          example,
        }
      : {
          name: functionName,
          signature,
          description: description || `${functionName} operation`,
        };

    tools.push(tool);
  }

  return tools;
}

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
