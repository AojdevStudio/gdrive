/**
 * Google Drive operations module
 *
 * This module provides programmatic access to Google Drive operations
 * for use in code execution environments.
 *
 * @example
 * ```typescript
 * import { search, read, createFile } from './modules/drive';
 *
 * // Search for files
 * const results = await search({ query: 'reports', pageSize: 20 });
 *
 * // Read file content
 * const file = await read({ fileId: results.files[0].id });
 *
 * // Create new file
 * const newFile = await createFile({
 *   name: 'summary.txt',
 *   content: 'Summary of findings...'
 * });
 * ```
 */

// Search operations
export {
  search,
  enhancedSearch,
  type SearchOptions,
  type SearchResult,
  type DriveFile,
  type EnhancedSearchOptions,
  type EnhancedSearchResult,
  type EnhancedDriveFile,
  type SearchFilters,
} from './search.js';

// Read operations
export {
  read,
  type ReadOptions,
  type ReadResult,
} from './read.js';

// Create operations
export {
  createFile,
  createFolder,
  type CreateFileOptions,
  type CreateFileResult,
  type CreateFolderOptions,
  type CreateFolderResult,
} from './create.js';

// Update operations
export {
  updateFile,
  type UpdateFileOptions,
  type UpdateFileResult,
} from './update.js';

// Batch operations
export {
  batchOperations,
  type BatchOperationsOptions,
  type BatchOperationsResult,
  type BatchOperation,
  type BatchCreateOperation,
  type BatchUpdateOperation,
  type BatchDeleteOperation,
  type BatchMoveOperation,
  type BatchOperationResult,
  type BatchOperationError,
  type BatchOperationsSummary,
} from './batch.js';
