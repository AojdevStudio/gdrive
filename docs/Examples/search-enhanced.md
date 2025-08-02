# Enhanced Search Examples

The `enhancedSearch` tool provides advanced filtering, sorting, and search capabilities beyond basic natural language queries. This guide demonstrates complex search scenarios with precise control.

## Overview

The `enhancedSearch` tool offers:
- Advanced filtering by multiple criteria
- Custom sorting options
- Pagination control
- Precise date range queries
- Complex boolean logic

## Basic Enhanced Search

### Simple Enhanced Query

```javascript
// Basic enhanced search with filters
await callTool("enhancedSearch", {
  query: "budget",
  filters: {
    mimeType: "application/vnd.google-apps.spreadsheet"
  },
  orderBy: "modifiedTime desc",
  pageSize: 15
});

// Response includes enhanced metadata:
// {
//   "files": [
//     {
//       "id": "1abc123...",
//       "name": "Q4 Budget Analysis",
//       "mimeType": "application/vnd.google-apps.spreadsheet",
//       "size": "152637",
//       "modifiedTime": "2024-01-15T14:22:00.000Z",
//       "createdTime": "2024-01-10T09:15:00.000Z",
//       "owners": [{"displayName": "John Doe", "emailAddress": "john@company.com"}],
//       "lastModifyingUser": {"displayName": "Jane Smith"},
//       "webViewLink": "https://docs.google.com/spreadsheets/d/1abc123...",
//       "permissions": ["read", "write"]
//     }
//   ],
//   "totalResults": 8,
//   "hasMore": false
// }
```

## Advanced Filtering

### File Type Filtering

```javascript
// Multiple MIME types
await callTool("enhancedSearch", {
  query: "project",
  filters: {
    mimeType: [
      "application/vnd.google-apps.document",
      "application/vnd.google-apps.presentation"
    ]
  },
  pageSize: 20
});

// Exclude specific types
await callTool("enhancedSearch", {
  query: "meeting",
  filters: {
    excludeMimeTypes: [
      "application/vnd.google-apps.folder"
    ]
  },
  pageSize: 25
});
```

### Date Range Filtering

```javascript
// Precise date ranges
await callTool("enhancedSearch", {
  query: "reports",
  filters: {
    modifiedAfter: "2024-01-01T00:00:00Z",
    modifiedBefore: "2024-01-31T23:59:59Z"
  },
  orderBy: "modifiedTime desc",
  pageSize: 30
});

// Created in specific timeframe
await callTool("enhancedSearch", {
  query: "presentations",
  filters: {
    createdAfter: "2024-01-15T00:00:00Z",
    createdBefore: "2024-01-30T23:59:59Z"
  },
  orderBy: "createdTime asc"
});
```

### Owner and Sharing Filters

```javascript
// Files by specific owner
await callTool("enhancedSearch", {
  query: "budget",
  filters: {
    owners: ["finance@company.com"]
  },
  orderBy: "name"
});

// Shared files only
await callTool("enhancedSearch", {
  query: "collaboration",
  filters: {
    sharedWithMe: true
  },
  orderBy: "sharedWithMeTime desc"
});

// Files I can edit
await callTool("enhancedSearch", {
  query: "documents",
  filters: {
    writable: true
  }
});
```

## Sorting and Ordering

### Multiple Sort Options

```javascript
// Sort by modification time (newest first)
await callTool("enhancedSearch", {
  query: "project files",
  orderBy: "modifiedTime desc",
  pageSize: 20
});

// Sort by name (alphabetical)
await callTool("enhancedSearch", {
  query: "documents",
  orderBy: "name asc",
  pageSize: 25
});

// Sort by size (largest first)
await callTool("enhancedSearch", {
  query: "presentations",
  orderBy: "quotaBytesUsed desc",
  pageSize: 15
});

// Sort by creation date
await callTool("enhancedSearch", {
  query: "new files",
  orderBy: "createdTime desc",
  pageSize: 10
});
```

## Complex Search Scenarios

### Multi-Criteria Business Search

```javascript
async function findQuarterlyReports(quarter, year) {
  const startDate = new Date(year, (quarter - 1) * 3, 1);
  const endDate = new Date(year, quarter * 3, 0, 23, 59, 59);
  
  return await callTool("enhancedSearch", {
    query: `Q${quarter} ${year} report quarterly`,
    filters: {
      mimeType: [
        "application/vnd.google-apps.document",
        "application/vnd.google-apps.spreadsheet",
        "application/vnd.google-apps.presentation"
      ],
      modifiedAfter: startDate.toISOString(),
      modifiedBefore: endDate.toISOString(),
      owners: [
        "finance@company.com",
        "operations@company.com",
        "sales@company.com"
      ]
    },
    orderBy: "modifiedTime desc",
    pageSize: 50
  });
}

// Usage
const q4Reports = await findQuarterlyReports(4, 2023);
console.log(`Found ${q4Reports.files.length} Q4 2023 reports`);
```

