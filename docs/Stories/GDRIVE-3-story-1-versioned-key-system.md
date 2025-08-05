# Story 1: Implement New Versioned Key System

## Story
**As a** system administrator,  
**I want** a versioned key system with secure key derivation,  
**so that** I can rotate encryption keys without accumulating technical debt.

## Acceptance Criteria
1. KeyRotationManager implements singleton pattern consistent with existing codebase
2. PBKDF2 key derivation uses minimum 100,000 iterations with 32-byte salt
3. New token storage format includes version, algorithm, and key metadata
4. TokenManager completely replaced with versioned encryption/decryption
5. Environment variables support multiple key configurations
6. Audit logging captures all key operations with appropriate metadata
7. No legacy code paths remain in the encryption/decryption flow

## Integration Verification
- IV1: Newly encrypted tokens use versioned format exclusively
- IV2: AuthManager continues to function with new TokenManager implementation
- IV3: Performance metrics show < 5% overhead for PBKDF2 derivation

## Technical Details

### New Versioned Token Format
```typescript
interface VersionedTokenStorage {
  version: string;           // "v1", "v2", etc.
  algorithm: string;         // "aes-256-gcm"
  keyDerivation: {
    method: "pbkdf2";
    iterations: number;
    salt: string;
  };
  data: string;              // iv:authTag:encryptedData
  createdAt: string;         // ISO timestamp
  keyId: string;             // Reference to current key
}
```

### Files to Create
- `src/auth/KeyRotationManager.ts` - Main key rotation logic with singleton pattern
- `src/auth/KeyDerivation.ts` - PBKDF2 utilities and secure key generation

### Files to Modify
- `src/auth/TokenManager.ts` - Complete replacement with versioned approach
- `src/auth/AuthManager.ts` - Update token handling method calls
- `.env.example` - Add new key rotation environment variables

### Implementation Notes
1. Use `crypto.pbkdf2Sync()` for key derivation with SHA-256
2. Generate cryptographically secure salts using `crypto.randomBytes(32)`
3. Store key metadata separately from encrypted data for easier rotation
4. Implement timing-safe comparison for version checking
5. Clear sensitive data from memory after use

### Testing Requirements
- Unit tests in `src/__tests__/auth/KeyRotationManager.test.ts`
- Unit tests in `src/__tests__/auth/TokenManager.test.ts`
- Performance benchmarks to verify < 5% overhead
- Security tests for timing attack resistance