# Natural Language Search Examples

The Google Drive MCP Server supports intuitive natural language queries for finding files and folders. In v4, you use the `execute` tool with `sdk.drive.search()` to run searches. Optionally, discover the operation first via `search`.

## Overview

`sdk.drive.search()` searches Google Drive by file name. The query is matched against file names (not full-text content). Use `sdk.drive.enhancedSearch()` when you need filters for file type, date ranges, or owner.

## Discovery First (Optional)

Before running code, you can discover the Drive search operation:

```json
{
  "name": "search",
  "arguments": { "service": "drive", "operation": "search" }
}
```

## Basic Search Examples

### Simple File Search

**Execute payload:**

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: 'budget spreadsheet', pageSize: 10 }); return results.files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime }));"
  }
}
```

**Example response structure:**
```json
{
  "files": [
    {
      "id": "1abc123...",
      "name": "2024 Budget Spreadsheet",
      "mimeType": "application/vnd.google-apps.spreadsheet",
      "modifiedTime": "2024-01-15T10:30:00.000Z"
    }
  ],
  "totalResults": 3
}
```

### Search by File Type

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: 'spreadsheet', pageSize: 20 }); return results.files;"
  }
}
```

For documents:
```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: 'document', pageSize: 15 }); return results.files;"
  }
}
```

## Time-Based Search

`sdk.drive.search()` matches file names only. For time-based filtering (e.g., "modified today"), use `sdk.drive.enhancedSearch()` with `filters.modifiedAfter`. See [Enhanced Search](./search-enhanced.md).

For name-based queries that include time hints:

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: '2024 Q1 report', pageSize: 15 }); return results.files;"
  }
}
```

## Content-Based Search

Basic `search` matches file names only. For full-text content search, use Google Drive's native query syntax via `enhancedSearch` or combine with `read()` for targeted file inspection.

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: 'quarterly report', pageSize: 10 }); return results.files.map(f => ({ id: f.id, name: f.name }));"
  }
}
```

## Practical Use Cases

### 1. Daily File Discovery

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: '2024', pageSize: 20 }); return { count: results.totalResults, files: results.files.map(f => ({ name: f.name, id: f.id })) };"
  }
}
```

### 2. Project File Discovery

```json
{
  "name": "execute",
  "arguments": {
    "code": "const projectName = 'Alpha Launch'; const results = await sdk.drive.search({ query: projectName, pageSize: 50 }); const grouped = results.files.reduce((acc, f) => { const type = f.mimeType.includes('spreadsheet') ? 'spreadsheets' : f.mimeType.includes('document') ? 'documents' : f.mimeType.includes('presentation') ? 'presentations' : 'other'; acc[type] = acc[type] || []; acc[type].push(f); return acc; }, {}); return grouped;"
  }
}
```

### 3. Find Files Then Read One

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: 'budget', pageSize: 5 }); if (results.files.length === 0) return { message: 'No files found' }; const first = results.files[0]; const content = await sdk.drive.read({ fileId: first.id }); return { name: first.name, contentPreview: content.content?.slice(0, 500) };"
  }
}
```

## Error Handling

### Robust Search Function

```json
{
  "name": "execute",
  "arguments": {
    "code": "try { const results = await sdk.drive.search({ query: 'budget documents', pageSize: 20 }); return { success: true, count: results.files.length, files: results.files }; } catch (err) { return { success: false, error: err.message }; }"
  }
}
```

## Performance Tips

### 1. Optimize Page Size

```json
{
  "name": "execute",
  "arguments": {
    "code": "const preview = await sdk.drive.search({ query: 'recent documents', pageSize: 5 }); return preview.files;"
  }
}
```

For bulk operations, use larger `pageSize` (max 100):

```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: 'project files', pageSize: 100 }); return results;"
  }
}
```

### 2. Batch Related Searches

```json
{
  "name": "execute",
  "arguments": {
    "code": "const projectName = 'Website Redesign'; const [documents, spreadsheets, presentations] = await Promise.all([ sdk.drive.search({ query: projectName + ' document', pageSize: 20 }), sdk.drive.search({ query: projectName + ' spreadsheet', pageSize: 15 }), sdk.drive.search({ query: projectName + ' presentation', pageSize: 10 }) ]); return { documents: documents.files, spreadsheets: spreadsheets.files, presentations: presentations.files, total: documents.files.length + spreadsheets.files.length + presentations.files.length };"
  }
}
```

## Query Pattern Reference

### Supported Patterns (basic search)

| Pattern | Example | Notes |
|---------|---------|-------|
| File names | "budget spreadsheet" | Matches file names containing the terms |
| Keywords | "Q3 report" | Name-based |
| File types | "spreadsheet", "document" | Matches names containing these words |

For time-based, owner, or MIME-type filters, use `sdk.drive.enhancedSearch()` — see [Enhanced Search](./search-enhanced.md).

### Best Practices

1. **Be Specific**: More specific queries return more relevant results
2. **Use File Types**: Include file type keywords for better filtering
3. **Handle Empty Results**: Always check if `files.length > 0` before processing
4. **Use Appropriate Page Size**: 5–10 for previews, up to 100 for bulk operations

---

**Next Steps**: Try the [Enhanced Search](./search-enhanced.md) examples for more advanced filtering and sorting capabilities.
