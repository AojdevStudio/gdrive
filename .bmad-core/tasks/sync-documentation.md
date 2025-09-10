# Sync Documentation Task

## Purpose
Trigger the doc-curator agent to synchronize all project documentation with recent code changes, ensuring documentation remains current and comprehensive.

## When to Use
- After story completion (status changed to "Done")
- When architecture documents are updated
- After API changes or new endpoints
- Following feature implementation
- Before epic completion
- When code changes affect documentation

## Prerequisites
- Recent code changes or story completion
- Access to doc-curator agent
- Current project documentation structure

## Instructions

### 1. Assess Documentation Impact
- Identify what code changes have occurred
- Determine which documentation files may be affected
- Check if new documentation is needed

### 2. Invoke doc-curator Agent
- Call external doc-curator agent with current context
- Provide list of changed files and features
- Include story details if triggered by story completion

### 3. Documentation Scope
Based on core-config.yaml documentationScope:
- README.md updates
- docs/architecture/ synchronization
- docs/prd/ alignment
- API documentation updates
- Developer guide maintenance

### 4. Validation
- Verify documentation accuracy against code
- Ensure cross-references remain valid
- Check for completeness of new feature documentation
- Validate code examples and commands

## Expected Outcomes
- All documentation synchronized with code changes
- New features properly documented
- Breaking changes clearly noted
- Cross-references updated and valid
- Documentation quality maintained

## Integration with BMad Workflow

### Story Completion Trigger
When a story is marked "Done":
1. Dev agent completes implementation
2. QA agent validates and marks story complete
3. **AUTO-TRIGGER**: sync-documentation task
4. doc-curator updates affected documentation
5. Documentation synchronized before next story

### Architecture Update Trigger
When architecture documents change:
1. Architecture modifications made
2. **AUTO-TRIGGER**: sync-documentation task
3. doc-curator ensures consistency across all docs
4. Cross-references updated

### API Change Trigger
When API modifications occur:
1. API endpoints added/modified/removed
2. **AUTO-TRIGGER**: sync-documentation task
3. doc-curator updates API documentation
4. Examples and usage guides updated

## Usage Examples

**Manual Trigger:**
```
@bmad-master *task sync-documentation
```

**Story Completion Context:**
```
Story XYZ-123 completed: "Add user authentication system"
- New API endpoints: /auth/login, /auth/logout, /auth/refresh
- New middleware: authMiddleware.js
- Updated: User model, routes, tests
```

**Architecture Update Context:**
```
Architecture change: "Moved from monolith to microservices"
- Updated: system architecture, deployment, API gateway
- New: service communication patterns, database sharding
```

## Notes
- This task coordinates with your external doc-curator agent
- Maintains BMad's document-driven development approach
- Ensures documentation quality throughout development cycle
- Integrates seamlessly with SM → Dev → QA workflow