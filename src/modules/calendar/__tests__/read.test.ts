/**
 * Tests for calendar read operations
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { getCalendar, getEvent } from '../read.js';

describe('getCalendar', () => {
  let mockContext: any;
  let mockCalendarApi: any;

  beforeEach(() => {
    // Mock calendar API
    mockCalendarApi = {
      calendars: {
        get: jest.fn(),
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

  test('gets calendar by ID', async () => {
    const mockResponse = {
      data: {
        id: 'primary',
        summary: 'Primary Calendar',
        description: 'My personal calendar',
        location: 'Chicago, IL',
        timeZone: 'America/Chicago',
        conferenceProperties: {
          allowedConferenceSolutionTypes: ['hangoutsMeet'],
        },
      },
    };

    mockCalendarApi.calendars.get.mockResolvedValue(mockResponse);

    const result = await getCalendar({ calendarId: 'primary' }, mockContext);

    expect(result.id).toBe('primary');
    expect(result.summary).toBe('Primary Calendar');
    expect(result.description).toBe('My personal calendar');
    expect(result.location).toBe('Chicago, IL');
    expect(result.timeZone).toBe('America/Chicago');
    expect(result.conferenceProperties?.allowedConferenceSolutionTypes).toEqual(['hangoutsMeet']);
  });

  test('uses cache when available', async () => {
    const cachedResult = {
      id: 'cached-cal',
      summary: 'Cached Calendar',
      timeZone: 'UTC',
    };
    mockContext.cacheManager.get = jest.fn(() => Promise.resolve(cachedResult));

    const result = await getCalendar({ calendarId: 'cached-cal' }, mockContext);

    expect(result).toEqual(cachedResult);
    expect(mockCalendarApi.calendars.get).not.toHaveBeenCalled();
    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'calendar:getCalendar',
      expect.any(Number)
    );
  });

  test('caches result after API call', async () => {
    const mockResponse = {
      data: {
        id: 'cal1',
        summary: 'Calendar 1',
        timeZone: 'America/Chicago',
      },
    };
    mockCalendarApi.calendars.get.mockResolvedValue(mockResponse);

    await getCalendar({ calendarId: 'cal1' }, mockContext);

    expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('calendar:getCalendar:cal1'),
      expect.objectContaining({
        id: 'cal1',
        summary: 'Calendar 1',
      })
    );
  });

  test('tracks performance metrics', async () => {
    const mockResponse = {
      data: {
        id: 'cal1',
        summary: 'Calendar 1',
        timeZone: 'UTC',
      },
    };
    mockCalendarApi.calendars.get.mockResolvedValue(mockResponse);

    await getCalendar({ calendarId: 'cal1' }, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'calendar:getCalendar',
      expect.any(Number)
    );
  });

  test('logs calendar retrieval', async () => {
    const mockResponse = {
      data: {
        id: 'primary',
        summary: 'Primary Calendar',
        timeZone: 'America/Chicago',
      },
    };
    mockCalendarApi.calendars.get.mockResolvedValue(mockResponse);

    await getCalendar({ calendarId: 'primary' }, mockContext);

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Retrieved calendar',
      expect.objectContaining({
        calendarId: 'primary',
        summary: 'Primary Calendar',
      })
    );
  });
});

describe('getEvent', () => {
  let mockContext: any;
  let mockCalendarApi: any;

  beforeEach(() => {
    // Mock calendar API
    mockCalendarApi = {
      events: {
        get: jest.fn(),
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

  test('gets event by ID with default calendarId', async () => {
    const mockResponse = {
      data: {
        id: 'event123',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event?eid=event123',
        created: '2026-01-08T10:00:00Z',
        updated: '2026-01-08T10:00:00Z',
        summary: 'Team Meeting',
        description: 'Weekly sync',
        location: 'Conference Room A',
        start: {
          dateTime: '2026-01-09T14:00:00-06:00',
          timeZone: 'America/Chicago',
        },
        end: {
          dateTime: '2026-01-09T15:00:00-06:00',
          timeZone: 'America/Chicago',
        },
        creator: {
          email: 'creator@example.com',
          displayName: 'Creator Name',
        },
        organizer: {
          email: 'organizer@example.com',
          displayName: 'Organizer Name',
        },
        attendees: [
          {
            email: 'user1@example.com',
            displayName: 'User One',
            responseStatus: 'accepted',
            organizer: false,
          },
          {
            email: 'user2@example.com',
            displayName: 'User Two',
            responseStatus: 'needsAction',
            optional: true,
          },
        ],
      },
    };

    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    const result = await getEvent({ eventId: 'event123' }, mockContext);

    expect(mockCalendarApi.events.get).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        eventId: 'event123',
      })
    );
    expect(result.id).toBe('event123');
    expect(result.summary).toBe('Team Meeting');
    expect(result.attendees).toHaveLength(2);
  });

  test('uses custom calendarId when provided', async () => {
    const mockResponse = {
      data: {
        id: 'event456',
        summary: 'Custom Calendar Event',
        start: { dateTime: '2026-01-09T14:00:00Z' },
        end: { dateTime: '2026-01-09T15:00:00Z' },
      },
    };

    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    await getEvent({ calendarId: 'custom@example.com', eventId: 'event456' }, mockContext);

    expect(mockCalendarApi.events.get).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'custom@example.com',
        eventId: 'event456',
      })
    );
  });

  test('parses attendee details correctly', async () => {
    const mockResponse = {
      data: {
        id: 'event789',
        summary: 'Event with Attendees',
        start: { dateTime: '2026-01-09T14:00:00Z' },
        end: { dateTime: '2026-01-09T15:00:00Z' },
        attendees: [
          {
            email: 'organizer@example.com',
            displayName: 'Organizer',
            responseStatus: 'accepted',
            organizer: true,
            self: false,
          },
          {
            email: 'me@example.com',
            displayName: 'Me',
            responseStatus: 'accepted',
            self: true,
          },
          {
            email: 'optional@example.com',
            displayName: 'Optional Attendee',
            responseStatus: 'tentative',
            optional: true,
          },
        ],
      },
    };

    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    const result = await getEvent({ eventId: 'event789' }, mockContext);

    expect(result.attendees).toHaveLength(3);
    expect(result.attendees![0]).toMatchObject({
      email: 'organizer@example.com',
      displayName: 'Organizer',
      responseStatus: 'accepted',
      organizer: true,
    });
    expect(result.attendees![2]).toMatchObject({
      email: 'optional@example.com',
      optional: true,
      responseStatus: 'tentative',
    });
  });

  test('parses recurring event details', async () => {
    const mockResponse = {
      data: {
        id: 'recurring-event',
        summary: 'Weekly Standup',
        start: { dateTime: '2026-01-13T09:00:00-06:00' },
        end: { dateTime: '2026-01-13T09:30:00-06:00' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10'],
      },
    };

    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    const result = await getEvent({ eventId: 'recurring-event' }, mockContext);

    expect(result.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10']);
  });

  test('parses conference data', async () => {
    const mockResponse = {
      data: {
        id: 'video-call',
        summary: 'Video Conference',
        start: { dateTime: '2026-01-09T14:00:00Z' },
        end: { dateTime: '2026-01-09T15:00:00Z' },
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
        conferenceData: {
          entryPoints: [
            {
              entryPointType: 'video',
              uri: 'https://meet.google.com/abc-defg-hij',
              label: 'meet.google.com/abc-defg-hij',
            },
          ],
        },
      },
    };

    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    const result = await getEvent({ eventId: 'video-call' }, mockContext);

    expect(result.conferenceData).toBeDefined();
    expect(result.conferenceData?.entryPoints).toHaveLength(1);
  });

  test('uses cache when available', async () => {
    const cachedResult = {
      id: 'cached-event',
      summary: 'Cached Event',
      start: { dateTime: '2026-01-09T14:00:00Z' },
      end: { dateTime: '2026-01-09T15:00:00Z' },
    };
    mockContext.cacheManager.get = jest.fn(() => Promise.resolve(cachedResult));

    const result = await getEvent({ eventId: 'cached-event' }, mockContext);

    expect(result).toEqual(cachedResult);
    expect(mockCalendarApi.events.get).not.toHaveBeenCalled();
  });

  test('caches result after API call', async () => {
    const mockResponse = {
      data: {
        id: 'event1',
        summary: 'Event 1',
        start: { dateTime: '2026-01-09T14:00:00Z' },
        end: { dateTime: '2026-01-09T15:00:00Z' },
      },
    };
    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    await getEvent({ eventId: 'event1' }, mockContext);

    expect(mockContext.cacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('calendar:getEvent:event1'),
      expect.objectContaining({
        id: 'event1',
        summary: 'Event 1',
      })
    );
  });

  test('tracks performance metrics', async () => {
    const mockResponse = {
      data: {
        id: 'event1',
        summary: 'Event 1',
        start: { dateTime: '2026-01-09T14:00:00Z' },
        end: { dateTime: '2026-01-09T15:00:00Z' },
      },
    };
    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    await getEvent({ eventId: 'event1' }, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'calendar:getEvent',
      expect.any(Number)
    );
  });

  test('logs event retrieval', async () => {
    const mockResponse = {
      data: {
        id: 'event1',
        summary: 'Important Meeting',
        start: { dateTime: '2026-01-09T14:00:00Z' },
        end: { dateTime: '2026-01-09T15:00:00Z' },
      },
    };
    mockCalendarApi.events.get.mockResolvedValue(mockResponse);

    await getEvent({ eventId: 'event1' }, mockContext);

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Retrieved event',
      expect.objectContaining({
        eventId: 'event1',
        summary: 'Important Meeting',
      })
    );
  });
});
