# [FEATURE] Encryption Key Rotation Mechanism for Google Drive MCP Server

## Metadata
- **Priority:** High
- **Status:** Backlog
- **Assignee:** AI Agent
- **Estimate:** 13 Story Points
- **Issue ID:** GDRIVE-3
- **Labels:** 
  - type:feature
  - priority:high
  - agent-ready
  - security
  - infrastructure

## Problem Statement

### What
Implement a comprehensive encryption key rotation mechanism for the Google Drive MCP Server to enable secure management and rotation of the encryption keys used to protect stored OAuth tokens and sensitive data.

### Why
The current TokenManager uses a single, static encryption key (`GDRIVE_TOKEN_ENCRYPTION_KEY`) that cannot be rotated without losing access to previously encrypted tokens. This creates several security risks:

1. **Key Compromise Risk**: If the encryption key is compromised, all stored tokens are at risk and there's no secure way to rotate to a new key
2. **Operational Risk**: Token re-encryption requires manual intervention and potential service downtime
3. **Compliance Gap**: Many security frameworks require regular key rotation as a security best practice
4. **Recovery Challenges**: No mechanism exists to migrate from one key to another while maintaining backward compatibility

### Context
The Google Drive MCP Server stores sensitive OAuth tokens using AES-256-GCM encryption through the `TokenManager` class. The current implementation requires a 32-byte base64-encoded key provided via environment variable. The system handles token encryption/decryption, audit logging, and automatic cleanup on invalid grants, but lacks key versioning and rotation capabilities.

## Acceptance Criteria

- [ ] **AC1:** Support versioned key storage format that maintains backward compatibility with existing encrypted tokens
- [ ] **AC2:** Implement CLI command `rotate-key` that generates new encryption keys and re-encrypts existing tokens automatically
- [ ] **AC3:** Enable multiple encryption keys to coexist, allowing gradual migration from old to new keys
- [ ] **AC4:** Maintain audit trail of key rotation events with timestamps and success/failure status
- [ ] **AC5:** Provide secure key derivation using PBKDF2 with configurable salt and iteration count for enhanced security
- [ ] **AC6:** Implement automatic detection and handling of tokens encrypted with different key versions
- [ ] **AC7:** Support emergency key rotation scenarios with validation and rollback capabilities

## Technical Requirements

### Implementation Notes

**Core Architecture Pattern:**
- Extend existing `TokenManager` class with versioned key support
- Implement `KeyRotationManager` class following singleton pattern similar to `TokenManager`
- Use semantic versioning for key versions (v1, v2, etc.) with metadata storage
- Maintain backward compatibility with existing token storage format

**Key Storage Format Enhancement:**
```typescript
interface VersionedTokenStorage {
  version: string;           // Key version (e.g., "v1", "v2")
  algorithm: string;         // "aes-256-gcm"
  keyDerivation?: {          // Optional for enhanced security
    method: "pbkdf2";
    iterations: number;
    salt: string;
  };
  data: string;              // Existing encrypted format: iv:authTag:encryptedData
  rotatedAt?: string;        // ISO timestamp of key rotation
  previousVersion?: string;  // Track rotation chain
}
```

**Integration Points:**
- Extend `TokenManager.encrypt()` and `decrypt()` methods to handle versioned keys
- Modify `AuthManager` to be aware of key rotation events
- Add key rotation CLI commands to main index.ts entry point
- Integrate with existing audit logging system

**Security Considerations:**
- Use PBKDF2 with minimum 100,000 iterations for key derivation
- Generate cryptographically secure random salts for each key version
- Implement secure memory clearing for old keys during rotation
- Add timing attack prevention for key version detection

**Performance Requirements:**
- Key rotation should complete within 30 seconds for standard token volumes
- Decryption performance should not degrade more than 10% with multiple key versions
- Memory usage should not exceed 50MB during key rotation process

### Testing Requirements
- [ ] **Unit Tests** - Framework: Jest, Coverage: 90%, Location: `src/__tests__/key-rotation/`
  - Test key generation with PBKDF2 derivation
  - Test versioned encryption/decryption with multiple keys
  - Test backward compatibility with existing token format
  - Test key rotation process with mock tokens
  - Test error handling for corrupted keys and invalid versions
- [ ] **Integration Tests** - Framework: Jest, Location: `src/__tests__/integration/`
  - Test CLI key rotation command end-to-end
  - Test token re-encryption across key versions
  - Test audit logging during key rotation
  - Test rollback scenarios and error recovery
- [ ] **Security Tests** - Framework: Jest, Location: `src/__tests__/security/`
  - Test key derivation with different iteration counts
  - Test secure memory clearing
  - Test protection against timing attacks
  - Test encryption strength validation

### Dependencies
- **Blockers:** None
- **Related:** GDRIVE-1 (Enhanced Authentication), GDRIVE-2 (Security Audit)
- **Files to Modify:** 
  - `src/auth/TokenManager.ts` - Add versioned key support
  - `index.ts` - Add CLI rotation commands
  - `src/auth/AuthManager.ts` - Key rotation awareness
  - `package.json` - Add CLI commands
- **Files to Create:**
  - `src/auth/KeyRotationManager.ts` - Main key rotation logic
  - `src/auth/KeyDerivation.ts` - PBKDF2 key derivation utilities
  - `src/cli/KeyRotationCLI.ts` - CLI command implementation
  - `scripts/rotate-key.ts` - Standalone rotation script

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Tests written and passing (per testing requirements)
- [ ] Security review completed by security team
- [ ] Documentation updated (API docs, user guides, operations runbook)
- [ ] Deployed to staging environment
- [ ] Manual verification completed with real token rotation
- [ ] Backward compatibility verified with existing installations

