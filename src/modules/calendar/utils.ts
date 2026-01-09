/**
 * Shared calendar utilities
 */

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
