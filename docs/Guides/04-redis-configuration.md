# Redis Configuration Guide

This guide covers Redis cache configuration, optimization, monitoring, and troubleshooting for the Google Drive MCP Server.

## Prerequisites

Before configuring Redis:
- **[Initial Setup](./01-initial-setup.md)** completed
- **[Authentication Flow](./02-authentication-flow.md)** completed
- **Redis server** available (local installation or Docker)
- **Network connectivity** between MCP server and Redis

## Understanding Redis Integration

### Redis Architecture in MCP Server

```
MCP Server Request Flow with Redis:

Client Request → MCP Server → Cache Check (Redis)
                            │
                            └── Cache Hit → Return Cached Data
                            │
                            └── Cache Miss → Google API Call
                                         │
                                         └── Store in Cache → Return Data

Cache Invalidation:
Write Operations → Pattern-based Invalidation → Fresh Data on Next Request
```

### Cache Performance Benefits

- **5-minute TTL** for cached data
- **Intelligent invalidation** on write operations
- **30-50% performance improvement** for repeated operations
- **Reduced API quota usage** for Google Workspace APIs
- **Graceful fallback** when Redis is unavailable

## Step 1: Redis Installation Options

### Option 1: Docker Redis (Recommended)

```bash
# Using Docker Compose (included in project)
docker-compose up -d redis

# Verify Redis container is running
docker-compose ps redis

# Test Redis connectivity
docker-compose exec redis redis-cli ping
# Expected output: PONG
```

### Option 2: Local Redis Installation

**macOS (using Homebrew):**
```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Test connection
redis-cli ping
# Expected output: PONG

# Configure to start on boot
brew services enable redis
```

**Ubuntu/Debian:**
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli ping
# Expected output: PONG

# Check status
sudo systemctl status redis-server
```

**CentOS/RHEL:**
```bash
# Install EPEL repository
sudo yum install epel-release

# Install Redis
sudo yum install redis

# Start Redis service
sudo systemctl start redis
sudo systemctl enable redis

# Test connection
redis-cli ping
```

### Option 3: Cloud Redis Services

**Redis Cloud:**
```bash
# Get connection details from Redis Cloud dashboard
# Update .env file with cloud Redis URL
echo "REDIS_URL=redis://username:password@host:port" >> .env
```

**AWS ElastiCache:**
```bash
# Use ElastiCache endpoint
echo "REDIS_URL=redis://your-cluster.cache.amazonaws.com:6379" >> .env
```

**Google Cloud Memorystore:**
```bash
# Use Memorystore IP address
echo "REDIS_URL=redis://10.0.0.1:6379" >> .env
```

## Step 2: Redis Configuration

### 2.1 Environment Configuration

```bash
# Add Redis configuration to .env file
cat >> .env << EOF

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TTL=300                    # 5 minutes default TTL
REDIS_MAX_RETRIES=3              # Connection retry attempts
REDIS_RETRY_DELAY=1000           # Retry delay in milliseconds
REDIS_CONNECT_TIMEOUT=5000       # Connection timeout
REDIS_COMMAND_TIMEOUT=3000       # Command timeout
REDIS_DB=0                       # Redis database number

# Cache Configuration
CACHE_ENABLED=true               # Enable/disable caching
CACHE_PREFIX=gdrive_mcp          # Cache key prefix
CACHE_COMPRESSION=true           # Enable data compression
EOF

# Verify configuration
source .env
echo "Redis URL: $REDIS_URL"
```

### 2.2 Redis Server Configuration

**Local Redis Configuration (`/etc/redis/redis.conf`):**

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Key settings for MCP server:
# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence (optional for cache)
save ""
# save 900 1    # Uncomment for persistence

# Network
bind 127.0.0.1
port 6379
timeout 300

# Security
requirepass your_secure_password  # Set if needed

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Restart Redis after configuration changes
sudo systemctl restart redis-server
```

**Docker Redis Configuration:**

