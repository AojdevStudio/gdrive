/**
 * Tests for calendar utility functions
 */
import { describe, expect, test } from '@jest/globals';
import { parseAttendees, buildEventResult, validateEventTimes } from '../utils.js';

describe('Calendar Utils', () => {
  describe('validateEventTimes', () => {
    test('accepts valid dateTime event', () => {
      expect(() => validateEventTimes(
        { dateTime: '2026-01-10T14:00:00-06:00' },
        { dateTime: '2026-01-10T15:00:00-06:00' }
      )).not.toThrow();
    });

    test('accepts valid all-day event', () => {
      expect(() => validateEventTimes(
        { date: '2026-01-10' },
        { date: '2026-01-11' }
      )).not.toThrow();
    });

    test('throws if end is before start for dateTime', () => {
      expect(() => validateEventTimes(
        { dateTime: '2026-01-10T15:00:00-06:00' },
        { dateTime: '2026-01-10T14:00:00-06:00' }
      )).toThrow('Event end time must be after start time');
    });

    test('throws if end is before start for date', () => {
      expect(() => validateEventTimes(
        { date: '2026-01-11' },
        { date: '2026-01-10' }
      )).toThrow('Event end time must be after start time');
    });

    test('throws if mixing date and dateTime in start', () => {
      expect(() => validateEventTimes(
        { date: '2026-01-10', dateTime: '2026-01-10T14:00:00-06:00' },
        { dateTime: '2026-01-10T15:00:00-06:00' }
      )).toThrow("All-day events should use 'date' field, not 'dateTime'");
    });
  });

  describe('parseAttendees', () => {
    test('returns undefined for undefined input', () => {
      const result = parseAttendees(undefined);
      expect(result).toBeUndefined();
    });

    test('returns undefined for empty array', () => {
      const result = parseAttendees([]);
      expect(result).toBeUndefined();
    });

    test('parses basic attendee with email only', () => {
      const result = parseAttendees([{ email: 'user@example.com' }]);
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      if (result && result.length > 0) {
        expect(result[0]!.email).toBe('user@example.com');
        expect(result[0]!.displayName).toBeUndefined();
        expect(result[0]!.responseStatus).toBeUndefined();
      }
    });

    test('parses attendee with null email as empty string', () => {
      const result = parseAttendees([{ email: null as unknown as string }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!.email).toBe('');
      }
    });

    test('parses attendee with displayName', () => {
      const result = parseAttendees([{
        email: 'user@example.com',
        displayName: 'Test User'
      }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!.displayName).toBe('Test User');
      }
    });

    test('parses valid responseStatus values', () => {
      const statuses = ['needsAction', 'declined', 'tentative', 'accepted'] as const;
      for (const status of statuses) {
        const result = parseAttendees([{ email: 'test@example.com', responseStatus: status }]);
        expect(result).toBeDefined();
        if (result && result.length > 0) {
          expect(result[0]!.responseStatus).toBe(status);
        }
      }
    });

    test('filters invalid responseStatus values', () => {
      const result = parseAttendees([{
        email: 'user@example.com',
        responseStatus: 'invalid-status' as 'accepted'
      }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!.responseStatus).toBeUndefined();
      }
    });

    test('parses organizer true', () => {
      const result = parseAttendees([{ email: 'org@example.com', organizer: true }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!.organizer).toBe(true);
      }
    });

    test('parses organizer false', () => {
      const result = parseAttendees([{ email: 'user@example.com', organizer: false }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!.organizer).toBe(false);
      }
    });

    test('does not set organizer when undefined', () => {
      const result = parseAttendees([{ email: 'user@example.com' }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!.organizer).toBeUndefined();
      }
    });

    test('parses self and optional booleans', () => {
      const result = parseAttendees([{
        email: 'user@example.com',
        self: true,
        optional: false
      }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!.self).toBe(true);
        expect(result[0]!.optional).toBe(false);
      }
    });

    test('parses attendee with all properties', () => {
      const result = parseAttendees([{
        email: 'user@example.com',
        displayName: 'Test User',
        responseStatus: 'accepted',
        organizer: true,
        self: false,
        optional: false
      }]);
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        expect(result[0]!).toEqual({
          email: 'user@example.com',
          displayName: 'Test User',
          responseStatus: 'accepted',
          organizer: true,
          self: false,
          optional: false
        });
      }
    });

    test('parses multiple attendees', () => {
      const result = parseAttendees([
        { email: 'user1@example.com' },
        { email: 'user2@example.com' }
      ]);
      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      if (result && result.length > 1) {
        expect(result[0]!.email).toBe('user1@example.com');
        expect(result[1]!.email).toBe('user2@example.com');
      }
    });
  });

  describe('buildEventResult', () => {
    test('builds minimal result with only eventId', () => {
      const result = buildEventResult({ id: 'event123' });
      expect(result.eventId).toBe('event123');
      expect(result.summary).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    test('builds result with basic properties', () => {
      const result = buildEventResult({
        id: 'event123',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event/123',
        summary: 'Test Event',
        description: 'Test Description',
        location: 'Test Location'
      });
      expect(result.eventId).toBe('event123');
      expect(result.status).toBe('confirmed');
      expect(result.htmlLink).toBe('https://calendar.google.com/event/123');
      expect(result.summary).toBe('Test Event');
      expect(result.description).toBe('Test Description');
      expect(result.location).toBe('Test Location');
    });

    test('builds result with created and updated timestamps', () => {
      const result = buildEventResult({
        id: 'event123',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-02T00:00:00Z'
      });
      expect(result.created).toBe('2026-01-01T00:00:00Z');
      expect(result.updated).toBe('2026-01-02T00:00:00Z');
    });

    test('builds result with creator', () => {
      const result = buildEventResult({
        id: 'event123',
        creator: { email: 'creator@example.com', displayName: 'Creator' }
      });
      expect(result.creator).toEqual({
        email: 'creator@example.com',
        displayName: 'Creator'
      });
    });

    test('builds result with partial creator (email only)', () => {
      const result = buildEventResult({
        id: 'event123',
        creator: { email: 'creator@example.com' }
      });
      expect(result.creator?.email).toBe('creator@example.com');
      expect(result.creator?.displayName).toBeUndefined();
    });

    test('builds result with organizer', () => {
      const result = buildEventResult({
        id: 'event123',
        organizer: { email: 'org@example.com', displayName: 'Organizer' }
      });
      expect(result.organizer).toEqual({
        email: 'org@example.com',
        displayName: 'Organizer'
      });
    });

    test('builds result with start/end dateTime', () => {
      const result = buildEventResult({
        id: 'event123',
        start: { dateTime: '2026-01-10T14:00:00-06:00', timeZone: 'America/Chicago' },
        end: { dateTime: '2026-01-10T15:00:00-06:00', timeZone: 'America/Chicago' }
      });
      expect(result.start).toEqual({
        dateTime: '2026-01-10T14:00:00-06:00',
        timeZone: 'America/Chicago'
      });
      expect(result.end).toEqual({
        dateTime: '2026-01-10T15:00:00-06:00',
        timeZone: 'America/Chicago'
      });
    });

    test('builds result with start/end date (all-day)', () => {
      const result = buildEventResult({
        id: 'event123',
        start: { date: '2026-01-10' },
        end: { date: '2026-01-11' }
      });
      expect(result.start).toEqual({ date: '2026-01-10' });
      expect(result.end).toEqual({ date: '2026-01-11' });
    });

    test('builds result with recurrence', () => {
      const result = buildEventResult({
        id: 'event123',
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10']
      });
      expect(result.recurrence).toEqual(['RRULE:FREQ=WEEKLY;COUNT=10']);
    });

    test('does not include empty recurrence array', () => {
      const result = buildEventResult({
        id: 'event123',
        recurrence: []
      });
      expect(result.recurrence).toBeUndefined();
    });

    test('builds result with attendees using parseAttendees', () => {
      const result = buildEventResult({
        id: 'event123',
        attendees: [
          { email: 'user@example.com', displayName: 'User', responseStatus: 'accepted' }
        ]
      });
      expect(result.attendees).toBeDefined();
      expect(result.attendees).toHaveLength(1);
      if (result.attendees && result.attendees.length > 0) {
        expect(result.attendees[0]!.email).toBe('user@example.com');
        expect(result.attendees[0]!.displayName).toBe('User');
        expect(result.attendees[0]!.responseStatus).toBe('accepted');
      }
    });

    test('builds result with conferenceData', () => {
      const conferenceData = {
        entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }]
      };
      const result = buildEventResult({
        id: 'event123',
        conferenceData
      });
      expect(result.conferenceData).toEqual(conferenceData);
    });

    test('builds result with attachments', () => {
      const result = buildEventResult({
        id: 'event123',
        attachments: [
          { fileId: 'file1', fileUrl: 'https://drive.google.com/file1', title: 'Doc 1' }
        ]
      });
      expect(result.attachments).toEqual([
        { fileId: 'file1', fileUrl: 'https://drive.google.com/file1', title: 'Doc 1' }
      ]);
    });

    test('handles attachments with missing fields', () => {
      const result = buildEventResult({
        id: 'event123',
        attachments: [{}]
      });
      expect(result.attachments).toEqual([{ fileId: '', fileUrl: '', title: '' }]);
    });

    test('does not include empty attachments array', () => {
      const result = buildEventResult({
        id: 'event123',
        attachments: []
      });
      expect(result.attachments).toBeUndefined();
    });

    test('builds result with reminders using default', () => {
      const result = buildEventResult({
        id: 'event123',
        reminders: { useDefault: true }
      });
      expect(result.reminders).toEqual({ useDefault: true });
    });

    test('builds result with reminders with overrides', () => {
      const result = buildEventResult({
        id: 'event123',
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 30 },
            { method: 'popup', minutes: 10 }
          ]
        }
      });
      expect(result.reminders).toEqual({
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 30 },
          { method: 'popup', minutes: 10 }
        ]
      });
    });

    test('handles reminders overrides with missing fields', () => {
      const result = buildEventResult({
        id: 'event123',
        reminders: {
          useDefault: false,
          overrides: [{}]
        }
      });
      expect(result.reminders?.overrides).toEqual([{ method: 'popup', minutes: 0 }]);
    });

    test('builds complete result with all properties', () => {
      const result = buildEventResult({
        id: 'event123',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event/123',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
        summary: 'Test Event',
        description: 'Test Description',
        location: 'Test Location',
        creator: { email: 'creator@example.com' },
        organizer: { email: 'org@example.com' },
        start: { dateTime: '2026-01-10T14:00:00-06:00' },
        end: { dateTime: '2026-01-10T15:00:00-06:00' },
        recurrence: ['RRULE:FREQ=WEEKLY'],
        attendees: [{ email: 'user@example.com' }],
        reminders: { useDefault: true }
      });

      expect(result.eventId).toBe('event123');
      expect(result.status).toBe('confirmed');
      expect(result.summary).toBe('Test Event');
      expect(result.start?.dateTime).toBe('2026-01-10T14:00:00-06:00');
      expect(result.attendees).toHaveLength(1);
    });
  });
});
