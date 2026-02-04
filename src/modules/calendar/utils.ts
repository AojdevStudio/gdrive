/**
 * Shared calendar utilities
 */

import type { calendar_v3 } from 'googleapis';
import type { Attendee, EventResult } from './types.js';

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

/**
 * Build EventResult from Google Calendar API response
 * Transforms Google API event schema into type-safe EventResult
 *
 * @param responseData Google Calendar API event object
 * @returns Type-safe EventResult object
 */
export function buildEventResult(
  responseData: calendar_v3.Schema$Event
): EventResult {
  const result: EventResult = {
    eventId: responseData.id!,
  };

  // Only add properties if they exist (exactOptionalPropertyTypes compliance)
  if (responseData.status) {
    result.status = responseData.status;
  }
  if (responseData.htmlLink) {
    result.htmlLink = responseData.htmlLink;
  }
  if (responseData.created) {
    result.created = responseData.created;
  }
  if (responseData.updated) {
    result.updated = responseData.updated;
  }
  if (responseData.summary) {
    result.summary = responseData.summary;
  }
  if (responseData.description) {
    result.description = responseData.description;
  }
  if (responseData.location) {
    result.location = responseData.location;
  }

  // Creator
  if (responseData.creator) {
    result.creator = {};
    if (responseData.creator.email) {
      result.creator.email = responseData.creator.email;
    }
    if (responseData.creator.displayName) {
      result.creator.displayName = responseData.creator.displayName;
    }
  }

  // Organizer
  if (responseData.organizer) {
    result.organizer = {};
    if (responseData.organizer.email) {
      result.organizer.email = responseData.organizer.email;
    }
    if (responseData.organizer.displayName) {
      result.organizer.displayName = responseData.organizer.displayName;
    }
  }

  // Start/End times
  if (responseData.start) {
    result.start = {};
    if (responseData.start.dateTime) {
      result.start.dateTime = responseData.start.dateTime;
    }
    if (responseData.start.date) {
      result.start.date = responseData.start.date;
    }
    if (responseData.start.timeZone) {
      result.start.timeZone = responseData.start.timeZone;
    }
  }

  if (responseData.end) {
    result.end = {};
    if (responseData.end.dateTime) {
      result.end.dateTime = responseData.end.dateTime;
    }
    if (responseData.end.date) {
      result.end.date = responseData.end.date;
    }
    if (responseData.end.timeZone) {
      result.end.timeZone = responseData.end.timeZone;
    }
  }

  // Recurrence
  if (responseData.recurrence && responseData.recurrence.length > 0) {
    result.recurrence = responseData.recurrence;
  }

  // Attendees (uses parseAttendees utility)
  const parsedAttendees = parseAttendees(responseData.attendees);
  if (parsedAttendees) {
    result.attendees = parsedAttendees;
  }

  // Conference data
  if (responseData.conferenceData) {
    result.conferenceData = responseData.conferenceData;
  }

  // Attachments
  if (responseData.attachments && responseData.attachments.length > 0) {
    result.attachments = responseData.attachments.map((att) => ({
      fileId: att.fileId || '',
      fileUrl: att.fileUrl || '',
      title: att.title || '',
    }));
  }

  // Reminders
  if (responseData.reminders) {
    result.reminders = {
      useDefault: responseData.reminders.useDefault || false,
    };
    if (responseData.reminders.overrides && responseData.reminders.overrides.length > 0) {
      result.reminders.overrides = responseData.reminders.overrides.map((override) => ({
        method: override.method || 'popup',
        minutes: override.minutes || 0,
      }));
    }
  }

  return result;
}
