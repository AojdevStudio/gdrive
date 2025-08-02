# Redis Connection Problems

This guide covers Redis-related issues with the Google Drive MCP Server, including connection failures, performance problems, and cache management.

## 🔍 Quick Diagnosis

### Check Redis Status
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis server status
redis-cli info server

# For Docker setup
docker-compose exec redis redis-cli ping
docker-compose logs redis

# Check if MCP server can connect to Redis
grep -i "redis" logs/combined.log | tail -10
```

### Test Cache Functionality
```bash
# Check cache statistics
redis-cli info stats

# Monitor cache operations in real-time
redis-cli monitor
# (Run this in separate terminal, then perform operations)

# Check cache hit/miss ratios in application logs
grep -E "cache (hit|miss)" logs/combined.log | tail -20
```

## 🚨 Common Redis Issues

### 1. Redis Connection Failed

**Symptoms:**
- Error: `Redis connection failed`
- Error: `ECONNREFUSED 127.0.0.1:6379`
- Application starts but caching is disabled
- Warning: `Operating without cache`

**Solutions:**

#### For Local Redis Installation
```bash
# Check if Redis is installed and running
which redis-server
ps aux | grep redis

# Start Redis if not running
# On macOS with Homebrew:
brew services start redis

# On Linux with systemd:
sudo systemctl start redis
sudo systemctl enable redis  # Auto-start on boot

# On Ubuntu/Debian:
sudo service redis-server start

# Test connection after starting
redis-cli ping
```

#### For Docker Redis
```bash
# Check if Redis container is running
docker-compose ps redis

# Start Redis container
docker-compose up -d redis

# Check Redis container logs
docker-compose logs redis

# Test connection from host
docker-compose exec redis redis-cli ping

# Test connection from main container
docker-compose exec gdrive-mcp sh -c 'nc -zv redis 6379'
```

#### Fix Connection String
```bash
# Check REDIS_URL environment variable
echo $REDIS_URL

# For local Redis:
export REDIS_URL="redis://localhost:6379"
echo "REDIS_URL=redis://localhost:6379" >> .env

# For Docker Compose:
export REDIS_URL="redis://redis:6379"
echo "REDIS_URL=redis://redis:6379" >> .env

# For remote Redis:
export REDIS_URL="redis://username:password@host:port/database"
```

### 2. Redis Authentication Issues

**Symptoms:**
- Error: `NOAUTH Authentication required`
- Error: `ERR invalid password`
- Connection succeeds but commands fail

**Solutions:**

#### Configure Redis Password
```bash
# If Redis requires authentication, update connection URL
REDIS_URL="redis://:password@localhost:6379"
# Or with username:
REDIS_URL="redis://username:password@localhost:6379"

# For Docker setup, add to docker-compose.yml:
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass yourpassword
    environment:
      - REDIS_PASSWORD=yourpassword
```

#### Check Redis Configuration
```bash
# Check if Redis requires authentication
redis-cli config get requirepass

# Set password if needed
redis-cli config set requirepass yourpassword

# Test authenticated connection
redis-cli -a yourpassword ping
```

### 3. Redis Memory Issues

**Symptoms:**
- Error: `OOM command not allowed when used memory > 'maxmemory'`
- Slow cache performance
- Cache entries being evicted too quickly
- High memory usage

**Solutions:**

#### Check Memory Usage
```bash
# Check Redis memory usage
redis-cli info memory

# Check system memory
free -h

# Monitor memory usage over time
redis-cli --latency-history -i 1
```

#### Configure Memory Settings
```bash
# Set max memory limit (e.g., 256MB)
redis-cli config set maxmemory 268435456

# Set eviction policy
redis-cli config set maxmemory-policy allkeys-lru

# For Docker, add to docker-compose.yml:
services:
  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
```

#### Optimize Cache TTL
```bash
# Add to .env for shorter cache times
GDRIVE_CACHE_TTL=300          # 5 minutes (default)
GDRIVE_CACHE_SEARCH_TTL=600   # 10 minutes for searches
GDRIVE_CACHE_FILE_TTL=1800    # 30 minutes for files

