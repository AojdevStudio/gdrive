import { z } from 'zod';

// Define the operation enum for Docs operations
const DocsOperationEnum = z.enum([
  'create',
  'insertText',
  'replaceText',
  'applyTextStyle',
  'insertTable',
]);

// Base schema with common field
const DocsBaseSchema = z.object({
  operation: DocsOperationEnum,
  documentId: z.string().min(1, 'Document ID is required'),
});

// Color schema for text styling
const ColorSchema = z.object({
  red: z.number().min(0).max(1),
  green: z.number().min(0).max(1),
  blue: z.number().min(0).max(1),
}).strict();

// Individual operation schemas
export const DocsCreateSchema = z.object({
  operation: z.literal('create'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  parentId: z.string().optional(),
});

export const DocsInsertTextSchema = DocsBaseSchema.extend({
  operation: z.literal('insertText'),
  text: z.string().min(1, 'Text is required'),
  index: z.number().int().min(1).optional(),
});

export const DocsReplaceTextSchema = DocsBaseSchema.extend({
  operation: z.literal('replaceText'),
  searchText: z.string().min(1, 'Search text is required'),
  replaceText: z.string().min(1, 'Replace text is required'),
  matchCase: z.boolean().optional(),
});

export const DocsApplyTextStyleSchema = DocsBaseSchema.extend({
  operation: z.literal('applyTextStyle'),
  startIndex: z.number().int().min(0),
  endIndex: z.number().int().min(0),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  fontSize: z.number().int().min(1).optional(),
  foregroundColor: ColorSchema.optional(),
});

export const DocsInsertTableSchema = DocsBaseSchema.extend({
  operation: z.literal('insertTable'),
  rows: z.number().int().min(1, 'Rows must be at least 1'),
  columns: z.number().int().min(1, 'Columns must be at least 1'),
  index: z.number().int().min(1).optional(),
});

// Main discriminated union schema for Docs tool
export const DocsToolSchema = z.discriminatedUnion('operation', [
  DocsCreateSchema,
  DocsInsertTextSchema,
  DocsReplaceTextSchema,
  DocsApplyTextStyleSchema,
  DocsInsertTableSchema,
]);

export type DocsToolInput = z.infer<typeof DocsToolSchema>;
export type DocsOperation = DocsToolInput['operation'];
