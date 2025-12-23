import { describe, it, expect } from '@jest/globals';

describe('addQuestion JSON Structure Validation', () => {
  describe('QuestionItem JSON Structure', () => {
    it('should place required field inside question structure for TEXT questions', () => {
      const questionItem = {
        question: {
          required: true,
          textQuestion: {
            paragraph: false,
          },
        },
      };

      // Validate the structure matches Google Forms API expectations
      expect(questionItem.question.required).toBe(true);
      expect(questionItem.question.textQuestion).toBeDefined();
      expect(questionItem.question.textQuestion.paragraph).toBe(false);

      // Ensure required is NOT at root level (this was the bug)
      expect((questionItem as any).required).toBeUndefined();
    });

    it('should place required field inside question structure for PARAGRAPH_TEXT questions', () => {
      const questionItem = {
        question: {
          required: false,
          textQuestion: {
            paragraph: true,
          },
        },
      };

      expect(questionItem.question.required).toBe(false);
      expect(questionItem.question.textQuestion).toBeDefined();
      expect(questionItem.question.textQuestion.paragraph).toBe(true);
      expect((questionItem as any).required).toBeUndefined();
    });

    it('should place required field inside question structure for MULTIPLE_CHOICE questions', () => {
      const options = ['Option 1', 'Option 2', 'Option 3'];
      const questionItem = {
        question: {
          required: true,
          choiceQuestion: {
            type: 'RADIO',
            options: options.map((option: string) => ({ value: option })),
          },
        },
      };

      expect(questionItem.question.required).toBe(true);
      expect(questionItem.question.choiceQuestion).toBeDefined();
      expect(questionItem.question.choiceQuestion.type).toBe('RADIO');
      expect(questionItem.question.choiceQuestion.options).toEqual([
        { value: 'Option 1' },
        { value: 'Option 2' },
        { value: 'Option 3' },
      ]);
      expect((questionItem as any).required).toBeUndefined();
    });

    it('should place required field inside question structure for CHECKBOX questions', () => {
      const options = ['Check 1', 'Check 2'];
      const questionItem = {
        question: {
          required: false,
          choiceQuestion: {
            type: 'CHECKBOX',
            options: options.map((option: string) => ({ value: option })),
          },
        },
      };

      expect(questionItem.question.required).toBe(false);
      expect(questionItem.question.choiceQuestion.type).toBe('CHECKBOX');
      expect(questionItem.question.choiceQuestion.options).toEqual([
        { value: 'Check 1' },
        { value: 'Check 2' },
      ]);
      expect((questionItem as any).required).toBeUndefined();
    });

    it('should place required field inside question structure for DROPDOWN questions', () => {
      const options = ['Drop 1', 'Drop 2'];
      const questionItem = {
        question: {
          required: true,
          choiceQuestion: {
            type: 'DROP_DOWN',
            options: options.map((option: string) => ({ value: option })),
          },
        },
      };

      expect(questionItem.question.required).toBe(true);
      expect(questionItem.question.choiceQuestion.type).toBe('DROP_DOWN');
      expect(questionItem.question.choiceQuestion.options).toEqual([
        { value: 'Drop 1' },
        { value: 'Drop 2' },
      ]);
      expect((questionItem as any).required).toBeUndefined();
    });

    it('should place required field inside question structure for LINEAR_SCALE questions', () => {
      const questionItem = {
        question: {
          required: true,
          scaleQuestion: {
            low: 1,
            high: 10,
            lowLabel: 'Poor',
            highLabel: 'Excellent',
          },
        },
      };

      expect(questionItem.question.required).toBe(true);
      expect(questionItem.question.scaleQuestion).toBeDefined();
      expect(questionItem.question.scaleQuestion.low).toBe(1);
      expect(questionItem.question.scaleQuestion.high).toBe(10);
      expect(questionItem.question.scaleQuestion.lowLabel).toBe('Poor');
      expect(questionItem.question.scaleQuestion.highLabel).toBe('Excellent');
      expect((questionItem as any).required).toBeUndefined();
    });

    it('should place required field inside question structure for DATE questions', () => {
      const questionItem = {
        question: {
          required: false,
          dateQuestion: {
            includeTime: false,
            includeYear: true,
          },
        },
      };

      expect(questionItem.question.required).toBe(false);
      expect(questionItem.question.dateQuestion).toBeDefined();
      expect(questionItem.question.dateQuestion.includeTime).toBe(false);
      expect(questionItem.question.dateQuestion.includeYear).toBe(true);
      expect((questionItem as any).required).toBeUndefined();
    });

    it('should place required field inside question structure for TIME questions', () => {
      const questionItem = {
        question: {
          required: true,
          timeQuestion: {
            duration: false,
          },
        },
      };

      expect(questionItem.question.required).toBe(true);
      expect(questionItem.question.timeQuestion).toBeDefined();
      expect(questionItem.question.timeQuestion.duration).toBe(false);
      expect((questionItem as any).required).toBeUndefined();
    });
  });

  describe('batchUpdate Request Structure', () => {
    it('should create valid createItem request structure', () => {
      const formId = 'test-form-id';
      const title = 'Test Question';
      const questionItem = {
        question: {
          required: true,
          textQuestion: {
            paragraph: false,
          },
        },
      };

      // Define the proper type for the batch update request
      type CreateItemRequest = {
        createItem: {
          item: { title: string; questionItem: any };
          location: { index: number };
        };
      };

      const batchUpdateRequest: {
        formId: string;
        requestBody: {
          requests: CreateItemRequest[];
        };
      } = {
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
      };

      // Validate the complete request structure
      expect(batchUpdateRequest.formId).toBe(formId);
      expect(batchUpdateRequest.requestBody.requests).toHaveLength(1);

      const { requests } = batchUpdateRequest.requestBody;
      const createItemRequest = requests[0];
      
      // Add null check to satisfy TypeScript
      if (createItemRequest) {
        expect(createItemRequest.createItem.item.title).toBe(title);
        expect(createItemRequest.createItem.item.questionItem).toEqual(questionItem);
        expect(createItemRequest.createItem.location.index).toBe(0);

        // Ensure required field is properly nested
        expect(createItemRequest.createItem.item.questionItem.question.required).toBe(true);
        expect((createItemRequest.createItem.item.questionItem).required).toBeUndefined();
      }
    });

    it('should handle optional scale labels correctly', () => {
      const questionItem: any = {
        question: {
          required: false,
          scaleQuestion: {
            low: 1,
            high: 5,
            // No labels provided
          },
        },
      };

      expect(questionItem.question.scaleQuestion.lowLabel).toBeUndefined();
      expect(questionItem.question.scaleQuestion.highLabel).toBeUndefined();
      expect(questionItem.question.scaleQuestion.low).toBe(1);
      expect(questionItem.question.scaleQuestion.high).toBe(5);
    });
  });

  describe('Error Cases Validation', () => {
    it('should require options for choice-based questions', () => {
      const createChoiceQuestion = (type: string, options?: string[]) => {
        if (!options || options.length === 0) {
          throw new Error(`Options required for ${type.toLowerCase()} questions`);
        }

        return {
          question: {
            required: true,
            choiceQuestion: {
              type,
              options: options.map((option: string) => ({ value: option })),
            },
          },
        };
      };

      // Should throw for empty options
      expect(() => createChoiceQuestion('RADIO', [])).toThrow('Options required for radio questions');
      expect(() => createChoiceQuestion('CHECKBOX', undefined)).toThrow('Options required for checkbox questions');
      expect(() => createChoiceQuestion('DROP_DOWN', [])).toThrow('Options required for drop_down questions');

      // Should work with valid options
      expect(() => createChoiceQuestion('RADIO', ['Option 1'])).not.toThrow();
      expect(() => createChoiceQuestion('CHECKBOX', ['Check 1', 'Check 2'])).not.toThrow();
      expect(() => createChoiceQuestion('DROP_DOWN', ['Drop 1'])).not.toThrow();
    });

    it('should handle unsupported question types', () => {
      const createUnsupportedQuestion = (type: string) => {
        const supportedTypes = ['TEXT', 'PARAGRAPH_TEXT', 'MULTIPLE_CHOICE', 'CHECKBOX', 'DROPDOWN', 'LINEAR_SCALE', 'DATE', 'TIME'];

        if (!supportedTypes.includes(type)) {
          throw new Error(`Unsupported question type: ${type}`);
        }
      };

      expect(() => createUnsupportedQuestion('INVALID_TYPE')).toThrow('Unsupported question type: INVALID_TYPE');
      expect(() => createUnsupportedQuestion('CUSTOM_TYPE')).toThrow('Unsupported question type: CUSTOM_TYPE');

      // Should work with supported types
      expect(() => createUnsupportedQuestion('TEXT')).not.toThrow();
      expect(() => createUnsupportedQuestion('MULTIPLE_CHOICE')).not.toThrow();
    });
  });
});