```yaml
# Add to docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: gdrive-mcp-redis
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf  # Optional custom config
    ports:
      - "6379:6379"  # Expose port if needed
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 3s
      retries: 3
    restart: unless-stopped

volumes:
  redis_data:

networks:
  mcp-network:
    driver: bridge
```

### 2.3 MCP Server Cache Configuration

The MCP server automatically configures caching based on environment variables:

```typescript
// Cache configuration is handled automatically
// Key cache patterns:

// File searches: search:{query_hash}
// File reads: read:{file_id}
// Sheet data: sheet:{spreadsheet_id}:{range}
// Resource lists: resources:{page_token}
// Apps Script: script:{script_id}
```

## Step 3: Cache Performance Optimization

### 3.1 Memory Optimization

```bash
# Monitor Redis memory usage
redis-cli INFO memory

# Key metrics to monitor:
# used_memory_human: Current memory usage
# used_memory_peak_human: Peak memory usage
# maxmemory_human: Memory limit
# mem_fragmentation_ratio: Memory fragmentation

# Set optimal memory limits
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Monitor memory efficiency
watch -n 5 "redis-cli INFO memory | grep -E '(used_memory_human|mem_fragmentation_ratio)'"
```

### 3.2 Performance Tuning

```bash
# Optimize Redis for MCP server workload
redis-cli CONFIG SET save ""
# Disable persistence for pure cache use

redis-cli CONFIG SET timeout 300
# Connection timeout

redis-cli CONFIG SET tcp-keepalive 60
# TCP keepalive

redis-cli CONFIG SET hz 10
# Background task frequency

# Monitor slow queries
redis-cli SLOWLOG GET 10

# Monitor client connections
redis-cli CLIENT LIST
```

### 3.3 Cache Hit Ratio Optimization

```bash
# Monitor cache statistics
watch -n 10 "redis-cli INFO stats | grep -E '(hits|misses|expired_keys)'"

# Calculate hit ratio
redis-cli INFO stats | awk '/keyspace_hits|keyspace_misses/ {hits+=$2} /keyspace_misses/ {misses=$2} END {print "Hit Ratio:", hits/(hits+misses)*100"%"}'

# Monitor key patterns
redis-cli --scan --pattern "*" | head -20

# Analyze TTL distribution
redis-cli --scan --pattern "*" | head -10 | while read key; do echo "$key: $(redis-cli TTL $key)s"; done
```

## Step 4: Monitoring and Maintenance

### 4.1 Real-time Monitoring

```bash
# Monitor Redis in real-time
redis-cli MONITOR
# Shows all commands as they happen

# Monitor specific operations
redis-cli MONITOR | grep -E "(GET|SET|DEL)"

# Monitor MCP server cache operations
docker-compose logs -f gdrive-mcp | grep -i cache

# Performance statistics
watch -n 30 "redis-cli INFO stats | grep -E '(operations_per_sec|hits|misses)'"
```

### 4.2 Cache Analysis

```bash
# Analyze cache contents
echo "Cache Key Analysis:"
echo "=================="
redis-cli --scan --pattern "search:*" | wc -l | xargs echo "Search cache entries:"
redis-cli --scan --pattern "read:*" | wc -l | xargs echo "File read cache entries:"
redis-cli --scan --pattern "sheet:*" | wc -l | xargs echo "Sheet cache entries:"
redis-cli --scan --pattern "resources:*" | wc -l | xargs echo "Resource cache entries:"

# Check cache sizes
redis-cli --scan --pattern "*" | head -10 | while read key; do 
  size=$(redis-cli MEMORY USAGE $key 2>/dev/null || echo "N/A")
  echo "$key: $size bytes"
done

# TTL analysis
echo "TTL Distribution:"
redis-cli --scan --pattern "*" | head -20 | while read key; do
  ttl=$(redis-cli TTL $key)
  echo "$key: ${ttl}s"
done | sort -k2 -n
```

### 4.3 Performance Metrics Collection

