/**
 * Calendar create operations - createEvent and quickAdd
 */

import { randomUUID } from 'crypto';
import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type {
  CreateEventOptions,
  EventResult,
  QuickAddOptions,
  Attendee,
} from './types.js';
import { resolveContacts } from './contacts.js';

/**
 * Validate event time parameters
 * - Ensures end time is after start time
 * - Validates all-day events use 'date' field, not 'dateTime'
 *
 * @param start Event start time
 * @param end Event end time
 * @throws Error if validation fails
 */
function validateEventTimes(
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
 */
function parseAttendees(attendees: calendar_v3.Schema$EventAttendee[] | undefined): Attendee[] | undefined {
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
 * Create a new calendar event
 *
 * Features:
 * - Resolves PAI contact names to email addresses via contacts.ts
 * - Automatic UUID generation for Google Meet conferenceData requestId
 * - Supports all-day events, recurring events, attachments, reminders
 * - Validates event times (end must be after start)
 * - Invalidates relevant caches after creation
 *
 * @param options Event creation parameters
 * @param context Calendar API context
 * @returns Created event details
 *
 * @example
 * ```typescript
 * // Create event with PAI contact names
 * const event = await createEvent({
 *   summary: 'Team Sync',
 *   start: { dateTime: '2026-01-09T14:00:00-06:00' },
 *   end: { dateTime: '2026-01-09T15:00:00-06:00' },
 *   attendees: ['Mary', 'Kelvin'], // Resolves via PAI contacts
 *   conferenceData: {
 *     createRequest: {
 *       requestId: randomUUID(), // Auto-generated if not provided
 *       conferenceSolutionKey: { type: 'hangoutsMeet' }
 *     }
 *   }
 * }, context);
 * ```
 *
 * @example
 * ```typescript
 * // Create all-day event with raw emails
 * const event = await createEvent({
 *   summary: 'Team Offsite',
 *   start: { date: '2026-02-15' },
 *   end: { date: '2026-02-16' },
 *   attendees: ['user@example.com', 'other@example.com'],
 *   location: 'San Francisco Office'
 * }, context);
 * ```
 */
export async function createEvent(
  options: CreateEventOptions,
  context: CalendarContext
): Promise<EventResult> {
  const {
    calendarId = 'primary',
    summary,
    description,
    location,
    start,
    end,
    attendees,
    recurrence,
    conferenceData,
    attachments,
    reminders,
    visibility,
    transparency,
    colorId,
    timeZone,
  } = options;

  // Validate event times
  validateEventTimes(start, end);

  // Resolve contact names to emails if attendees provided
  let resolvedAttendees: calendar_v3.Schema$EventAttendee[] | undefined;
  if (attendees && attendees.length > 0) {
    const resolved = await resolveContacts(attendees, context.logger);
    resolvedAttendees = resolved.map((contact) => {
      const attendee: calendar_v3.Schema$EventAttendee = {
        email: contact.email,
      };
      if (contact.displayName) {
        attendee.displayName = contact.displayName;
      }
      return attendee;
    });
  }

  // Handle Google Meet conference data with auto-generated requestId if needed
  let processedConferenceData: calendar_v3.Schema$ConferenceData | undefined;
  if (conferenceData?.createRequest) {
    processedConferenceData = {
      createRequest: {
        requestId: conferenceData.createRequest.requestId || randomUUID(),
        conferenceSolutionKey: {
          type: conferenceData.createRequest.conferenceSolutionKey.type,
        },
      },
    };
  }

  // Build event resource
  const eventResource: calendar_v3.Schema$Event = {
    summary,
  };

  // Only add optional fields if they exist (exactOptionalPropertyTypes compliance)
  if (description) {
    eventResource.description = description;
  }
  if (location) {
    eventResource.location = location;
  }

  // Start and end times (required)
  eventResource.start = start;
  eventResource.end = end;

  if (resolvedAttendees && resolvedAttendees.length > 0) {
    eventResource.attendees = resolvedAttendees;
  }
  if (recurrence && recurrence.length > 0) {
    eventResource.recurrence = recurrence;
  }
  if (processedConferenceData) {
    eventResource.conferenceData = processedConferenceData;
  }
  if (attachments && attachments.length > 0) {
    eventResource.attachments = attachments.map((att) => {
      const mapped: calendar_v3.Schema$EventAttachment = {};
      if (att.fileId !== undefined) {
        mapped.fileId = att.fileId;
      }
      if (att.fileUrl !== undefined) {
        mapped.fileUrl = att.fileUrl;
      }
      if (att.title !== undefined) {
        mapped.title = att.title;
      }
      if (att.mimeType !== undefined) {
        mapped.mimeType = att.mimeType;
      }
      if (att.iconLink !== undefined) {
        mapped.iconLink = att.iconLink;
      }
      return mapped;
    });
  }
  if (reminders) {
    eventResource.reminders = {};
    if (reminders.useDefault !== undefined) {
      eventResource.reminders.useDefault = reminders.useDefault;
    }
    if (reminders.overrides !== undefined) {
      eventResource.reminders.overrides = reminders.overrides;
    }
  }
  if (visibility) {
    eventResource.visibility = visibility;
  }
  if (transparency) {
    eventResource.transparency = transparency;
  }
  if (colorId) {
    eventResource.colorId = colorId;
  }

  // Build params
  const params: calendar_v3.Params$Resource$Events$Insert = {
    calendarId,
    requestBody: eventResource,
  };

  // Only set conferenceDataVersion if conference data exists
  if (processedConferenceData) {
    params.conferenceDataVersion = 1;
  }

  // Add timeZone to params if provided (for timezone-aware event creation)
  if (timeZone) {
    // TimeZone is set in the start/end EventDateTime objects, not at the params level
    // So we just ensure it's passed through correctly in the eventResource
  }

  const response = await context.calendar.events.insert(params);

  // Build result
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
  const parsedAttendees = parseAttendees(response.data.attendees);
  if (parsedAttendees) {
    result.attendees = parsedAttendees;
  }

  // Conference data
  if (response.data.conferenceData) {
    result.conferenceData = response.data.conferenceData;
  }

  // Attachments
  if (response.data.attachments && response.data.attachments.length > 0) {
    result.attachments = response.data.attachments.map((att: calendar_v3.Schema$EventAttachment) => ({
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
      result.reminders.overrides = response.data.reminders.overrides.map((override: calendar_v3.Schema$EventReminder) => ({
        method: override.method || 'popup',
        minutes: override.minutes || 0,
      }));
    }
  }

  // Invalidate list caches for this calendar
  const listCacheKeys = [
    `calendar:listEvents:${calendarId}:*`,
    `calendar:getEvent:${result.id}`,
  ];
  for (const pattern of listCacheKeys) {
    await context.cacheManager.invalidate(pattern);
  }

  context.performanceMonitor.track('calendar:createEvent', Date.now() - context.startTime);
  context.logger.info('Created calendar event', {
    calendarId,
    eventId: result.id,
    summary: result.summary,
    attendeeCount: parsedAttendees?.length || 0,
  });

  return result;
}

/**
 * Quick add event using natural language
 *
 * Uses Google Calendar's quick add feature to create events from natural language strings.
 * Examples:
 * - "Appointment at Somewhere on June 3rd 10am-10:25am"
 * - "Dinner with Mary at 7pm tomorrow"
 * - "Team meeting next Monday 2pm"
 *
 * Note: Quick add does NOT support:
 * - PAI contact name resolution (use raw emails or full names)
 * - Custom conference data (Google Meet links)
 * - Attachments
 * - Custom reminders
 *
 * For full control, use createEvent() instead.
 *
 * @param options Quick add text and calendar ID
 * @param context Calendar API context
 * @returns Created event details
 *
 * @example
 * ```typescript
 * const event = await quickAdd({
 *   text: 'Lunch with team at 12pm tomorrow'
 * }, context);
 *
 * console.log(`Created: ${event.summary}`);
 * console.log(`Start: ${event.start?.dateTime}`);
 * ```
 */
export async function quickAdd(
  options: QuickAddOptions,
  context: CalendarContext
): Promise<EventResult> {
  const { calendarId = 'primary', text } = options;

  // Build params
  const params: calendar_v3.Params$Resource$Events$Quickadd = {
    calendarId,
    text,
  };

  const response = await context.calendar.events.quickAdd(params);

  // Build result
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
  const parsedAttendees = parseAttendees(response.data.attendees);
  if (parsedAttendees) {
    result.attendees = parsedAttendees;
  }

  // Conference data
  if (response.data.conferenceData) {
    result.conferenceData = response.data.conferenceData;
  }

  // Attachments
  if (response.data.attachments && response.data.attachments.length > 0) {
    result.attachments = response.data.attachments.map((att: calendar_v3.Schema$EventAttachment) => ({
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
      result.reminders.overrides = response.data.reminders.overrides.map((override: calendar_v3.Schema$EventReminder) => ({
        method: override.method || 'popup',
        minutes: override.minutes || 0,
      }));
    }
  }

  // Invalidate list caches for this calendar
  const listCacheKeys = [
    `calendar:listEvents:${calendarId}:*`,
    `calendar:getEvent:${result.id}`,
  ];
  for (const pattern of listCacheKeys) {
    await context.cacheManager.invalidate(pattern);
  }

  context.performanceMonitor.track('calendar:quickAdd', Date.now() - context.startTime);
  context.logger.info('Quick added calendar event', {
    calendarId,
    eventId: result.id,
    text,
    summary: result.summary,
  });

  return result;
}
