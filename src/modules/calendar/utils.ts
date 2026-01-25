/**
 * Shared calendar utilities
 */

import type { calendar_v3 } from 'googleapis';
import type { Attendee } from './types.js';

/**
 * Validate event time parameters
 * - Ensures end time is after start time
 * - Validates all-day events use 'date' field, not 'dateTime'
 *
 * @param start Event start time
 * @param end Event end time
 * @throws Error if validation fails
 */
export function validateEventTimes(
  start: { dateTime?: string; date?: string },
  end: { dateTime?: string; date?: string }
): void {
  // Check all-day event consistency
  if (start.date && start.dateTime) {
    throw new Error("All-day events should use 'date' field, not 'dateTime'");
  }
  if (end.date && end.dateTime) {
    throw new Error("All-day events should use 'date' field, not 'dateTime'");
  }

  // Check end is after start (for dateTime events)
  if (start.dateTime && end.dateTime) {
    const startTime = new Date(start.dateTime).getTime();
    const endTime = new Date(end.dateTime).getTime();

    if (endTime <= startTime) {
      throw new Error('Event end time must be after start time');
    }
  }

  // Check end is after start (for all-day events)
  if (start.date && end.date) {
    const startTime = new Date(start.date).getTime();
    const endTime = new Date(end.date).getTime();

    if (endTime <= startTime) {
      throw new Error('Event end time must be after start time');
    }
  }
}

/**
 * Parse attendees from Google Calendar API response
 * Transforms Google API schema into type-safe Attendee objects
 *
 * @param attendees Google Calendar API attendees array
 * @returns Parsed attendees array, or undefined if empty/missing
 */
export function parseAttendees(
  attendees: calendar_v3.Schema$EventAttendee[] | undefined
): Attendee[] | undefined {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  return attendees.map((attendee) => {
    const parsed: Attendee = {
      email: attendee.email ?? '',
    };

    // Use intermediate variables to help TypeScript narrow types
    const displayName = attendee.displayName;
    if (typeof displayName === 'string') {
      parsed.displayName = displayName;
    }

    const responseStatus = attendee.responseStatus;
    if (responseStatus === 'needsAction' || responseStatus === 'declined' || responseStatus === 'tentative' || responseStatus === 'accepted') {
      parsed.responseStatus = responseStatus;
    }

    if (attendee.organizer === true) {
      parsed.organizer = true;
    } else if (attendee.organizer === false) {
      parsed.organizer = false;
    }

    if (attendee.self === true) {
      parsed.self = true;
    } else if (attendee.self === false) {
      parsed.self = false;
    }

    if (attendee.optional === true) {
      parsed.optional = true;
    } else if (attendee.optional === false) {
      parsed.optional = false;
    }

    return parsed;
  });
}
