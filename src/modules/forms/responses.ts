import type { FormsContext } from '../types.js';

/**
 * Options for listing form responses
 */
export interface ListResponsesOptions {
  /** Form ID */
  formId: string;
}

/**
 * Answer to a form question
 */
export interface FormAnswer {
  questionId: string;
  answer: string;
}

/**
 * Form response metadata
 */
export interface FormResponse {
  responseId?: string | undefined;
  createTime?: string | undefined;
  lastSubmittedTime?: string | undefined;
  respondentEmail?: string | undefined;
  answers: FormAnswer[];
}

/**
 * Result of listing form responses
 */
export interface ListResponsesResult {
  formId: string;
  totalResponses: number;
  responses: FormResponse[];
}

/**
 * List all responses submitted to a form
 *
 * Retrieves all form submissions with answers to each question.
 *
 * @param options List responses parameters
 * @param context Forms API context
 * @returns Form responses with answers
 *
 * @example
 * ```typescript
 * const result = await listResponses({ formId: 'abc123' }, context);
 *
 * console.log(`Total responses: ${result.totalResponses}`);
 *
 * result.responses.forEach((response, i) => {
 *   console.log(`\nResponse ${i + 1}:`);
 *   console.log(`  Submitted: ${response.lastSubmittedTime}`);
 *   console.log(`  Email: ${response.respondentEmail || 'Anonymous'}`);
 *
 *   response.answers.forEach(answer => {
 *     console.log(`  - ${answer.questionId}: ${answer.answer}`);
 *   });
 * });
 * ```
 */
export async function listResponses(
  options: ListResponsesOptions,
  context: FormsContext
): Promise<ListResponsesResult> {
  const { formId } = options;

  const response = await context.forms.forms.responses.list({
    formId,
  });

  const responses: FormResponse[] = response.data.responses?.map((resp) => ({
    responseId: resp.responseId || undefined,
    createTime: resp.createTime || undefined,
    lastSubmittedTime: resp.lastSubmittedTime || undefined,
    respondentEmail: resp.respondentEmail || undefined,
    answers: resp.answers
      ? Object.entries(resp.answers).map(([questionId, answer]) => ({
          questionId,
          answer:
            answer.textAnswers?.answers?.[0]?.value ??
            (answer as { choiceAnswers?: { answers?: Array<{ value: string }> } })
              .choiceAnswers?.answers
              ?.map((a: { value: string }) => a.value)
              .join(", ") ??
            "No answer",
        }))
      : [],
  })) ?? [];

  context.performanceMonitor.track('forms:listResponses', Date.now() - context.startTime);

  return {
    formId,
    totalResponses: responses.length,
    responses,
  };
}
