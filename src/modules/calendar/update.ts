/**
 * Calendar update operations - updateEvent
 */

import { randomUUID } from 'crypto';
import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type {
  UpdateEventOptions,
  EventResult,
} from './types.js';
import { resolveContacts } from './contacts.js';
import { validateEventTimes, buildEventResult } from './utils.js';


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
  const result = buildEventResult(response.data);

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
