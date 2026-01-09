/**
 * Calendar delete operations - deleteEvent
 */

import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type { DeleteEventOptions } from './types.js';

/**
 * Delete a calendar event
 *
 * Features:
 * - Permanently removes event from calendar
 * - Supports sendUpdates parameter to notify attendees
 * - Invalidates all relevant caches
 *
 * Warning: This operation is irreversible. The event cannot be recovered
 * after deletion. For recurring events, this deletes only the specific
 * instance unless you delete the recurring event master.
 *
 * @param options Delete parameters with event ID
 * @param context Calendar API context
 * @returns Success confirmation with message
 *
 * @example
 * ```typescript
 * // Delete event and notify all attendees
 * const result = await deleteEvent({
 *   eventId: 'abc123',
 *   sendUpdates: 'all'
 * }, context);
 *
 * console.log(result.message); // "Event deleted successfully"
 * ```
 *
 * @example
 * ```typescript
 * // Delete event silently (no notifications)
 * const result = await deleteEvent({
 *   eventId: 'abc123',
 *   sendUpdates: 'none'
 * }, context);
 * ```
 */
export async function deleteEvent(
  options: DeleteEventOptions,
  context: CalendarContext
): Promise<{ success: boolean; message: string }> {
  const {
    calendarId = 'primary',
    eventId,
    sendUpdates = 'none',
  } = options;

  // Build params
  const params: calendar_v3.Params$Resource$Events$Delete = {
    calendarId,
    eventId,
    sendUpdates,
  };

  // Execute delete - Google Calendar API returns 204 No Content on success
  await context.calendar.events.delete(params);

  // Invalidate caches for this event and list caches
  const cacheKeys = [
    `calendar:getEvent:${eventId}`,
    `calendar:listEvents:${calendarId}:*`,
  ];
  for (const pattern of cacheKeys) {
    await context.cacheManager.invalidate(pattern);
  }

  context.performanceMonitor.track('calendar:deleteEvent', Date.now() - context.startTime);
  context.logger.info('Deleted calendar event', {
    calendarId,
    eventId,
    sendUpdates,
  });

  return {
    success: true,
    message: 'Event deleted successfully',
  };
}
