# API Rate Limits

This guide covers Google API rate limiting issues and provides strategies for optimization and error handling.

## 🔍 Quick Diagnosis

### Check Rate Limit Status
```bash
# Monitor API usage in logs
grep -i "quota\|rate" logs/combined.log | tail -20

# Check for 429 (Too Many Requests) errors
grep "429" logs/error.log

# Monitor Redis cache hit rates
grep "cache" logs/combined.log | grep -E "hit|miss" | tail -10
```

### Test Current API Performance
```bash
# Test basic search with timing
time echo '{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {"query": "test", "pageSize": 5}
  }
}' | node ./dist/index.js
```

## 🚨 Common Rate Limit Issues

### 1. Google Drive API Quota Exceeded

**Symptoms:**
- Error: `Quota exceeded for quota metric 'Queries' and limit 'Queries per day'`
- Error: `User Rate Limit Exceeded`
- HTTP 429 status codes
- Slow or failing API responses

**Understanding Google Drive API Limits:**

| API | Default Limit | Reset Period |
|-----|---------------|-------------|
| Drive API | 1,000 requests/100 seconds/user | Rolling window |
| Sheets API | 100 requests/100 seconds/user | Rolling window |
| Docs API | 300 requests/minute | Rolling window |
| Forms API | 1,000 requests/day | Daily |

**Solutions:**

#### Enable Request Caching
```bash
# Ensure Redis is running for caching
docker-compose up -d redis

# Verify cache is working
redis-cli ping
# Should return: PONG

# Check cache hit rate
grep "cache hit" logs/combined.log | wc -l
grep "cache miss" logs/combined.log | wc -l
```

#### Implement Request Batching
```javascript
// Use batch operations instead of individual calls
// Instead of multiple createFile calls:
await callTool("batchFileOperations", {
  operations: [
    {type: "create", name: "file1.txt", content: "content1"},
    {type: "create", name: "file2.txt", content: "content2"},
    {type: "create", name: "file3.txt", content: "content3"}
  ]
});
```

#### Configure Rate Limit Handling
Add to your `.env` file:
```bash
# Custom rate limit configuration
GDRIVE_RATE_LIMIT_DELAY=1000  # 1 second between requests
GDRIVE_MAX_RETRIES=3          # Retry failed requests
GDRIVE_EXPONENTIAL_BACKOFF=true  # Use exponential backoff
```

### 2. Sheets API Rate Limiting

**Symptoms:**
- Slow spreadsheet operations
- Error: `Rate Limit Exceeded`
- Timeouts on large sheet reads

**Solutions:**

#### Optimize Sheet Operations
```javascript
// Read large ranges efficiently
// Instead of multiple small reads:
await callTool("readSheet", {
  spreadsheetId: "1abc...",
  range: "Sheet1!A1:Z1000"  // Single large read
});

// Use batch updates
await callTool("updateCells", {
  spreadsheetId: "1abc...",
  range: "Sheet1!A1:C10",
  values: [
    ["col1", "col2", "col3"],
    ["val1", "val2", "val3"],
    // ... more rows
  ]
});
```

#### Configure Sheet-Specific Caching
```bash
# Increase cache TTL for sheets
GDRIVE_SHEETS_CACHE_TTL=600  # 10 minutes

# Enable aggressive caching for read-heavy workloads
GDRIVE_AGGRESSIVE_CACHING=true
```

### 3. Concurrent Request Issues

**Symptoms:**
- Multiple simultaneous API calls failing
- Error: `Too many concurrent requests`
- Inconsistent performance

**Solutions:**

#### Configure Request Queueing
```bash
# Add to .env
GDRIVE_MAX_CONCURRENT_REQUESTS=5  # Limit concurrent requests
GDRIVE_REQUEST_QUEUE_SIZE=100     # Queue size
```

#### Implement Request Prioritization
```javascript
// High priority for interactive operations
await callTool("search", {
  query: "urgent documents",
  priority: "high"
});

// Low priority for bulk operations
await callTool("batchFileOperations", {
  operations: bulkOps,
  priority: "low"
});
```

## ⚙️ Advanced Rate Limit Strategies

### 1. Implement Exponential Backoff

Add this configuration to handle rate limits gracefully:

```javascript
// Example configuration in code
const rateLimitConfig = {
  maxRetries: 5,
  baseDelay: 1000,      // 1 second
  maxDelay: 32000,      // 32 seconds
  backoffMultiplier: 2,
  jitter: true          // Add randomness to prevent thundering herd
};
```

