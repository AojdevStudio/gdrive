import type { FormsContext } from '../types.js';

/**
 * Question types supported by Google Forms
 */
export type QuestionType =
  | 'TEXT'
  | 'PARAGRAPH_TEXT'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOX'
  | 'DROPDOWN'
  | 'LINEAR_SCALE'
  | 'DATE'
  | 'TIME';

/**
 * Options for adding a question to a form
 */
export interface AddQuestionOptions {
  /** Form ID */
  formId: string;
  /** Question title/text */
  title: string;
  /** Question type */
  type: QuestionType;
  /** Whether answer is required (default: false) */
  required?: boolean;
  /** Options for choice questions (MULTIPLE_CHOICE, CHECKBOX, DROPDOWN) */
  options?: string[];
  /** Minimum value for linear scale (default: 1) */
  scaleMin?: number;
  /** Maximum value for linear scale (default: 5) */
  scaleMax?: number;
  /** Label for minimum scale value */
  scaleMinLabel?: string;
  /** Label for maximum scale value */
  scaleMaxLabel?: string;
}

/**
 * Result of adding a question
 */
export interface AddQuestionResult {
  formId: string;
  title: string;
  type: QuestionType;
  message: string;
}

/**
 * Question item structure for Forms API
 */
interface QuestionItem {
  question: {
    required: boolean;
    textQuestion?: {
      paragraph: boolean;
    };
    choiceQuestion?: {
      type: "RADIO" | "CHECKBOX" | "DROP_DOWN";
      options: Array<{ value: string }>;
    };
    scaleQuestion?: {
      low: number;
      high: number;
      lowLabel?: string;
      highLabel?: string;
    };
    dateQuestion?: {
      includeTime: boolean;
      includeYear: boolean;
    };
    timeQuestion?: {
      duration: boolean;
    };
    [key: string]: unknown;
  };
}

/**
 * Add a question to a Google Form
 *
 * Supports all major question types including text, choice, scale, date, and time.
 *
 * @param options Question parameters
 * @param context Forms API context
 * @returns Add question confirmation
 *
 * @example
 * ```typescript
 * // Add multiple choice question
 * await addQuestion({
 *   formId: 'abc123',
 *   title: 'What is your favorite color?',
 *   type: 'MULTIPLE_CHOICE',
 *   required: true,
 *   options: ['Red', 'Blue', 'Green', 'Yellow']
 * }, context);
 *
 * // Add linear scale question
 * await addQuestion({
 *   formId: 'abc123',
 *   title: 'How satisfied are you?',
 *   type: 'LINEAR_SCALE',
 *   required: true,
 *   scaleMin: 1,
 *   scaleMax: 10,
 *   scaleMinLabel: 'Not satisfied',
 *   scaleMaxLabel: 'Very satisfied'
 * }, context);
 * ```
 */
export async function addQuestion(
  options: AddQuestionOptions,
  context: FormsContext
): Promise<AddQuestionResult> {
  const {
    formId,
    title,
    type,
    required = false,
    options: choiceOptions,
    scaleMin = 1,
    scaleMax = 5,
    scaleMinLabel,
    scaleMaxLabel,
  } = options;

  // Build the question item structure
  const questionItem: QuestionItem = {
    question: {
      required,
    },
  };

  // Build the question based on type
  switch (type) {
    case "TEXT":
      questionItem.question.textQuestion = {
        paragraph: false,
      };
      break;

    case "PARAGRAPH_TEXT":
      questionItem.question.textQuestion = {
        paragraph: true,
      };
      break;

    case "MULTIPLE_CHOICE":
      if (!choiceOptions || choiceOptions.length === 0) {
        throw new Error("Options required for multiple choice questions");
      }
      questionItem.question.choiceQuestion = {
        type: "RADIO",
        options: choiceOptions.map((option) => ({ value: option })),
      };
      break;

    case "CHECKBOX":
      if (!choiceOptions || choiceOptions.length === 0) {
        throw new Error("Options required for checkbox questions");
      }
      questionItem.question.choiceQuestion = {
        type: "CHECKBOX",
        options: choiceOptions.map((option) => ({ value: option })),
      };
      break;

    case "DROPDOWN":
      if (!choiceOptions || choiceOptions.length === 0) {
        throw new Error("Options required for dropdown questions");
      }
      questionItem.question.choiceQuestion = {
        type: "DROP_DOWN",
        options: choiceOptions.map((option) => ({ value: option })),
      };
      break;

    case "LINEAR_SCALE":
      questionItem.question.scaleQuestion = {
        low: scaleMin,
        high: scaleMax,
        ...(scaleMinLabel ? { lowLabel: scaleMinLabel } : {}),
        ...(scaleMaxLabel ? { highLabel: scaleMaxLabel } : {}),
      };
      break;

    case "DATE":
      questionItem.question.dateQuestion = {
        includeTime: false,
        includeYear: true,
      };
      break;

    case "TIME":
      questionItem.question.timeQuestion = {
        duration: false,
      };
      break;

    default:
      throw new Error(`Unsupported question type: ${type}`);
  }

  await context.forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [{
        createItem: {
          item: {
            title,
            questionItem,
          },
          location: {
            index: 0,
          },
        },
      }],
    },
  });

  context.performanceMonitor.track('forms:addQuestion', Date.now() - context.startTime);
  context.logger.info('Question added to form', { formId, type, title });

  return {
    formId,
    title,
    type,
    message: `Question added successfully to form ${formId}`,
  };
}
