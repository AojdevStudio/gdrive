---
allowed-tools: Read, Bash, Write, Edit, MultiEdit, Grep, TodoWrite, WebFetch
description: Review and merge pull requests with comprehensive validation and safety checks
---

# Review Merge

This command provides a comprehensive workflow for reviewing and merging pull requests, including automated checks, validation, and safe merge strategies following project conventions.

**variables:**
Arguments: $ARGUMENTS

**Usage Examples:**

- `/review-merge` - Interactive review and merge for current branch PR
- `/review-merge 123` - Review and merge PR #123
- `/review-merge --approve` - Quick approve and merge with all checks
- `/review-merge 123 --squash` - Review and squash merge specific PR
- `/review-merge --dry-run` - Preview what would happen without merging

```yaml
# Protocol for comprehensive PR review and merge workflow
pull_request_review_merge_protocol:
  execution_flow:
    - step: parse_arguments
      action: 'Extract PR number, merge strategy, and options from $ARGUMENTS'
      options:
        - 'PR number or current branch'
        - 'Merge strategy: merge, squash, rebase'
        - 'Auto-approve flag'
        - 'Dry-run mode'

    - step: fetch_pr_details
      action: 'Gather comprehensive PR information'
      commands:
        - 'gh pr view --json number,title,state,checks,reviews,mergeable'
        - 'gh pr checks to verify CI status'
        - 'gh pr diff to review changes'
      validation:
        - 'PR exists and is open'
        - 'User has appropriate permissions'

    - step: automated_review
      action: 'Perform automated code quality checks'
      checks:
        - 'Verify all CI checks passing'
        - 'Check for merge conflicts'
        - 'Validate commit message format'
        - 'Ensure required reviews approved'
        - 'Check for sensitive data (secrets scan)'
        - 'Verify test coverage maintained'

    - step: interactive_review
      action: 'Guide through manual review if needed'
      process:
        - 'Display PR summary and changes'
        - 'Highlight areas needing attention'
        - 'Show test results and coverage'
        - 'Review commit history'
        - 'Check Linear task completion'

    - step: pre_merge_validation
      action: 'Final safety checks before merge'
      validations:
        - 'Target branch is correct (usually main)'
        - 'No force-push since last review'
        - 'Dependencies updated if needed'
        - 'Documentation updated'
        - 'CHANGELOG updated if required'

    - step: execute_merge
      action: 'Perform the actual merge operation'
      strategies:
        - merge: 'Preserve all commits (--merge)'
        - squash: 'Combine into single commit (--squash)'
        - rebase: 'Rebase onto target (--rebase)'
      options:
        - 'Delete branch after merge'
        - 'Auto-merge when ready'
        - 'Admin override if needed'

    - step: post_merge_actions
      action: 'Cleanup and notifications'
      tasks:
        - 'Delete merged branch locally and remotely'
        - 'Update Linear task status'
        - 'Notify relevant stakeholders'
        - 'Trigger deployment if configured'
        - 'Update project documentation'

  operational_context:
    merge_strategies:
      squash_merge:
        when: 'Feature branches with many commits'
        benefits: 'Clean linear history'
        commit_format: '<type>(<scope>): <description> (#<pr-number>)'

      merge_commit:
        when: 'Preserving commit history important'
        benefits: 'Full context preserved'
        flag: '--merge'

      rebase_merge:
        when: 'Linear history without merge commits'
        benefits: 'Clean timeline'
        caution: 'Only for simple changes'

    validation_rules:
      required_checks:
        - 'All CI workflows pass'
        - 'Code review approved'
        - 'No merge conflicts'
        - 'Branch up to date'

      quality_gates:
        - 'Test coverage >= 80%'
        - 'No critical security issues'
        - 'Performance benchmarks pass'
        - 'Type checking passes'

    safety_features:
      conflict_detection:
        - 'Automatic merge conflict check'
        - 'Suggest resolution strategies'
        - 'Option to abort on conflicts'

      rollback_plan:
        - 'Note commit SHA before merge'
        - 'Document revert procedure'
        - 'Test rollback feasibility'

    data_sources:
      - command: 'gh pr status'
        purpose: 'Current PR state overview'
      - command: 'gh pr checks'
        purpose: 'CI/CD status verification'
      - command: 'git log origin/main..HEAD'
        purpose: 'Commits to be merged'
```

**Implementation Flow:**

1. **Parse Input**: Determine target PR and merge preferences
2. **Fetch Details**: Get comprehensive PR information and status
3. **Validate**: Run automated checks and ensure merge readiness
4. **Review**: Guide through changes if manual review needed
5. **Merge**: Execute merge with selected strategy
6. **Cleanup**: Handle post-merge tasks and notifications

**Key Features:**

- Multi-strategy merge support (squash, merge, rebase)
- Comprehensive pre-merge validation
- Automated quality checks
- Safe rollback procedures
- Linear task integration
- Branch cleanup automation
