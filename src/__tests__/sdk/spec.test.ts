import { describe, expect, it } from '@jest/globals';
import { SDK_SPEC } from '../../sdk/spec.js';

describe('SDK_SPEC Gmail label operations', () => {
  it('advertises createLabel through search metadata', () => {
    const createLabel = SDK_SPEC.gmail.createLabel;
    expect(createLabel).toBeDefined();
    expect(createLabel).toMatchObject({
      signature: expect.stringContaining('createLabel'),
      description: expect.stringContaining('Create a custom Gmail label'),
    });
    expect(createLabel?.params.name).toContain('required');
  });

  it('documents messageId as the modifyLabels SDK parameter', () => {
    const modifyLabels = SDK_SPEC.gmail.modifyLabels;
    expect(modifyLabels).toBeDefined();
    expect(modifyLabels?.signature).toContain('messageId: string');
    expect(modifyLabels?.example).toContain('messageId');
  });
});