# For memory-constrained environments
GDRIVE_CACHE_TTL=120          # 2 minutes
GDRIVE_CACHE_SEARCH_TTL=300   # 5 minutes
GDRIVE_CACHE_FILE_TTL=600     # 10 minutes
```

### 4. Redis Performance Issues

**Symptoms:**
- Slow cache operations
- High Redis CPU usage
- Timeout errors
- Application performance degradation

**Solutions:**

#### Optimize Redis Configuration
```bash
# For better performance, configure Redis:
redis-cli config set tcp-keepalive 60
redis-cli config set timeout 300
redis-cli config set tcp-backlog 511

# Disable expensive operations if not needed
redis-cli config set save ""
```

#### Monitor Performance
```bash
# Check Redis performance stats
redis-cli info stats
redis-cli info commandstats

# Monitor slow queries
redis-cli config set slowlog-log-slower-than 10000  # 10ms
redis-cli slowlog get 10

# Real-time performance monitoring
redis-cli --latency
```

#### Optimize Application Cache Usage
```bash
# Configure connection pooling
REDIS_MAX_CONNECTIONS=10
REDIS_CONNECTION_TIMEOUT=5000
REDIS_RETRY_ATTEMPTS=3

# Enable pipelining for batch operations
REDIS_ENABLE_PIPELINING=true
REDIS_PIPELINE_SIZE=100
```

### 5. Redis Persistence Issues

**Symptoms:**
- Cache data lost after restart
- Redis fails to start due to corrupted data
- Disk space issues
- Background save failures

**Solutions:**

#### Configure Persistence
```bash
# For development (no persistence needed):
redis-cli config set save ""

# For production (enable persistence):
redis-cli config set save "900 1 300 10 60 10000"

# Check persistence settings
redis-cli config get save
redis-cli config get dir
```

#### Fix Persistence Errors
```bash
# Check disk space
df -h

# Check Redis data directory permissions
ls -la /var/lib/redis/  # Or wherever Redis stores data

# For Docker, ensure volume is mounted correctly:
services:
  redis:
    volumes:
      - redis-data:/data
volumes:
  redis-data:
    driver: local
```

#### Repair Corrupted Data
```bash
# If Redis fails to start due to corruption:
# Stop Redis
redis-cli shutdown

# Try to fix dump.rdb
redis-check-rdb /var/lib/redis/dump.rdb

# If unfixable, remove corrupted data (cache will rebuild)
rm /var/lib/redis/dump.rdb

# Restart Redis
redis-server
```

## ⚙️ Advanced Redis Configuration

### 1. Production Redis Setup

```bash
# redis.conf for production
# Save to redis.conf and mount in Docker

# Network
bind 127.0.0.1
port 6379
tcp-backlog 511
tcp-keepalive 300

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data

# Security
requirepass your-strong-password

# Performance
timeout 300
tcp-keepalive 300
```

### 2. Redis Sentinel for High Availability

```yaml
# docker-compose.ha.yml - High availability setup
version: '3.8'

services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --replica-read-only no
    volumes:
      - redis-master-data:/data
    
  redis-replica:
    image: redis:7-alpine
    command: redis-server --appendonly yes --replicaof redis-master 6379
    volumes:
      - redis-replica-data:/data
    depends_on:
      - redis-master
      
  redis-sentinel:
    image: redis:7-alpine
    command: >
      redis-sentinel /etc/redis-sentinel.conf
      --sentinel monitor mymaster redis-master 6379 1
      --sentinel down-after-milliseconds mymaster 5000
      --sentinel parallel-syncs mymaster 1
      --sentinel failover-timeout mymaster 10000
    depends_on:
      - redis-master
      - redis-replica

volumes:
  redis-master-data:
  redis-replica-data:
```

### 3. Redis Cluster Configuration

```bash
# For very high-scale deployments
# Create 6-node Redis cluster

for port in 7000 7001 7002 7003 7004 7005; do
  mkdir -p cluster/${port}
  cat > cluster/${port}/redis.conf << EOF