```bash
# Create performance monitoring script
cat > monitor_redis.sh << 'EOF'
#!/bin/bash

echo "Redis Performance Report - $(date)"
echo "========================================"

# Memory usage
echo "Memory Usage:"
redis-cli INFO memory | grep -E "(used_memory_human|maxmemory_human|mem_fragmentation_ratio)"
echo

# Hit/Miss statistics
echo "Cache Statistics:"
stats=$(redis-cli INFO stats)
hits=$(echo "$stats" | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
misses=$(echo "$stats" | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
total=$((hits + misses))
if [ $total -gt 0 ]; then
  hit_ratio=$(echo "scale=2; $hits * 100 / $total" | bc)
  echo "Hit Ratio: ${hit_ratio}%"
  echo "Total Operations: $total"
  echo "Hits: $hits"
  echo "Misses: $misses"
else
  echo "No cache operations yet"
fi
echo

# Connection info
echo "Connections:"
redis-cli INFO clients | grep -E "(connected_clients|blocked_clients)"
echo

# Key count
echo "Key Statistics:"
redis-cli INFO keyspace
echo "Total Keys: $(redis-cli DBSIZE)"
EOF

chmod +x monitor_redis.sh

# Run monitoring
./monitor_redis.sh

# Schedule regular monitoring
echo "0 */6 * * * /path/to/monitor_redis.sh >> /path/to/redis_performance.log" | crontab -
```

## Step 5: Cache Management

### 5.1 Cache Invalidation

The MCP server automatically invalidates cache on write operations:

```bash
# Monitor cache invalidation
docker-compose logs gdrive-mcp | grep -i "cache.*invalid"

# Manual cache invalidation (if needed)
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 "search:*"

# Clear specific cache patterns
redis-cli DEL $(redis-cli KEYS "read:1abc*")
redis-cli DEL $(redis-cli KEYS "sheet:1def*")

# Clear all cache (emergency)
redis-cli FLUSHDB
```

### 5.2 Cache Warming

```bash
# Create cache warming script
cat > warm_cache.sh << 'EOF'
#!/bin/bash

echo "Warming cache with common operations..."

# Warm up with basic search
echo '{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "spreadsheet"}}}' | node dist/index.js > /dev/null

# Warm up with resource listing
echo '{"method": "resources/list"}' | node dist/index.js > /dev/null

echo "Cache warming complete"
EOF

chmod +x warm_cache.sh

# Run after server startup
./warm_cache.sh
```

### 5.3 Backup and Recovery

```bash
# Backup Redis data (if persistence enabled)
redis-cli BGSAVE

# Export keys and values (for cache analysis)
redis-cli --scan --pattern "*" | while read key; do
  echo "$key -> $(redis-cli GET $key | head -c 100)..."
done > redis_cache_snapshot.txt

# Restore from RDB file (if using persistence)
# Stop Redis, replace dump.rdb, start Redis
sudo systemctl stop redis-server
sudo cp backup.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb
sudo systemctl start redis-server
```

## Step 6: Troubleshooting Redis Issues

### Issue: "Redis connection refused"

**Symptoms:**
- MCP server logs show Redis connection errors
- Cache functionality not working
- "Connection refused" errors

**Solutions:**
```bash
# Check Redis server status
redis-cli ping
# Should return PONG

# Check Redis service status
sudo systemctl status redis-server
# or for Docker:
docker-compose ps redis

# Check Redis configuration
redis-cli CONFIG GET port
redis-cli CONFIG GET bind

# Verify network connectivity
telnet localhost 6379
# or:
nc -zv localhost 6379

# Check firewall rules
sudo ufw status
sudo iptables -L

# Restart Redis service
sudo systemctl restart redis-server
# or for Docker:
docker-compose restart redis
```

### Issue: "Authentication failed"

**Symptoms:**
- "NOAUTH Authentication required" errors
- Redis connects but commands fail

