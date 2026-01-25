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
} from './types.js';
import { buildEventResult } from './utils.js';

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

  const result = buildEventResult(response.data);

  // Cache the result (5-minute TTL)
  await context.cacheManager.set(cacheKey, result);
  context.performanceMonitor.track('calendar:getEvent', Date.now() - context.startTime);
  context.logger.info('Retrieved event', {
    eventId,
    summary: result.summary,
  });

  return result;
}