### 2. Request Prioritization System

```bash
# Configure priority queues
GDRIVE_PRIORITY_QUEUES=high,normal,low
GDRIVE_HIGH_PRIORITY_QUOTA=50%    # Reserve 50% quota for high priority
GDRIVE_NORMAL_PRIORITY_QUOTA=35%  # 35% for normal
GDRIVE_LOW_PRIORITY_QUOTA=15%     # 15% for low priority
```

### 3. Intelligent Caching Strategy

```bash
# Advanced caching configuration
GDRIVE_CACHE_STRATEGY=adaptive
GDRIVE_CACHE_HOT_DATA_TTL=300     # 5 minutes for frequently accessed
GDRIVE_CACHE_WARM_DATA_TTL=1800   # 30 minutes for occasionally accessed
GDRIVE_CACHE_COLD_DATA_TTL=3600   # 1 hour for rarely accessed
```

### 4. Monitoring and Alerting

```bash
# Set up rate limit monitoring
#!/bin/bash
# save as monitor-rate-limits.sh

RECENT_429_COUNT=$(grep "429" logs/error.log | grep $(date '+%Y-%m-%d %H:%M') | wc -l)
QUOTA_ERRORS=$(grep -i "quota exceeded" logs/error.log | grep $(date '+%Y-%m-%d %H:%M') | wc -l)

if [[ $RECENT_429_COUNT -gt 10 ]]; then
    echo "ALERT: High rate limit errors detected: $RECENT_429_COUNT"
fi

if [[ $QUOTA_ERRORS -gt 0 ]]; then
    echo "ALERT: API quota exceeded: $QUOTA_ERRORS errors"
fi

# Check cache performance
CACHE_HIT_RATE=$(redis-cli info stats | grep keyspace_hits | cut -d: -f2)
echo "Cache hit rate: $CACHE_HIT_RATE"
```

## 📊 Performance Optimization

### 1. Enable All Caching Features

```bash
# Optimal caching configuration
REDIS_URL=redis://localhost:6379
GDRIVE_CACHE_ENABLED=true
GDRIVE_CACHE_TTL=300              # 5 minutes default
GDRIVE_CACHE_SEARCH_TTL=600       # 10 minutes for searches
GDRIVE_CACHE_FILE_CONTENT_TTL=1800 # 30 minutes for file content
```

### 2. Optimize Query Patterns

```javascript
// Efficient search patterns
// Use specific queries instead of broad searches
await callTool("enhancedSearch", {
  query: "name:budget mimeType:spreadsheet",
  filters: {
    modifiedAfter: "2024-01-01T00:00:00Z"
  },
  pageSize: 10  // Don't request more than needed
});

// Cache-friendly operations
// Group related operations together
const batchOps = [
  {type: "read", fileId: "1abc..."},
  {type: "read", fileId: "1def..."},
  {type: "read", fileId: "1ghi..."}
];
```

### 3. Database Connection Pooling

```bash
# Redis connection optimization
REDIS_MAX_CONNECTIONS=10
REDIS_CONNECTION_TIMEOUT=5000
REDIS_RETRY_ATTEMPTS=3
REDIS_RETRY_DELAY=1000
```

## 🔧 Diagnostic Tools

### Rate Limit Health Check

```bash
#!/bin/bash
# save as check-rate-limits.sh

echo "Google Drive MCP Server - Rate Limit Health Check"
echo "================================================="

# Check recent API errors
echo "Recent API Errors (last hour):"
grep "$(date -d '1 hour ago' '+%Y-%m-%d %H'):" logs/error.log | grep -E "429|quota|rate" | wc -l

# Check cache performance
echo "\nCache Performance:"
if redis-cli ping > /dev/null 2>&1; then
    redis-cli info stats | grep -E "keyspace_hits|keyspace_misses"
    
    # Calculate hit rate
    HITS=$(redis-cli info stats | grep keyspace_hits | cut -d: -f2)
    MISSES=$(redis-cli info stats | grep keyspace_misses | cut -d: -f2)
    TOTAL=$((HITS + MISSES))
    
    if [[ $TOTAL -gt 0 ]]; then
        HIT_RATE=$(echo "scale=2; $HITS * 100 / $TOTAL" | bc)
        echo "Cache Hit Rate: ${HIT_RATE}%"
    fi
else
    echo "Redis not available - caching disabled"
fi

# Check current request rate
echo "\nCurrent Request Rate (last 5 minutes):"
grep "$(date -d '5 minutes ago' '+%Y-%m-%d %H:%M')" logs/combined.log | grep "API request" | wc -l

echo "\nRecommendations:"
if [[ $HIT_RATE && $(echo "$HIT_RATE < 50" | bc) -eq 1 ]]; then
    echo "- Consider increasing cache TTL values"
fi

echo "- Monitor logs for quota warnings"
echo "- Use batch operations for bulk requests"
echo "- Implement request queuing for high-volume scenarios"
```