## Agent Context

### Reference Materials
- Node.js Crypto API documentation: https://nodejs.org/api/crypto.html
- PBKDF2 specification: RFC 2898
- AES-GCM encryption best practices: NIST SP 800-38D
- Token rotation security patterns: OAuth 2.0 Security Best Practices (RFC 8693)
- Existing codebase patterns from `TokenManager.ts` and `AuthManager.ts`

### Key Security Libraries and Patterns
Based on Context7 research, the implementation should leverage:

```typescript
// PBKDF2 Key Derivation (Node.js crypto)
import { pbkdf2Sync, randomBytes } from 'crypto';

// AES-256-GCM Encryption Pattern
const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

// Key Wrapping for Additional Security
const wrappedKey = crypto.subtle.wrapKey('raw', key, wrappingKey, 'AES-KW');
```

### Integration Points
- **Database Schema:** Extend token storage format to include version metadata
- **CLI Interface:** Add `rotate-key`, `list-keys`, `verify-rotation` commands
- **Audit System:** Extend existing audit logging with key rotation events
- **Environment Variables:** 
  - `GDRIVE_KEY_ROTATION_ENABLED` - Enable/disable key rotation
  - `GDRIVE_KEY_DERIVATION_ITERATIONS` - PBKDF2 iteration count (default: 100000)
  - `GDRIVE_MASTER_KEY_PATH` - Optional master key file location

## Validation Steps

### Automated Verification
- [ ] Build pipeline passes with new key rotation modules
- [ ] All unit tests green (target: 90% coverage)
- [ ] Integration tests pass for CLI commands and token migration
- [ ] Security tests validate key derivation and memory clearing
- [ ] Linting passes with TypeScript strict mode
- [ ] Memory leak tests pass during key rotation

### Manual Verification
1. **Key Generation Testing:** Verify CLI can generate new keys with proper entropy and derivation
2. **Backward Compatibility:** Confirm existing tokens decrypt successfully after adding key versioning
3. **Rotation Process:** Execute full key rotation with test tokens and verify success
4. **Emergency Scenarios:** Test rollback capabilities and error recovery processes
5. **Performance Validation:** Measure rotation time and memory usage with realistic token volumes
6. **Audit Trail:** Verify all key rotation events are properly logged with required metadata

## Agent Execution Record

### Branch Strategy
- **Name Format:** feature/GDRIVE-3-encryption-key-rotation
- **Linear Integration:** feature/GDRIVE-3-encryption-key-rotation

### PR Strategy
Link to this issue using: "Fixes GDRIVE-3" in PR description

### Implementation Approach

**Phase 1: Core Key Management Infrastructure**
1. Create `KeyRotationManager` with versioned key storage
2. Implement PBKDF2-based key derivation with configurable parameters
3. Extend `TokenManager` to support multiple key versions

**Phase 2: Token Migration System**
1. Implement automatic detection of token encryption versions
2. Build re-encryption process for migrating tokens to new keys
3. Add backward compatibility layer for existing token format

**Phase 3: CLI Integration**
1. Create CLI commands for key rotation operations
2. Implement validation and rollback mechanisms
3. Add comprehensive error handling and user feedback

**Phase 4: Security Hardening**
1. Implement secure memory clearing and timing attack prevention
2. Add comprehensive audit logging for all key operations
3. Implement emergency rotation procedures

### Security Implementation Details

**Key Derivation Pattern:**
```typescript
// Enhanced PBKDF2 implementation with secure defaults
const salt = randomBytes(32);
const iterations = process.env.GDRIVE_KEY_DERIVATION_ITERATIONS || 100000;
const derivedKey = pbkdf2Sync(masterPassword, salt, iterations, 32, 'sha256');
```

**Versioned Storage Format:**
```typescript
// Backward-compatible storage format
const versionedData = {
  version: 'v2',
  algorithm: 'aes-256-gcm',
  keyDerivation: {
    method: 'pbkdf2',
    iterations: 100000,
    salt: salt.toString('hex')
  },
  data: encryptedTokenData,
  rotatedAt: new Date().toISOString()
};
```

### PR Integration
- **Linear Magic Words:** Fixes GDRIVE-3
- **Auto Close Trigger:** PR merge to main branch
- **Status Automation:** Issue will auto-move from 'In Progress' to 'Done'

### Debug References
- Key rotation audit logs: `~/.gdrive-mcp-audit.log`
- Performance metrics: Memory usage and timing data during rotation
- Error handling: Comprehensive error logging for rotation failures

### Change Log
[Track changes made during implementation]

## Bot Automation Integration

### Branch Naming for Auto-Linking
- feature/GDRIVE-3-encryption-key-rotation

### PR Description Template
```markdown
## Description
Implements comprehensive encryption key rotation mechanism for Google Drive MCP Server

**Linked Issues:**
- Fixes GDRIVE-3

## Security Features
- Versioned key storage with backward compatibility
- PBKDF2 key derivation with configurable iterations
- Automatic token re-encryption during rotation
- Comprehensive audit logging
- Emergency rollback capabilities

## Testing
- [ ] Unit tests pass (90% coverage target)
- [ ] Integration tests pass
- [ ] Security tests validate key derivation
- [ ] Manual key rotation tested
- [ ] Backward compatibility verified
```