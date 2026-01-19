import { z } from 'zod';

// Define the operation enum for Forms operations
const FormsOperationEnum = z.enum([
  'create',
  'read',
  'addQuestion',
  'listResponses',
]);

// Base schema with common field
const FormsBaseSchema = z.object({
  operation: FormsOperationEnum,
  formId: z.string().min(1, 'Form ID is required'),
});

// Question type enum
const QuestionTypeEnum = z.enum([
  'TEXT',
  'PARAGRAPH_TEXT',
  'MULTIPLE_CHOICE',
  'CHECKBOX',
  'DROPDOWN',
  'LINEAR_SCALE',
  'DATE',
  'TIME',
]);

// Individual operation schemas
export const FormsCreateSchema = z.object({
  operation: z.literal('create'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
});

export const FormsReadSchema = FormsBaseSchema.extend({
  operation: z.literal('read'),
});

export const FormsAddQuestionSchema = FormsBaseSchema.extend({
  operation: z.literal('addQuestion'),
  title: z.string().min(1, 'Question title is required'),
  type: QuestionTypeEnum,
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  scaleMin: z.number().int().optional(),
  scaleMax: z.number().int().optional(),
  scaleMinLabel: z.string().optional(),
  scaleMaxLabel: z.string().optional(),
});

export const FormsListResponsesSchema = FormsBaseSchema.extend({
  operation: z.literal('listResponses'),
});

// Main discriminated union schema for Forms tool
export const FormsToolSchema = z.discriminatedUnion('operation', [
  FormsCreateSchema,
  FormsReadSchema,
  FormsAddQuestionSchema,
  FormsListResponsesSchema,
]);

export type FormsToolInput = z.infer<typeof FormsToolSchema>;
export type FormsOperation = FormsToolInput['operation'];
export type QuestionType = z.infer<typeof QuestionTypeEnum>;
