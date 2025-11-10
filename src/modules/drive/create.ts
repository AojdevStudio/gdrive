import type { DriveContext } from '../types.js';

/**
 * Options for creating a new file
 */
export interface CreateFileOptions {
  /** Name of the file to create */
  name: string;
  /** File content as string */
  content: string;
  /** MIME type (default: "text/plain") */
  mimeType?: string;
  /** Parent folder ID (optional) */
  parentId?: string;
}

/**
 * Result of file creation
 */
export interface CreateFileResult {
  fileId: string;
  name: string;
  webViewLink?: string | undefined;
  message: string;
}

/**
 * Create a new file in Google Drive
 *
 * @param options File creation parameters
 * @param context Drive API context
 * @returns Created file metadata
 *
 * @example
 * ```typescript
 * const file = await createFile({
 *   name: 'report.txt',
 *   content: 'Q1 Sales Report...',
 *   mimeType: 'text/plain',
 *   parentId: 'folder123'
 * }, context);
 * console.log(`Created: ${file.webViewLink}`);
 * ```
 */
export async function createFile(
  options: CreateFileOptions,
  context: DriveContext
): Promise<CreateFileResult> {
  const { name, content, mimeType = "text/plain", parentId } = options;

  const fileMetadata: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name,
    mimeType,
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const media = {
    mimeType,
    body: content,
  };

  const response = await context.drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, name, webViewLink",
  });

  // Invalidate cache
  await context.cacheManager.invalidate('resources:*');
  await context.cacheManager.invalidate('search:*');

  context.performanceMonitor.track('drive:create', Date.now() - context.startTime);
  context.logger.info('File created', { fileId: response.data.id, name });

  return {
    fileId: response.data.id!,
    name: response.data.name!,
    webViewLink: response.data.webViewLink || undefined,
    message: `File created successfully!`,
  };
}

/**
 * Options for creating a new folder
 */
export interface CreateFolderOptions {
  /** Name of the folder to create */
  name: string;
  /** Parent folder ID (optional) */
  parentId?: string;
}

/**
 * Result of folder creation
 */
export interface CreateFolderResult {
  folderId: string;
  name: string;
  webViewLink?: string | undefined;
  message: string;
}

/**
 * Create a new folder in Google Drive
 *
 * @param options Folder creation parameters
 * @param context Drive API context
 * @returns Created folder metadata
 *
 * @example
 * ```typescript
 * const folder = await createFolder({
 *   name: '2025 Reports',
 *   parentId: 'parentFolder123'
 * }, context);
 * console.log(`Folder ID: ${folder.folderId}`);
 * ```
 */
export async function createFolder(
  options: CreateFolderOptions,
  context: DriveContext
): Promise<CreateFolderResult> {
  const { name, parentId } = options;

  const fileMetadata: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const response = await context.drive.files.create({
    requestBody: fileMetadata,
    fields: "id, name, webViewLink",
  });

  // Invalidate cache
  await context.cacheManager.invalidate('resources:*');
  await context.cacheManager.invalidate('search:*');

  context.performanceMonitor.track('drive:createFolder', Date.now() - context.startTime);
  context.logger.info('Folder created', { folderId: response.data.id, name });

  return {
    folderId: response.data.id!,
    name: response.data.name!,
    webViewLink: response.data.webViewLink || undefined,
    message: `Folder created successfully!`,
  };
}
