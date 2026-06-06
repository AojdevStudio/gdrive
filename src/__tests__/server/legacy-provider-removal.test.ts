import { describe, expect, it } from '@jest/globals';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe('legacy direct-Google provider removal', () => {
  it('does not keep the direct module SDK runtime as a migrated-operation execution path', async () => {
    await expect(fileExists(join(root, 'src/sdk/runtime.ts'))).resolves.toBe(false);
  });

  it('keeps Worker and local entrypoints free of Google OAuth setup routes', async () => {
    const workerSource = await readFile(join(root, 'worker.ts'), 'utf8');
    const localEntrypoint = await readFile(join(root, 'index.ts'), 'utf8');

    for (const source of [workerSource, localEntrypoint]) {
      expect(source).not.toMatch(/setup\/google|setup\/status|workers-oauth/);
      expect(source).not.toMatch(/GDRIVE_CLIENT_ID|GDRIVE_CLIENT_SECRET|GDRIVE_TOKEN_ENCRYPTION_KEY|MCP_SETUP_TOKEN/);
    }
  });
});