**Solutions:**
```bash
# Check if Redis password is configured
redis-cli CONFIG GET requirepass

# Update Redis URL with password
echo "REDIS_URL=redis://:password@localhost:6379" > .env

# Or disable authentication (development only)
redis-cli CONFIG SET requirepass ""

# Test authentication
redis-cli -a your_password ping
```

### Issue: "High memory usage"

**Symptoms:**
- Redis memory usage constantly increasing
- System running out of memory
- Slow cache operations

**Solutions:**
```bash
# Check current memory usage
redis-cli INFO memory

# Set memory limit
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Clear cache if needed
redis-cli FLUSHDB

# Monitor key expiration
redis-cli INFO keyspace
watch -n 5 "redis-cli DBSIZE"

# Check for keys without TTL
redis-cli --scan --pattern "*" | while read key; do
  ttl=$(redis-cli TTL $key)
  if [ $ttl -eq -1 ]; then
    echo "No TTL: $key"
  fi
done
```

### Issue: "Low cache hit ratio"

**Symptoms:**
- Cache hit ratio below 50%
- Slow API response times
- High Google API usage

**Solutions:**
```bash
# Analyze cache patterns
redis-cli INFO stats | grep -E "(hits|misses)"

# Check TTL settings
redis-cli --scan --pattern "*" | head -10 | while read key; do
  echo "$key: $(redis-cli TTL $key)s"
done

# Increase TTL for stable data
# This is configured in the MCP server code
# Consider contributing to increase TTL for stable resources

# Warm cache with common operations
./warm_cache.sh

# Monitor invalidation patterns
docker-compose logs gdrive-mcp | grep -i "cache.*invalid" | tail -20
```

### Issue: "Redis server crashes"

**Symptoms:**
- Redis service stops unexpectedly
- Connection lost errors
- Cache completely unavailable

**Solutions:**
```bash
# Check Redis logs
sudo journalctl -u redis-server -f
# or for Docker:
docker-compose logs redis

# Check system resources
free -h
df -h

# Check Redis configuration
redis-cli CONFIG GET "*" | grep -E "(maxmemory|maxclients)"

# Reduce memory usage
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Restart with clean state
sudo systemctl restart redis-server
# or:
docker-compose restart redis

# Monitor for stability
watch -n 10 "redis-cli ping"
```

### Issue: "Slow cache operations"

**Symptoms:**
- Redis operations taking too long
- High command processing time
- Timeouts in MCP server

**Solutions:**
```bash
# Check slow log
redis-cli SLOWLOG GET 10

# Monitor latency
redis-cli --latency

# Check memory fragmentation
redis-cli INFO memory | grep mem_fragmentation_ratio

# Restart Redis to defragment
sudo systemctl restart redis-server

# Optimize configuration
redis-cli CONFIG SET hz 10
redis-cli CONFIG SET tcp-keepalive 60

# Monitor network latency
ping -c 10 localhost
```

## Advanced Redis Configurations

### Redis Clustering (High Availability)

```bash
# Redis Cluster configuration
# Create multiple Redis instances
for port in 7000 7001 7002 7003 7004 7005; do
  mkdir cluster-$port
  cat > cluster-$port/redis.conf << EOF
port $port
cluster-enabled yes
cluster-config-file nodes-$port.conf
cluster-node-timeout 5000
appendonly yes
dir ./cluster-$port
EOF
done

# Start cluster instances
for port in 7000 7001 7002 7003 7004 7005; do
  redis-server cluster-$port/redis.conf &
done

# Create cluster
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 --cluster-replicas 1

# Update MCP server configuration
echo "REDIS_URL=redis://localhost:7000" >> .env
```

### Redis Sentinel (Failover)

```bash
# Sentinel configuration
cat > sentinel.conf << EOF
port 26379
sentinel monitor mymaster 127.0.0.1 6379 1
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1
EOF

# Start Sentinel
redis-sentinel sentinel.conf &

# Update MCP server for Sentinel
echo "REDIS_URL=redis-sentinel://localhost:26379/mymaster" >> .env
```

