import type { DocsContext } from '../types.js';

/**
 * Options for inserting text
 */
export interface InsertTextOptions {
  /** Document ID */
  documentId: string;
  /** Text to insert */
  text: string;
  /** Position index to insert at (default: 1, which is the start) */
  index?: number;
}

/**
 * Result of inserting text
 */
export interface InsertTextResult {
  documentId: string;
  index: number;
  textLength: number;
  message: string;
}

/**
 * Insert text at a specific position in a document
 *
 * Index 1 is the beginning of the document.
 * Use higher indices to insert text after existing content.
 *
 * @param options Insert text parameters
 * @param context Docs API context
 * @returns Insert confirmation
 *
 * @example
 * ```typescript
 * // Insert at beginning
 * await insertText({
 *   documentId: 'abc123',
 *   text: 'Executive Summary\n\n',
 *   index: 1
 * }, context);
 *
 * // Append to end (assuming document has 500 characters)
 * await insertText({
 *   documentId: 'abc123',
 *   text: '\n\nConclusion\nThis concludes our proposal.',
 *   index: 500
 * }, context);
 * ```
 */
export async function insertText(
  options: InsertTextOptions,
  context: DocsContext
): Promise<InsertTextResult> {
  const { documentId, text, index = 1 } = options;

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
  context.logger.info('Text inserted', { documentId, textLength: text.length, index });

  return {
    documentId,
    index,
    textLength: text.length,
    message: `Text inserted successfully at index ${index}`,
  };
}

/**
 * Options for replacing text
 */
export interface ReplaceTextOptions {
  /** Document ID */
  documentId: string;
  /** Text to search for */
  searchText: string;
  /** Text to replace with */
  replaceText: string;
  /** Whether to match case (default: false) */
  matchCase?: boolean;
}

/**
 * Result of replacing text
 */
export interface ReplaceTextResult {
  documentId: string;
  searchText: string;
  replaceText: string;
  message: string;
}

/**
 * Find and replace all occurrences of text in a document
 *
 * Replaces all instances of the search text with the replacement text.
 *
 * @param options Replace text parameters
 * @param context Docs API context
 * @returns Replace confirmation
 *
 * @example
 * ```typescript
 * // Replace all instances of "TODO" with "DONE"
 * await replaceText({
 *   documentId: 'abc123',
 *   searchText: 'TODO',
 *   replaceText: 'DONE',
 *   matchCase: true
 * }, context);
 *
 * // Update company name throughout document
 * await replaceText({
 *   documentId: 'abc123',
 *   searchText: 'Acme Corp',
 *   replaceText: 'Acme Corporation',
 *   matchCase: false
 * }, context);
 * ```
 */
export async function replaceText(
  options: ReplaceTextOptions,
  context: DocsContext
): Promise<ReplaceTextResult> {
  const { documentId, searchText, replaceText: replacement, matchCase = false } = options;

  await context.docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        replaceAllText: {
          containsText: {
            text: searchText,
            matchCase,
          },
          replaceText: replacement,
        },
      }],
    },
  });

  context.performanceMonitor.track('docs:replaceText', Date.now() - context.startTime);
  context.logger.info('Text replaced', { documentId, searchText, replaceText: replacement });

  return {
    documentId,
    searchText,
    replaceText: replacement,
    message: `All occurrences of "${searchText}" replaced with "${replacement}"`,
  };
}