port ${port}
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
appendonly yes
bind 0.0.0.0
EOF
done

# Start all nodes
for port in 7000 7001 7002 7003 7004 7005; do
  redis-server cluster/${port}/redis.conf &
done

# Create cluster
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 --cluster-replicas 1
```

## 🔧 Diagnostic Tools

### Redis Health Check Script

```bash
#!/bin/bash
# save as redis-health-check.sh

echo "Redis Health Check"
echo "=================="

# Check Redis availability
echo "1. Connection Test:"
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: CONNECTED"
    
    # Get Redis info
    echo "\n2. Redis Information:"
    redis-cli info server | grep -E "redis_version|uptime_in_seconds|process_id"
    
    # Memory usage
    echo "\n3. Memory Usage:"
    redis-cli info memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"
    
    # Performance stats
    echo "\n4. Performance Stats:"
    redis-cli info stats | grep -E "total_commands_processed|instantaneous_ops_per_sec|keyspace_hits|keyspace_misses"
    
    # Calculate cache hit rate
    HITS=$(redis-cli info stats | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
    MISSES=$(redis-cli info stats | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
    
    if [[ $HITS -gt 0 ]] || [[ $MISSES -gt 0 ]]; then
        TOTAL=$((HITS + MISSES))
        if [[ $TOTAL -gt 0 ]]; then
            HIT_RATE=$(echo "scale=2; $HITS * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")
            echo "Cache Hit Rate: ${HIT_RATE}%"
        fi
    fi
    
    # Persistence status
    echo "\n5. Persistence:"
    redis-cli info persistence | grep -E "rdb_last_save_time|aof_enabled|rdb_changes_since_last_save"
    
    # Active databases
    echo "\n6. Active Keys:"
    redis-cli info keyspace
    
else
    echo "❌ Redis: DISCONNECTED"
    
    # Check if Redis process is running
    if pgrep redis-server > /dev/null; then
        echo "Redis process is running but not responding"
    else
        echo "Redis process not found"
    fi
    
    # For Docker setup
    if command -v docker-compose &> /dev/null; then
        echo "\nChecking Docker Redis:"
        docker-compose ps redis
        docker-compose logs --tail=10 redis
    fi
fi

echo "\nRecommendations:"
if [[ $HIT_RATE && $(echo "$HIT_RATE < 70" | bc 2>/dev/null) -eq 1 ]]; then
    echo "- Cache hit rate is low, consider increasing TTL values"
fi
echo "- Monitor memory usage to prevent OOM errors"
echo "- Regular backup of Redis data if persistence is enabled"
echo "- Check Redis logs for any warnings or errors"
```

### Redis Performance Monitor

```bash
#!/bin/bash
# save as monitor-redis-performance.sh

echo "Redis Performance Monitor"
echo "========================"

# Function to get Redis stats
get_redis_stat() {
    redis-cli info stats | grep "$1" | cut -d: -f2 | tr -d '\r'
}

# Function to get Redis memory info
get_redis_memory() {
    redis-cli info memory | grep "$1" | cut -d: -f2 | tr -d '\r'
}

# Monitor loop
echo "Monitoring Redis performance (Ctrl+C to stop)..."
echo "Time,Commands/sec,Hit Rate %,Memory MB,Connections"

while true; do
    TIMESTAMP=$(date '+%H:%M:%S')
    
    # Commands per second
    OPS_SEC=$(get_redis_stat "instantaneous_ops_per_sec")
    
    # Hit rate
    HITS=$(get_redis_stat "keyspace_hits")
    MISSES=$(get_redis_stat "keyspace_misses")
    TOTAL=$((HITS + MISSES))
    
    if [[ $TOTAL -gt 0 ]]; then
        HIT_RATE=$(echo "scale=1; $HITS * 100 / $TOTAL" | bc 2>/dev/null || echo "0")
    else
        HIT_RATE="0"
    fi
    
    # Memory usage in MB
    MEMORY_BYTES=$(get_redis_memory "used_memory")
    MEMORY_MB=$(echo "scale=1; $MEMORY_BYTES / 1024 / 1024" | bc 2>/dev/null || echo "0")
    
    # Connected clients
    CONNECTIONS=$(get_redis_stat "connected_clients")
    
    echo "$TIMESTAMP,$OPS_SEC,$HIT_RATE,$MEMORY_MB,$CONNECTIONS"
    
    sleep 5
done
```

### Redis Cache Analysis

```bash
#!/bin/bash
# save as analyze-redis-cache.sh

echo "Redis Cache Analysis"
echo "===================="

# Get all keys with their TTL
echo "1. Cache Key Analysis:"
redis-cli --scan --pattern "*" | while read key; do
    TTL=$(redis-cli ttl "$key")
    TYPE=$(redis-cli type "$key")
    SIZE=$(redis-cli memory usage "$key" 2>/dev/null || echo "N/A")
    
    echo "Key: $key, Type: $TYPE, TTL: ${TTL}s, Size: ${SIZE} bytes"
done | head -20

echo "\n2. Key Statistics:"
# Count keys by pattern
echo "Total keys: $(redis-cli dbsize)"
echo "Search cache keys: $(redis-cli --scan --pattern "*search*" | wc -l)"
echo "File cache keys: $(redis-cli --scan --pattern "*file*" | wc -l)"

echo "\n3. Memory Distribution:"
# Memory usage by key type
for type in string hash list set zset; do
    count=$(redis-cli --scan | xargs -I {} redis-cli type {} | grep -c "$type")
    echo "$type keys: $count"
done

echo "\n4. Expiration Analysis:"
# Keys by TTL ranges
expiring_soon=0
expiring_later=0
persistent=0

redis-cli --scan | while read key; do
    ttl=$(redis-cli ttl "$key")
    if [[ $ttl -eq -1 ]]; then
        ((persistent++))
    elif [[ $ttl -lt 300 ]]; then  # Less than 5 minutes
        ((expiring_soon++))
    else
        ((expiring_later++))
    fi
done

echo "Keys expiring soon (<5min): $expiring_soon"
echo "Keys expiring later (>5min): $expiring_later"
echo "Persistent keys (no TTL): $persistent"

echo "\n5. Cache Efficiency Recommendations:"
HIT_RATE=$(redis-cli info stats | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
MISS_RATE=$(redis-cli info stats | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
TOTAL=$((HIT_RATE + MISS_RATE))

if [[ $TOTAL -gt 0 ]]; then
    EFFICIENCY=$(echo "scale=1; $HIT_RATE * 100 / $TOTAL" | bc)
    echo "Current hit rate: ${EFFICIENCY}%"
    
    if (( $(echo "$EFFICIENCY < 50" | bc -l) )); then
        echo "- Hit rate is low, consider:"
        echo "  * Increasing cache TTL values"
        echo "  * Implementing cache warming"
        echo "  * Reviewing cache key patterns"
    elif (( $(echo "$EFFICIENCY > 90" | bc -l) )); then
        echo "- Excellent hit rate, consider:"
        echo "  * Increasing TTL for better memory efficiency"
        echo "  * Monitoring for cache size growth"
    else
        echo "- Good hit rate, monitor for trends"
    fi
fi
```

## 🛡️ Prevention Strategies

### 1. Automated Redis Monitoring

```bash
# Add to crontab for regular monitoring
*/5 * * * * /path/to/redis-health-check.sh >> /path/to/redis-health.log 2>&1

# Daily cache analysis
0 2 * * * /path/to/analyze-redis-cache.sh > /path/to/cache-analysis-$(date +\%Y\%m\%d).log

# Alert on Redis failures
*/1 * * * * redis-cli ping > /dev/null || echo "Redis down at $(date)" | mail -s "Redis Alert" admin@company.com
```

### 2. Redis Backup Strategy

```bash
#!/bin/bash
# save as backup-redis.sh

echo "Backing up Redis data..."

# Create backup directory
mkdir -p backups/redis/$(date +%Y%m%d)

# For RDB persistence
if [[ -f /var/lib/redis/dump.rdb ]]; then
    cp /var/lib/redis/dump.rdb backups/redis/$(date +%Y%m%d)/
    echo "RDB backup completed"
fi

# For AOF persistence
if [[ -f /var/lib/redis/appendonly.aof ]]; then
    cp /var/lib/redis/appendonly.aof backups/redis/$(date +%Y%m%d)/
    echo "AOF backup completed"
fi

# For Docker volumes
if command -v docker-compose &> /dev/null; then
    docker run --rm -v gdrive_redis-data:/data -v $(pwd)/backups/redis/$(date +%Y%m%d):/backup alpine tar -czf /backup/redis-data.tar.gz -C /data .
    echo "Docker volume backup completed"
fi

# Clean old backups (keep 7 days)
find backups/redis/ -type d -mtime +7 -exec rm -rf {} \;
```

### 3. Configuration Management

```bash
# Environment-specific Redis configurations

# Development (.env.dev)
REDIS_URL=redis://localhost:6379
REDIS_MAX_CONNECTIONS=5
GDRIVE_CACHE_TTL=60  # Short TTL for development

# Staging (.env.staging)
REDIS_URL=redis://redis:6379
REDIS_MAX_CONNECTIONS=10
GDRIVE_CACHE_TTL=300

# Production (.env.prod)
REDIS_URL=redis://redis-cluster:6379
REDIS_MAX_CONNECTIONS=20
GDRIVE_CACHE_TTL=1800
REDIS_ENABLE_CLUSTERING=true
REDIS_SENTINEL_ENDPOINTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
```

## 🆘 Emergency Recovery

If Redis is completely broken:

### Complete Redis Reset
```bash
#!/bin/bash
echo "Emergency Redis Recovery"
echo "======================="

# Stop Redis services
redis-cli shutdown 2>/dev/null || echo "Redis already stopped"
docker-compose stop redis 2>/dev/null || echo "No Docker Redis to stop"

# Clean Redis data (cache will rebuild)
rm -rf /var/lib/redis/* 2>/dev/null || echo "No local Redis data to clean"
docker volume rm gdrive_redis-data 2>/dev/null || echo "No Docker volume to remove"

# Remove any corrupted configuration
rm -f /etc/redis/redis.conf.bak

# Restart Redis
if command -v docker-compose &> /dev/null; then
    echo "Starting Redis with Docker..."
    docker-compose up -d redis
    
    # Wait for Redis to start
    sleep 5
    
    # Test connection
    docker-compose exec redis redis-cli ping
else
    echo "Starting local Redis..."
    redis-server --daemonize yes
    
    # Wait for Redis to start
    sleep 3
    
    # Test connection
    redis-cli ping
fi

# Verify recovery
echo "\nVerifying Redis recovery..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis recovered successfully"
    echo "Cache will rebuild automatically as requests are made"
else
    echo "❌ Redis recovery failed"
    echo "Check logs and configuration"
fi
```

### Restore from Backup
```bash
#!/bin/bash
# If you have Redis backups

echo "Restoring Redis from backup..."

# Stop Redis
redis-cli shutdown

# Find latest backup
LATEST_BACKUP=$(find backups/redis/ -name "dump.rdb" -o -name "redis-data.tar.gz" | sort | tail -1)

if [[ -n "$LATEST_BACKUP" ]]; then
    echo "Restoring from: $LATEST_BACKUP"
    
    if [[ $LATEST_BACKUP == *.tar.gz ]]; then
        # Docker volume restore
        docker run --rm -v gdrive_redis-data:/data -v $(dirname $LATEST_BACKUP):/backup alpine sh -c "cd /data && tar -xzf /backup/$(basename $LATEST_BACKUP)"
    else
        # Direct RDB restore
        cp "$LATEST_BACKUP" /var/lib/redis/dump.rdb
        chown redis:redis /var/lib/redis/dump.rdb
    fi
    
    # Start Redis
    redis-server --daemonize yes
    
    echo "Restore completed"
else
    echo "No backup found"
fi
```

---

For specific Redis error messages, see the [Error Messages Reference](./error-messages.md).