---
status: implemented
reviewer: Antigravity
date: 2026-01-12T10:32:28-06:00
grade: A (Fully Implemented)
---

# Google Calendar Integration Specification

**Generated:** Thu Jan 8 12:03:43 CST 2026
**Status:** Ready for Implementation
**Version:** 1.0.0

## Problem Statement

### Why This Exists
The gdrive MCP server currently provides comprehensive access to Google Workspace (Drive, Sheets, Forms, Docs, Gmail) but lacks calendar functionality. Users need to:
- Schedule meetings with contacts from their PAI contact list
- Manage personal calendar events programmatically
- Coordinate across multiple calendars
- Track events and meetings as part of their AI-assisted workflow

### Who It's For
- **Primary:** Users of the gdrive MCP server who need calendar operations integrated with their existing workflow
- **Specific:** PAI (Personal AI Infrastructure) users who want to schedule meetings with their contacts (Mary, Kelvin, Giauna, Elihu, Ayaba, etc.) by name rather than manually typing emails

### Cost of Not Doing It
Without calendar integration:
- Users must manually switch between MCP tools and Google Calendar UI
- Cannot programmatically schedule meetings as part of automated workflows
- Missing calendar context in PAI Memory System (can't track meeting history)
- No integration between emails (Gmail module) and calendar events
- Cannot leverage contact list for quick meeting invites

## Technical Requirements

### Architecture Pattern
**Operation-based with progressive disclosure** (matching Gmail/Drive/Sheets modules)

```typescript
// MCP Tool Definition
{
  name: "calendar",
  description: "Google Calendar operations. Read gdrive://tools resource to see available operations.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: [
          // Calendar Management
          "listCalendars",
          "getCalendar",

          // Event CRUD
          "listEvents",
          "getEvent",
          "createEvent",
          "updateEvent",
          "deleteEvent",

          // Advanced Operations
          "quickAdd",
          "checkFreeBusy"
        ],
        description: "Operation to perform"
      },
      params: {
        type: "object",
        description: "Operation-specific parameters. See gdrive://tools for details."
      }
    },
    required: ["operation", "params"]
  }
}
```

### Module Structure
Following established patterns from Gmail module (v3.2.0):

```
src/modules/calendar/
├── index.ts           # Public API exports (types + operations)
├── types.ts           # TypeScript interfaces and types
├── list.ts            # listCalendars, listEvents
├── read.ts            # getCalendar, getEvent
├── create.ts          # createEvent, quickAdd
├── update.ts          # updateEvent
├── delete.ts          # deleteEvent
├── freebusy.ts        # checkFreeBusy
└── contacts.ts        # PAI contact name resolution
```

### Data Models

#### CalendarContext
```typescript
export interface CalendarContext extends BaseContext {
  calendar: calendar_v3.Calendar;  // Google Calendar API v3
}
```

#### Event Options
```typescript
export interface CreateEventOptions {
  calendarId?: string;              // Default: 'primary'
  summary: string;                  // Event title
  description?: string;             // Event details
  location?: string;                // Physical or virtual location
  start: EventDateTime;             // Start time with timezone
  end: EventDateTime;               // End time with timezone
  attendees?: string[];             // Email addresses OR contact names
  recurrence?: string[];            // RRULE strings (RFC 5545)
  conferenceData?: ConferenceData;  // Google Meet or other video links
  attachments?: EventAttachment[];  // Drive file links
  reminders?: ReminderSettings;     // Notification settings
}

export interface EventDateTime {
  dateTime?: string;                // ISO 8601 format: '2026-01-08T14:00:00-06:00'
  date?: string;                    // All-day events: '2026-01-08'
  timeZone?: string;                // IANA timezone: 'America/Chicago'
}

export interface ConferenceData {
  createRequest?: {
    requestId: string;              // UUID for idempotency
    conferenceSolutionKey: {
      type: 'hangoutsMeet' | 'eventHangout' | 'eventNamedHangout';
    };
  };
}
```

#### List/Search Options
```typescript
export interface ListEventsOptions {
  calendarId?: string;              // Default: 'primary'
  timeMin?: string;                 // ISO 8601: filter events after this time
  timeMax?: string;                 // ISO 8601: filter events before this time
  maxResults?: number;              // Default: 10, max: 2500
  pageToken?: string;               // For pagination
  singleEvents?: boolean;           // Expand recurring events (default: true)
  orderBy?: 'startTime' | 'updated';
  showDeleted?: boolean;            // Include deleted events
  timeZone?: string;                // Response timezone
}
```

### PAI Contact Integration

#### Contact Resolution Strategy
**Environment Variable:** `PAI_CONTACTS_PATH`
**Default:** `/Users/ossieirondi/PAI/.claude/skills/CORE/USER/CONTACTS.md`

#### Contact Name Resolution
```typescript
// src/modules/calendar/contacts.ts

/**
 * Resolve contact names to email addresses from PAI contact list
 *
 * Supports:
 * - First names: "Mary" -> "findsbymary@gmail.com"
 * - Raw emails: "user@example.com" -> "user@example.com"
 * - Mixed: ["Mary", "user@example.com"] -> ["findsbymary@gmail.com", "user@example.com"]
 */
export async function resolveContacts(
  names: string[],
  logger: Logger
): Promise<{ email: string; displayName?: string }[]>
```

#### Contact List Format Parsing
Parse PAI CONTACTS.md format:
```markdown
- **Mary** [Wife/Life Partner] - findsbymary@gmail.com
- **Kelvin** [Junior Developer] - mmesomakelvin@gmail.com
```

Extract mapping:
```typescript
{
  "mary": { email: "findsbymary@gmail.com", displayName: "Mary", role: "Wife/Life Partner" },
  "kelvin": { email: "mmesomakelvin@gmail.com", displayName: "Kelvin", role: "Junior Developer" }
}
```

#### Error Handling for Contact Resolution
- **Unknown contact name:** Return clear error: `"Contact 'Bob' not found in PAI contact list. Available contacts: Mary, Kelvin, Giauna, Elihu, Ayaba, Veronica, Uzoamaka"`
- **Missing contacts file:** Log warning, treat all inputs as raw email addresses
- **Invalid email format:** Validate with regex, return error for invalid emails

### Performance Constraints
- **Cached reads:** < 500ms (listEvents, getEvent, getCalendar)
- **Write operations:** < 1s (createEvent, updateEvent, deleteEvent)
- **Batch operations:** < 3s for up to 10 events

### Caching Strategy (Redis)
Following Gmail module pattern:

```typescript
// Cache keys
const cacheKey = `calendar:${operation}:${JSON.stringify(params)}`;

// Cache invalidation
await cacheManager.invalidate('calendar:listEvents:*');  // After create/update/delete
await cacheManager.invalidate('calendar:getEvent:*');     // After specific event update

// TTL: 300 seconds (5 minutes) - matches Gmail/Drive
```

**Operations to cache:**
- ✅ `listCalendars` - calendars change infrequently
- ✅ `getCalendar` - metadata rarely changes
- ✅ `listEvents` - cache with time range in key
- ✅ `getEvent` - cache individual event details
- ❌ `createEvent` - write operation, invalidates caches
- ❌ `updateEvent` - write operation, invalidates caches
- ❌ `deleteEvent` - write operation, invalidates caches
- ⚠️ `checkFreeBusy` - cache with short TTL (60s), highly time-sensitive

### Integration Points

#### 1. Google Calendar API v3
```typescript
import { google } from 'googleapis';
const calendar = google.calendar('v3');

// Initialize in index.ts
const calendar = google.calendar('v3');

// Build context for operations
const context = {
  logger,
  calendar,
  cacheManager,
  performanceMonitor,
  startTime,
};
```

#### 2. OAuth Scopes (Authentication)
Add to index.ts authentication flow:

```typescript
const auth = await authenticate({
  keyfilePath: oauthPath,
  scopes: [
    // ... existing scopes ...
    "https://www.googleapis.com/auth/calendar.readonly",  // Read calendars
    "https://www.googleapis.com/auth/calendar.events",    // Manage events
  ],
});
```

**Scope rationale:**
- `calendar.readonly` - List calendars, view event details
- `calendar.events` - Full event CRUD (create, update, delete)
- **NOT** `calendar` (full access) - Excludes calendar ACL management per scope decisions

#### 3. Main Server (index.ts)
Add calendar tool to ListToolsRequestSchema handler:

```typescript
{
  name: "calendar",
  description: "Google Calendar operations. Read gdrive://tools resource to see available operations.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["listCalendars", "getCalendar", "listEvents", "getEvent", "createEvent", "updateEvent", "deleteEvent", "quickAdd", "checkFreeBusy"],
        description: "Operation to perform"
      },
      params: {
        type: "object",
        description: "Operation-specific parameters. See gdrive://tools for details."
      }
    },
    required: ["operation", "params"]
  }
}
```

Add calendar case to CallToolRequestSchema handler:

```typescript
case "calendar": {
  const calendarModule = await import('./src/modules/calendar/index.js');

  switch (operation) {
    case "listCalendars":
      result = await calendarModule.listCalendars(params, context);
      break;
    case "getCalendar":
      result = await calendarModule.getCalendar(params, context);
      break;
    case "listEvents":
      result = await calendarModule.listEvents(params, context);
      break;
    case "getEvent":
      result = await calendarModule.getEvent(params, context);
      break;
    case "createEvent":
      result = await calendarModule.createEvent(params, context);
      break;
    case "updateEvent":
      result = await calendarModule.updateEvent(params, context);
      break;
    case "deleteEvent":
      result = await calendarModule.deleteEvent(params, context);
      break;
    case "quickAdd":
      result = await calendarModule.quickAdd(params, context);
      break;
    case "checkFreeBusy":
      result = await calendarModule.checkFreeBusy(params, context);
      break;
    default:
      throw new Error(`Unknown calendar operation: ${operation}`);
  }
  break;
}
```

#### 4. Tool Discovery (src/tools/listTools.ts)
Add calendar operations to generateToolStructure():

```typescript
calendar: [
  {
    name: 'listCalendars',
    signature: 'listCalendars({ maxResults?: number, pageToken?: string })',
    description: 'List all calendars accessible by the user',
    example: 'calendar.listCalendars({ maxResults: 10 })',
  },
  {
    name: 'getCalendar',
    signature: 'getCalendar({ calendarId: string })',
    description: 'Get details of a specific calendar',
    example: 'calendar.getCalendar({ calendarId: "primary" })',
  },
  {
    name: 'listEvents',
    signature: 'listEvents({ calendarId?: string, timeMin?: string, timeMax?: string, maxResults?: number })',
    description: 'List events in a calendar within a time range',
    example: 'calendar.listEvents({ timeMin: "2026-01-08T00:00:00Z", maxResults: 20 })',
  },
  {
    name: 'getEvent',
    signature: 'getEvent({ calendarId?: string, eventId: string })',
    description: 'Get details of a specific event',
    example: 'calendar.getEvent({ eventId: "abc123" })',
  },
  {
    name: 'createEvent',
    signature: 'createEvent({ summary: string, start: EventDateTime, end: EventDateTime, attendees?: string[], ... })',
    description: 'Create a new calendar event with optional attendees and recurrence',
    example: 'calendar.createEvent({ summary: "Team Standup", start: { dateTime: "2026-01-09T09:00:00-06:00" }, end: { dateTime: "2026-01-09T09:30:00-06:00" }, attendees: ["Mary", "Kelvin"] })',
  },
  {
    name: 'updateEvent',
    signature: 'updateEvent({ eventId: string, updates: Partial<EventOptions> })',
    description: 'Update an existing event',
    example: 'calendar.updateEvent({ eventId: "abc123", updates: { summary: "Updated Meeting Title" } })',
  },
  {
    name: 'deleteEvent',
    signature: 'deleteEvent({ eventId: string, sendUpdates?: "all" | "externalOnly" | "none" })',
    description: 'Delete an event and optionally notify attendees',
    example: 'calendar.deleteEvent({ eventId: "abc123", sendUpdates: "all" })',
  },
  {
    name: 'quickAdd',
    signature: 'quickAdd({ text: string, calendarId?: string })',
    description: 'Create an event from natural language text',
    example: 'calendar.quickAdd({ text: "Lunch with Mary tomorrow at noon" })',
  },
  {
    name: 'checkFreeBusy',
    signature: 'checkFreeBusy({ timeMin: string, timeMax: string, items: { id: string }[] })',
    description: 'Check availability for calendars or attendees in a time range',
    example: 'calendar.checkFreeBusy({ timeMin: "2026-01-09T00:00:00Z", timeMax: "2026-01-09T23:59:59Z", items: [{ id: "primary" }] })',
  },
],
```

## Edge Cases & Error Handling

### Input Validation

#### Event Times
- **Past events:** ✅ ALLOWED - Users may want to log past meetings
- **Invalid date format:** ❌ ERROR - Return clear message: `"Invalid date format. Use ISO 8601: '2026-01-08T14:00:00-06:00'"`
- **End before start:** ❌ ERROR - Return: `"Event end time must be after start time"`
- **All-day event with time:** ❌ ERROR - Return: `"All-day events should use 'date' field, not 'dateTime'"`

#### Attendees
- **Email validation:** Basic regex check (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- **Unknown contact name:** ❌ ERROR - Return list of available contacts
- **Mixed valid/invalid:** Process valid emails, return error for invalid ones
- **Empty attendee list:** ✅ ALLOWED - Create event without attendees

#### Recurring Events (RRULE)
- **Valid RRULE:** `["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10"]`
- **Invalid RRULE syntax:** ❌ ERROR - Return: `"Invalid RRULE format. See RFC 5545 specification"`
- **Conflicting rules:** Let Google Calendar API validate, return API error

#### Conference Data
- **Google Meet auto-creation:** Set `conferenceSolutionKey.type = 'hangoutsMeet'` + `requestId`
- **External links (Zoom, Teams):** Add as string in `description` or `location` field
- **Missing requestId:** Generate UUID automatically for idempotency

### Operation Failures

#### Network/API Errors
```typescript
try {
  const response = await context.calendar.events.insert({ ... });
} catch (error) {
  if (error.code === 403) {
    // Permission denied
    return {
      success: false,
      error: {
        message: "Permission denied. Check OAuth scopes and calendar sharing settings.",
        stack: error.stack,
      }
    };
  }
  if (error.code === 404) {
    // Calendar or event not found
    return {
      success: false,
      error: {
        message: `Calendar or event not found: ${error.message}`,
        stack: error.stack,
      }
    };
  }
  // Generic error
  logger.error('Calendar operation failed', { error, operation: 'createEvent' });
  return {
    success: false,
    error: {
      message: error.message || 'Unknown error occurred',
      stack: error.stack,
    }
  };
}
```

#### Quota Limits
Google Calendar API quotas:
- **Queries per day:** 1,000,000 (unlikely to hit)
- **Queries per 100 seconds:** 10,000
- **Create events per day:** 100,000

**Handling:**
- Return quota error from API: `"Rate limit exceeded. Try again in a few minutes."`
- Log quota errors for monitoring
- ❌ NO automatic retry with exponential backoff (per scope decision - keep it simple)

#### Conflict Detection
```typescript
// After creating/updating an event, check for overlaps
const conflicts = await detectConflicts(newEvent, context);

if (conflicts.length > 0) {
  logger.warn('Event conflicts detected', {
    eventId: newEvent.id,
    conflicts: conflicts.map(c => ({
      id: c.id,
      summary: c.summary,
      start: c.start,
      end: c.end,
    })),
  });

  // Return warning in response
  return {
    success: true,
    data: {
      event: newEvent,
      warnings: [{
        type: 'conflict',
        message: `This event overlaps with ${conflicts.length} existing event(s)`,
        conflicts: conflicts.map(c => c.summary),
      }],
    },
  };
}
```

**Conflict logic:**
- Check for time overlap: `newStart < existingEnd && newEnd > existingStart`
- Only check against accepted events (not declined/tentative)
- ⚠️ WARN but ALLOW - User manages their schedule

### Time Zone Handling

#### Default Behavior
- Use user's primary calendar timezone if not specified
- Always include timezone in API responses
- Support IANA timezone names: `America/Chicago`, `Europe/London`, `Asia/Tokyo`

#### Edge Cases
- **Missing timezone:** Use calendar default or UTC
- **Invalid timezone:** ❌ ERROR - Return list of valid IANA timezones
- **Daylight Saving Time:** Let Google Calendar API handle DST transitions
- **Cross-timezone events:** Store in user's specified timezone, display logic handled by Google Calendar

### Contact Resolution Edge Cases

#### PAI Contacts File
- **File not found:** Log warning, treat all attendees as raw emails
- **Parse error:** Log error, fallback to raw emails
- **Duplicate names:** Use first match, log warning
- **Case sensitivity:** Match case-insensitive: "mary" === "Mary"

#### Environment Variable
```typescript
const contactsPath = process.env.PAI_CONTACTS_PATH
  || '/Users/ossieirondi/PAI/.claude/skills/CORE/USER/CONTACTS.md';
```

## User Experience

### Mental Model
Users should think: "I'm talking to my calendar directly through the MCP"

**Simple use case:**
```typescript
// Natural thought: "Schedule a meeting with Mary tomorrow at 2pm"
calendar.createEvent({
  summary: "Catch up with Mary",
  start: { dateTime: "2026-01-09T14:00:00-06:00", timeZone: "America/Chicago" },
  end: { dateTime: "2026-01-09T15:00:00-06:00", timeZone: "America/Chicago" },
  attendees: ["Mary"]  // Resolves to findsbymary@gmail.com
})
```

**Alternative: Quick Add**
```typescript
calendar.quickAdd({
  text: "Lunch with Mary tomorrow at noon"
})
// Google parses natural language, creates event
```

### Confusion Points & Solutions

#### 1. "Do I use contact names or emails?"
**Solution:** Support BOTH transparently
```typescript
attendees: ["Mary", "external@company.com", "Kelvin"]
// Resolves to: ["findsbymary@gmail.com", "external@company.com", "mmesomakelvin@gmail.com"]
```

#### 2. "How do I create recurring events?"
**Solution:** Provide clear RRULE examples in docs
```typescript
// Weekly standup every Monday at 9am
{
  summary: "Team Standup",
  start: { dateTime: "2026-01-13T09:00:00-06:00" },  // First Monday
  end: { dateTime: "2026-01-13T09:30:00-06:00" },
  recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
}
```

#### 3. "What timezone should I use?"
**Solution:** Document timezone behavior clearly
- Specify `timeZone` in `start`/`end` for explicit control
- Omit for user's default calendar timezone
- Use ISO 8601 with offset: `2026-01-09T14:00:00-06:00`

#### 4. "How do I add a Google Meet link?"
**Solution:** Simple boolean flag
```typescript
{
  summary: "Video call",
  start: { ... },
  end: { ... },
  conferenceData: {
    createRequest: {
      requestId: crypto.randomUUID(),
      conferenceSolutionKey: { type: 'hangoutsMeet' }
    }
  }
}
```

### Feedback at Each Step

#### Event Creation
```typescript
{
  success: true,
  data: {
    eventId: "abc123xyz",
    htmlLink: "https://calendar.google.com/event?eid=abc123xyz",
    summary: "Team Standup",
    start: "2026-01-09T09:00:00-06:00",
    end: "2026-01-09T09:30:00-06:00",
    attendees: [
      { email: "findsbymary@gmail.com", displayName: "Mary", responseStatus: "needsAction" },
      { email: "mmesomakelvin@gmail.com", displayName: "Kelvin", responseStatus: "needsAction" }
    ],
    created: "2026-01-08T18:03:43Z",
    warnings: []  // Includes conflict warnings if any
  }
}
```

#### List Events
```typescript
{
  success: true,
  data: {
    events: [
      {
        id: "abc123",
        summary: "Team Standup",
        start: "2026-01-09T09:00:00-06:00",
        end: "2026-01-09T09:30:00-06:00",
        attendees: 2,
        status: "confirmed"
      },
      // ... more events
    ],
    nextPageToken: "token123",
    timeZone: "America/Chicago"
  }
}
```

#### Error Feedback
```typescript
{
  success: false,
  error: {
    message: "Contact 'Bob' not found in PAI contact list. Available contacts: Mary, Kelvin, Giauna, Elihu, Ayaba, Veronica, Uzoamaka",
    stack: "..."
  }
}
```

## Scope & Tradeoffs

### In Scope (MVP - Full Scheduling)

#### Essential Operations
- ✅ **Calendar Management**
  - List accessible calendars
  - Get calendar metadata

- ✅ **Event CRUD**
  - Create events with attendees
  - List events (with time range filtering)
  - Get event details
  - Update existing events
  - Delete events with notification options

- ✅ **Advanced Features**
  - Recurring events (full RFC 5545 RRULE support)
  - Time zone support (IANA timezones)
  - Google Meet conference links (auto-generation)
  - Event attachments (Drive file links)
  - Reminder settings

- ✅ **Nice-to-Have Operations**
  - Quick Add (natural language event creation)
  - FreeBusy queries (check availability)

- ✅ **PAI Integration**
  - Contact name resolution (Mary → findsbymary@gmail.com)
  - Environment variable for contacts path
  - Integration with PAI Memory System logging

- ✅ **Cross-Module Integration**
  - Gmail thread linking (reference emails in events)
  - Drive file attachments
  - Linear task/issue linking

### Explicitly Out of Scope

#### Calendar Permissions/ACLs
- ❌ Managing calendar sharing settings
- ❌ Modifying calendar access control lists
- ❌ Creating/deleting calendars themselves
- **Rationale:** Complexity vs. value - users rarely need programmatic ACL management

#### Advanced Scheduling Intelligence
- ❌ AI-powered "find time" suggestions
- ❌ Automatic optimal slot detection
- ❌ Smart rescheduling algorithms
- **Rationale:** Complex feature requiring significant development, can use manual scheduling or external tools

#### External Meeting Platform Integration
- ❌ Creating Zoom/Teams/Slack meeting links programmatically
- ❌ Managing external platform authentication
- **Rationale:** Each platform requires separate OAuth/API integration, out of scope for calendar-focused feature

### Technical Debt Accepted

#### 1. Hard-coded PAI Contact List Path
```typescript
const contactsPath = process.env.PAI_CONTACTS_PATH
  || '/Users/ossieirondi/PAI/.claude/skills/CORE/USER/CONTACTS.md';
```
- **Debt:** Tightly coupled to PAI environment structure
- **Future fix:** Could abstract to general contact provider interface
- **Acceptable because:** 90% of users will use PAI, custom path via env var for others

#### 2. No Offline Calendar Support
- **Debt:** Requires active internet and Google API access
- **Future fix:** Could add local caching of calendar data for offline viewing
- **Acceptable because:** Calendar operations inherently require sync with Google servers

#### 3. Simple Conflict Detection
- **Debt:** Basic time overlap checking, no sophisticated scheduling logic
- **Future fix:** Could add multi-calendar conflict detection, tentative event handling
- **Acceptable because:** Provides warnings without blocking, users manage their schedules

#### 4. Limited Batch Operations Initially
- **Debt:** No batch event creation/update in MVP
- **Future fix:** Add `batchEvents` operation similar to Drive's `batchOperations`
- **Acceptable because:** Single event operations work fine, batch can be added later

#### 5. Redis Cache Encryption
- **Debt:** Calendar data cached in Redis without encryption
- **Future fix:** Implement encryption layer for sensitive calendar data in cache
- **Mitigation:** Short TTL (5 min), Redis should be on private network
- **Acceptable because:** Performance priority, sensitive data exposure window is small

## Integration Requirements

### Systems Affected

#### 1. Authentication System (index.ts)
**Change:** Add Google Calendar API scopes

```typescript
scopes: [
  // ... existing scopes ...
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
]
```

**Migration:** Users must re-authenticate to grant calendar permissions
- Run: `node ./dist/index.js auth`
- Opens browser for OAuth consent
- New scopes added to existing token

#### 2. MCP Server (index.ts)
**Changes:**
- Add `calendar` tool to ListToolsRequestSchema handler
- Add `calendar` case to CallToolRequestSchema handler
- Import calendar module operations
- Initialize Google Calendar API v3 client

```typescript
const calendar = google.calendar('v3');

const context = {
  logger,
  drive,
  sheets,
  forms,
  docs,
  gmail,
  calendar,  // NEW
  cacheManager,
  performanceMonitor,
  startTime,
};
```

#### 3. Tool Discovery (src/tools/listTools.ts)
**Change:** Add calendar operations to `generateToolStructure()`

See "Integration Points" section for complete calendar operation list.

#### 4. Type Definitions (src/modules/types.ts)
**Change:** Add CalendarContext interface

```typescript
export interface CalendarContext extends BaseContext {
  calendar: calendar_v3.Calendar;
}
```

#### 5. Gmail Module (Optional Enhancement)
**Future integration:** Link Gmail threads to calendar events

```typescript
// In Gmail read.ts
if (message.payload.headers.find(h => h.name === 'X-Google-Calendar-Event-Id')) {
  // Extract calendar event ID, provide link
}
```

#### 6. Linear Module (Optional Enhancement)
**Future integration:** Sync calendar events with Linear issues

```typescript
// Create Linear issue when event created with specific label
if (event.summary.includes('[LINEAR]')) {
  await linear.issues.create({ ... });
}
```

#### 7. PAI Memory System
**Integration:** Log calendar operations to PAI MEMORY

```typescript
// In create.ts, update.ts, delete.ts
logger.info('Calendar event created', {
  eventId: result.id,
  summary: result.summary,
  attendees: result.attendees?.map(a => a.email),
});

// Future: Write to ${PAI_DIR}/MEMORY/execution/calendar-operations.log
```

### Migration Path

#### Existing User Data
**Scenario:** Users already have Google Calendars with existing events

**Approach:**
1. No data migration needed - MCP reads existing calendars via API
2. First run requires OAuth re-authentication to grant calendar scopes
3. Existing events immediately accessible via `listEvents`, `getEvent`

#### Authentication Migration
```bash
# Users must run:
node ./dist/index.js auth

# This will:
# 1. Open browser for OAuth consent
# 2. Show new calendar scopes being requested
# 3. Save updated tokens with calendar permissions
# 4. Server ready to access calendar API
```

#### Backward Compatibility
- ✅ No breaking changes to existing modules (Drive, Sheets, Forms, Docs, Gmail)
- ✅ Calendar is additive feature
- ✅ Users without re-auth simply won't have calendar access (graceful degradation)

## Security & Compliance

### Sensitive Data Handling

#### Event Details
**Sensitive:** Titles, descriptions, locations may contain confidential information
- **In transit:** HTTPS to Google Calendar API (Google handles TLS)
- **At rest (Redis cache):**
  - ⚠️ **Not encrypted in MVP** (accepted technical debt)
  - Mitigation: 5-minute TTL, private Redis instance
  - Future: Implement cache encryption layer

#### Attendee Information
**Sensitive:** Email addresses, names from PAI contact list
- **Contact list file:** Read-only access to PAI CONTACTS.md
- **In memory:** Contact mapping held briefly during operation
- **Logging:** Email addresses logged (Winston file logs should be secured)

#### Video Conference Links
**Sensitive:** Google Meet links may contain join codes
- **Cached:** Yes (part of event data)
- **TTL:** 5 minutes
- **Exposure risk:** Low (links are shareable by design, but cached briefly)

#### Attachments
**Sensitive:** Drive file IDs in event attachments
- **Access control:** Follows Google Drive sharing settings
- **MCP responsibility:** Pass through file IDs, don't validate permissions
- **User responsibility:** Ensure Drive files are shared with attendees

### Authentication & Authorization

#### OAuth Scopes Required
```typescript
"https://www.googleapis.com/auth/calendar.readonly"  // Read calendars and events
"https://www.googleapis.com/auth/calendar.events"    // Create, update, delete events
```

**NOT included:**
- `calendar` (full access) - Would allow calendar deletion, ACL management

#### Token Management
**Pattern:** Follow existing Gmail/Drive token management (AuthManager, TokenManager)

```typescript
// In index.ts
authManager = AuthManager.getInstance(oauthKeys, logger);
await authManager.initialize();

const oauth2Client = authManager.getOAuth2Client();
google.options({ auth: oauth2Client });
```

**Token refresh:** Automatic via AuthManager
**Token storage:** Encrypted via TokenManager with `GDRIVE_TOKEN_ENCRYPTION_KEY`

#### Permission Verification
**Strategy:** Trust Google Calendar API for authorization checks

```typescript
// No pre-flight permission checks
// Let API return 403 if user lacks access to calendar
// Return clear error message to user
```

**Rationale:** Google Calendar API handles complex ACL logic, duplicating checks adds complexity without value

### Data Privacy

#### User Consent
- Users explicitly grant calendar access during OAuth flow
- Scopes clearly labeled in Google consent screen
- User can revoke access at any time via Google Account settings

#### Data Retention
- **Redis cache:** 5-minute TTL, auto-expires
- **Winston logs:** Rotated after 5 files × 5MB (per existing config)
- **No persistent storage:** Calendar data only in Google's servers

#### Cross-Module Data Sharing
- Calendar module can access PAI contacts (read-only)
- Gmail module could link to calendar events (future enhancement)
- Linear module could reference calendar events (future enhancement)
- **All cross-module data access logged for audit**

## Success Criteria & Testing

### Acceptance Criteria

#### 1. Can Create Event and Invite PAI Contacts by Name ✅
```typescript
// Test case
const result = await calendar.createEvent({
  summary: "Meeting with Mary and Kelvin",
  start: { dateTime: "2026-01-09T14:00:00-06:00" },
  end: { dateTime: "2026-01-09T15:00:00-06:00" },
  attendees: ["Mary", "Kelvin"]  // Contact names resolved
});

// Expected
assert(result.success === true);
assert(result.data.attendees.find(a => a.email === 'findsbymary@gmail.com'));
assert(result.data.attendees.find(a => a.email === 'mmesomakelvin@gmail.com'));
```

#### 2. Can View Upcoming Events for the Week ✅
```typescript
// Test case
const today = new Date();
const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

const result = await calendar.listEvents({
  timeMin: today.toISOString(),
  timeMax: nextWeek.toISOString(),
  singleEvents: true,
  orderBy: 'startTime'
});

// Expected
assert(result.success === true);
assert(Array.isArray(result.data.events));
assert(result.data.events.every(e => e.start && e.end));
```

#### 3. Can Update/Delete Events Without Errors ✅
```typescript
// Update test
const updateResult = await calendar.updateEvent({
  eventId: testEventId,
  updates: {
    summary: "Updated Meeting Title",
    location: "Conference Room B"
  }
});

assert(updateResult.success === true);
assert(updateResult.data.summary === "Updated Meeting Title");

// Delete test
const deleteResult = await calendar.deleteEvent({
  eventId: testEventId,
  sendUpdates: "all"
});

assert(deleteResult.success === true);
```

#### 4. All Tests Pass with >80% Coverage ✅
```bash
npm run test:coverage

# Expected output:
# ------------------------|---------|----------|---------|---------|
# File                    | % Stmts | % Branch | % Funcs | % Lines |
# ------------------------|---------|----------|---------|---------|
# All files               |   85.23 |    78.45 |   89.12 |   86.34 |
#  modules/calendar       |   87.50 |    82.00 |   92.00 |   88.75 |
#   index.ts              |     100 |      100 |     100 |     100 |
#   create.ts             |   85.00 |    80.00 |   90.00 |   86.00 |
#   list.ts               |   90.00 |    85.00 |   95.00 |   91.00 |
#   read.ts               |   88.00 |    83.00 |   91.00 |   89.00 |
#   update.ts             |   85.00 |    78.00 |   88.00 |   86.00 |
#   delete.ts             |   87.00 |    82.00 |   90.00 |   88.00 |
#   contacts.ts           |   82.00 |    75.00 |   85.00 |   83.00 |
#   freebusy.ts           |   80.00 |    72.00 |   82.00 |   81.00 |
# ------------------------|---------|----------|---------|---------|
```

### Test Approach

#### 1. Unit Tests (per operation)
**Pattern:** Match Gmail module test structure

```typescript
// src/modules/calendar/__tests__/create.test.ts
describe('createEvent', () => {
  let mockContext: CalendarContext;

  beforeEach(() => {
    mockContext = {
      logger: mockLogger,
      calendar: mockCalendarApi,
      cacheManager: mockCache,
      performanceMonitor: mockMonitor,
      startTime: Date.now(),
    };
  });

  test('creates basic event', async () => {
    const result = await createEvent({
      summary: 'Test Event',
      start: { dateTime: '2026-01-09T14:00:00Z' },
      end: { dateTime: '2026-01-09T15:00:00Z' },
    }, mockContext);

    expect(result.success).toBe(true);
    expect(result.data.summary).toBe('Test Event');
  });

  test('resolves PAI contact names', async () => {
    const result = await createEvent({
      summary: 'Meeting',
      start: { dateTime: '2026-01-09T14:00:00Z' },
      end: { dateTime: '2026-01-09T15:00:00Z' },
      attendees: ['Mary'],
    }, mockContext);

    expect(result.data.attendees[0].email).toBe('findsbymary@gmail.com');
  });

  test('handles unknown contact name error', async () => {
    const result = await createEvent({
      summary: 'Meeting',
      start: { dateTime: '2026-01-09T14:00:00Z' },
      end: { dateTime: '2026-01-09T15:00:00Z' },
      attendees: ['UnknownPerson'],
    }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error.message).toContain('not found in PAI contact list');
  });
});
```

**Files to create:**
- `src/modules/calendar/__tests__/create.test.ts` (~15 tests)
- `src/modules/calendar/__tests__/list.test.ts` (~12 tests)
- `src/modules/calendar/__tests__/read.test.ts` (~8 tests)
- `src/modules/calendar/__tests__/update.test.ts` (~10 tests)
- `src/modules/calendar/__tests__/delete.test.ts` (~6 tests)
- `src/modules/calendar/__tests__/contacts.test.ts` (~10 tests)
- `src/modules/calendar/__tests__/freebusy.test.ts` (~5 tests)

**Total:** ~66 unit tests

#### 2. Integration Tests
**Pattern:** Mock Google Calendar API responses

```typescript
// src/modules/calendar/__tests__/integration/calendar-workflow.test.ts
describe('Calendar Integration Tests', () => {
  test('full event lifecycle', async () => {
    // Create event
    const created = await createEvent({ ... }, context);
    expect(created.success).toBe(true);
    const eventId = created.data.eventId;

    // Read event
    const read = await getEvent({ eventId }, context);
    expect(read.success).toBe(true);
    expect(read.data.summary).toBe(created.data.summary);

    // Update event
    const updated = await updateEvent({
      eventId,
      updates: { location: 'New Location' }
    }, context);
    expect(updated.data.location).toBe('New Location');

    // Delete event
    const deleted = await deleteEvent({ eventId }, context);
    expect(deleted.success).toBe(true);
  });
});
```

**Files to create:**
- `src/modules/calendar/__tests__/integration/calendar-workflow.test.ts`
- `src/modules/calendar/__tests__/integration/recurring-events.test.ts`
- `src/modules/calendar/__tests__/integration/contact-resolution.test.ts`

#### 3. Edge Case Tests

```typescript
// src/modules/calendar/__tests__/edge-cases.test.ts
describe('Edge Cases', () => {
  test('recurring weekly event with RRULE', async () => {
    const result = await createEvent({
      summary: 'Weekly Standup',
      start: { dateTime: '2026-01-13T09:00:00-06:00' },
      end: { dateTime: '2026-01-13T09:30:00-06:00' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10'],
    }, context);

    expect(result.success).toBe(true);
    expect(result.data.recurrence).toContain('FREQ=WEEKLY');
  });

  test('cross-timezone event', async () => {
    const result = await createEvent({
      summary: 'International Call',
      start: {
        dateTime: '2026-01-09T14:00:00',
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: '2026-01-09T15:00:00',
        timeZone: 'America/New_York'
      },
    }, context);

    expect(result.success).toBe(true);
  });

  test('event conflict warning', async () => {
    // Create first event
    await createEvent({
      summary: 'Event 1',
      start: { dateTime: '2026-01-09T14:00:00Z' },
      end: { dateTime: '2026-01-09T15:00:00Z' },
    }, context);

    // Create overlapping event
    const result = await createEvent({
      summary: 'Event 2',
      start: { dateTime: '2026-01-09T14:30:00Z' },
      end: { dateTime: '2026-01-09T15:30:00Z' },
    }, context);

    expect(result.success).toBe(true);
    expect(result.data.warnings).toBeDefined();
    expect(result.data.warnings[0].type).toBe('conflict');
  });
});
```

#### 4. Testing Strategy Summary
- ✅ **Unit tests:** Each operation function tested in isolation
- ✅ **Integration tests:** Full workflows with mocked Google API
- ✅ **Edge cases:** Recurring events, timezones, conflicts, contact resolution
- ✅ **Pattern matching:** Follow Gmail/Sheets test structure
- ✅ **Coverage target:** >80% overall, >85% for core operations

## Implementation Notes

### Files to Modify

#### 1. index.ts (Main Server)
**Lines to change:**
- Line 81: Add `const calendar = google.calendar('v3');`
- Line 564-574: Add calendar to context object
- Line 447-546: Add calendar tool to ListToolsRequestSchema handler
- Line 741: Add calendar case to CallToolRequestSchema handler
- Line 789: Add calendar scopes to authenticate() call

**Estimated changes:** ~100 lines added

#### 2. src/tools/listTools.ts
**Function:** `generateToolStructure()`
**Changes:** Add calendar operations to returned structure (see Integration Points section)

**Estimated changes:** ~50 lines added

#### 3. src/modules/types.ts
**Changes:** Add CalendarContext interface

**Estimated changes:** ~5 lines added

### Files to Create

#### Core Module Files
```
src/modules/calendar/
├── index.ts           # Public API exports (~40 lines)
├── types.ts           # TypeScript interfaces (~200 lines)
├── list.ts            # listCalendars, listEvents (~180 lines)
├── read.ts            # getCalendar, getEvent (~120 lines)
├── create.ts          # createEvent, quickAdd (~250 lines)
├── update.ts          # updateEvent (~150 lines)
├── delete.ts          # deleteEvent (~80 lines)
├── freebusy.ts        # checkFreeBusy (~100 lines)
└── contacts.ts        # PAI contact resolution (~150 lines)
```

**Total new code:** ~1,270 lines

#### Test Files
```
src/modules/calendar/__tests__/
├── create.test.ts                          # ~400 lines
├── list.test.ts                            # ~350 lines
├── read.test.ts                            # ~250 lines
├── update.test.ts                          # ~300 lines
├── delete.test.ts                          # ~200 lines
├── contacts.test.ts                        # ~350 lines
├── freebusy.test.ts                        # ~180 lines
├── edge-cases.test.ts                      # ~400 lines
└── integration/
    ├── calendar-workflow.test.ts           # ~350 lines
    ├── recurring-events.test.ts            # ~300 lines
    └── contact-resolution.test.ts          # ~250 lines
```

**Total test code:** ~3,330 lines

### Patterns to Follow

#### 1. Operation Structure (from Gmail module)
```typescript
export async function operationName(
  options: OperationOptions,
  context: CalendarContext
): Promise<OperationResult> {
  // 1. Destructure options with defaults
  const { param1 = default1, param2 } = options;

  // 2. Check cache
  const cacheKey = `calendar:operation:${JSON.stringify(options)}`;
  const cached = await context.cacheManager.get(cacheKey);
  if (cached) {
    context.performanceMonitor.track('calendar:operation', Date.now() - context.startTime);
    return cached as OperationResult;
  }

  // 3. Build params object (exactOptionalPropertyTypes compliance)
  const params: calendar_v3.Params$Resource$... = {
    calendarId: 'primary',
    // Only include properties with values
  };

  if (param2) {
    params.param2 = param2;
  }

  // 4. Make API call
  const response = await context.calendar.events.operation(params);

  // 5. Format result
  const result: OperationResult = {
    success: true,
    data: {
      // Map response to clean interface
    }
  };

  // 6. Cache result
  await context.cacheManager.set(cacheKey, result);

  // 7. Track performance
  context.performanceMonitor.track('calendar:operation', Date.now() - context.startTime);

  // 8. Log
  context.logger.info('Operation completed', { ... });

  return result;
}
```

#### 2. Error Handling Pattern
```typescript
try {
  const response = await context.calendar.events.insert({ ... });
  return { success: true, data: response.data };
} catch (error) {
  context.performanceMonitor.track('calendar:operation', Date.now() - context.startTime, true);
  context.logger.error('Operation failed', { error, operation: 'operationName' });

  return {
    success: false,
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }
  };
}
```

#### 3. Type Imports
```typescript
import type { calendar_v3 } from 'googleapis';
import type { CalendarContext } from '../types.js';
import type {
  CreateEventOptions,
  CreateEventResult,
} from './types.js';
```

### Environment Variables

#### Required
```bash
# Existing
GDRIVE_TOKEN_ENCRYPTION_KEY="..."        # Token encryption key
GDRIVE_OAUTH_PATH="..."                  # OAuth keys file path
REDIS_URL="redis://localhost:6379"       # Redis cache

# New for Calendar
PAI_CONTACTS_PATH="/Users/ossieirondi/PAI/.claude/skills/CORE/USER/CONTACTS.md"
```

#### .env.example
Add to project root:
```bash
# Google Calendar Integration
PAI_CONTACTS_PATH=/Users/ossieirondi/PAI/.claude/skills/CORE/USER/CONTACTS.md
```

### Documentation Updates

#### 1. README.md
Add calendar section:
```markdown
## Google Calendar Integration (v3.3.0+)

The MCP server provides comprehensive calendar operations:
- **Calendar Management:** List calendars, view calendar details
- **Event CRUD:** Create, read, update, delete events
- **Advanced Features:** Recurring events (RRULE), timezone support, Google Meet links
- **PAI Integration:** Invite contacts by name (resolves from PAI contact list)

### Setup
1. Re-authenticate to grant calendar scopes:
   ```bash
   node ./dist/index.js auth
   ```

2. Set PAI contacts path (optional):
   ```bash
   export PAI_CONTACTS_PATH=/path/to/PAI/.claude/skills/CORE/USER/CONTACTS.md
   ```

3. Use calendar operations:
   ```typescript
   // Create event with PAI contacts
   calendar.createEvent({
     summary: "Team Meeting",
     start: { dateTime: "2026-01-09T14:00:00-06:00" },
     end: { dateTime: "2026-01-09T15:00:00-06:00" },
     attendees: ["Mary", "Kelvin"]  // Resolved from PAI contacts
   })
   ```
```

#### 2. CHANGELOG.md
Add v3.3.0 entry:
```markdown
## [3.3.0] - 2026-01-08

### Added
- **Google Calendar Integration** - Full calendar functionality (#XX)
  - Calendar management (listCalendars, getCalendar)
  - Event CRUD operations (create, read, update, delete)
  - Recurring events with RFC 5545 RRULE support
  - Multi-timezone support with IANA timezone names
  - Google Meet conference link auto-generation
  - PAI contact name resolution (e.g., "Mary" → "findsbymary@gmail.com")
  - Quick Add (natural language event creation)
  - FreeBusy queries (availability checking)
  - Conflict detection with warnings
  - Redis caching for read operations (<500ms cached reads)
  - Comprehensive test coverage (66+ unit tests, 3 integration test suites)

### Changed
- Added OAuth scopes: `calendar.readonly`, `calendar.events`
- Updated authentication flow to include calendar permissions

### Migration
- Users must re-authenticate to grant calendar scopes: `node ./dist/index.js auth`
- Optional: Set `PAI_CONTACTS_PATH` environment variable for contact resolution
```

## Summary

### Key Decisions Made

1. **Architecture:** Operation-based progressive disclosure (matching Gmail/Drive patterns)
2. **Scope:** Full scheduling MVP (CRUD + recurring + timezones + Meet links), excluding calendar ACLs
3. **Contact Resolution:** Smart PAI contact integration via environment variable
4. **Performance:** < 500ms cached reads, < 1s writes, Redis caching with 5min TTL
5. **Error Handling:** Clear errors with descriptive messages, no auto-retry
6. **Conflict Detection:** Warn but allow overlapping events
7. **Testing:** >80% coverage, matching Gmail test patterns
8. **Security:** Follow existing OAuth pattern, accept unencrypted Redis cache (short TTL mitigation)
9. **Integration:** Gmail thread linking, Drive attachments, Linear task sync (future enhancements)
10. **Tech Debt:** Hard-coded PAI path (env var), no offline support, simple conflicts

### Implementation Checklist

- [ ] **Phase 1: Core Module Setup**
  - [ ] Create `src/modules/calendar/` directory structure
  - [ ] Implement `types.ts` with all interfaces
  - [ ] Implement `contacts.ts` for PAI contact resolution
  - [ ] Add CalendarContext to `src/modules/types.ts`

- [ ] **Phase 2: Calendar Operations**
  - [ ] Implement `list.ts` (listCalendars, listEvents)
  - [ ] Implement `read.ts` (getCalendar, getEvent)
  - [ ] Implement `create.ts` (createEvent, quickAdd)
  - [ ] Implement `update.ts` (updateEvent)
  - [ ] Implement `delete.ts` (deleteEvent)
  - [ ] Implement `freebusy.ts` (checkFreeBusy)
  - [ ] Create `index.ts` with public exports

- [ ] **Phase 3: Server Integration**
  - [ ] Modify `index.ts` to add calendar API initialization
  - [ ] Add calendar tool to ListToolsRequestSchema handler
  - [ ] Add calendar case to CallToolRequestSchema handler
  - [ ] Add calendar scopes to authenticate() call
  - [ ] Update `src/tools/listTools.ts` with calendar operations

- [ ] **Phase 4: Testing**
  - [ ] Write unit tests for each operation (66+ tests)
  - [ ] Write integration test suites (3 suites)
  - [ ] Write edge case tests (recurring, timezones, conflicts)
  - [ ] Achieve >80% test coverage
  - [ ] Run full test suite: `npm run test:coverage`

- [ ] **Phase 5: Documentation**
  - [ ] Update README.md with calendar section
  - [ ] Update CHANGELOG.md with v3.3.0 entry
  - [ ] Add `.env.example` entry for PAI_CONTACTS_PATH
  - [ ] Create example usage snippets

- [ ] **Phase 6: Manual Testing**
  - [ ] Re-authenticate with calendar scopes
  - [ ] Create event with PAI contact names
  - [ ] List upcoming events for the week
  - [ ] Update event details
  - [ ] Delete event
  - [ ] Verify Redis caching behavior
  - [ ] Test conflict detection warnings

- [ ] **Phase 7: Final Validation**
  - [ ] All acceptance criteria passing
  - [ ] Performance metrics met (<500ms reads, <1s writes)
  - [ ] No regressions in existing modules
  - [ ] Code review checklist complete
  - [ ] Ready for merge

---

**Open Questions:** 0 (all resolved via interview)

**Estimated Effort:**
- Core implementation: ~1,270 lines of new code
- Test implementation: ~3,330 lines of test code
- Documentation updates: ~200 lines
- **Total:** ~4,800 lines

**Timeline Estimate:**
- Phase 1-2 (Core module): 1-2 days
- Phase 3 (Server integration): 0.5 days
- Phase 4 (Testing): 1-2 days
- Phase 5-7 (Docs + validation): 0.5-1 day
- **Total:** 3-5 days for full implementation

**Next Steps:**
1. Review and approve this specification
2. Begin Phase 1: Core module setup
3. Iterate through implementation phases
4. Manual testing and validation
5. Merge and release v3.3.0