### API Usage Analytics

```bash
#!/bin/bash
# save as api-usage-report.sh

echo "API Usage Report - Last 24 Hours"
echo "=================================="

# Count requests by API type
echo "Requests by API:"
grep "$(date '+%Y-%m-%d')" logs/combined.log | \
  grep -E "Drive|Sheets|Docs|Forms" | \
  awk '{print $5}' | sort | uniq -c | sort -nr

# Count errors by type
echo "\nErrors by Type:"
grep "$(date '+%Y-%m-%d')" logs/error.log | \
  awk '{print $6}' | sort | uniq -c | sort -nr

# Peak usage hours
echo "\nPeak Usage Hours:"
grep "$(date '+%Y-%m-%d')" logs/combined.log | \
  awk '{print $2}' | cut -d: -f1 | sort | uniq -c | sort -nr
```

## 🛡️ Prevention Strategies

### 1. Proactive Monitoring

```bash
# Add to crontab for regular monitoring
# Check every 15 minutes
*/15 * * * * /path/to/check-rate-limits.sh

# Daily usage report
0 0 * * * /path/to/api-usage-report.sh > /path/to/daily-usage.log
```

### 2. Automated Cache Warming

```bash
#!/bin/bash
# save as warm-cache.sh
# Warm up cache with commonly accessed data

echo "Warming up cache with frequently accessed files..."

# Pre-load search results for common queries
echo '{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "type:document", "pageSize": 50}}}' | \
  node ./dist/index.js > /tmp/warmup1.json

echo '{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "type:spreadsheet", "pageSize": 50}}}' | \
  node ./dist/index.js > /tmp/warmup2.json

echo "Cache warming completed"
```

### 3. Configuration Templates

#### High-Performance Configuration
```bash
# .env for high-performance scenarios
REDIS_URL=redis://localhost:6379
GDRIVE_CACHE_ENABLED=true
GDRIVE_CACHE_TTL=600
GDRIVE_MAX_CONCURRENT_REQUESTS=3
GDRIVE_RATE_LIMIT_DELAY=2000
GDRIVE_EXPONENTIAL_BACKOFF=true
LOG_LEVEL=warn  # Reduce logging overhead
```

#### High-Volume Configuration
```bash
# .env for high-volume scenarios
REDIS_URL=redis://localhost:6379
GDRIVE_CACHE_ENABLED=true
GDRIVE_CACHE_TTL=1800
GDRIVE_AGGRESSIVE_CACHING=true
GDRIVE_MAX_CONCURRENT_REQUESTS=2
GDRIVE_REQUEST_QUEUE_SIZE=200
GDRIVE_RATE_LIMIT_DELAY=3000
```

## 🆘 Emergency Recovery

If rate limits are severely impacting service:

### Immediate Actions
```bash
# 1. Enable aggressive caching
echo "GDRIVE_AGGRESSIVE_CACHING=true" >> .env
echo "GDRIVE_CACHE_TTL=3600" >> .env

# 2. Reduce concurrent requests
echo "GDRIVE_MAX_CONCURRENT_REQUESTS=1" >> .env

# 3. Increase delays
echo "GDRIVE_RATE_LIMIT_DELAY=5000" >> .env

# 4. Restart with new config
docker-compose restart gdrive-mcp
```

### Long-term Recovery
```bash
# 1. Implement request quotas
echo "GDRIVE_DAILY_REQUEST_QUOTA=50000" >> .env
echo "GDRIVE_HOURLY_REQUEST_QUOTA=2000" >> .env

# 2. Set up monitoring
crontab -e
# Add: */5 * * * * /path/to/check-rate-limits.sh

# 3. Optimize application patterns
# Review code for inefficient API usage patterns
```

---

For specific error messages related to rate limits, see the [Error Messages Reference](./error-messages.md).