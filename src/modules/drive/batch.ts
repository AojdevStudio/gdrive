import type { DriveContext } from '../types.js';

/**
 * Batch operation types
 */
export type BatchOperationType = 'create' | 'update' | 'delete' | 'move';

/**
 * Create operation for batch
 */
export interface BatchCreateOperation {
  type: 'create';
  name: string;
  content: string;
  mimeType?: string;
  parentId?: string;
}

/**
 * Update operation for batch
 */
export interface BatchUpdateOperation {
  type: 'update';
  fileId: string;
  name?: string;
  content?: string;
}

/**
 * Delete operation for batch
 */
export interface BatchDeleteOperation {
  type: 'delete';
  fileId: string;
}

/**
 * Move operation for batch
 */
export interface BatchMoveOperation {
  type: 'move';
  fileId: string;
  parentId: string;
}

/**
 * Union type of all batch operations
 */
export type BatchOperation =
  | BatchCreateOperation
  | BatchUpdateOperation
  | BatchDeleteOperation
  | BatchMoveOperation;

/**
 * Options for batch operations
 */
export interface BatchOperationsOptions {
  /** Array of operations to perform */
  operations: BatchOperation[];
}

/**
 * Result of a single batch operation
 */
export interface BatchOperationResult {
  type: BatchOperationType;
  success: boolean;
  fileId?: string;
  name?: string;
  newParentId?: string;
}

/**
 * Error from a batch operation
 */
export interface BatchOperationError {
  operation: BatchOperation;
  error: string;
}

/**
 * Summary of batch operations
 */
export interface BatchOperationsSummary {
  total: number;
  successful: number;
  failed: number;
}

/**
 * Result of batch operations
 */
export interface BatchOperationsResult {
  summary: BatchOperationsSummary;
  results: BatchOperationResult[];
  errors: BatchOperationError[];
}

/**
 * Convert unknown error to error message string
 */
const toErrorMsg = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

/**
 * Execute multiple Google Drive operations in a single batch
 *
 * Supports create, update, delete, and move operations.
 * Each operation is executed sequentially with error handling.
 *
 * @param options Batch operations parameters
 * @param context Drive API context
 * @returns Summary and results of all operations
 *
 * @example
 * ```typescript
 * const result = await batchOperations({
 *   operations: [
 *     { type: 'create', name: 'file1.txt', content: 'Content 1' },
 *     { type: 'create', name: 'file2.txt', content: 'Content 2' },
 *     { type: 'update', fileId: 'abc123', content: 'Updated content' },
 *     { type: 'delete', fileId: 'xyz789' },
 *     { type: 'move', fileId: 'def456', parentId: 'folder123' }
 *   ]
 * }, context);
 *
 * console.log(`Successful: ${result.summary.successful}`);
 * console.log(`Failed: ${result.summary.failed}`);
 * ```
 */
export async function batchOperations(
  options: BatchOperationsOptions,
  context: DriveContext
): Promise<BatchOperationsResult> {
  const { operations } = options;
  const results: BatchOperationResult[] = [];
  const errors: BatchOperationError[] = [];

  for (const op of operations) {
    try {
      switch (op.type) {
        case "create": {
          const fileMetadata: {
            name: string;
            mimeType: string;
            parents?: string[];
          } = {
            name: op.name,
            mimeType: op.mimeType ?? "text/plain",
          };

          if (op.parentId) {
            fileMetadata.parents = [op.parentId];
          }

          const response = await context.drive.files.create({
            requestBody: fileMetadata,
            media: {
              mimeType: op.mimeType ?? "text/plain",
              body: op.content,
            },
            fields: "id, name",
          });

          results.push({
            type: "create",
            success: true,
            fileId: response.data.id!,
            name: response.data.name!,
          });
          break;
        }

        case "update": {
          const updateParams: {
            fileId: string;
            requestBody?: { name?: string };
            media?: { mimeType: string; body: string };
          } = {
            fileId: op.fileId,
            requestBody: op.name ? { name: op.name } : {},
          };

          if (op.content) {
            updateParams.media = {
              mimeType: "text/plain",
              body: op.content,
            };
          }

          await context.drive.files.update(updateParams);

          results.push({
            type: "update",
            success: true,
            fileId: op.fileId,
          });
          break;
        }

        case "delete": {
          await context.drive.files.delete({
            fileId: op.fileId,
          });

          results.push({
            type: "delete",
            success: true,
            fileId: op.fileId,
          });
          break;
        }

        case "move": {
          // Get current parents
          const file = await context.drive.files.get({
            fileId: op.fileId,
            fields: "parents",
          });

          const previousParents = file.data.parents?.join(",") ?? "";

          await context.drive.files.update({
            fileId: op.fileId,
            addParents: op.parentId,
            removeParents: previousParents,
          });

          results.push({
            type: "move",
            success: true,
            fileId: op.fileId,
            newParentId: op.parentId,
          });
          break;
        }
      }
    } catch (error: unknown) {
      errors.push({
        operation: op,
        error: toErrorMsg(error),
      });
    }
  }

  // Invalidate cache
  await context.cacheManager.invalidate('resources:*');
  await context.cacheManager.invalidate('search:*');

  context.performanceMonitor.track('drive:batch', Date.now() - context.startTime);
  context.logger.info('Batch operations completed', {
    total: operations.length,
    successful: results.length,
    failed: errors.length
  });

  return {
    summary: {
      total: operations.length,
      successful: results.length,
      failed: errors.length,
    },
    results,
    errors,
  };
}
