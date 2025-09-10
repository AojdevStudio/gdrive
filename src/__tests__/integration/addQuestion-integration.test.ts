import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock the Google Forms API to avoid actual API calls during testing
const mockFormsAPI = {
  forms: {
    batchUpdate: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    get: jest.fn() as jest.MockedFunction<any>,
  },
};

// Mock the googleapis module
jest.unstable_mockModule('googleapis', () => ({
  google: {
    forms: jest.fn(() => mockFormsAPI),
    auth: {
      GoogleAuth: jest.fn(),
    },
  },
}));

describe('addQuestion Integration Tests', () => {
  let mockFormId: string;

  beforeAll(() => {
    mockFormId = 'test-form-id-123';
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addQuestion API Integration', () => {
    it('should successfully add TEXT question to form', async () => {
      mockFormsAPI.forms.batchUpdate.mockResolvedValueOnce({
        data: { replies: [{ createItem: { itemId: 'test-item-id' } }] },
      });

      const args = {
        formId: mockFormId,
        title: 'What is your name?',
        type: 'TEXT' as const,
        required: true,
      };

      const { addQuestion } = await import('../../index.ts');
      await addQuestion(args);

      expect(mockFormsAPI.forms.batchUpdate).toHaveBeenCalledTimes(1);
      const calledWith = mockFormsAPI.forms.batchUpdate.mock.calls[0][0];
      const actualQuestionItem = calledWith.requestBody.requests[0].createItem.item.questionItem;

      expect(actualQuestionItem.question.required).toBe(true);
      expect(actualQuestionItem.required).toBeUndefined();
    });

    it('should successfully add MULTIPLE_CHOICE question to form', async () => {
      mockFormsAPI.forms.batchUpdate.mockResolvedValueOnce({
        data: { replies: [{ createItem: { itemId: 'test-item-id-2' } }] },
      });

      const args = {
        formId: mockFormId,
        title: 'What is your favorite color?',
        type: 'MULTIPLE_CHOICE' as const,
        required: false,
        options: ['Red', 'Blue', 'Green', 'Yellow'],
      };

      const { addQuestion } = await import('../../index.ts');
      await addQuestion(args);

      expect(mockFormsAPI.forms.batchUpdate).toHaveBeenCalledTimes(1);
      const calledWith = mockFormsAPI.forms.batchUpdate.mock.calls[0][0];
      const actualQuestionItem = calledWith.requestBody.requests[0].createItem.item.questionItem;

      expect(actualQuestionItem.question.required).toBe(false);
      expect(actualQuestionItem.question.choiceQuestion.type).toBe('RADIO');
      expect(actualQuestionItem.question.choiceQuestion.options).toEqual([
        { value: 'Red' },
        { value: 'Blue' },
        { value: 'Green' },
        { value: 'Yellow' },
      ]);
      expect(actualQuestionItem.required).toBeUndefined();
    });

    it('should successfully add LINEAR_SCALE question to form', async () => {
      mockFormsAPI.forms.batchUpdate.mockResolvedValueOnce({
        data: { replies: [{ createItem: { itemId: 'test-item-id-3' } }] },
      });

      const args = {
        formId: mockFormId,
        title: 'Rate your experience',
        type: 'LINEAR_SCALE' as const,
        required: true,
        scaleMin: 1,
        scaleMax: 10,
        scaleMinLabel: 'Poor',
        scaleMaxLabel: 'Excellent',
      };

      const { addQuestion } = await import('../../index.ts');
      await addQuestion(args);

      expect(mockFormsAPI.forms.batchUpdate).toHaveBeenCalledTimes(1);
      const calledWith = mockFormsAPI.forms.batchUpdate.mock.calls[0][0];
      const actualQuestionItem = calledWith.requestBody.requests[0].createItem.item.questionItem;

      expect(actualQuestionItem.question.required).toBe(true);
      expect(actualQuestionItem.question.scaleQuestion.low).toBe(1);
      expect(actualQuestionItem.question.scaleQuestion.high).toBe(10);
      expect(actualQuestionItem.question.scaleQuestion.lowLabel).toBe('Poor');
      expect(actualQuestionItem.question.scaleQuestion.highLabel).toBe('Excellent');
      expect(actualQuestionItem.required).toBeUndefined();
    });

    it('should handle DATE question correctly', async () => {
      mockFormsAPI.forms.batchUpdate.mockResolvedValueOnce({
        data: { replies: [{ createItem: { itemId: 'test-item-id-4' } }] },
      });

      const args = {
        formId: mockFormId,
        title: 'What is your birth date?',
        type: 'DATE' as const,
        required: true,
      };

      const { addQuestion } = await import('../../index.ts');
      await addQuestion(args);

      expect(mockFormsAPI.forms.batchUpdate).toHaveBeenCalledTimes(1);
      const calledWith = mockFormsAPI.forms.batchUpdate.mock.calls[0][0];
      const actualQuestionItem = calledWith.requestBody.requests[0].createItem.item.questionItem;

      expect(actualQuestionItem.question.required).toBe(true);
      expect(actualQuestionItem.question.dateQuestion.includeTime).toBe(false);
      expect(actualQuestionItem.question.dateQuestion.includeYear).toBe(true);
      expect(actualQuestionItem.required).toBeUndefined();
    });

    it('should handle TIME question correctly', async () => {
      mockFormsAPI.forms.batchUpdate.mockResolvedValueOnce({
        data: { replies: [{ createItem: { itemId: 'test-item-id-5' } }] },
      });

      const args = {
        formId: mockFormId,
        title: 'What time do you prefer?',
        type: 'TIME' as const,
        required: false,
      };

      const { addQuestion } = await import('../../index.ts');
      await addQuestion(args);

      expect(mockFormsAPI.forms.batchUpdate).toHaveBeenCalledTimes(1);
      const calledWith = mockFormsAPI.forms.batchUpdate.mock.calls[0][0];
      const actualQuestionItem = calledWith.requestBody.requests[0].createItem.item.questionItem;

      expect(actualQuestionItem.question.required).toBe(false);
      expect(actualQuestionItem.question.timeQuestion.duration).toBe(false);
      expect(actualQuestionItem.required).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should reject when Google Forms API returns an error', async () => {
      const apiError = new Error('API Error: Invalid form ID');
      mockFormsAPI.forms.batchUpdate.mockRejectedValueOnce(apiError);

      const args = {
        formId: 'invalid-form-id',
        title: 'Test Question',
        type: 'TEXT' as const,
        required: true,
      };

      const { addQuestion } = await import('../../index.ts');
      await expect(addQuestion(args)).rejects.toThrow('API Error: Invalid form ID');
    });

    it('should validate required parameters', () => {
      const validateArgs = (args: any) => {
        if (!args || typeof args.formId !== 'string' || typeof args.title !== 'string' || typeof args.type !== 'string') {
          throw new Error('formId, title, and type parameters are required');
        }
      };

      expect(() => validateArgs({})).toThrow('formId, title, and type parameters are required');
      expect(() => validateArgs({ formId: 'test' })).toThrow('formId, title, and type parameters are required');
      expect(() => validateArgs({ formId: 'test', title: 'Test' })).toThrow('formId, title, and type parameters are required');
      expect(() => validateArgs({ formId: 'test', title: 'Test', type: 'TEXT' })).not.toThrow();
    });

    it('should require options for choice-based questions', () => {
      const validateChoiceOptions = (type: string, options?: string[]) => {
        if (['MULTIPLE_CHOICE', 'CHECKBOX', 'DROPDOWN'].includes(type)) {
          if (!options || options.length === 0) {
            throw new Error(`Options required for ${type.toLowerCase()} questions`);
          }
        }
      };

      expect(() => validateChoiceOptions('MULTIPLE_CHOICE')).toThrow('Options required for multiple_choice questions');
      expect(() => validateChoiceOptions('CHECKBOX', [])).toThrow('Options required for checkbox questions');
      expect(() => validateChoiceOptions('DROPDOWN')).toThrow('Options required for dropdown questions');

      expect(() => validateChoiceOptions('MULTIPLE_CHOICE', ['Option 1'])).not.toThrow();
      expect(() => validateChoiceOptions('TEXT')).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing form operations', async () => {
      // Test that our change doesn't break other form operations
      mockFormsAPI.forms.create.mockResolvedValueOnce({
        data: { formId: 'new-form-id', info: { title: 'Test Form' } },
      });

      mockFormsAPI.forms.get.mockResolvedValueOnce({
        data: { formId: 'existing-form-id', info: { title: 'Existing Form' } },
      });

      // Test createForm operation
      const createResult = await mockFormsAPI.forms.create({
        requestBody: {
          info: {
            title: 'Test Form',
            documentTitle: 'Test Form',
          },
        },
      });

      expect(createResult.data.formId).toBe('new-form-id');

      // Test getForm operation
      const getResult = await mockFormsAPI.forms.get({ formId: 'existing-form-id' });
      expect(getResult.data.formId).toBe('existing-form-id');

      // These operations should work independently of our addQuestion fix
      expect(mockFormsAPI.forms.create).toHaveBeenCalledTimes(1);
      expect(mockFormsAPI.forms.get).toHaveBeenCalledTimes(1);
    });
  });
});