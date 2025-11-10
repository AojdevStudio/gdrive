import type { DriveContext } from '../types.js';

/**
 * Options for reading file content
 */
export interface ReadOptions {
  /** ID of the file to read */
  fileId: string;
}

/**
 * Result of reading a file
 */
export interface ReadResult {
  fileId: string;
  name: string;
  mimeType: string;
  content: string;
}

/**
 * Read the content of a Google Drive file
 *
 * Automatically handles different file types:
 * - Google Docs → Exported as Markdown
 * - Google Sheets → Exported as CSV
 * - Google Slides → Exported as plain text
 * - Text files → Direct content
 * - Binary files → Returns placeholder message
 *
 * @param options Read parameters with fileId
 * @param context Drive API context
 * @returns File content with metadata
 *
 * @example
 * ```typescript
 * const file = await read({ fileId: 'abc123' }, context);
 * console.log(`File: ${file.name}`);
 * console.log(`Content: ${file.content}`);
 * ```
 */
export async function read(
  options: ReadOptions,
  context: DriveContext
): Promise<ReadResult> {
  const { fileId } = options;

  // Check cache
  const cacheKey = `read:${fileId}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('drive:read', Date.now() - context.startTime);
    return cached as ReadResult;
  }

  // Get file metadata
  const file = await context.drive.files.get({
    fileId,
    fields: "id, name, mimeType",
  });

  let content = "";

  // Handle different file types
  if (file.data.mimeType?.startsWith("application/vnd.google-apps.")) {
    // Export Google Workspace files
    let exportMimeType = "text/plain";

    if (file.data.mimeType === "application/vnd.google-apps.document") {
      exportMimeType = "text/markdown";
    } else if (file.data.mimeType === "application/vnd.google-apps.spreadsheet") {
      exportMimeType = "text/csv";
    } else if (file.data.mimeType === "application/vnd.google-apps.presentation") {
      exportMimeType = "text/plain";
    }

    const response = await context.drive.files.export({
      fileId,
      mimeType: exportMimeType,
    });

    content = response.data as string;
  } else if (file.data.mimeType?.startsWith("text/")) {
    // Download text files directly
    const response = await context.drive.files.get({
      fileId,
      alt: "media",
    });

    content = response.data as string;
  } else {
    // Binary files
    content = `Binary file (${file.data.mimeType}). Use the resource URI gdrive:///${fileId} to access the full content.`;
  }

  const result: ReadResult = {
    fileId: file.data.id!,
    name: file.data.name!,
    mimeType: file.data.mimeType!,
    content,
  };

  // Cache result
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('drive:read', Date.now() - context.startTime);

  return result;
}
