/**
 * Security tests for Drive search query escaping
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { search, enhancedSearch } from '../search.js';

describe('Drive Search Security', () => {
  let mockContext: any;
  let mockDriveApi: any;

  beforeEach(() => {
    mockDriveApi = {
      files: {
        list: jest.fn<() => Promise<any>>().mockResolvedValue({
          data: { files: [] }
        }),
      },
    };

    mockContext = {
      drive: mockDriveApi,
      cacheManager: {
        get: jest.fn<() => Promise<any>>().mockResolvedValue(null),
        set: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
      performanceMonitor: {
        track: jest.fn<() => void>(),
      },
      startTime: Date.now(),
    };
  });

  describe('search - query escaping', () => {
    test('escapes single quotes in search queries', async () => {
      await search({ query: "John's Document" }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "name contains 'John\\'s Document' and trashed = false"
        })
      );
    });

    test('handles multiple single quotes', async () => {
      await search({ query: "It's O'Brien's file" }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "name contains 'It\\'s O\\'Brien\\'s file' and trashed = false"
        })
      );
    });

    test('prevents query structure manipulation', async () => {
      // Attack vector: try to inject additional query terms
      await search({ query: "test' or name contains '" }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "name contains 'test\\' or name contains \\'' and trashed = false"
        })
      );
    });

    test('handles strings without quotes unchanged', async () => {
      await search({ query: "normal query" }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "name contains 'normal query' and trashed = false"
        })
      );
    });

    test('handles empty string', async () => {
      await search({ query: "" }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "name contains '' and trashed = false"
        })
      );
    });
  });

  describe('enhancedSearch - query escaping', () => {
    test('escapes single quotes in query parameter', async () => {
      await enhancedSearch({ query: "John's Report" }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining("name contains 'John\\'s Report'")
        })
      );
    });

    test('escapes single quotes in mimeType filter', async () => {
      await enhancedSearch({
        filters: { mimeType: "test'injection" }
      }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining("mimeType = 'test\\'injection'")
        })
      );
    });

    test('escapes single quotes in parents filter', async () => {
      await enhancedSearch({
        filters: { parents: "folder'id" }
      }, mockContext);

      expect(mockDriveApi.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining("'folder\\'id' in parents")
        })
      );
    });

    test('combines query and filter escaping', async () => {
      await enhancedSearch({
        query: "O'Brien",
        filters: { mimeType: "text/plain" }
      }, mockContext);

      const call = mockDriveApi.files.list.mock.calls[0][0];
      expect(call.q).toContain("name contains 'O\\'Brien'");
      expect(call.q).toContain("mimeType = 'text/plain'");
    });
  });
});