### Project File Audit

```javascript
async function auditProjectFiles(projectName, teamMembers) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Find recent project files
  const recentFiles = await callTool("enhancedSearch", {
    query: projectName,
    filters: {
      modifiedAfter: thirtyDaysAgo.toISOString(),
      owners: teamMembers
    },
    orderBy: "modifiedTime desc",
    pageSize: 100
  });
  
  // Find stale project files
  const staleFiles = await callTool("enhancedSearch", {
    query: projectName,
    filters: {
      modifiedBefore: thirtyDaysAgo.toISOString(),
      owners: teamMembers
    },
    orderBy: "modifiedTime asc",
    pageSize: 100
  });
  
  return {
    recent: recentFiles.files,
    stale: staleFiles.files,
    summary: {
      totalFiles: recentFiles.files.length + staleFiles.files.length,
      recentActivity: recentFiles.files.length,
      needsReview: staleFiles.files.length
    }
  };
}

// Usage
const audit = await auditProjectFiles("Website Redesign", [
  "designer@company.com",
  "developer@company.com",
  "pm@company.com"
]);

console.log(`Project audit: ${audit.summary.recentActivity} active, ${audit.summary.needsReview} stale`);
```

### Content and Collaboration Analysis

```javascript
async function analyzeTeamCollaboration(teamEmail, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Files created by team
  const created = await callTool("enhancedSearch", {
    query: "*",
    filters: {
      owners: [teamEmail],
      createdAfter: startDate.toISOString()
    },
    orderBy: "createdTime desc",
    pageSize: 50
  });
  
  // Files shared with team
  const shared = await callTool("enhancedSearch", {
    query: "*",
    filters: {
      sharedWithMe: true,
      sharedWithMeTime: startDate.toISOString()
    },
    orderBy: "sharedWithMeTime desc",
    pageSize: 50
  });
  
  // Files team can edit
  const editable = await callTool("enhancedSearch", {
    query: "*",
    filters: {
      writable: true,
      modifiedAfter: startDate.toISOString()
    },
    orderBy: "modifiedTime desc",
    pageSize: 50
  });
  
  // Analyze file types
  const analyzeTypes = (files) => {
    return files.reduce((acc, file) => {
      const type = file.mimeType.includes('document') ? 'Documents' :
                   file.mimeType.includes('spreadsheet') ? 'Spreadsheets' :
                   file.mimeType.includes('presentation') ? 'Presentations' :
                   file.mimeType.includes('folder') ? 'Folders' : 'Other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  };
  
  return {
    period: `${days} days`,
    created: {
      files: created.files,
      count: created.files.length,
      types: analyzeTypes(created.files)
    },
    shared: {
      files: shared.files,
      count: shared.files.length,
      types: analyzeTypes(shared.files)
    },
    editable: {
      files: editable.files,
      count: editable.files.length,
      types: analyzeTypes(editable.files)
    }
  };
}
```

## Pagination and Large Result Sets

### Handling Large Searches

```javascript
async function getAllProjectFiles(projectName, maxResults = 1000) {
  const allFiles = [];
  let pageToken = null;
  const pageSize = 100;
  
  do {
    const params = {
      query: projectName,
      pageSize: Math.min(pageSize, maxResults - allFiles.length),
      orderBy: "modifiedTime desc"
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    const result = await callTool("enhancedSearch", params);
    
    allFiles.push(...result.files);
    pageToken = result.nextPageToken;
    
    console.log(`Retrieved ${allFiles.length} files...`);
    
  } while (pageToken && allFiles.length < maxResults);
  
  return {
    files: allFiles,
    totalRetrieved: allFiles.length,
    hasMore: !!pageToken
  };
}

// Usage with progress tracking
const projectFiles = await getAllProjectFiles("Major Project", 500);
console.log(`Retrieved ${projectFiles.totalRetrieved} files`);
```

### Batched Processing

```javascript
async function processFilesInBatches(searchQuery, processor, batchSize = 50) {
  const results = [];
  let pageToken = null;
  let batchNumber = 1;
  
  do {
    console.log(`Processing batch ${batchNumber}...`);
    
    const params = {
      query: searchQuery,
      pageSize: batchSize,
      orderBy: "modifiedTime desc"
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    const searchResult = await callTool("enhancedSearch", params);
    
    // Process this batch
    const processedBatch = await processor(searchResult.files);
    results.push(...processedBatch);
    
    pageToken = searchResult.nextPageToken;
    batchNumber++;
    
    // Optional delay between batches
    if (pageToken) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } while (pageToken);
  
  return results;
}

// Example processor function
async function analyzeFileMetadata(files) {
  return files.map(file => ({
    id: file.id,
    name: file.name,
    size: parseInt(file.size) || 0,
    lastModified: new Date(file.modifiedTime),
    owner: file.owners?.[0]?.emailAddress,
    type: file.mimeType.split('.').pop()
  }));
}

// Usage
const analysis = await processFilesInBatches(
  "company documents",
  analyzeFileMetadata,
  25
);
```

