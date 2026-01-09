/**
 * Calendar freebusy operations - checkFreeBusy
 * Checks availability for calendars or attendees in a time range
 */

import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type { FreeBusyOptions, FreeBusyResult } from './types.js';

/**
 * Check free/busy status for calendars or attendees
 *
 * This operation checks availability across multiple calendars in a specified time range.
 * Useful for finding available meeting times or checking schedule conflicts.
 *
 * @param options Free/busy query options (time range and calendar IDs)
 * @param context Calendar API context
 * @returns Free/busy information for each calendar
 *
 * @example
 * ```typescript
 * // Check availability for today
 * const result = await checkFreeBusy({
 *   timeMin: '2026-01-09T00:00:00Z',
 *   timeMax: '2026-01-09T23:59:59Z',
 *   items: [{ id: 'primary' }]
 * }, context);
 *
 * // Check if calendar is free at specific time
 * const isFree = result.calendars['primary'].busy.length === 0;
 * ```
 */
export async function checkFreeBusy(
  options: FreeBusyOptions,
  context: CalendarContext
): Promise<FreeBusyResult> {
  const { timeMin, timeMax, items, timeZone } = options;

  // Check cache first (short TTL for time-sensitive data)
  const cacheKey = `calendar:checkFreeBusy:${JSON.stringify(options)}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track(
      'calendar:checkFreeBusy',
      Date.now() - context.startTime
    );
    return cached as FreeBusyResult;
  }

  try {
    // Build params object - only include properties that have values
    // This is required because of exactOptionalPropertyTypes in tsconfig
    const requestBody: calendar_v3.Schema$FreeBusyRequest = {
      timeMin,
      timeMax,
      items,
    };

    if (timeZone) {
      requestBody.timeZone = timeZone;
    }

    const response = await context.calendar.freebusy.query({
      requestBody,
    });

    const result: FreeBusyResult = {
      timeMin: response.data.timeMin!,
      timeMax: response.data.timeMax!,
      calendars: {},
    };

    // Transform response calendars to our type format
    if (response.data.calendars) {
      for (const [calendarId, calendarData] of Object.entries(
        response.data.calendars
      )) {
        result.calendars[calendarId] = {
          busy: (calendarData.busy || []).map((period) => ({
            start: period.start!,
            end: period.end!,
          })),
        };

        // Include errors if present (e.g., calendar not found or access denied)
        if (calendarData.errors && calendarData.errors.length > 0) {
          result.calendars[calendarId].errors = calendarData.errors.map(
            (err) => ({
              domain: err.domain!,
              reason: err.reason!,
            })
          );
        }
      }
    }

    // Cache the result (Note: current CacheManager doesn't support per-operation TTL)
    // TODO: Implement 60s TTL for freeBusy when CacheManager supports configurable TTL
    // Per spec: "cache with short TTL (60s), highly time-sensitive"
    await context.cacheManager.set(cacheKey, result);

    context.performanceMonitor.track(
      'calendar:checkFreeBusy',
      Date.now() - context.startTime
    );

    return result;
  } catch (error) {
    context.logger.error('Failed to check free/busy', {
      error,
      options,
    });
    throw error;
  }
}
