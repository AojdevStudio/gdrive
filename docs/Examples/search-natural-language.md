# Natural Language Search Examples

The Google Drive MCP Server supports intuitive natural language queries for finding files and folders. This guide demonstrates how to use the `search` tool with various query patterns.

## Overview

The `search` tool translates natural language queries into Google Drive API search parameters, making it easy to find files without learning complex query syntax.

## Basic Search Examples

### Simple File Search

```javascript
// Find files by name
await callTool("search", {
  query: "budget spreadsheet",
  pageSize: 10
});

// Response:
// {
//   "files": [
//     {
//       "id": "1abc123...",
//       "name": "2024 Budget Spreadsheet",
//       "mimeType": "application/vnd.google-apps.spreadsheet",
//       "size": "45678",
//       "modifiedTime": "2024-01-15T10:30:00.000Z",
//       "webViewLink": "https://docs.google.com/spreadsheets/d/1abc123..."
//     }
//   ],
//   "totalResults": 3
// }
```

### Search by File Type

```javascript
// Find all spreadsheets
await callTool("search", {
  query: "spreadsheets",
  pageSize: 20
});

// Find all documents
await callTool("search", {
  query: "documents",
  pageSize: 15
});

// Find all presentations
await callTool("search", {
  query: "presentations slides",
  pageSize: 10
});
```

## Time-Based Search

### Recent Files

```javascript
// Files modified recently
await callTool("search", {
  query: "files modified today",
  pageSize: 15
});

await callTool("search", {
  query: "documents created this week",
  pageSize: 10
});

await callTool("search", {
  query: "spreadsheets updated last month",
  pageSize: 20
});
```

### Specific Time Periods

```javascript
// Files from specific dates
await callTool("search", {
  query: "files modified after 2024-01-01",
  pageSize: 25
});

await callTool("search", {
  query: "presentations created before 2023-12-31",
  pageSize: 10
});
```

## Content-Based Search

### Search Within File Content

```javascript
// Find files containing specific text
await callTool("search", {
  query: "files containing quarterly report",
  pageSize: 10
});

// Search for files with specific keywords
await callTool("search", {
  query: "documents with marketing strategy",
  pageSize: 15
});

// Find files with multiple keywords
await callTool("search", {
  query: "budget AND forecast AND 2024",
  pageSize: 10
});
```

## Owner and Sharing Search

### Find Files by Owner

```javascript
// Files owned by specific user
await callTool("search", {
  query: "files owned by john.doe@company.com",
  pageSize: 20
});

// Files shared with me
await callTool("search", {
  query: "files shared with me",
  pageSize: 25
});

// Files I've shared
await callTool("search", {
  query: "files I shared",
  pageSize: 15
});
```

## Advanced Query Patterns

### Complex Combinations

```javascript
// Multiple criteria
await callTool("search", {
  query: "budget spreadsheets modified last week",
  pageSize: 10
});

async function findProjectFiles(projectName) {
  return await callTool("search", {
    query: `${projectName} documents and presentations created this month`,
    pageSize: 20
  });
}

// Usage
const projectFiles = await findProjectFiles("Alpha Launch");
```

### Folder-Specific Search

```javascript
// Search within specific folders
await callTool("search", {
  query: "files in Marketing folder",
  pageSize: 15
});

// Search in multiple folders
await callTool("search", {
  query: "spreadsheets in Finance or Accounting folders",
  pageSize: 20
});
```

## Practical Use Cases

### 1. Daily File Management

```javascript
async function getTodaysWork() {
  // Get files I've worked on today
  const todaysFiles = await callTool("search", {
    query: "files modified today",
    pageSize: 20
  });
  
  // Get files shared with me today
  const sharedToday = await callTool("search", {
    query: "files shared with me today",
    pageSize: 15
  });
  
  return {
    modified: todaysFiles.files,
    shared: sharedToday.files
  };
}
```

### 2. Project File Discovery

