/**
 * Calendar read operations - getCalendar and getEvent
 */

import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type {
  GetCalendarOptions,
  CalendarResult,
  GetEventOptions,
  EventResult,
  Attendee,
} from './types.js';

/**
 * Get details of a specific calendar
 *
 * @param options Calendar ID
 * @param context Calendar API context
 * @returns Calendar details
 *
 * @example
 * ```typescript
 * const calendar = await getCalendar({
 *   calendarId: 'primary'
 * }, context);
 *
 * console.log(`Calendar: ${calendar.summary}`);
 * console.log(`Timezone: ${calendar.timeZone}`);
 * ```
 */
export async function getCalendar(
  options: GetCalendarOptions,
  context: CalendarContext
): Promise<CalendarResult> {
  const { calendarId } = options;

  // Check cache first
  const cacheKey = `calendar:getCalendar:${calendarId}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('calendar:getCalendar', Date.now() - context.startTime);
    return cached as CalendarResult;
  }

  // Build params
  const params: calendar_v3.Params$Resource$Calendars$Get = {
    calendarId,
  };

  const response = await context.calendar.calendars.get(params);

  const result: CalendarResult = {
    id: response.data.id!,
    summary: response.data.summary || '',
    timeZone: response.data.timeZone || 'UTC',
  };

  // Only add optional properties if they exist (exactOptionalPropertyTypes compliance)
  if (response.data.description) {
    result.description = response.data.description;
  }
  if (response.data.location) {
    result.location = response.data.location;
  }
  if (response.data.conferenceProperties) {
    result.conferenceProperties = {};
    if (response.data.conferenceProperties.allowedConferenceSolutionTypes) {
      result.conferenceProperties.allowedConferenceSolutionTypes =
        response.data.conferenceProperties.allowedConferenceSolutionTypes;
    }
  }

  // Cache the result (5-minute TTL)
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('calendar:getCalendar', Date.now() - context.startTime);
  context.logger.info('Retrieved calendar', {
    calendarId,
    summary: result.summary,
  });

  return result;
}

/**
 * Parse attendees from Google Calendar event
 */
function parseAttendees(attendees: calendar_v3.Schema$EventAttendee[] | undefined): Attendee[] | undefined {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  return attendees.map((attendee) => {
    const parsed: Attendee = {
      email: attendee.email || '',
    };

    if (attendee.displayName) {
      parsed.displayName = attendee.displayName;
    }
    if (
      attendee.responseStatus &&
      (attendee.responseStatus === 'needsAction' ||
        attendee.responseStatus === 'declined' ||
        attendee.responseStatus === 'tentative' ||
        attendee.responseStatus === 'accepted')
    ) {
      parsed.responseStatus = attendee.responseStatus;
    }
    if (attendee.organizer) {
      parsed.organizer = attendee.organizer;
    }
    if (attendee.self) {
      parsed.self = attendee.self;
    }
    if (attendee.optional) {
      parsed.optional = attendee.optional;
    }

    return parsed;
  });
}

/**
 * Get details of a specific event
 *
 * @param options Event ID and calendar ID
 * @param context Calendar API context
 * @returns Full event details
 *
 * @example
 * ```typescript
 * const event = await getEvent({
 *   eventId: 'abc123'
 * }, context);
 *
 * console.log(`Event: ${event.summary}`);
 * console.log(`Start: ${event.start?.dateTime}`);
 * console.log(`Attendees: ${event.attendees?.length || 0}`);
 * ```
 */
export async function getEvent(
  options: GetEventOptions,
  context: CalendarContext
): Promise<EventResult> {
  const { calendarId = 'primary', eventId } = options;

  // Check cache first
  const cacheKey = `calendar:getEvent:${eventId}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('calendar:getEvent', Date.now() - context.startTime);
    return cached as EventResult;
  }

  // Build params
  const params: calendar_v3.Params$Resource$Events$Get = {
    calendarId,
    eventId,
  };

  const response = await context.calendar.events.get(params);

  const result: EventResult = {
    id: response.data.id!,
  };

  // Only add properties if they exist (exactOptionalPropertyTypes compliance)
  if (response.data.status) {
    result.status = response.data.status;
  }
  if (response.data.htmlLink) {
    result.htmlLink = response.data.htmlLink;
  }
  if (response.data.created) {
    result.created = response.data.created;
  }
  if (response.data.updated) {
    result.updated = response.data.updated;
  }
  if (response.data.summary) {
    result.summary = response.data.summary;
  }
  if (response.data.description) {
    result.description = response.data.description;
  }
  if (response.data.location) {
    result.location = response.data.location;
  }

  // Creator
  if (response.data.creator) {
    result.creator = {};
    if (response.data.creator.email) {
      result.creator.email = response.data.creator.email;
    }
    if (response.data.creator.displayName) {
      result.creator.displayName = response.data.creator.displayName;
    }
  }

  // Organizer
  if (response.data.organizer) {
    result.organizer = {};
    if (response.data.organizer.email) {
      result.organizer.email = response.data.organizer.email;
    }
    if (response.data.organizer.displayName) {
      result.organizer.displayName = response.data.organizer.displayName;
    }
  }

  // Start/End times
  if (response.data.start) {
    result.start = {};
    if (response.data.start.dateTime) {
      result.start.dateTime = response.data.start.dateTime;
    }
    if (response.data.start.date) {
      result.start.date = response.data.start.date;
    }
    if (response.data.start.timeZone) {
      result.start.timeZone = response.data.start.timeZone;
    }
  }

  if (response.data.end) {
    result.end = {};
    if (response.data.end.dateTime) {
      result.end.dateTime = response.data.end.dateTime;
    }
    if (response.data.end.date) {
      result.end.date = response.data.end.date;
    }
    if (response.data.end.timeZone) {
      result.end.timeZone = response.data.end.timeZone;
    }
  }

  // Recurrence
  if (response.data.recurrence && response.data.recurrence.length > 0) {
    result.recurrence = response.data.recurrence;
  }

  // Attendees
  const attendees = parseAttendees(response.data.attendees);
  if (attendees) {
    result.attendees = attendees;
  }

  // Conference data
  if (response.data.conferenceData) {
    result.conferenceData = response.data.conferenceData;
  }

  // Attachments
  if (response.data.attachments && response.data.attachments.length > 0) {
    result.attachments = response.data.attachments.map((att) => ({
      fileId: att.fileId || '',
      fileUrl: att.fileUrl || '',
      title: att.title || '',
    }));
  }

  // Reminders
  if (response.data.reminders) {
    result.reminders = {
      useDefault: response.data.reminders.useDefault || false,
    };
    if (response.data.reminders.overrides && response.data.reminders.overrides.length > 0) {
      result.reminders.overrides = response.data.reminders.overrides.map((override) => ({
        method: override.method || 'popup',
        minutes: override.minutes || 0,
      }));
    }
  }

  // Cache the result (5-minute TTL)
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('calendar:getEvent', Date.now() - context.startTime);
  context.logger.info('Retrieved event', {
    eventId,
    summary: result.summary,
  });

  return result;
}
