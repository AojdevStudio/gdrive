# Doc-Curator Integration with BMad

## Overview

This document describes the integration of the external `doc-curator` agent with BMad workflows to provide automatic documentation synchronization throughout the development cycle.

## Integration Architecture

### Core Configuration

The integration is configured in `bmad-core/core-config.yaml`:

```yaml
documentationIntegration:
  primaryAgent: doc-curator
  autoTriggers:
    - story-completion
    - architecture-updates
    - api-changes
    - feature-implementation
  documentationScope:
    - README.md
    - docs/architecture/
    - docs/prd/
    - API documentation
    - developer guides
  syncValidation: true
```

### Workflow Integration Points

#### 1. Story Completion Trigger
- **When**: Story status changes to "Done"
- **Agent**: QA agent completes story review
- **Action**: Automatically triggers `sync-documentation` task
- **Outcome**: Documentation updated to reflect implemented features

#### 2. Architecture Update Trigger
- **When**: Architecture documents are modified
- **Agent**: Architect agent or manual updates
- **Action**: Triggers documentation synchronization
- **Outcome**: Cross-references and dependencies updated

#### 3. API Change Trigger
- **When**: API endpoints added/modified/removed
- **Agent**: Dev agent during implementation
- **Action**: API documentation automatically updated
- **Outcome**: API docs remain current with implementation

#### 4. Feature Implementation Trigger
- **When**: Major features completed
- **Agent**: Dev agent marks feature complete
- **Action**: Comprehensive documentation review
- **Outcome**: Feature documentation created/updated

## Task Integration

### sync-documentation.md Task

Located at `.bmad-core/tasks/sync-documentation.md`, this task:

1. **Assesses Documentation Impact**
   - Identifies affected documentation files
   - Determines scope of changes needed

2. **Invokes doc-curator Agent**
   - Calls external Claude Code doc-curator
   - Provides context of recent changes
   - Includes story details and implementation notes

3. **Manages Documentation Scope**
   - README.md updates
   - Architecture documentation synchronization
   - PRD alignment verification
   - API documentation updates
   - Developer guide maintenance

4. **Validates Results**
   - Ensures documentation accuracy
   - Verifies cross-references
   - Confirms completeness

### Agent Dependencies

The following BMad agents now include `sync-documentation.md` in their dependencies:

- **dev agent**: For triggering during development
- **qa agent**: For post-completion documentation sync

## Usage Patterns

### Automatic Triggers

Documentation synchronization happens automatically when:

1. **Story Completion**:
   ```
   Dev Agent → implements story
   QA Agent → reviews and approves
   AUTO-TRIGGER → sync-documentation task
   doc-curator → updates documentation
   ```

2. **Architecture Changes**:
   ```
   Architect Agent → modifies architecture
   AUTO-TRIGGER → sync-documentation task
   doc-curator → ensures consistency
   ```

### Manual Triggers

Users can manually trigger documentation sync:

```bash
# Using bmad-master
@bmad-master *task sync-documentation

# Using dev agent during development
@dev *sync-documentation

# Using qa agent during review
@qa *sync-documentation
```

## Integration Benefits

### For BMad Workflow
- **Maintains Document-Driven Development**: Keeps docs aligned with implementation
- **Preserves Context Optimization**: External agent doesn't bloat BMad agent context
- **Enhances Quality Gates**: Documentation quality becomes part of story completion
- **Supports Continuous Integration**: Documentation stays current throughout development

### For Documentation Quality
- **Real-Time Synchronization**: Documentation updated as code changes
- **Cross-Reference Integrity**: Links and references remain valid
- **Comprehensive Coverage**: All documentation types handled consistently
- **Quality Validation**: Built-in quality checks ensure accuracy

## Best Practices

### When to Use Manual Triggers
- Before epic completion
- After major refactoring
- When documentation feels outdated
- Before releases or demos

### Documentation Scope Management
- Focus on user-facing changes
- Prioritize API and integration documentation
- Maintain architectural consistency
- Keep examples and code snippets current

### Quality Validation
- Verify all code examples work
- Check cross-references between documents
- Ensure breaking changes are documented
- Validate installation and setup instructions

## Troubleshooting

### Common Issues

1. **Documentation Out of Sync**
   - **Solution**: Run manual `sync-documentation` task
   - **Prevention**: Ensure auto-triggers are configured

2. **Cross-References Broken**
   - **Solution**: doc-curator validates and fixes references
   - **Prevention**: Regular validation during development

3. **Missing Feature Documentation**
   - **Solution**: Trigger after story completion
   - **Prevention**: Include documentation requirements in stories

### Validation Commands

```bash
# Check documentation coverage
@bmad-master *task sync-documentation

# Validate specific documentation
@doc-curator # (external agent call)

# Review documentation quality
# Use your project's documentation review process
```

## Integration Maintenance

### Regular Tasks
- Review auto-trigger effectiveness
- Update documentation scope as project evolves
- Validate integration points during BMad updates
- Monitor documentation quality metrics

### Configuration Updates
- Modify `core-config.yaml` as documentation needs change
- Update `sync-documentation.md` task for new patterns
- Adjust agent dependencies as workflow evolves

## Future Enhancements

### Potential Improvements
- Integration with changelog generation
- Automated documentation testing
- Documentation coverage metrics
- Integration with CI/CD pipelines

### Expansion Opportunities
- Additional documentation types
- Custom validation rules
- Multi-language documentation support
- Documentation analytics and insights

This integration ensures that BMad's document-driven development approach maintains high-quality, synchronized documentation throughout the entire development lifecycle.