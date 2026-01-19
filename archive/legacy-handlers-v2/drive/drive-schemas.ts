import { z } from 'zod';

// Define the operation enum for Drive operations
const DriveOperationEnum = z.enum([
  'search',
  'enhancedSearch',
  'read',
  'create',
  'update',
  'createFolder',
  'batch',
]);

// Base schema with common field
const DriveBaseSchema = z.object({
  operation: DriveOperationEnum,
});

// Search filters schema for enhancedSearch
const SearchFiltersSchema = z.object({
  mimeType: z.string().optional(),
  modifiedAfter: z.string().optional(),
  modifiedBefore: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  sharedWithMe: z.boolean().optional(),
  ownedByMe: z.boolean().optional(),
  parents: z.string().optional(),
  trashed: z.boolean().optional(),
}).strict();

// Batch operation schemas
const BatchCreateOpSchema = z.object({
  type: z.literal('create'),
  name: z.string().min(1),
  content: z.string(),
  mimeType: z.string().optional(),
  parentId: z.string().optional(),
}).strict();

const BatchUpdateOpSchema = z.object({
  type: z.literal('update'),
  fileId: z.string().min(1),
  content: z.string().optional(),
  name: z.string().optional(),
}).strict();

const BatchDeleteOpSchema = z.object({
  type: z.literal('delete'),
  fileId: z.string().min(1),
}).strict();

const BatchMoveOpSchema = z.object({
  type: z.literal('move'),
  fileId: z.string().min(1),
  parentId: z.string().min(1),
}).strict();

const BatchOperationSchema = z.discriminatedUnion('type', [
  BatchCreateOpSchema,
  BatchUpdateOpSchema,
  BatchDeleteOpSchema,
  BatchMoveOpSchema,
]);

// Individual operation schemas
export const DriveSearchSchema = DriveBaseSchema.extend({
  operation: z.literal('search'),
  query: z.string().min(1, 'Query is required'),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export const DriveEnhancedSearchSchema = DriveBaseSchema.extend({
  operation: z.literal('enhancedSearch'),
  query: z.string(),
  filters: SearchFiltersSchema.optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  orderBy: z.string().optional(),
});

export const DriveReadSchema = DriveBaseSchema.extend({
  operation: z.literal('read'),
  fileId: z.string().min(1, 'File ID is required'),
});

export const DriveCreateSchema = DriveBaseSchema.extend({
  operation: z.literal('create'),
  name: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Content is required'),
  mimeType: z.string().optional(),
  parentId: z.string().optional(),
});

export const DriveUpdateSchema = DriveBaseSchema.extend({
  operation: z.literal('update'),
  fileId: z.string().min(1, 'File ID is required'),
  content: z.string().min(1, 'Content is required'),
});

export const DriveCreateFolderSchema = DriveBaseSchema.extend({
  operation: z.literal('createFolder'),
  name: z.string().min(1, 'Folder name is required'),
  parentId: z.string().optional(),
});

export const DriveBatchSchema = DriveBaseSchema.extend({
  operation: z.literal('batch'),
  operations: z.array(BatchOperationSchema).min(1, 'At least one operation is required'),
});

// Main discriminated union schema for Drive tool
export const DriveToolSchema = z.discriminatedUnion('operation', [
  DriveSearchSchema,
  DriveEnhancedSearchSchema,
  DriveReadSchema,
  DriveCreateSchema,
  DriveUpdateSchema,
  DriveCreateFolderSchema,
  DriveBatchSchema,
]);

export type DriveToolInput = z.infer<typeof DriveToolSchema>;
export type DriveOperation = DriveToolInput['operation'];
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type BatchOperation = z.infer<typeof BatchOperationSchema>;
