# Story 3: Testing and Documentation

## Story
**As a** developer,  
**I want** comprehensive tests and clear documentation,  
**so that** the new key system is reliable and maintainable.

## Acceptance Criteria
1. Unit tests achieve 90% coverage for KeyRotationManager and updated TokenManager
2. Integration tests verify complete migration and rotation workflows
3. Security tests validate PBKDF2 parameters and memory clearing
4. Performance tests confirm rotation completes < 30 seconds for 100 tokens
5. README updated with migration instructions and new key management section
6. API documentation reflects new TokenManager interface
7. Operations runbook includes key rotation procedures
8. All legacy compatibility code and tests removed from codebase

## Integration Verification
- IV1: CI/CD pipeline passes with new test suite
- IV2: Documentation examples work as written
- IV3: No references to legacy format remain in codebase

## Test Coverage Requirements

### Unit Tests (src/__tests__/auth/)
```typescript
// KeyRotationManager.test.ts
describe('KeyRotationManager', () => {
  test('generates keys with proper entropy');
  test('derives keys using PBKDF2 with correct iterations');
  test('stores and retrieves keys correctly');
  test('enforces singleton pattern');
  test('handles concurrent rotation requests');
});

// TokenManager.test.ts  
describe('TokenManager (Versioned)', () => {
  test('encrypts tokens with version metadata');
  test('decrypts versioned tokens correctly');
  test('rejects tokens with invalid versions');
  test('performs within 5% of baseline performance');
  test('clears memory after operations');
});
```

### Integration Tests
```typescript
// migration.integration.test.ts
describe('Token Migration', () => {
  test('migrates legacy tokens to versioned format');
  test('creates backup before migration');
  test('rolls back on migration failure');
  test('prevents server start with legacy tokens');
});

// rotation.integration.test.ts
describe('Key Rotation', () => {
  test('rotates keys and re-encrypts tokens');
  test('maintains service availability during rotation');
  test('logs all rotation events');
});
```

### Security Tests
```typescript
// key-security.test.ts
describe('Security', () => {
  test('resists timing attacks on version detection');
  test('clears sensitive data from memory');
  test('validates key strength (256 bits)');
  test('enforces minimum PBKDF2 iterations');
});
```

## Documentation Updates

### README.md Additions
```markdown
## Key Rotation

### Initial Migration (Required for Existing Installations)
Before upgrading to v2.0.0, migrate your existing tokens:

\`\`\`bash
# 1. Backup existing tokens (automatic, but manual backup recommended)
cp .gdrive-mcp-tokens.json .gdrive-mcp-tokens.backup.json

# 2. Run migration script
node scripts/migrate-tokens.js

# 3. Verify migration success
node dist/index.js verify-keys
\`\`\`

### Rotating Encryption Keys
\`\`\`bash
# Generate new key and re-encrypt all tokens
node dist/index.js rotate-key

# Verify all tokens work with new key
node dist/index.js verify-keys
\`\`\`

### Environment Variables
- `GDRIVE_TOKEN_ENCRYPTION_KEY` - Base64-encoded 32-byte key (auto-generated if not set)
- `GDRIVE_KEY_DERIVATION_ITERATIONS` - PBKDF2 iterations (default: 100000)
```

### Operations Runbook Entry
```markdown
## Key Rotation Procedures

### Routine Key Rotation (Quarterly)
1. Schedule maintenance window (5 minutes expected)
2. Run `node dist/index.js rotate-key`
3. Verify with `node dist/index.js verify-keys`
4. Monitor logs for any authentication issues
5. Document rotation in security log

### Emergency Key Rotation
1. If key compromise suspected, rotate immediately
2. Run rotation command with elevated logging
3. Monitor all active sessions for anomalies
4. Consider forcing re-authentication for all users
```

## Files to Update
- `README.md` - Add key rotation section
- `docs/Guides/07-key-rotation.md` - New comprehensive guide
- `docs/Architecture/ARCHITECTURE.md` - Update security section
- Remove all legacy test files and compatibility code

## Cleanup Tasks
1. Remove old TokenManager encryption/decryption methods
2. Delete legacy token format interfaces
3. Remove backward compatibility tests
4. Update all code examples to use new format
5. Ensure no TODO comments reference legacy format