```javascript
async function findProjectAssets(projectName, fileTypes = []) {
  let query = `${projectName}`;
  
  if (fileTypes.length > 0) {
    const typeQuery = fileTypes.join(" OR ");
    query += ` AND (${typeQuery})`;
  }
  
  const results = await callTool("search", {
    query,
    pageSize: 50
  });
  
  // Group by file type
  const grouped = results.files.reduce((acc, file) => {
    const type = file.mimeType.includes('spreadsheet') ? 'spreadsheets' :
                 file.mimeType.includes('document') ? 'documents' :
                 file.mimeType.includes('presentation') ? 'presentations' : 'other';
    
    acc[type] = acc[type] || [];
    acc[type].push(file);
    return acc;
  }, {});
  
  return grouped;
}

// Usage
const projectFiles = await findProjectAssets("Website Redesign", ["documents", "presentations"]);
console.log(`Found ${projectFiles.documents?.length || 0} documents`);
console.log(`Found ${projectFiles.presentations?.length || 0} presentations`);
```

### 3. Cleanup and Organization

```javascript
async function findOldFiles(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const dateStr = cutoffDate.toISOString().split('T')[0];
  
  return await callTool("search", {
    query: `files modified before ${dateStr}`,
    pageSize: 100
  });
}

async function findLargeFiles() {
  // Note: Size-based search may require enhanced search
  return await callTool("search", {
    query: "large files",
    pageSize: 50
  });
}
```

## Error Handling

### Robust Search Function

```javascript
async function safeSearch(query, options = {}) {
  const defaultOptions = {
    pageSize: 10,
    maxRetries: 3,
    retryDelay: 1000
  };
  
  const config = { ...defaultOptions, ...options };
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await callTool("search", {
        query,
        pageSize: config.pageSize
      });
      
      return {
        success: true,
        data: result,
        attempt
      };
      
    } catch (error) {
      console.error(`Search attempt ${attempt} failed:`, error.message);
      
      if (attempt === config.maxRetries) {
        return {
          success: false,
          error: error.message,
          attempts: attempt
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, config.retryDelay));
    }
  }
}

// Usage
const result = await safeSearch("budget documents", { pageSize: 20 });
if (result.success) {
  console.log(`Found ${result.data.files.length} files`);
} else {
  console.error(`Search failed after ${result.attempts} attempts: ${result.error}`);
}
```

## Performance Tips

### 1. Optimize Page Size

```javascript
// For quick previews
const preview = await callTool("search", {
  query: "recent documents",
  pageSize: 5  // Small page size for quick results
});

// For comprehensive results
const comprehensive = await callTool("search", {
  query: "project files",
  pageSize: 100  // Larger page size for bulk operations
});
```

### 2. Cache Frequent Searches

```javascript
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedSearch(query, pageSize = 10) {
  const cacheKey = `${query}:${pageSize}`;
  const cached = searchCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  const result = await callTool("search", { query, pageSize });
  
  searchCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });
  
  return result;
}
```

### 3. Batch Related Searches

```javascript
async function getProjectOverview(projectName) {
  // Execute searches in parallel for better performance
  const [documents, spreadsheets, presentations] = await Promise.all([
    callTool("search", { query: `${projectName} documents`, pageSize: 20 }),
    callTool("search", { query: `${projectName} spreadsheets`, pageSize: 15 }),
    callTool("search", { query: `${projectName} presentations`, pageSize: 10 })
  ]);
  
  return {
    documents: documents.files,
    spreadsheets: spreadsheets.files,
    presentations: presentations.files,
    totalFiles: documents.files.length + spreadsheets.files.length + presentations.files.length
  };
}
```

## Query Pattern Reference

### Supported Natural Language Patterns

| Pattern | Example | Translates To |
|---------|---------|---------------|
| File types | "spreadsheets", "documents" | `mimeType` filters |
| Time expressions | "today", "last week", "this month" | `modifiedTime` ranges |
| Ownership | "files I own", "shared with me" | `owners` and `sharedWithMe` |
| Content search | "containing budget" | `fullText` search |
| Folder references | "in Marketing folder" | `parents` filter |
| Size expressions | "large files" | Approximate size filters |
| Boolean operators | "AND", "OR", "NOT" | Query combinations |

### Best Practices

1. **Be Specific**: More specific queries return more relevant results
2. **Use File Types**: Include file type keywords for better filtering
3. **Combine Criteria**: Mix content, time, and type filters for precision
4. **Handle Empty Results**: Always check if results are returned
5. **Consider Performance**: Use appropriate page sizes for your use case

---

**Next Steps**: Try the [Enhanced Search](./search-enhanced.md) examples for more advanced filtering and sorting capabilities.