### Redis with TLS/SSL

```bash
# Generate certificates
openssl req -x509 -newkey rsa:4096 -keyout redis.key -out redis.crt -days 365 -nodes

# Configure Redis with TLS
cat >> redis.conf << EOF
port 0
tls-port 6380
tls-cert-file redis.crt
tls-key-file redis.key
tls-protocols "TLSv1.2 TLSv1.3"
EOF

# Update MCP server configuration
echo "REDIS_URL=rediss://localhost:6380" >> .env
echo "REDIS_TLS_CERT_FILE=redis.crt" >> .env
echo "REDIS_TLS_KEY_FILE=redis.key" >> .env
```

## Performance Benchmarking

### Redis Benchmark Testing

```bash
# Basic performance test
redis-benchmark -h localhost -p 6379 -n 10000 -d 1000

# Test specific operations used by MCP server
redis-benchmark -h localhost -p 6379 -t get,set,del -n 10000 -d 1000

# Test with pipeline
redis-benchmark -h localhost -p 6379 -n 10000 -P 16

# Test memory usage patterns
redis-benchmark -h localhost -p 6379 -t set -n 100000 -d 10000

# Monitor during benchmark
watch -n 1 "redis-cli INFO memory | grep used_memory_human"
```

### MCP Server Cache Performance Testing

```bash
# Create performance test script
cat > test_cache_performance.sh << 'EOF'
#!/bin/bash

echo "Testing MCP Server Cache Performance"
echo "==================================="

# Clear cache for baseline
redis-cli FLUSHDB

# Test 1: Cold cache (first request)
echo "Test 1: Cold cache performance"
time echo '{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "test"}}}' | node dist/index.js > /dev/null

# Test 2: Warm cache (second request)
echo "Test 2: Warm cache performance"
time echo '{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "test"}}}' | node dist/index.js > /dev/null

# Test 3: Multiple requests
echo "Test 3: Multiple requests performance"
for i in {1..10}; do
  time echo '{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "test'$i'"}}}' | node dist/index.js > /dev/null
done

# Cache statistics
echo "Final cache statistics:"
redis-cli INFO stats | grep -E "(hits|misses)"
EOF

chmod +x test_cache_performance.sh
./test_cache_performance.sh
```

## Security Considerations

### Redis Security Best Practices

```bash
# Set strong password
redis-cli CONFIG SET requirepass "$(openssl rand -base64 32)"

# Disable dangerous commands
redis-cli CONFIG SET rename-command FLUSHDB ""
redis-cli CONFIG SET rename-command FLUSHALL ""
redis-cli CONFIG SET rename-command CONFIG "CONFIG_$(openssl rand -hex 8)"

# Bind to specific interfaces
redis-cli CONFIG SET bind "127.0.0.1"

# Enable protected mode
redis-cli CONFIG SET protected-mode yes

# Disable debug and shutdown commands
redis-cli CONFIG SET rename-command DEBUG ""
redis-cli CONFIG SET rename-command SHUTDOWN "SHUTDOWN_$(openssl rand -hex 8)"
```

### Network Security

```bash
# Firewall rules (allow only MCP server)
sudo ufw allow from 172.18.0.0/24 to any port 6379
sudo ufw deny 6379

# Use Redis ACL (Redis 6+)
redis-cli ACL SETUSER mcp_user on >password ~* +@read +@write -@dangerous
redis-cli ACL DELUSER default

# Monitor connections
watch -n 5 "redis-cli CLIENT LIST"
```

## Next Steps

After Redis configuration:
1. **[Claude Desktop Integration](./05-claude-desktop-integration.md)** - Connect Claude with caching
2. **[Environment Variables Setup](./06-environment-variables.md)** - Fine-tune cache settings
3. **Production monitoring setup**
4. **Performance optimization based on usage patterns**

---

**Redis Configuration Complete!** ⚙️

Your Google Drive MCP Server now has high-performance Redis caching configured with monitoring, security, and optimization features.