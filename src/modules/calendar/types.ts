/**
 * Calendar module type definitions
 * Following Gmail module patterns for consistency
 */

import type { calendar_v3 } from 'googleapis';

/**
 * List calendars options
 */
export interface ListCalendarsOptions {
  maxResults?: number;
  pageToken?: string;
  showHidden?: boolean;
  showDeleted?: boolean;
}

/**
 * Calendar summary for list operations
 */
export interface CalendarSummary {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  accessRole?: string;
}

/**
 * List calendars result
 */
export interface ListCalendarsResult {
  calendars: CalendarSummary[];
  nextPageToken?: string;
}

/**
 * List events options
 */
export interface ListEventsOptions {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  pageToken?: string;
  singleEvents?: boolean;
  orderBy?: 'startTime' | 'updated';
  showDeleted?: boolean;
  timeZone?: string;
}

/**
 * Event summary for list operations
 */
export interface EventSummary {
  id: string;
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  status?: string;
  attendeeCount?: number;
  location?: string;
}

/**
 * List events result
 */
export interface ListEventsResult {
  events: EventSummary[];
  nextPageToken?: string;
  timeZone?: string;
  summary?: string;
}

/**
 * Get calendar options
 */
export interface GetCalendarOptions {
  calendarId: string;
}

/**
 * Calendar details result
 */
export interface CalendarResult {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  timeZone: string;
  conferenceProperties?: {
    allowedConferenceSolutionTypes?: string[];
  };
}

/**
 * Get event options
 */
export interface GetEventOptions {
  calendarId?: string;
  eventId: string;
}

/**
 * Attendee information
 */
export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  self?: boolean;
  optional?: boolean;
}

/**
 * Event date/time
 */
export interface EventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

/**
 * Detailed event result
 */
export interface EventResult {
  id: string;
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
  };
  start?: EventDateTime;
  end?: EventDateTime;
  recurrence?: string[];
  attendees?: Attendee[];
  conferenceData?: calendar_v3.Schema$ConferenceData;
  attachments?: Array<{
    fileId: string;
    fileUrl: string;
    title: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

/**
 * Conference data for creating events with Google Meet
 */
export interface ConferenceData {
  createRequest?: {
    requestId: string;
    conferenceSolutionKey: {
      type: 'hangoutsMeet' | 'eventHangout' | 'eventNamedHangout';
    };
  };
}

/**
 * Event attachment (Drive file link)
 */
export interface EventAttachment {
  fileId?: string;
  fileUrl?: string;
  title?: string;
  mimeType?: string;
  iconLink?: string;
}

/**
 * Reminder settings
 */
export interface ReminderSettings {
  useDefault?: boolean;
  overrides?: Array<{
    method: 'email' | 'popup';
    minutes: number;
  }>;
}

/**
 * Create event options
 */
export interface CreateEventOptions {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: EventDateTime;
  end: EventDateTime;
  attendees?: string[]; // Email addresses OR contact names from PAI
  recurrence?: string[]; // RRULE strings
  conferenceData?: ConferenceData;
  attachments?: EventAttachment[];
  reminders?: ReminderSettings;
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  transparency?: 'opaque' | 'transparent';
  colorId?: string;
  timeZone?: string;
}

/**
 * Create event result
 */
export interface CreateEventResult {
  eventId: string;
  htmlLink: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: Attendee[];
  recurrence?: string[];
  created: string;
  updated: string;
  status: string;
  organizer?: {
    email: string;
    displayName?: string;
  };
  creator?: {
    email: string;
    displayName?: string;
  };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
  };
  warnings?: Array<{
    type: string;
    message: string;
    conflicts?: string[];
  }>;
}

/**
 * Flexible datetime input for update operations
 * Accepts either ISO 8601 strings or EventDateTime objects
 *
 * @example
 * // ISO string format
 * start: "2026-01-10T14:00:00-06:00"
 *
 * @example
 * // EventDateTime object format
 * start: { dateTime: "2026-01-10T14:00:00-06:00", timeZone: "America/Chicago" }
 *
 * @example
 * // Date-only string for all-day events
 * start: "2026-01-10"
 */
export type FlexibleDateTime = string | EventDateTime;

/**
 * Update event options with flexible datetime input
 *
 * The updates object accepts both string and EventDateTime formats for start/end times.
 * Strings are automatically normalized to EventDateTime objects before API calls.
 *
 * @example
 * // Using string format (convenient)
 * updateEvent({
 *   eventId: "abc123",
 *   updates: {
 *     summary: "Updated Meeting",
 *     start: "2026-01-10T14:00:00-06:00",
 *     end: "2026-01-10T15:00:00-06:00"
 *   },
 *   sendUpdates: "all"
 * })
 *
 * @example
 * // Using EventDateTime format (explicit)
 * updateEvent({
 *   eventId: "abc123",
 *   updates: {
 *     start: { dateTime: "2026-01-10T14:00:00-06:00", timeZone: "America/Chicago" }
 *   }
 * })
 */
export interface UpdateEventOptions {
  calendarId?: string;
  eventId: string;
  /**
   * Partial event updates. start/end can be ISO strings or EventDateTime objects.
   * Strings are auto-normalized before validation and API calls.
   */
  updates: Omit<Partial<CreateEventOptions>, 'start' | 'end'> & {
    start?: FlexibleDateTime;
    end?: FlexibleDateTime;
  };
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

/**
 * Delete event options
 */
export interface DeleteEventOptions {
  calendarId?: string;
  eventId: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

/**
 * Delete event result
 */
export interface DeleteEventResult {
  eventId: string;
  message: string;
}

/**
 * Quick add options (natural language)
 */
export interface QuickAddOptions {
  calendarId?: string;
  text: string;
}

/**
 * FreeBusy query options
 */
export interface FreeBusyOptions {
  timeMin: string;
  timeMax: string;
  items: Array<{ id: string }>;
  timeZone?: string;
}

/**
 * FreeBusy query result
 */
export interface FreeBusyResult {
  timeMin: string;
  timeMax: string;
  calendars: Record<string, {
    busy: Array<{
      start: string;
      end: string;
    }>;
    errors?: Array<{
      domain: string;
      reason: string;
    }>;
  }>;
}

/**
 * Resolved contact with email and metadata
 */
export interface ResolvedContact {
  email: string;
  displayName?: string;
  role?: string;
}

/**
 * Contact entry parsed from PAI CONTACTS.md
 */
export interface ContactEntry {
  name: string; // lowercase for matching
  displayName: string; // original casing
  email: string;
  role?: string;
}
