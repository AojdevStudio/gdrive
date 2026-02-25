/**
 * Tests for calendar delete operations
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { deleteEvent } from '../delete.js';

describe('deleteEvent', () => {
  let mockContext: any;
  let mockCalendarApi: any;

  beforeEach(() => {
    // Mock calendar API
    mockCalendarApi = {
      events: {
        delete: jest.fn(),
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

  test('returns DeleteEventResult with eventId', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    const result = await deleteEvent(
      { eventId: 'event123' },
      mockContext
    );

    expect(result).toHaveProperty('eventId', 'event123');
    expect(result).toHaveProperty('message', 'Event deleted successfully');
    expect(result).not.toHaveProperty('success');
  });

  test('uses default calendarId when not provided', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    await deleteEvent({ eventId: 'event123' }, mockContext);

    expect(mockCalendarApi.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        eventId: 'event123',
      })
    );
  });

  test('uses custom calendarId when provided', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    await deleteEvent(
      { calendarId: 'custom@example.com', eventId: 'event456' },
      mockContext
    );

    expect(mockCalendarApi.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'custom@example.com',
        eventId: 'event456',
      })
    );
  });

  test('passes sendUpdates parameter to API', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    await deleteEvent(
      { eventId: 'event123', sendUpdates: 'all' },
      mockContext
    );

    expect(mockCalendarApi.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        sendUpdates: 'all',
      })
    );
  });

  test('uses default sendUpdates=none when not provided', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    await deleteEvent({ eventId: 'event123' }, mockContext);

    expect(mockCalendarApi.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        sendUpdates: 'none',
      })
    );
  });

  test('invalidates correct cache keys', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    await deleteEvent(
      { calendarId: 'primary', eventId: 'event123' },
      mockContext
    );

    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith(
      'calendar:getEvent:event123'
    );
    expect(mockContext.cacheManager.invalidate).toHaveBeenCalledWith(
      'calendar:listEvents:primary:*'
    );
  });

  test('tracks performance', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    await deleteEvent({ eventId: 'event123' }, mockContext);

    expect(mockContext.performanceMonitor.track).toHaveBeenCalledWith(
      'calendar:deleteEvent',
      expect.any(Number)
    );
  });

  test('logs deletion', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    await deleteEvent(
      { eventId: 'event123', sendUpdates: 'all' },
      mockContext
    );

    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Deleted calendar event',
      expect.objectContaining({
        calendarId: 'primary',
        eventId: 'event123',
        sendUpdates: 'all',
      })
    );
  });

  test('returns eventId that matches input parameter', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    const eventId = 'my-unique-event-id';
    const result = await deleteEvent({ eventId }, mockContext);

    // Verify the eventId in result matches the input
    expect(result.eventId).toBe(eventId);
  });

  test('handles deletion with externalOnly sendUpdates', async () => {
    mockCalendarApi.events.delete.mockResolvedValue({ status: 204 });

    const result = await deleteEvent(
      { eventId: 'event789', sendUpdates: 'externalOnly' },
      mockContext
    );

    expect(result.eventId).toBe('event789');
    expect(mockCalendarApi.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        sendUpdates: 'externalOnly',
      })
    );
  });
});
