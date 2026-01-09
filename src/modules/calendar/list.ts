/**
 * Calendar list operations - listCalendars and listEvents
 */

import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type {
  ListCalendarsOptions,
  ListCalendarsResult,
  ListEventsOptions,
  ListEventsResult,
} from './types.js';

/**
 * List calendars accessible by the user
 *
 * @param options List options including pagination
 * @param context Calendar API context
 * @returns List of calendar summaries with pagination info
 *
 * @example
 * ```typescript
 * // List all calendars
 * const result = await listCalendars({
 *   maxResults: 10
 * }, context);
 *
 * console.log(`Found ${result.calendars.length} calendars`);
 * ```
 */
export async function listCalendars(
  options: ListCalendarsOptions,
  context: CalendarContext
): Promise<ListCalendarsResult> {
  const {
    maxResults = 10,
    pageToken,
    showHidden = false,
    showDeleted = false,
  } = options;

  // Check cache first
  const cacheKey = `calendar:listCalendars:${JSON.stringify(options)}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('calendar:listCalendars', Date.now() - context.startTime);
    return cached as ListCalendarsResult;
  }

  // Build params object - only include properties that have values
  // This is required because of exactOptionalPropertyTypes in tsconfig
  const params: calendar_v3.Params$Resource$Calendarlist$List = {
    maxResults: Math.min(maxResults, 250), // Calendar API limit
    showHidden,
    showDeleted,
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  const response = await context.calendar.calendarList.list(params);

  const result: ListCalendarsResult = {
    calendars: (response.data.items || []).map((cal: calendar_v3.Schema$CalendarListEntry) => {
      const calendar: {
        id: string;
        summary: string;
        description?: string;
        timeZone?: string;
        primary?: boolean;
        accessRole?: string;
      } = {
        id: cal.id!,
        summary: cal.summary || '',
      };

      // Only add optional properties if they exist (exactOptionalPropertyTypes compliance)
      if (cal.description) {
        calendar.description = cal.description;
      }
      if (cal.timeZone) {
        calendar.timeZone = cal.timeZone;
      }
      if (cal.primary) {
        calendar.primary = cal.primary;
      }
      if (cal.accessRole) {
        calendar.accessRole = cal.accessRole;
      }

      return calendar;
    }),
  };

  // Only add nextPageToken if it exists (exactOptionalPropertyTypes compliance)
  if (response.data.nextPageToken) {
    result.nextPageToken = response.data.nextPageToken;
  }

  // Cache the result (5-minute TTL)
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('calendar:listCalendars', Date.now() - context.startTime);
  context.logger.info('Listed calendars', {
    count: result.calendars.length,
    hasMore: !!result.nextPageToken,
  });

  return result;
}

/**
 * List events in a calendar within a time range
 *
 * @param options List options including time range and pagination
 * @param context Calendar API context
 * @returns List of event summaries with pagination info
 *
 * @example
 * ```typescript
 * // List upcoming events
 * const result = await listEvents({
 *   timeMin: '2026-01-09T00:00:00Z',
 *   maxResults: 20,
 *   singleEvents: true,
 *   orderBy: 'startTime'
 * }, context);
 *
 * console.log(`Found ${result.events.length} events`);
 * ```
 */
export async function listEvents(
  options: ListEventsOptions,
  context: CalendarContext
): Promise<ListEventsResult> {
  const {
    calendarId = 'primary',
    timeMin,
    timeMax,
    maxResults = 10,
    pageToken,
    singleEvents = true,
    orderBy,
    showDeleted = false,
    timeZone,
  } = options;

  // Check cache first - use calendarId as separate segment for pattern-based invalidation
  const cacheKey = `calendar:listEvents:${calendarId}:${JSON.stringify({ timeMin, timeMax, maxResults, pageToken, singleEvents, orderBy, showDeleted, timeZone })}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('calendar:listEvents', Date.now() - context.startTime);
    return cached as ListEventsResult;
  }

  // Build params object - only include properties that have values
  // This is required because of exactOptionalPropertyTypes in tsconfig
  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId,
    maxResults: Math.min(maxResults, 2500), // Calendar API limit
    singleEvents,
    showDeleted,
  };

  if (timeMin) {
    params.timeMin = timeMin;
  }
  if (timeMax) {
    params.timeMax = timeMax;
  }
  if (pageToken) {
    params.pageToken = pageToken;
  }
  if (orderBy) {
    params.orderBy = orderBy;
  }
  if (timeZone) {
    params.timeZone = timeZone;
  }

  const response = await context.calendar.events.list(params);

  const result: ListEventsResult = {
    events: (response.data.items || []).map((event: calendar_v3.Schema$Event) => {
      const eventSummary: {
        id: string;
        summary?: string;
        description?: string;
        start?: string;
        end?: string;
        status?: string;
        attendeeCount?: number;
        location?: string;
      } = {
        id: event.id!,
      };

      // Only add optional properties if they exist (exactOptionalPropertyTypes compliance)
      if (event.summary) {
        eventSummary.summary = event.summary;
      }
      if (event.description) {
        eventSummary.description = event.description;
      }
      if (event.start?.dateTime || event.start?.date) {
        const startTime = event.start.dateTime || event.start.date;
        if (startTime) {
          eventSummary.start = startTime;
        }
      }
      if (event.end?.dateTime || event.end?.date) {
        const endTime = event.end.dateTime || event.end.date;
        if (endTime) {
          eventSummary.end = endTime;
        }
      }
      if (event.status) {
        eventSummary.status = event.status;
      }
      if (event.attendees && event.attendees.length > 0) {
        eventSummary.attendeeCount = event.attendees.length;
      }
      if (event.location) {
        eventSummary.location = event.location;
      }

      return eventSummary;
    }),
  };

  // Only add optional properties if they exist (exactOptionalPropertyTypes compliance)
  if (response.data.nextPageToken) {
    result.nextPageToken = response.data.nextPageToken;
  }
  if (response.data.timeZone) {
    result.timeZone = response.data.timeZone;
  }
  if (response.data.summary) {
    result.summary = response.data.summary;
  }

  // Cache the result (5-minute TTL)
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('calendar:listEvents', Date.now() - context.startTime);
  context.logger.info('Listed events', {
    count: result.events.length,
    hasMore: !!result.nextPageToken,
  });

  return result;
}
