import type { docs_v1, drive_v3 } from 'googleapis';
import type { Logger } from 'winston';
import {
  DocsToolSchema,
  type DocsToolInput,
} from './docs-schemas.js';

interface CacheManagerLike {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

interface PerformanceMonitorLike {
  track(operation: string, duration: number, error?: boolean): void;
}

export interface DocsHandlerContext {
  logger: Logger;
  docs: docs_v1.Docs;
  drive: drive_v3.Drive;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  startTime: number;
}

// Text style interface for Google Docs
interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: {
    magnitude: number;
    unit: string;
  };
  foregroundColor?: {
    color: {
      rgbColor: {
        red: number;
        green: number;
        blue: number;
      };
    };
  };
}

// Handler for create operation
async function handleCreate(
  args: Extract<DocsToolInput, { operation: 'create' }>,
  context: DocsHandlerContext,
) {
  const { title, content, parentId } = args;

  // Create the document
  const createResponse = await context.docs.documents.create({
    requestBody: {
      title,
    },
  });

  const documentId = createResponse.data.documentId;

  // If content is provided, insert it
  if (content && documentId) {
    await context.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: 1 },
            text: content,
          },
        }],
      },
    });
  }

  // If parentId is provided, move the document
  if (parentId && documentId) {
    await context.drive.files.update({
      fileId: documentId,
      addParents: parentId,
    });
  }

  context.performanceMonitor.track('docs:create', Date.now() - context.startTime);
  context.logger.info('Document created', { documentId, title });

  return {
    content: [{
      type: "text" as const,
      text: `Document created successfully!\nDocument ID: ${documentId}\nTitle: ${title}\nURL: https://docs.google.com/document/d/${documentId}/edit`,
    }],
  };
}

// Handler for insertText operation
async function handleInsertText(
  args: Extract<DocsToolInput, { operation: 'insertText' }>,
  context: DocsHandlerContext,
) {
  const { documentId, text, index = 1 } = args;

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        insertText: {
          location: { index },
          text,
        },
      }],
    },
  });

  context.performanceMonitor.track('docs:insertText', Date.now() - context.startTime);
  context.logger.info('Text inserted', { documentId, textLength: text.length });

  return {
    content: [{
      type: "text" as const,
      text: `Text inserted successfully at index ${index}`,
    }],
  };
}

// Handler for replaceText operation
async function handleReplaceText(
  args: Extract<DocsToolInput, { operation: 'replaceText' }>,
  context: DocsHandlerContext,
) {
  const { documentId, searchText, replaceText, matchCase = false } = args;

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        replaceAllText: {
          containsText: {
            text: searchText,
            matchCase,
          },
          replaceText,
        },
      }],
    },
  });

  context.performanceMonitor.track('docs:replaceText', Date.now() - context.startTime);
  context.logger.info('Text replaced', { documentId, searchText, replaceText });

  return {
    content: [{
      type: "text" as const,
      text: `All occurrences of "${searchText}" replaced with "${replaceText}"`,
    }],
  };
}

// Handler for applyTextStyle operation
async function handleApplyTextStyle(
  args: Extract<DocsToolInput, { operation: 'applyTextStyle' }>,
  context: DocsHandlerContext,
) {
  const { documentId, startIndex, endIndex, bold, italic, underline, fontSize, foregroundColor } = args;

  const textStyle: Partial<TextStyle> = {};

  if (bold !== undefined) {
    textStyle.bold = bold;
  }
  if (italic !== undefined) {
    textStyle.italic = italic;
  }
  if (underline !== undefined) {
    textStyle.underline = underline;
  }
  if (fontSize !== undefined) {
    textStyle.fontSize = {
      magnitude: fontSize,
      unit: "PT",
    };
  }
  if (foregroundColor) {
    textStyle.foregroundColor = {
      color: {
        rgbColor: foregroundColor,
      },
    };
  }

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        updateTextStyle: {
          range: {
            startIndex,
            endIndex,
          },
          textStyle,
          fields: Object.keys(textStyle).join(","),
        },
      }],
    },
  });

  context.performanceMonitor.track('docs:applyTextStyle', Date.now() - context.startTime);
  context.logger.info('Text style applied', { documentId, startIndex, endIndex });

  return {
    content: [{
      type: "text" as const,
      text: `Text style applied successfully from index ${startIndex} to ${endIndex}`,
    }],
  };
}

// Handler for insertTable operation
async function handleInsertTable(
  args: Extract<DocsToolInput, { operation: 'insertTable' }>,
  context: DocsHandlerContext,
) {
  const { documentId, rows, columns, index = 1 } = args;

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        insertTable: {
          location: { index },
          rows,
          columns,
        },
      }],
    },
  });

  context.performanceMonitor.track('docs:insertTable', Date.now() - context.startTime);
  context.logger.info('Table inserted', { documentId, rows, columns });

  return {
    content: [{
      type: "text" as const,
      text: `Table with ${rows} rows and ${columns} columns inserted at index ${index}`,
    }],
  };
}

// Main handler function
export async function handleDocsTool(
  rawArgs: unknown,
  context: DocsHandlerContext,
) {
  const validated = DocsToolSchema.parse(rawArgs);

  context.logger.info('Executing consolidated docs tool', {
    operation: validated.operation,
  });

  switch (validated.operation) {
    case 'create':
      return handleCreate(validated, context);
    case 'insertText':
      return handleInsertText(validated, context);
    case 'replaceText':
      return handleReplaceText(validated, context);
    case 'applyTextStyle':
      return handleApplyTextStyle(validated, context);
    case 'insertTable':
      return handleInsertTable(validated, context);
    default: {
      const exhaustiveCheck: never = validated;
      throw new Error(`Unhandled docs operation: ${(exhaustiveCheck as DocsToolInput).operation}`);
    }
  }
}
