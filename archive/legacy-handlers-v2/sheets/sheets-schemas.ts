import { z } from 'zod';

const SheetsOperationEnum = z.enum([
  'list',
  'read',
  'create',
  'rename',
  'delete',
  'update',
  'updateFormula',
  'format',
  'conditionalFormat',
  'append',
  'freeze',
  'setColumnWidth',
]);

const SheetsBaseSchema = z.object({
  operation: SheetsOperationEnum,
  spreadsheetId: z.string().min(1, 'Spreadsheet ID is required'),
});

const ColorChannelSchema = z
  .object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional(),
    alpha: z.number().min(0).max(1).optional(),
  })
  .strict();

const NumberFormatSchema = z
  .object({
    type: z.string().min(1),
    pattern: z.string().min(1).optional(),
  })
  .strict();

const FormatSchema = z
  .object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    fontSize: z.coerce.number().int().min(1).optional(),
    foregroundColor: ColorChannelSchema.optional(),
    backgroundColor: ColorChannelSchema.optional(),
    numberFormat: NumberFormatSchema.optional(),
  })
  .strict();

const ConditionalFormatConditionSchema = z
  .object({
    type: z.enum(['NUMBER_GREATER', 'NUMBER_LESS', 'TEXT_CONTAINS', 'CUSTOM_FORMULA']),
    values: z.array(z.string().min(1)).nonempty().optional(),
    formula: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === 'CUSTOM_FORMULA' && !data.formula) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'formula is required when type is CUSTOM_FORMULA',
        path: ['formula'],
      });
    }

    const requiresValues = data.type === 'NUMBER_GREATER' || data.type === 'NUMBER_LESS' || data.type === 'TEXT_CONTAINS';
    if (requiresValues && (!data.values || data.values.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'values must include at least one entry for this condition type',
        path: ['values'],
      });
    }
  });

const ConditionalFormatSchema = z
  .object({
    condition: ConditionalFormatConditionSchema,
    format: z
      .object({
        backgroundColor: ColorChannelSchema.optional(),
        foregroundColor: ColorChannelSchema.optional(),
        bold: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();

const ColumnWidthSchema = z
  .object({
    columnIndex: z.coerce.number().int().min(0),
    width: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const SheetsListSchema = SheetsBaseSchema.extend({
  operation: z.literal('list'),
});

export const SheetsReadSchema = SheetsBaseSchema.extend({
  operation: z.literal('read'),
  range: z.string().min(1, 'Range is required'),
  sheetName: z.string().min(1).optional(),
  sheetId: z.coerce.number().int().min(0).optional(),
});

export const SheetsCreateSchema = SheetsBaseSchema.extend({
  operation: z.literal('create'),
  sheetName: z.string().min(1, 'sheetName is required'),
  title: z.string().min(1).optional(),
  index: z.coerce.number().int().min(0).optional(),
  hidden: z.boolean().optional(),
  rightToLeft: z.boolean().optional(),
  rowCount: z.coerce.number().int().min(1).optional(),
  columnCount: z.coerce.number().int().min(1).optional(),
  frozenRowCount: z.coerce.number().int().min(0).optional(),
  frozenColumnCount: z.coerce.number().int().min(0).optional(),
  tabColor: ColorChannelSchema.optional(),
});

const SheetsRenameSchemaBase = SheetsBaseSchema.extend({
  operation: z.literal('rename'),
  sheetName: z.string().min(1).optional(),
  sheetId: z.coerce.number().int().min(0).optional(),
  newName: z.string().min(1, 'newName is required'),
});

export const SheetsRenameSchema = SheetsRenameSchemaBase;

const SheetsDeleteSchemaBase = SheetsBaseSchema.extend({
  operation: z.literal('delete'),
  sheetName: z.string().min(1).optional(),
  sheetId: z.coerce.number().int().min(0).optional(),
});

export const SheetsDeleteSchema = SheetsDeleteSchemaBase;

export const SheetsUpdateSchema = SheetsBaseSchema.extend({
  operation: z.literal('update'),
  range: z.string().min(1),
  values: z.array(z.array(z.unknown())),
  sheetName: z.string().min(1).optional(),
  sheetId: z.coerce.number().int().min(0).optional(),
});

export const SheetsUpdateFormulaSchema = SheetsBaseSchema.extend({
  operation: z.literal('updateFormula'),
  range: z.string().min(1),
  formula: z.string().min(1),
  sheetName: z.string().min(1).optional(),
});

export const SheetsFormatSchema = SheetsBaseSchema.extend({
  operation: z.literal('format'),
  range: z.string().min(1),
  format: FormatSchema,
});

export const SheetsConditionalFormatSchema = SheetsBaseSchema.extend({
  operation: z.literal('conditionalFormat'),
  range: z.string().min(1),
  rule: ConditionalFormatSchema,
});

export const SheetsAppendSchema = SheetsBaseSchema.extend({
  operation: z.literal('append'),
  values: z.array(z.array(z.unknown())).nonempty(),
  sheetName: z.string().min(1).optional(),
});

export const SheetsFreezeSchema = SheetsBaseSchema.extend({
  operation: z.literal('freeze'),
  sheetName: z.string().min(1).optional(),
  frozenRowCount: z.coerce.number().int().min(0).optional(),
  frozenColumnCount: z.coerce.number().int().min(0).optional(),
});

export const SheetsSetColumnWidthSchema = SheetsBaseSchema.extend({
  operation: z.literal('setColumnWidth'),
  sheetName: z.string().min(1).optional(),
  columns: z.array(ColumnWidthSchema).min(1),
});

export const SheetsToolSchema = z.discriminatedUnion('operation', [
  SheetsListSchema,
  SheetsReadSchema,
  SheetsCreateSchema,
  SheetsRenameSchema,
  SheetsDeleteSchema,
  SheetsUpdateSchema,
  SheetsUpdateFormulaSchema,
  SheetsFormatSchema,
  SheetsConditionalFormatSchema,
  SheetsAppendSchema,
  SheetsFreezeSchema,
  SheetsSetColumnWidthSchema,
])
  .refine(
    (data) => data.operation !== 'rename' || data.sheetName !== undefined || data.sheetId !== undefined,
    {
      message: 'Either sheetName or sheetId must be provided',
      path: ['sheetName'],
    },
  )
  .refine(
    (data) => data.operation !== 'delete' || data.sheetName !== undefined || data.sheetId !== undefined,
    {
      message: 'Either sheetName or sheetId must be provided',
      path: ['sheetName'],
    },
  );

export type SheetsToolInput = z.infer<typeof SheetsToolSchema>;
export type SheetsOperation = SheetsToolInput['operation'];
