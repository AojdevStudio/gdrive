import type { DriveContext } from '../types.js';

/**
 * Options for updating a file
 */
export interface UpdateFileOptions {
  /** ID of the file to update */
  fileId: string;
  /** New content for the file */
  content: string;
}

/**
 * Result of file update
 */
export interface UpdateFileResult {
  fileId: string;
  message: string;
}

/**
 * Update the content of an existing file in Google Drive
 *
 * @param options Update parameters with fileId and new content
 * @param context Drive API context
 * @returns Update confirmation
 *
 * @example
 * ```typescript
 * const result = await updateFile({
 *   fileId: 'abc123',
 *   content: 'Updated content...'
 * }, context);
 * console.log(result.message);
 * ```
 */
export async function updateFile(
  options: UpdateFileOptions,
  context: DriveContext
): Promise<UpdateFileResult> {
  const { fileId, content } = options;

  const media = {
    mimeType: "text/plain",
    body: content,
  };

  await context.drive.files.update({
    fileId,
    media,
  });

  // Invalidate cache
  await context.cacheManager.invalidate(`read:${fileId}`);
  await context.cacheManager.invalidate(`resource:${fileId}`);

  context.performanceMonitor.track('drive:update', Date.now() - context.startTime);
  context.logger.info('File updated', { fileId });

  return {
    fileId,
    message: `File ${fileId} updated successfully!`,
  };
}
