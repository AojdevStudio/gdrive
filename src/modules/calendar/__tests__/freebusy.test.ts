/**
 * Tests for calendar freebusy operations
 * Following TDD approach - write failing tests first
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../../types.js';
import { checkFreeBusy } from '../freebusy.js';

describe('checkFreeBusy', () => {
  let mockContext: CalendarContext;
  let mockCalendarApi: jest.Mocked<calendar_v3.Calendar>;

  beforeEach(() => {
    // Mock calendar API
    mockCalendarApi = {
      freebusy: {
        query: jest.fn(),
      },
    } as unknown as jest.Mocked<calendar_v3.Calendar>;

    // Mock context
    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      calendar: mockCalendarApi,
      cacheManager: {
        // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
        get: jest.fn().mockResolvedValue(null),
        // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
        set: jest.fn().mockResolvedValue(undefined),
        // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
        invalidate: jest.fn().mockResolvedValue(undefined),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    } as unknown as CalendarContext;
  });

  test('checks free/busy for a single calendar', async () => {
    const mockResponse = {
      data: {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        calendars: {
          'primary': {
            busy: [
              {
                start: '2026-01-09T10:00:00Z',
                end: '2026-01-09T11:00:00Z',
              },
              {
                start: '2026-01-09T14:00:00Z',
                end: '2026-01-09T15:30:00Z',
              },
            ],
          },
        },
      },
    };

    // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
    (mockCalendarApi.freebusy.query as jest.Mock).mockResolvedValue(mockResponse);

    const result = await checkFreeBusy(
      {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        items: [{ id: 'primary' }],
      },
      mockContext
    );

    expect(result.timeMin).toBe('2026-01-09T00:00:00Z');
    expect(result.timeMax).toBe('2026-01-09T23:59:59Z');
    expect(result.calendars['primary']).toBeDefined();
    expect(result.calendars['primary']!.busy).toHaveLength(2);
    expect(result.calendars['primary']!.busy[0]).toMatchObject({
      start: '2026-01-09T10:00:00Z',
      end: '2026-01-09T11:00:00Z',
    });
  });

  test('checks free/busy for multiple calendars', async () => {
    const mockResponse = {
      data: {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        calendars: {
          'primary': {
            busy: [
              {
                start: '2026-01-09T10:00:00Z',
                end: '2026-01-09T11:00:00Z',
              },
            ],
          },
          'test@example.com': {
            busy: [
              {
                start: '2026-01-09T13:00:00Z',
                end: '2026-01-09T14:00:00Z',
              },
            ],
          },
        },
      },
    };

    // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
    (mockCalendarApi.freebusy.query as jest.Mock).mockResolvedValue(mockResponse);

    const result = await checkFreeBusy(
      {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        items: [{ id: 'primary' }, { id: 'test@example.com' }],
      },
      mockContext
    );

    expect(Object.keys(result.calendars)).toHaveLength(2);
    expect(result.calendars['primary']!.busy).toHaveLength(1);
    expect(result.calendars['test@example.com']!.busy).toHaveLength(1);
  });

  test('returns empty busy array when calendar is free', async () => {
    const mockResponse = {
      data: {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        calendars: {
          'primary': {
            busy: [],
          },
        },
      },
    };

    // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
    (mockCalendarApi.freebusy.query as jest.Mock).mockResolvedValue(mockResponse);

    const result = await checkFreeBusy(
      {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        items: [{ id: 'primary' }],
      },
      mockContext
    );

    expect(result.calendars['primary']!.busy).toHaveLength(0);
  });

  test('includes errors when calendar access fails', async () => {
    const mockResponse = {
      data: {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        calendars: {
          'restricted@example.com': {
            busy: [],
            errors: [
              {
                domain: 'calendar',
                reason: 'notFound',
              },
            ],
          },
        },
      },
    };

    // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
    (mockCalendarApi.freebusy.query as jest.Mock).mockResolvedValue(mockResponse);

    const result = await checkFreeBusy(
      {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        items: [{ id: 'restricted@example.com' }],
      },
      mockContext
    );

    expect(result.calendars['restricted@example.com']!.errors).toBeDefined();
    expect(result.calendars['restricted@example.com']!.errors).toHaveLength(1);
    expect(result.calendars['restricted@example.com']!.errors?.[0]).toMatchObject({
      domain: 'calendar',
      reason: 'notFound',
    });
  });

  test('caches the result', async () => {
    const mockResponse = {
      data: {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        calendars: {
          'primary': {
            busy: [],
          },
        },
      },
    };

    // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
    (mockCalendarApi.freebusy.query as jest.Mock).mockResolvedValue(mockResponse);

    await checkFreeBusy(
      {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        items: [{ id: 'primary' }],
      },
      mockContext
    );

    // Verify cache was set
    // Note: Current CacheManager doesn't support per-operation TTL
    // TODO: Verify 60s TTL when CacheManager supports it (per spec requirement)
    expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('calendar:checkFreeBusy:'),
      expect.any(Object)
    );
  });

  test('supports optional timezone parameter', async () => {
    const mockResponse = {
      data: {
        timeMin: '2026-01-09T00:00:00-06:00',
        timeMax: '2026-01-09T23:59:59-06:00',
        calendars: {
          'primary': {
            busy: [],
          },
        },
      },
    };

    // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
    (mockCalendarApi.freebusy.query as jest.Mock).mockResolvedValue(mockResponse);

    const result = await checkFreeBusy(
      {
        timeMin: '2026-01-09T00:00:00-06:00',
        timeMax: '2026-01-09T23:59:59-06:00',
        items: [{ id: 'primary' }],
        timeZone: 'America/Chicago',
      },
      mockContext
    );

    expect(mockCalendarApi.freebusy.query).toHaveBeenCalledWith({
      requestBody: {
        timeMin: '2026-01-09T00:00:00-06:00',
        timeMax: '2026-01-09T23:59:59-06:00',
        items: [{ id: 'primary' }],
        timeZone: 'America/Chicago',
      },
    });
    expect(result.calendars['primary']).toBeDefined();
  });

  test('handles API errors gracefully', async () => {
    const error = new Error('API Error');
    // @ts-expect-error - Mock typing with exactOptionalPropertyTypes
    (mockCalendarApi.freebusy.query as jest.Mock).mockRejectedValue(error);

    await expect(
      checkFreeBusy(
        {
          timeMin: '2026-01-09T00:00:00Z',
          timeMax: '2026-01-09T23:59:59Z',
          items: [{ id: 'primary' }],
        },
        mockContext
      )
    ).rejects.toThrow('API Error');

    expect(mockContext.logger.error).toHaveBeenCalledWith(
      'Failed to check free/busy',
      expect.objectContaining({
        error: expect.any(Error),
      })
    );
  });
});
