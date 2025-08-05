# Story 2: Migration Tool and CLI Commands

## Story
**As a** system operator,  
**I want** a migration tool and CLI commands for key management,  
**so that** I can safely migrate existing tokens and rotate keys on demand.

## Acceptance Criteria
1. Standalone migration script (`scripts/migrate-tokens.ts`) converts legacy tokens
2. Migration creates automatic backup in `.backup/` directory with timestamp
3. CLI command `rotate-key` generates new key and re-encrypts all tokens
4. CLI command `migrate-tokens` performs one-time migration from legacy format
5. CLI command `verify-keys` validates all tokens can be decrypted
6. Clear console output shows migration progress and results
7. Migration failures are atomic - all or nothing approach
8. Post-migration cleanup removes old token files after verification

## Integration Verification
- IV1: Migration script runs independently before server upgrade
- IV2: Server refuses to start if legacy tokens detected (forces migration)
- IV3: Audit log captures complete migration history

## Migration Flow
```bash
# Step 1: Run migration (before upgrading server)
$ node scripts/migrate-tokens.js
> Backing up tokens to .backup/tokens-2024-01-15T10-30-00.json
> Migrating 1 token(s) to versioned format...
> ✓ Migration complete. Tokens saved to .gdrive-mcp-tokens.json
> ✓ Backup available at .backup/tokens-2024-01-15T10-30-00.json

# Step 2: Verify migration
$ node dist/index.js verify-keys
> ✓ All tokens successfully verified with current key

# Step 3: Normal operation with rotation capability
$ node dist/index.js rotate-key
> Generating new encryption key (v2)...
> Re-encrypting 1 token(s)...
> ✓ Key rotation complete
```

## Files to Create
- `scripts/migrate-tokens.ts` - Standalone migration script
- `src/cli/KeyRotationCLI.ts` - CLI command implementations

## Files to Modify
- `index.ts` - Add new CLI commands (rotate-key, migrate-tokens, verify-keys)
- `package.json` - Add migration script to scripts section

## Implementation Notes

### Migration Script Requirements
1. Load legacy tokens using old decryption method
2. Create timestamped backup in `.backup/` directory
3. Convert to new versioned format with PBKDF2 derivation
4. Write new format to standard token location
5. Verify all tokens decrypt successfully
6. Only delete old file after successful verification

### CLI Command Implementation
```typescript
// In index.ts
if (args[0] === 'rotate-key') {
  const keyRotationManager = KeyRotationManager.getInstance();
  await keyRotationManager.rotateKey();
  console.log('✓ Key rotation complete');
  process.exit(0);
}

if (args[0] === 'migrate-tokens') {
  // Migration logic
}

if (args[0] === 'verify-keys') {
  // Verification logic
}
```

### Error Handling
- Atomic transactions: Use temporary files and rename on success
- Clear error messages for common issues (file permissions, missing tokens)
- Rollback capability if any token fails migration
- Detailed logging of each migration step

## Testing Requirements
- Integration test for complete migration workflow
- Test migration with corrupted tokens (should fail atomically)
- Test backup creation and restoration
- Test CLI commands with various scenarios
- Verify server startup prevention with legacy tokens