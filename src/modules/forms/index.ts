/**
 * Google Forms operations module
 *
 * This module provides programmatic access to Google Forms operations
 * for use in code execution environments.
 *
 * @example
 * ```typescript
 * import { createForm, addQuestion, listResponses } from './modules/forms';
 *
 * // Create a new form
 * const form = await createForm({
 *   title: 'Customer Feedback',
 *   description: 'Help us improve our service'
 * });
 *
 * // Add questions
 * await addQuestion({
 *   formId: form.formId,
 *   title: 'How satisfied are you?',
 *   type: 'LINEAR_SCALE',
 *   required: true,
 *   scaleMin: 1,
 *   scaleMax: 5
 * });
 *
 * await addQuestion({
 *   formId: form.formId,
 *   title: 'What can we improve?',
 *   type: 'PARAGRAPH_TEXT',
 *   required: false
 * });
 *
 * // Later, get responses
 * const responses = await listResponses({ formId: form.formId });
 * console.log(`Received ${responses.totalResponses} responses`);
 * ```
 */

// Create operations
export {
  createForm,
  type CreateFormOptions,
  type CreateFormResult,
} from './create.js';

// Read operations
export {
  readForm,
  type ReadFormOptions,
  type ReadFormResult,
  type FormQuestion,
} from './read.js';

// Question operations
export {
  addQuestion,
  type AddQuestionOptions,
  type AddQuestionResult,
  type QuestionType,
} from './questions.js';

// Response operations
export {
  listResponses,
  type ListResponsesOptions,
  type ListResponsesResult,
  type FormResponse,
  type FormAnswer,
} from './responses.js';
