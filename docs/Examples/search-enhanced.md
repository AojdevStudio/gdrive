# Enhanced Search Examples

The `sdk.drive.enhancedSearch()` operation provides advanced filtering, sorting, and search capabilities beyond basic `sdk.drive.search()`. In v4, you discover it via `search`, then run it inside `execute`.

## Overview

`sdk.drive.enhancedSearch()` offers:

- Advanced filtering by file type (MIME), date ranges, owner, sharing
- Custom sorting options
- Pagination control
- Complex boolean logic via Drive query language

## Discovery First (Optional)

```json
{
  "name": "search",
  "arguments": { "service": "drive", "operation": "enhancedSearch" }
}
```

## Basic Enhanced Search

### Simple Enhanced Query

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'budget', filters: { mimeType: 'application/vnd.google-apps.spreadsheet' }, orderBy: 'modifiedTime desc', pageSize: 15 }); return results.files.map(f => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));"
  }
}
```

## Advanced Filtering

### File Type Filtering

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'project', filters: { mimeType: 'application/vnd.google-apps.document' }, pageSize: 20 }); return results.files;"
  }
}
```

Common MIME types:
- `application/vnd.google-apps.document` — Google Docs
- `application/vnd.google-apps.spreadsheet` — Google Sheets
- `application/vnd.google-apps.presentation` — Google Slides
- `application/vnd.google-apps.folder` — Folders

### Date Range Filtering

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'reports', filters: { modifiedAfter: '2024-01-01T00:00:00Z', modifiedBefore: '2024-01-31T23:59:59Z' }, orderBy: 'modifiedTime desc', pageSize: 30 }); return results.files;"
  }
}
```

Created in specific timeframe:

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'presentations', filters: { createdAfter: '2024-01-15T00:00:00Z', createdBefore: '2024-01-30T23:59:59Z' }, orderBy: 'createdTime asc', pageSize: 20 }); return results.files;"
  }
}
```

### Owner and Sharing Filters

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'budget', filters: { sharedWithMe: true }, orderBy: 'sharedWithMeTime desc', pageSize: 25 }); return results.files;"
  }
}
```

Files owned by me:

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'documents', filters: { ownedByMe: true }, orderBy: 'modifiedTime desc', pageSize: 20 }); return results.files;"
  }
}
```

### Parent Folder Filter

```json
{
  "name": "execute",
  "arguments": {
    "code": "const folderId = 'YOUR_FOLDER_ID'; const results = await sdk.drive.enhancedSearch({ query: 'spreadsheet', filters: { parents: folderId }, pageSize: 20 }); return results.files;"
  }
}
```

## Sorting and Ordering

### Sort Options

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'project files', orderBy: 'modifiedTime desc', pageSize: 20 }); return results.files;"
  }
}
```

By name (alphabetical):

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'documents', orderBy: 'name asc', pageSize: 25 }); return results.files;"
  }
}
```

By size (largest first):

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.enhancedSearch({ query: 'presentations', orderBy: 'quotaBytesUsed desc', pageSize: 15 }); return results.files;"
  }
}
```

## Complex Search Scenarios

### Multi-Criteria Business Search

```json
{
  "name": "execute",
  "arguments": {
    "code": "const startDate = '2023-10-01T00:00:00Z'; const endDate = '2023-12-31T23:59:59Z'; const results = await sdk.drive.enhancedSearch({ query: 'Q4 report quarterly', filters: { mimeType: 'application/vnd.google-apps.document', modifiedAfter: startDate, modifiedBefore: endDate }, orderBy: 'modifiedTime desc', pageSize: 50 }); return { count: results.files.length, files: results.files };"
  }
}
```

### Project File Audit

```json
{
  "name": "execute",
  "arguments": {
    "code": "const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); const iso = thirtyDaysAgo.toISOString(); const [recent, stale] = await Promise.all([ sdk.drive.enhancedSearch({ query: 'Website Redesign', filters: { modifiedAfter: iso }, orderBy: 'modifiedTime desc', pageSize: 100 }), sdk.drive.enhancedSearch({ query: 'Website Redesign', filters: { modifiedBefore: iso }, orderBy: 'modifiedTime asc', pageSize: 100 }) ]); return { recent: recent.files, stale: stale.files, summary: { recentActivity: recent.files.length, needsReview: stale.files.length } };"
  }
}
```

## Pagination and Large Result Sets

### Handling Large Searches

For up to 100 results per query, use `pageSize: 100`:

```json
{
  "name": "execute",
  "arguments": {
    "code": "const result = await sdk.drive.enhancedSearch({ query: 'Major Project', orderBy: 'modifiedTime desc', pageSize: 100 }); return { totalRetrieved: result.files.length, files: result.files };"
  }
}
```

For more than 100 files, run multiple queries with different date ranges or filters (e.g., `modifiedAfter`/`modifiedBefore`) to partition the result set.

## Filter Reference

### Available Filter Options

| Filter | Type | Description | Example |
|--------|------|-------------|---------|
| `mimeType` | string | File MIME type | `"application/vnd.google-apps.spreadsheet"` |
| `modifiedAfter` | string | ISO 8601 date | `"2024-01-01T00:00:00Z"` |
| `modifiedBefore` | string | ISO 8601 date | `"2024-12-31T23:59:59Z"` |
| `createdAfter` | string | ISO 8601 date | `"2024-01-01T00:00:00Z"` |
| `createdBefore` | string | ISO 8601 date | `"2024-12-31T23:59:59Z"` |
| `sharedWithMe` | boolean | Files shared with authenticated user | `true` |
| `ownedByMe` | boolean | Files owned by authenticated user | `true` |
| `parents` | string | Parent folder ID | `"1abc..."` |
| `trashed` | boolean | Include trashed files | `false` (default: exclude) |

### Sort Options (orderBy)

| Sort Field | Description |
|------------|-------------|
| `modifiedTime desc` | Last modification (newest first) |
| `modifiedTime asc` | Last modification (oldest first) |
| `createdTime desc` | Creation time (newest first) |
| `name asc` | File name (A–Z) |
| `name desc` | File name (Z–A) |
| `quotaBytesUsed desc` | File size (largest first) |
| `sharedWithMeTime desc` | When shared (most recent first) |

---

**Next Steps**: Explore [Conditional Formatting](./sheets-conditional-formatting.md) for Sheets, or use `sdk.drive.read()` to read file content after finding files.
