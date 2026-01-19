/**
 * Calendar module - Google Calendar operations for the gdrive MCP server
 *
 * @module calendar
 * @version 3.3.0
 */

// Types - Export all type definitions
export type {
  // List types
  ListCalendarsOptions,
  ListCalendarsResult,
  CalendarSummary,
  ListEventsOptions,
  ListEventsResult,
  EventSummary,
  // Read types
  GetCalendarOptions,
  CalendarResult,
  GetEventOptions,
  EventResult,
  // Event types
  EventDateTime,
  Attendee,
  ConferenceData,
  EventAttachment,
  ReminderSettings,
  // Create/Update types
  CreateEventOptions,
  CreateEventResult,
  UpdateEventOptions,
  FlexibleDateTime,
  DeleteEventOptions,
  DeleteEventResult,
  QuickAddOptions,
  // FreeBusy types
  FreeBusyOptions,
  FreeBusyResult,
  // Contact types
  ResolvedContact,
  ContactEntry,
} from './types.js';

// List operations
export { listCalendars, listEvents } from './list.js';

// Read operations
export { getCalendar, getEvent } from './read.js';

// Create operations
export { createEvent, quickAdd } from './create.js';

// Update operations
export { updateEvent } from './update.js';

// Delete operations
export { deleteEvent } from './delete.js';

// FreeBusy operations
export { checkFreeBusy } from './freebusy.js';

// Contact resolution (PAI integration)
export { resolveContacts } from './contacts.js';

// Utilities
export { normalizeEventDateTime, type DateTimeInput } from './utils.js';
