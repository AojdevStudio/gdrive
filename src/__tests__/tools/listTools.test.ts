import { describe, expect, it } from '@jest/globals';
import {
  formatToolStructure,
  generateToolStructure,
  getModuleTools,
  getToolDefinition,
  LIST_TOOLS_RESOURCE,
} from '../../tools/listTools.js';

describe('listTools resource helpers', () => {
  it('exposes the tool discovery resource metadata', () => {
    expect(LIST_TOOLS_RESOURCE).toEqual({
      uri: 'gdrive://tools',
      name: 'Available Operations',
      description: 'Hierarchical structure of all available Google Workspace operations',
      mimeType: 'application/json',
    });
  });

  it('generates the hardcoded Google Workspace operation structure', async () => {
    const structure = await generateToolStructure();

    expect(Object.keys(structure)).toEqual(
      expect.arrayContaining(['drive', 'sheets', 'forms', 'docs', 'gmail', 'calendar'])
    );
    expect((structure.gmail ?? []).map((tool) => tool.name)).toContain('sendMessage');
    expect((structure.gmail ?? []).map((tool) => tool.name)).toContain('readAttachmentText');
    expect((structure.calendar ?? []).map((tool) => tool.name)).toContain('checkFreeBusy');
  });

  it('formats operations for display', () => {
    const formatted = formatToolStructure({
      drive: [{
        name: 'files.list',
        signature: 'context.drive.files.list({})',
        description: 'List Drive files',
        example: 'await context.drive.files.list({})',
      }],
    });

    expect(formatted).toContain('# Google Workspace MCP Operations');
    expect(formatted).toContain('## ./modules/drive');
    expect(formatted).toContain('### files.list');
    expect(formatted).toContain('await context.drive.files.list({})');
  });

  it('returns module tools and individual tool definitions', async () => {
    await expect(getModuleTools('gmail')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'sendMessage' }),
        expect.objectContaining({ name: 'readAttachmentText' }),
      ])
    );

    await expect(getModuleTools('missing')).resolves.toEqual([]);
    await expect(getToolDefinition('calendar', 'quickAdd')).resolves.toEqual(
      expect.objectContaining({ name: 'quickAdd' })
    );
    await expect(getToolDefinition('calendar', 'missing')).resolves.toBeUndefined();
  });
});
