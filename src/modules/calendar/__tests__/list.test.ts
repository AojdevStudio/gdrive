/**
 * Tests for calendar list operations
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { listCalendars, listEvents } from '../list.js';

describe('listCalendars', () => {
  let mockContext: any;
  let mockCalendarApi: any;

  beforeEach(() => {
    // Mock calendar API
    mockCalendarApi = {
      calendarList: {
        list: jest.fn(),
      },
    };

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
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('lists calendars with default options', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            id: 'primary',
            summary: 'Primary Calendar',
            timeZone: 'America/Chicago',
            primary: true,
            accessRole: 'owner',
          },
          {
            id: 'test@example.com',
            summary: 'Test Calendar',
            description: 'Test description',
            timeZone: 'America/New_York',
            accessRole: 'reader',
          },
        ],
      },
    };

    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    const result = await listCalendars({}, mockContext);

    expect(result.calendars).toHaveLength(2);
    expect(result.calendars[0]).toMatchObject({
      id: 'primary',
      summary: 'Primary Calendar',
      timeZone: 'America/Chicago',
      primary: true,
      accessRole: 'owner',
    });
    expect(result.calendars[1]).toMatchObject({
      id: 'test@example.com',
      summary: 'Test Calendar',
      description: 'Test description',
      timeZone: 'America/New_York',
      accessRole: 'reader',
    });
  });

  test('limits maxResults to API maximum', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    await listCalendars({ maxResults: 1000 }, mockContext);

    expect(mockCalendarApi.calendarList.list).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults: 250, // Calendar API limit
      })
    );
  });

  test('includes pageToken when provided', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    await listCalendars({ pageToken: 'token123' }, mockContext);

    expect(mockCalendarApi.calendarList.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageToken: 'token123',
      })
    );
  });

  test('returns nextPageToken when available', async () => {
    const mockResponse = {
      data: {
        items: [{ id: 'cal1', summary: 'Calendar 1' }],
        nextPageToken: 'next-token',
      },
    };
    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    const result = await listCalendars({}, mockContext);

    expect(result.nextPageToken).toBe('next-token');
  });

  test('does not include nextPageToken when not available', async () => {
    const mockResponse = {
      data: {
        items: [{ id: 'cal1', summary: 'Calendar 1' }],
      },
    };
    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    const result = await listCalendars({}, mockContext);

    expect(result.nextPageToken).toBeUndefined();
  });

  test('uses cache when available', async () => {
    const cachedResult = {
      calendars: [{ id: 'cached', summary: 'Cached Calendar' }],
    };
    mockContext.cacheManager.get = jest.fn(() => Promise.resolve(cachedResult));

    const result = await listCalendars({}, mockContext);

    expect(result).toEqual(cachedResult);
    expect(mockCalendarApi.calendarList.list).not.toHaveBeenCalled();
    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'calendar:listCalendars',
      expect.any(Number)
    );
  });

  test('caches result after API call', async () => {
    const mockResponse = {
      data: {
        items: [{ id: 'cal1', summary: 'Calendar 1' }],
      },
    };
    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    await listCalendars({}, mockContext);

    expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('calendar:listCalendars:'),
      expect.objectContaining({
        calendars: expect.any(Array),
      })
    );
  });

  test('tracks performance metrics', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    await listCalendars({}, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'calendar:listCalendars',
      expect.any(Number)
    );
  });

  test('logs calendar list info', async () => {
    const mockResponse = {
      data: {
        items: [
          { id: 'cal1', summary: 'Calendar 1' },
          { id: 'cal2', summary: 'Calendar 2' },
        ],
      },
    };
    mockCalendarApi.calendarList.list.mockResolvedValue(mockResponse);

    await listCalendars({}, mockContext);

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Listed calendars',
      expect.objectContaining({
        count: 2,
      })
    );
  });
});

describe('listEvents', () => {
  let mockContext: any;
  let mockCalendarApi: any;

  beforeEach(() => {
    // Mock calendar API
    mockCalendarApi = {
      events: {
        list: jest.fn(),
      },
    };

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
        get: jest.fn(() => Promise.resolve(null)),
        set: jest.fn(() => Promise.resolve(undefined)),
        invalidate: jest.fn(() => Promise.resolve(undefined)),
      },
      performanceMonitor: {
        track: jest.fn(),
      },
      startTime: Date.now(),
    };
  });

  test('lists events with default calendarId', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            id: 'event1',
            summary: 'Test Event',
            start: { dateTime: '2026-01-09T14:00:00-06:00' },
            end: { dateTime: '2026-01-09T15:00:00-06:00' },
            status: 'confirmed',
          },
        ],
        timeZone: 'America/Chicago',
      },
    };

    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    const result = await listEvents({}, mockContext);

    expect(mockCalendarApi.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
      })
    );
    expect(result.events).toHaveLength(1);
    expect(result.timeZone).toBe('America/Chicago');
  });

  test('includes time range filters when provided', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents(
      {
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
      },
      mockContext
    );

    expect(mockCalendarApi.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
      })
    );
  });

  test('defaults singleEvents to true', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents({}, mockContext);

    expect(mockCalendarApi.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        singleEvents: true,
      })
    );
  });

  test('respects custom singleEvents setting', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents({ singleEvents: false }, mockContext);

    expect(mockCalendarApi.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        singleEvents: false,
      })
    );
  });

  test('includes orderBy when provided', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents({ orderBy: 'startTime' }, mockContext);

    expect(mockCalendarApi.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: 'startTime',
      })
    );
  });

  test('limits maxResults to API maximum', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents({ maxResults: 5000 }, mockContext);

    expect(mockCalendarApi.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults: 2500, // Calendar API limit
      })
    );
  });

  test('parses event attendee count', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            id: 'event1',
            summary: 'Team Meeting',
            start: { dateTime: '2026-01-09T14:00:00-06:00' },
            end: { dateTime: '2026-01-09T15:00:00-06:00' },
            attendees: [
              { email: 'user1@example.com' },
              { email: 'user2@example.com' },
              { email: 'user3@example.com' },
            ],
          },
        ],
      },
    };

    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    const result = await listEvents({}, mockContext);

    expect(result.events[0]?.attendeeCount).toBe(3);
  });

  test('uses cache when available', async () => {
    const cachedResult = {
      events: [{ id: 'cached-event', summary: 'Cached Event' }],
    };
    mockContext.cacheManager.get = jest.fn(() => Promise.resolve(cachedResult));

    const result = await listEvents({}, mockContext);

    expect(result).toEqual(cachedResult);
    expect(mockCalendarApi.events.list).not.toHaveBeenCalled();
  });

  test('caches result after API call', async () => {
    const mockResponse = {
      data: {
        items: [{ id: 'event1', summary: 'Event 1' }],
      },
    };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents({}, mockContext);

    expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('calendar:listEvents:'),
      expect.any(Object)
    );
  });

  test('uses calendarId segment in cache key for invalidation', async () => {
    const mockResponse = {
      data: {
        items: [{ id: 'event1', summary: 'Event 1' }],
      },
    };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents(
      {
        calendarId: 'cal-123',
        timeMin: '2026-01-09T00:00:00Z',
        timeMax: '2026-01-09T23:59:59Z',
        maxResults: 25,
        pageToken: 'page-2',
        singleEvents: false,
        orderBy: 'startTime',
        showDeleted: true,
        timeZone: 'UTC',
      },
      mockContext
    );

    const expectedKey = `calendar:listEvents:cal-123:${JSON.stringify({
      timeMin: '2026-01-09T00:00:00Z',
      timeMax: '2026-01-09T23:59:59Z',
      maxResults: 25,
      pageToken: 'page-2',
      singleEvents: false,
      orderBy: 'startTime',
      showDeleted: true,
      timeZone: 'UTC',
    })}`;

    expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
      expectedKey,
      expect.any(Object)
    );
  });

  test('handles pagination with nextPageToken', async () => {
    const mockResponse = {
      data: {
        items: [{ id: 'event1', summary: 'Event 1' }],
        nextPageToken: 'next-page-token',
      },
    };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    const result = await listEvents({}, mockContext);

    expect(result.nextPageToken).toBe('next-page-token');
  });

  test('tracks performance metrics', async () => {
    const mockResponse = { data: { items: [] } };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents({}, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'calendar:listEvents',
      expect.any(Number)
    );
  });

  test('logs event list info', async () => {
    const mockResponse = {
      data: {
        items: [
          { id: 'event1', summary: 'Event 1' },
          { id: 'event2', summary: 'Event 2' },
        ],
      },
    };
    mockCalendarApi.events.list.mockResolvedValue(mockResponse);

    await listEvents({}, mockContext);

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Listed events',
      expect.objectContaining({
        count: 2,
      })
    );
  });
});
