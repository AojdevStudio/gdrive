import type { forms_v1 } from 'googleapis';
import type { Logger } from 'winston';
import {
  FormsToolSchema,
  type FormsToolInput,
} from './forms-schemas.js';

interface CacheManagerLike {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

interface PerformanceMonitorLike {
  track(operation: string, duration: number, error?: boolean): void;
}

export interface FormsHandlerContext {
  logger: Logger;
  forms: forms_v1.Forms;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  startTime: number;
}

// Question item interface for forms - matching Google Forms API structure
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

// Handler for create operation
async function handleCreate(
  args: Extract<FormsToolInput, { operation: 'create' }>,
  context: FormsHandlerContext,
) {
  const { title, description } = args;

  const createResponse = await context.forms.forms.create({
    requestBody: {
      info: {
        title,
        documentTitle: title,
      },
    },
  });

  const formId = createResponse.data.formId;

  // If description is provided, update the form
  if (description && formId) {
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
    content: [{
      type: "text" as const,
      text: `Form created successfully!\nForm ID: ${formId}\nTitle: ${title}\nEdit URL: https://docs.google.com/forms/d/${formId}/edit\nResponse URL: https://docs.google.com/forms/d/${formId}/viewform`,
    }],
  };
}

// Handler for read operation
async function handleRead(
  args: Extract<FormsToolInput, { operation: 'read' }>,
  context: FormsHandlerContext,
) {
  const { formId } = args;

  const response = await context.forms.forms.get({
    formId,
  });

  const formData = {
    formId: response.data.formId,
    title: response.data.info?.title,
    description: response.data.info?.description,
    publishedUrl: response.data.responderUri,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    questions: response.data.items?.map((item, index) => ({
      itemId: item.itemId,
      index,
      title: item.title,
      description: item.description,
      type: item.questionItem?.question ? Object.keys(item.questionItem.question)[0] : 'unknown',
      required: Boolean(item.questionItem && 'required' in item.questionItem && item.questionItem.required),
    })) ?? [],
  };

  context.performanceMonitor.track('forms:read', Date.now() - context.startTime);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(formData, null, 2),
    }],
  };
}

// Handler for addQuestion operation
async function handleAddQuestion(
  args: Extract<FormsToolInput, { operation: 'addQuestion' }>,
  context: FormsHandlerContext,
) {
  const { formId, title, type, required = false, options, scaleMin = 1, scaleMax = 5, scaleMinLabel, scaleMaxLabel } = args;

  // Build the question item structure for createItem API
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
      if (!options || options.length === 0) {
        throw new Error("Options required for multiple choice questions");
      }
      questionItem.question.choiceQuestion = {
        type: "RADIO",
        options: options.map((option: string) => ({ value: option })),
      };
      break;

    case "CHECKBOX":
      if (!options || options.length === 0) {
        throw new Error("Options required for checkbox questions");
      }
      questionItem.question.choiceQuestion = {
        type: "CHECKBOX",
        options: options.map((option: string) => ({ value: option })),
      };
      break;

    case "DROPDOWN":
      if (!options || options.length === 0) {
        throw new Error("Options required for dropdown questions");
      }
      questionItem.question.choiceQuestion = {
        type: "DROP_DOWN",
        options: options.map((option: string) => ({ value: option })),
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
    content: [{
      type: "text" as const,
      text: `Question added successfully to form ${formId}`,
    }],
  };
}

// Handler for listResponses operation
async function handleListResponses(
  args: Extract<FormsToolInput, { operation: 'listResponses' }>,
  context: FormsHandlerContext,
) {
  const { formId } = args;

  const response = await context.forms.forms.responses.list({
    formId,
  });

  const responses = response.data.responses?.map((resp) => ({
    responseId: resp.responseId,
    createTime: resp.createTime,
    lastSubmittedTime: resp.lastSubmittedTime,
    respondentEmail: resp.respondentEmail,
    answers: resp.answers ? Object.entries(resp.answers).map(([questionId, answer]) => ({
      questionId,
      answer: answer.textAnswers?.answers?.[0]?.value ??
        (answer as { choiceAnswers?: { answers?: Array<{ value: string }> } }).choiceAnswers?.answers?.map((a: { value: string }) => a.value).join(", ") ??
        "No answer",
    })) : [],
  })) ?? [];

  context.performanceMonitor.track('forms:listResponses', Date.now() - context.startTime);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        formId,
        totalResponses: responses.length,
        responses,
      }, null, 2),
    }],
  };
}

// Main handler function
export async function handleFormsTool(
  rawArgs: unknown,
  context: FormsHandlerContext,
) {
  const validated = FormsToolSchema.parse(rawArgs);

  context.logger.info('Executing consolidated forms tool', {
    operation: validated.operation,
  });

  switch (validated.operation) {
    case 'create':
      return handleCreate(validated, context);
    case 'read':
      return handleRead(validated, context);
    case 'addQuestion':
      return handleAddQuestion(validated, context);
    case 'listResponses':
      return handleListResponses(validated, context);
    default: {
      const exhaustiveCheck: never = validated;
      throw new Error(`Unhandled forms operation: ${(exhaustiveCheck as FormsToolInput).operation}`);
    }
  }
}
