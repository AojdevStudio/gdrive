import type { drive_v3 } from 'googleapis';
import type { Logger } from 'winston';
import {
  DriveToolSchema,
  type DriveToolInput,
} from './drive-schemas.js';

interface CacheManagerLike {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

interface PerformanceMonitorLike {
  track(operation: string, duration: number, error?: boolean): void;
}

export interface DriveHandlerContext {
  logger: Logger;
  drive: drive_v3.Drive;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  startTime: number;
}

interface FileMetadata {
  name: string;
  mimeType?: string;
  parents?: string[];
  [key: string]: unknown;
}

const toErrorMessage = (error: unknown): string => {
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

// Handler for search operation
async function handleSearch(
  args: Extract<DriveToolInput, { operation: 'search' }>,
  context: DriveHandlerContext,
) {
  const { query, pageSize = 10 } = args;

  const cacheKey = `search:${query}:${pageSize}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('drive:search', Date.now() - context.startTime);
    return cached;
  }

  const response = await context.drive.files.list({
    q: `name contains '${query}' and trashed = false`,
    pageSize: Math.min(pageSize, 100),
    fields: "files(id, name, mimeType, createdTime, modifiedTime, webViewLink)",
  });

  const result = {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        query,
        totalResults: response.data.files?.length ?? 0,
        files: response.data.files ?? [],
      }, null, 2),
    }],
  };

  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('drive:search', Date.now() - context.startTime);

  return result;
}

// Handler for enhancedSearch operation
async function handleEnhancedSearch(
  args: Extract<DriveToolInput, { operation: 'enhancedSearch' }>,
  context: DriveHandlerContext,
) {
  const { query, filters, pageSize = 10, orderBy = "modifiedTime desc" } = args;

  let q = query ? `name contains '${query}'` : "";
  const filterConditions: string[] = [];

  if (filters) {
    if (filters.mimeType) {
      filterConditions.push(`mimeType = '${filters.mimeType}'`);
    }

    if (filters.modifiedAfter) {
      filterConditions.push(`modifiedTime > '${filters.modifiedAfter}'`);
    }

    if (filters.modifiedBefore) {
      filterConditions.push(`modifiedTime < '${filters.modifiedBefore}'`);
    }

    if (filters.createdAfter) {
      filterConditions.push(`createdTime > '${filters.createdAfter}'`);
    }

    if (filters.createdBefore) {
      filterConditions.push(`createdTime < '${filters.createdBefore}'`);
    }

    if (filters.sharedWithMe) {
      filterConditions.push("sharedWithMe = true");
    }

    if (filters.ownedByMe) {
      filterConditions.push("'me' in owners");
    }

    if (filters.parents) {
      filterConditions.push(`'${filters.parents}' in parents`);
    }

    if (!filters.trashed) {
      filterConditions.push("trashed = false");
    }
  } else {
    filterConditions.push("trashed = false");
  }

  // Combine query and filters
  if (filterConditions.length > 0) {
    q = q ? `${q} and ${filterConditions.join(" and ")}` : filterConditions.join(" and ");
  }

  const cacheKey = `enhancedSearch:${q}:${pageSize}:${orderBy}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('drive:enhancedSearch', Date.now() - context.startTime);
    return cached;
  }

  const response = await context.drive.files.list({
    q: q ?? undefined,
    pageSize: Math.min(pageSize, 100),
    fields: "files(id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink, iconLink, owners, permissions, description, starred)",
    orderBy,
  });

  const result = {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        query: q,
        totalResults: response.data.files?.length ?? 0,
        files: response.data.files ?? [],
      }, null, 2),
    }],
  };

  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('drive:enhancedSearch', Date.now() - context.startTime);

  return result;
}

// Handler for read operation
async function handleRead(
  args: Extract<DriveToolInput, { operation: 'read' }>,
  context: DriveHandlerContext,
) {
  const { fileId } = args;

  const cacheKey = `read:${fileId}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('drive:read', Date.now() - context.startTime);
    return cached;
  }

  const file = await context.drive.files.get({
    fileId,
    fields: "id, name, mimeType",
  });

  let text = "";

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

    text = response.data as string;
  } else if (file.data.mimeType?.startsWith("text/")) {
    // Download text files
    const response = await context.drive.files.get({
      fileId,
      alt: "media",
    });

    text = response.data as string;
  } else {
    text = `Binary file (${file.data.mimeType}). Use the resource URI to access the full content.`;
  }

  const result = {
    content: [{
      type: "text" as const,
      text: text,
    }],
  };

  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('drive:read', Date.now() - context.startTime);

  return result;
}

// Handler for create operation
async function handleCreate(
  args: Extract<DriveToolInput, { operation: 'create' }>,
  context: DriveHandlerContext,
) {
  const { name, content, mimeType = "text/plain", parentId } = args;

  const fileMetadata: FileMetadata = {
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
    content: [{
      type: "text" as const,
      text: `File created successfully!\nID: ${response.data.id}\nName: ${response.data.name}\nLink: ${response.data.webViewLink}`,
    }],
  };
}

// Handler for update operation
async function handleUpdate(
  args: Extract<DriveToolInput, { operation: 'update' }>,
  context: DriveHandlerContext,
) {
  const { fileId, content } = args;

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
    content: [{
      type: "text" as const,
      text: `File ${fileId} updated successfully!`,
    }],
  };
}

// Handler for createFolder operation
async function handleCreateFolder(
  args: Extract<DriveToolInput, { operation: 'createFolder' }>,
  context: DriveHandlerContext,
) {
  const { name, parentId } = args;

  const fileMetadata: FileMetadata = {
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
    content: [{
      type: "text" as const,
      text: `Folder created successfully!\nID: ${response.data.id}\nName: ${response.data.name}\nLink: ${response.data.webViewLink}`,
    }],
  };
}

// Handler for batch operation
async function handleBatch(
  args: Extract<DriveToolInput, { operation: 'batch' }>,
  context: DriveHandlerContext,
) {
  const { operations } = args;
  const results = [];
  const errors = [];

  for (const op of operations) {
    try {
      switch (op.type) {
        case "create": {
          const fileMetadata: FileMetadata = {
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
            fileId: response.data.id,
            name: response.data.name,
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
        error: toErrorMessage(error),
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
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        summary: {
          total: operations.length,
          successful: results.length,
          failed: errors.length,
        },
        results,
        errors,
      }, null, 2),
    }],
  };
}

// Main handler function
export async function handleDriveTool(
  rawArgs: unknown,
  context: DriveHandlerContext,
) {
  const validated = DriveToolSchema.parse(rawArgs);

  context.logger.info('Executing consolidated drive tool', {
    operation: validated.operation,
  });

  switch (validated.operation) {
    case 'search':
      return handleSearch(validated, context);
    case 'enhancedSearch':
      return handleEnhancedSearch(validated, context);
    case 'read':
      return handleRead(validated, context);
    case 'create':
      return handleCreate(validated, context);
    case 'update':
      return handleUpdate(validated, context);
    case 'createFolder':
      return handleCreateFolder(validated, context);
    case 'batch':
      return handleBatch(validated, context);
    default: {
      const exhaustiveCheck: never = validated;
      throw new Error(`Unhandled drive operation: ${(exhaustiveCheck as DriveToolInput).operation}`);
    }
  }
}
