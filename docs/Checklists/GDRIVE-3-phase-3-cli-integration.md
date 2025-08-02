# Phase 3: CLI Integration

**Duration:** Days 3-4  
**Priority:** High  
**Dependencies:** Phase 2 Complete

## Overview

This phase provides user-friendly CLI commands for managing encryption key rotation. Focus on clear feedback, safety checks, and operational excellence.

## Pre-Phase Checklist

- [ ] Verify Phase 2 migration system is working
- [ ] Review existing CLI command structure
- [ ] Plan user interaction flows
- [ ] Design error messages and help text

## Implementation Tasks

### CLI Development

- [ ] Create `src/cli/KeyRotationCLI.ts` with command implementations
  - [ ] Implement `rotate-key` command with progress indicators
  - [ ] Add `list-keys` command showing version info and metadata
  - [ ] Add `verify-rotation` command for post-rotation validation
  - [ ] Add `rollback-key` command for emergency scenarios
  - [ ] Implement interactive prompts for destructive operations

### Main Application Integration

- [ ] Modify `index.ts` to add CLI command routing
  - [ ] Add argument parsing for key rotation commands
  - [ ] Integrate with existing authentication flow
  - [ ] Add help text and usage examples
  - [ ] Implement graceful error handling and user feedback

### Script Development

- [ ] Create `scripts/rotate-key.ts` as standalone rotation utility
- [ ] Add environment variable validation
- [ ] Implement comprehensive error reporting
- [ ] Add dry-run mode for testing rotations

### User Experience

- [ ] Design clear progress indicators for long operations
- [ ] Add confirmation prompts for destructive actions
- [ ] Implement verbose mode for debugging
- [ ] Create informative error messages with recovery steps

## Testing Requirements

### CLI Tests

- [ ] Test all command variations and flags
- [ ] Test error handling for invalid inputs
- [ ] Test interruption handling (Ctrl+C)
- [ ] Test help text accuracy
- [ ] Test dry-run mode functionality

### End-to-End Tests

- [ ] Test complete key rotation workflow
- [ ] Test rollback scenarios
- [ ] Test concurrent CLI usage
- [ ] Test with various token volumes

## Documentation

- [ ] Update README with CLI usage examples
- [ ] Document all command options
- [ ] Add troubleshooting guide
- [ ] Create operational runbook

## Phase Completion Criteria

- [ ] All CLI commands functional
- [ ] Help text comprehensive and accurate
- [ ] Error messages helpful and actionable
- [ ] Dry-run mode prevents accidental operations
- [ ] Progress feedback clear for long operations

## Handoff to Phase 4

Upon completion, Phase 4 will add additional security hardening, audit logging, and compliance features to the key rotation system.