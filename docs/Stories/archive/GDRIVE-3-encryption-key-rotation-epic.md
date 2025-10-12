# Epic: Encryption Key Rotation for Google Drive MCP Server

## Epic Title
**Encryption Key Rotation Enhancement - Clean Migration**

## Epic Goal
Implement a secure key rotation mechanism for the Google Drive MCP Server with versioned key management and a one-time migration path from the legacy format to the new versioned format.

## Epic Description

**Existing System Context:**
- Current functionality: TokenManager uses single static AES-256-GCM encryption key from environment variable
- Technology stack: TypeScript, Node.js crypto module, singleton pattern for TokenManager
- Integration points: TokenManager class in `src/auth/TokenManager.ts`, AuthManager for token lifecycle, audit logging system

**Enhancement Details:**
- What's being added: Versioned key storage format, PBKDF2 key derivation, CLI rotation commands, clean migration from legacy format
- How it integrates: Replaces TokenManager encryption/decryption with versioned approach, adds KeyRotationManager class
- Success criteria: Clean migration to new format, streamlined key rotation process, no legacy code debt

## Stories

1. **Story 1: Implement New Versioned Key System**
   - Create KeyRotationManager with versioned key storage
   - Implement PBKDF2 key derivation with secure defaults
   - Replace TokenManager encryption/decryption with new versioned approach
   - Design clean token storage format with version metadata

2. **Story 2: Migration Tool and CLI Commands**
   - Build one-time migration tool to convert legacy tokens to versioned format
   - Implement CLI commands (rotate-key, migrate-tokens, verify-keys)
   - Add clear migration instructions and validation
   - Auto-backup old tokens before migration (safety net)

3. **Story 3: Testing and Documentation**
   - Comprehensive unit and integration tests for new system
   - Security tests for key derivation and rotation
   - Update all documentation to reflect new approach
   - Remove any legacy compatibility code after migration

## Compatibility Requirements
- [x] Clean break from legacy format (no backward compatibility debt)
- [x] One-time migration path provided
- [x] Clear upgrade instructions for existing users
- [x] Performance improvements expected (simpler code path)

## Risk Mitigation
- **Primary Risk:** Existing installations need migration before upgrade
- **Mitigation:** Provide standalone migration script that can be run before upgrading, clear documentation
- **Rollback Plan:** Backup of original token file created during migration, can manually restore if needed

## Definition of Done
- [x] All stories completed with acceptance criteria met
- [x] Migration tool successfully converts legacy tokens
- [x] New key rotation system fully functional
- [x] Documentation clearly explains migration process
- [x] Legacy code completely removed

## Story Manager Handoff

**Technology Stack Context:**
- TypeScript with ES2022 target
- Node.js crypto module for encryption
- Singleton pattern (consistent with existing AuthManager/TokenManager)
- Winston logger for audit trails
- Environment variables for configuration

**Key Integration Points:**
- TokenManager at `src/auth/TokenManager.ts` - Complete replacement
- AuthManager at `src/auth/AuthManager.ts` - Update token handling calls
- Main CLI at `index.ts` - Add new commands
- Audit logging - Extend with key operation events

**Critical Requirements:**
- Migration must be atomic (all tokens or none)
- No legacy format support in production code
- Performance target: < 30 seconds for 100 token rotation
- Security: PBKDF2 with 100,000+ iterations minimum