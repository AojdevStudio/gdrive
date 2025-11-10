import type { FormsContext } from '../types.js';

/**
 * Options for reading form metadata
 */
export interface ReadFormOptions {
  /** Form ID */
  formId: string;
}

/**
 * Question metadata
 */
export interface FormQuestion {
  itemId?: string | undefined;
  index: number;
  title?: string | undefined;
  description?: string | undefined;
  type: string | undefined;
  required: boolean;
}

/**
 * Result of reading a form
 */
export interface ReadFormResult {
  formId?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  publishedUrl?: string | undefined;
  editUrl: string;
  questions: FormQuestion[];
}

/**
 * Get form metadata including questions
 *
 * @param options Read parameters with formId
 * @param context Forms API context
 * @returns Form metadata and questions
 *
 * @example
 * ```typescript
 * const form = await readForm({ formId: 'abc123' }, context);
 *
 * console.log(`Form: ${form.title}`);
 * console.log(`Questions: ${form.questions.length}`);
 *
 * form.questions.forEach((q, i) => {
 *   console.log(`${i + 1}. ${q.title} (${q.type}) ${q.required ? '*' : ''}`);
 * });
 * ```
 */
export async function readForm(
  options: ReadFormOptions,
  context: FormsContext
): Promise<ReadFormResult> {
  const { formId } = options;

  const response = await context.forms.forms.get({
    formId,
  });

  const questions: FormQuestion[] = response.data.items?.map((item, index) => ({
    itemId: item.itemId || undefined,
    index,
    title: item.title || undefined,
    description: item.description || undefined,
    type: item.questionItem?.question ? Object.keys(item.questionItem.question)[0] : 'unknown',
    required: Boolean(item.questionItem && 'required' in item.questionItem && item.questionItem.required),
  })) ?? [];

  context.performanceMonitor.track('forms:read', Date.now() - context.startTime);

  return {
    formId: response.data.formId || undefined,
    title: response.data.info?.title || undefined,
    description: response.data.info?.description || undefined,
    publishedUrl: response.data.responderUri || undefined,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    questions,
  };
}