## Error Handling and Resilience

### Robust Search with Fallbacks

```javascript
async function resilientSearch(query, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const backoffDelay = options.backoffDelay || 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try enhanced search first
      const result = await callTool("enhancedSearch", {
        query,
        filters: options.filters || {},
        orderBy: options.orderBy || "modifiedTime desc",
        pageSize: options.pageSize || 20
      });
      
      return {
        success: true,
        data: result,
        method: 'enhanced',
        attempt
      };
      
    } catch (enhancedError) {
      console.warn(`Enhanced search attempt ${attempt} failed:`, enhancedError.message);
      
      // Fallback to basic search
      try {
        const fallbackResult = await callTool("search", {
          query,
          pageSize: options.pageSize || 20
        });
        
        return {
          success: true,
          data: fallbackResult,
          method: 'basic',
          attempt,
          warning: 'Used basic search fallback'
        };
        
      } catch (basicError) {
        console.error(`Basic search fallback failed:`, basicError.message);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            error: {
              enhanced: enhancedError.message,
              basic: basicError.message
            },
            attempts: attempt
          };
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, backoffDelay * Math.pow(2, attempt - 1))
        );
      }
    }
  }
}

// Usage
const result = await resilientSearch("important documents", {
  filters: { modifiedAfter: "2024-01-01T00:00:00Z" },
  orderBy: "modifiedTime desc",
  pageSize: 30,
  maxRetries: 3
});

if (result.success) {
  console.log(`Found ${result.data.files.length} files using ${result.method} search`);
  if (result.warning) console.warn(result.warning);
} else {
  console.error('All search methods failed:', result.error);
}
```

## Performance Optimization

### Search Result Caching

```javascript
class SearchCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  generateKey(query, filters, orderBy) {
    return JSON.stringify({ query, filters, orderBy });
  }
  
  get(query, filters, orderBy) {
    const key = this.generateKey(query, filters, orderBy);
    const cached = this.cache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < this.ttl) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key); // Remove expired entry
    }
    
    return null;
  }
  
  set(query, filters, orderBy, data) {
    const key = this.generateKey(query, filters, orderBy);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  clear() {
    this.cache.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

const searchCache = new SearchCache();

async function cachedEnhancedSearch(query, filters = {}, orderBy = "modifiedTime desc", pageSize = 20) {
  // Check cache first
  const cached = searchCache.get(query, filters, orderBy);
  if (cached) {
    console.log('Cache hit for search query');
    return cached;
  }
  
  // Perform search
  const result = await callTool("enhancedSearch", {
    query,
    filters,
    orderBy,
    pageSize
  });
  
  // Cache result
  searchCache.set(query, filters, orderBy, result);
  console.log(`Cached search result (cache size: ${searchCache.size()})`);
  
  return result;
}
```

## Filter Reference

### Available Filter Options

| Filter | Type | Description | Example |
|--------|------|-------------|----------|
| `mimeType` | string\|array | File MIME type(s) | `"application/vnd.google-apps.document"` |
| `excludeMimeTypes` | array | MIME types to exclude | `["application/vnd.google-apps.folder"]` |
| `modifiedAfter` | string | ISO date string | `"2024-01-01T00:00:00Z"` |
| `modifiedBefore` | string | ISO date string | `"2024-12-31T23:59:59Z"` |
| `createdAfter` | string | ISO date string | `"2024-01-01T00:00:00Z"` |
| `createdBefore` | string | ISO date string | `"2024-12-31T23:59:59Z"` |
| `owners` | array | Owner email addresses | `["user@company.com"]` |
| `sharedWithMe` | boolean | Files shared with authenticated user | `true` |
| `sharedWithMeTime` | string | ISO date for shared time | `"2024-01-01T00:00:00Z"` |
| `writable` | boolean | Files user can edit | `true` |
| `starred` | boolean | Starred files only | `true` |
| `trashed` | boolean | Include trashed files | `false` |

### Sort Options

| Sort Field | Description |
|------------|-------------|
| `modifiedTime` | Last modification time |
| `createdTime` | Creation time |
| `name` | File name |
| `quotaBytesUsed` | File size |
| `sharedWithMeTime` | Time when shared |
| `starred` | Starred status |
| `viewedByMeTime` | Last viewed time |

Add `desc` or `asc` to specify direction (e.g., `"modifiedTime desc"`).

---

**Next Steps**: Explore [Document Reading](./documents-reading.md) to learn how to access the content of files you've found.