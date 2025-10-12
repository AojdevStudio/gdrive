# Logging Discipline Protocol

**CRITICAL: NO console.\* STATEMENTS—EVER**

Violating these rules corrupts JSON-RPC protocols, breaks Unix pipelines, and causes production failures.

## Core Rules

1. **No `console.log`—ever.** ESLint enforced, zero exceptions
2. **stdout = results, stderr = logs**
3. **Always structured logs (NDJSON)** One JSON object per line
4. **Use levels:** `debug < info < warn < error < fatal`
5. **Attach correlation:** Include `requestId`/`traceId` on every log
6. **No secrets/PHI in logs:** Redact password, token, ssn, etc.
7. **Protocols stay pristine:** MCP stdout = protocol only

## JavaScript/TypeScript Setup

### ESLint Configuration (MANDATORY)

```json
// .eslintrc.json
{
  "rules": {
    "no-console": ["error"] // NO exceptions allowed
  }
}
```

### Pino Logger Setup

```typescript
import pino from 'pino';

const redact = {
  paths: ['password', 'token', 'authorization', 'cookie', 'ssn'],
  remove: true,
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
```

### Context-Specific Patterns

#### MCP Servers

```typescript
// stdout: JSON-RPC frames ONLY
process.stdout.write(JSON.stringify({ jsonrpc: '2.0', result }));
// stderr: ALL diagnostics
logger.info({ msg: 'server.start', port });
```

#### CLI Tools

```typescript
// Results to stdout (pipeable)
process.stdout.write(JSON.stringify(results));
// Logs to stderr
logger.info({ msg: 'processing', file });
```

## Python Setup

### Structlog Configuration

```python
import logging, sys, structlog

logging.basicConfig(
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stderr)],
    format="%(message)s",
)

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
)

log = structlog.get_logger()
```

### Usage Patterns

```python
# Results to stdout
print(json.dumps(results), file=sys.stdout)

# Logs to stderr
log.info("processing", file=filename)
```

## Violations vs Correct Patterns

### ❌ NEVER DO THIS

```javascript
console.log('Processing file:', file);  // Corrupts stdout
console.error('Debug:', data);          // Unstructured
print(f"Processing {file}")             // Python: breaks pipelines
```

### ✅ ALWAYS DO THIS

```javascript
logger.info({ msg: 'file.process', file }); // Structured to stderr
log.info('file.process', (file = file)); // Python: structured
```

## Enforcement Checklist

- [ ] ESLint/Ruff configured with no-console/no-print rules
- [ ] Logger library installed (pino/structlog)
- [ ] All console.\*/print() statements removed
- [ ] stdout used ONLY for results/protocol
- [ ] Correlation IDs on all log entries
- [ ] Sensitive data redaction configured
