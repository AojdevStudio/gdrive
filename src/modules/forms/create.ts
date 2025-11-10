import type { FormsContext } from '../types.js';

/**
 * Options for creating a new form
 */
export interface CreateFormOptions {
  /** Title of the form */
  title: string;
  /** Optional description */
  description?: string;
}

/**
 * Result of creating a form
 */
export interface CreateFormResult {
  formId: string;
  title: string;
  editUrl: string;
  responseUrl: string;
  message: string;
}

/**
 * Create a new Google Form
 *
 * @param options Form creation parameters
 * @param context Forms API context
 * @returns Created form metadata with URLs
 *
 * @example
 * ```typescript
 * const form = await createForm({
 *   title: 'Customer Feedback Survey',
 *   description: 'Please share your experience with our service'
 * }, context);
 *
 * console.log(`Form created: ${form.editUrl}`);
 * console.log(`Share with users: ${form.responseUrl}`);
 * ```
 */
export async function createForm(
  options: CreateFormOptions,
  context: FormsContext
): Promise<CreateFormResult> {
  const { title, description } = options;

  const createResponse = await context.forms.forms.create({
    requestBody: {
      info: {
        title,
        documentTitle: title,
      },
    },
  });

  const formId = createResponse.data.formId;

  if (!formId) {
    throw new Error('Failed to create form - no form ID returned');
  }

  // If description is provided, update the form
  if (description) {
    await context.forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [{
          updateFormInfo: {
            info: {
              description,
            },
            updateMask: "description",
          },
        }],
      },
    });
  }

  context.performanceMonitor.track('forms:create', Date.now() - context.startTime);
  context.logger.info('Form created', { formId, title });

  return {
    formId,
    title,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    responseUrl: `https://docs.google.com/forms/d/${formId}/viewform`,
    message: `Form created successfully!`,
  };
}
