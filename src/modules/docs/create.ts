import type { DocsContext } from '../types.js';

/**
 * Options for creating a new document
 */
export interface CreateDocumentOptions {
  /** Title of the document */
  title: string;
  /** Optional initial content */
  content?: string;
  /** Optional parent folder ID */
  parentId?: string;
}

/**
 * Result of creating a document
 */
export interface CreateDocumentResult {
  documentId: string;
  title: string;
  url: string;
  message: string;
}

/**
 * Create a new Google Doc
 *
 * @param options Document creation parameters
 * @param context Docs API context (requires both docs and drive APIs)
 * @returns Created document metadata with URL
 *
 * @example
 * ```typescript
 * const doc = await createDocument({
 *   title: 'Project Proposal',
 *   content: 'Executive Summary\n\nThis proposal outlines...',
 *   parentId: 'folderAbc123'
 * }, context);
 *
 * console.log(`Document created: ${doc.url}`);
 * ```
 */
export async function createDocument(
  options: CreateDocumentOptions,
  context: DocsContext
): Promise<CreateDocumentResult> {
  const { title, content, parentId } = options;

  // Create the document
  const createResponse = await context.docs.documents.create({
    requestBody: {
      title,
    },
  });

  const documentId = createResponse.data.documentId;

  if (!documentId) {
    throw new Error('Failed to create document - no document ID returned');
  }

  // If content is provided, insert it
  if (content) {
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
  // Note: This requires the drive API in the context
  if (parentId && 'drive' in context) {
    const driveContext = context as DocsContext & { drive: { files: { update: Function } } };
    await driveContext.drive.files.update({
      fileId: documentId,
      addParents: parentId,
    });
  }

  context.performanceMonitor.track('docs:create', Date.now() - context.startTime);
  context.logger.info('Document created', { documentId, title });

  return {
    documentId,
    title,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    message: `Document created successfully!`,
  };
}
