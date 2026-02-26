import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as path from 'path';
import { getOAuthPathCandidates, resolveOAuthPath } from '../../server/transports/stdio.js';

describe('stdio OAuth path resolution', () => {
  const originalEnv = process.env.GDRIVE_OAUTH_PATH;

  beforeEach(() => {
    delete process.env.GDRIVE_OAUTH_PATH;
    jest.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.GDRIVE_OAUTH_PATH = originalEnv;
    } else {
      delete process.env.GDRIVE_OAUTH_PATH;
    }
    jest.restoreAllMocks();
  });

  it('uses GDRIVE_OAUTH_PATH when provided', () => {
    process.env.GDRIVE_OAUTH_PATH = '/tmp/custom-oauth.json';

    const candidates = getOAuthPathCandidates();

    expect(candidates).toEqual(['/tmp/custom-oauth.json']);
  });

  it('uses cwd credentials path by default', () => {
    const cwdExpected = path.join(process.cwd(), 'credentials/gcp-oauth.keys.json');

    const candidates = getOAuthPathCandidates();

    expect(candidates[0]).toBe(cwdExpected);
    expect(candidates).toHaveLength(1);
  });

  it('returns first existing candidate', () => {
    const candidates = getOAuthPathCandidates();
    const existsFn = (candidate: string) => candidate === candidates[0];
    const resolved = resolveOAuthPath(existsFn);

    expect(resolved).toBe(candidates[0]);
  });

  it('falls back to cwd default when no candidate exists', () => {
    const resolved = resolveOAuthPath(() => false);

    expect(resolved).toBe(path.join(process.cwd(), 'credentials/gcp-oauth.keys.json'));
  });
});
