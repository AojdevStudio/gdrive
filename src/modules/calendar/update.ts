/**
 * Calendar update operations - updateEvent
 */

import { randomUUID } from 'crypto';
import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type {
  UpdateEventOptions,
  EventResult,
  Attendee,
} from './types.js';
import { resolveContacts } from './contacts.js';
import { validateEventTimes } from './utils.js';

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
 * Update an existing calendar event
 *
 * Features:
 * - Partial updates: Only updates fields provided in the updates object
 * - Resolves PAI contact names to email addresses for attendees
 * - Validates event times if both start and end are updated
 * - Supports sendUpdates parameter to notify attendees
 * - Invalidates relevant caches after update
 *
 * Note: This performs a PATCH operation, not a full replacement.
 * Only fields in the updates object will be modified.
 *
 * @param options Update parameters with event ID and partial updates
 * @param context Calendar API context
 * @returns Updated event details
 *
 * @example
 * ```typescript
 * // Update event summary and add attendees
 * const event = await updateEvent({
 *   eventId: 'abc123',
 *   updates: {
 *     summary: 'Updated Meeting Title',
 *     attendees: ['Mary', 'user@example.com']
 *   },
 *   sendUpdates: 'all' // Notify all attendees
 * }, context);
 * ```
 *
 * @example
 * ```typescript
 * // Update event time only
 * const event = await updateEvent({
 *   eventId: 'abc123',
 *   updates: {
 *     start: { dateTime: '2026-01-10T15:00:00-06:00' },
 *     end: { dateTime: '2026-01-10T16:00:00-06:00' }
 *   },
 *   sendUpdates: 'externalOnly' // Only notify external attendees
 * }, context);
 * ```
 */
export async function updateEvent(
  options: UpdateEventOptions,
  context: CalendarContext
): Promise<EventResult> {
  const {
    calendarId = 'primary',
    eventId,
    updates,
    sendUpdates = 'none',
  } = options;

  // Validate event times if both start and end are being updated
  if (updates.start && updates.end) {
    validateEventTimes(updates.start, updates.end);
  }

  // Resolve contact names to emails if attendees are being updated
  let resolvedAttendees: calendar_v3.Schema$EventAttendee[] | undefined;
  if (updates.attendees && updates.attendees.length > 0) {
    const resolved = await resolveContacts(updates.attendees, context.logger);
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
  if (updates.conferenceData?.createRequest) {
    processedConferenceData = {
      createRequest: {
        requestId: updates.conferenceData.createRequest.requestId || randomUUID(),
        conferenceSolutionKey: {
          type: updates.conferenceData.createRequest.conferenceSolutionKey.type,
        },
      },
    };
  }

  // Build partial update resource (only include fields being updated)
  const eventResource: calendar_v3.Schema$Event = {};

  if (updates.summary !== undefined) {
    eventResource.summary = updates.summary;
  }
  if (updates.description !== undefined) {
    eventResource.description = updates.description;
  }
  if (updates.location !== undefined) {
    eventResource.location = updates.location;
  }
  if (updates.start !== undefined) {
    eventResource.start = updates.start;
  }
  if (updates.end !== undefined) {
    eventResource.end = updates.end;
  }
  if (resolvedAttendees !== undefined) {
    eventResource.attendees = resolvedAttendees;
  }
  if (updates.recurrence !== undefined) {
    eventResource.recurrence = updates.recurrence;
  }
  if (processedConferenceData !== undefined) {
    eventResource.conferenceData = processedConferenceData;
  }
  if (updates.attachments !== undefined) {
    eventResource.attachments = updates.attachments.map((att) => {
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
  if (updates.reminders !== undefined) {
    eventResource.reminders = {};
    if (updates.reminders.useDefault !== undefined) {
      eventResource.reminders.useDefault = updates.reminders.useDefault;
    }
    if (updates.reminders.overrides !== undefined) {
      eventResource.reminders.overrides = updates.reminders.overrides;
    }
  }
  if (updates.visibility !== undefined) {
    eventResource.visibility = updates.visibility;
  }
  if (updates.transparency !== undefined) {
    eventResource.transparency = updates.transparency;
  }
  if (updates.colorId !== undefined) {
    eventResource.colorId = updates.colorId;
  }

  // Build params
  const params: calendar_v3.Params$Resource$Events$Patch = {
    calendarId,
    eventId,
    requestBody: eventResource,
    sendUpdates,
  };

  // Only set conferenceDataVersion if conference data exists
  if (processedConferenceData) {
    params.conferenceDataVersion = 1;
  }

  const response = await context.calendar.events.patch(params);

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

  // Invalidate caches for this event and list caches
  const cacheKeys = [
    `calendar:getEvent:${eventId}`,
    `calendar:listEvents:${calendarId}:*`,
  ];
  for (const pattern of cacheKeys) {
    await context.cacheManager.invalidate(pattern);
  }

  context.performanceMonitor.track('calendar:updateEvent', Date.now() - context.startTime);
  context.logger.info('Updated calendar event', {
    calendarId,
    eventId,
    fieldsUpdated: Object.keys(updates),
    sendUpdates,
  });

  return result;
}
