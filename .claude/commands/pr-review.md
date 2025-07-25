---
allowed-tools: Read, Bash, Grep, WebFetch, mcp__zen__codereview, mcp__zen__analyze
description: Pure analysis PR review for adoption decisions without code modification
---

# PR Review

This command analyzes incoming pull requests from the target branch perspective, evaluating proposed changes for quality, security, and architectural compatibility to provide adoption recommendations without making any modifications.

**variables:**
PRIdentifier: $ARGUMENTS

**Usage Examples:**

- `/pr-review` - Review current branch PR
- `/pr-review 123` - Review specific PR number
- `/pr-review feature/auth-system` - Review PR by branch name
- `/pr-review --security` - Focus on security implications
- `/pr-review 123 --detailed` - Full architectural analysis

```yaml
# Protocol for comprehensive pull request review and adoption decision
pull_request_review_protocol:
  execution_flow:
    - step: identify_target
      action: 'Determine which PR to review from $ARGUMENTS'
      logic:
        - 'If no arguments: Find PR for current branch'
        - 'If number provided: Use specific PR ID'
        - 'If branch name: Find associated PR'
        - 'If flags provided: Apply specialized review focus'

    - step: gather_context
      action: 'Collect comprehensive PR information'
      data_collection:
        pr_metadata:
          - 'gh pr view --json number,title,body,state,author,reviewRequests'
          - 'gh pr view --json headRefName,baseRefName,mergeable,checks'
          - 'gh pr view --json additions,deletions,changedFiles'
        change_analysis:
          - 'gh pr diff --name-only'
          - 'gh pr diff'
          - 'git log origin/main..HEAD --oneline'
        status_checks:
          - 'gh pr checks --json name,status,conclusion'
          - 'gh pr status'

    - step: automated_assessment
      action: 'Run automated quality and security checks'
      assessments:
        code_quality:
          - 'Check for TypeScript errors and lint issues'
          - 'Verify test coverage and new test additions'
          - 'Analyze code complexity and maintainability'
          - 'Check for proper error handling'
        security_review:
          - 'Scan for secrets and sensitive data exposure'
          - 'Check for SQL injection and XSS vulnerabilities'
          - 'Verify input validation and sanitization'
          - 'Review authentication and authorization changes'
        architectural_impact:
          - 'Assess breaking changes and API modifications'
          - 'Check dependency changes and version conflicts'
          - 'Evaluate performance implications'
          - 'Review database migration safety'

    - step: deep_code_review
      action: 'Perform systematic code analysis using AI tools'
      tools:
        - tool: 'mcp__zen__codereview'
          purpose: 'Comprehensive code review workflow'
          focus: 'Code quality, patterns, and maintainability'
        - tool: 'mcp__zen__analyze'
          purpose: 'Architectural and design analysis'
          focus: 'System impact and integration concerns'
      analysis_areas:
        - 'Code style consistency and best practices'
        - 'Design pattern adherence'
        - 'Error handling completeness'
        - 'Test coverage adequacy'
        - 'Documentation quality'

    - step: risk_assessment
      action: 'Evaluate deployment and adoption risks'
      risk_categories:
        technical_risks:
          - 'Breaking changes to public APIs'
          - 'Database schema modifications'
          - 'Performance degradation potential'
          - 'Dependency conflicts or updates'
        business_risks:
          - 'User experience impact'
          - 'Feature rollback complexity'
          - 'Integration with existing workflows'
          - 'Maintenance burden increase'
        security_risks:
          - 'New attack surface introduction'
          - 'Data exposure possibilities'
          - 'Authentication/authorization weakening'
          - 'Third-party dependency vulnerabilities'

    - step: generate_recommendation
      action: 'Provide clear adoption decision with rationale'
      decision_framework:
        adopt_immediately:
          criteria:
            - 'All automated checks pass'
            - 'High code quality score'
            - 'Low risk assessment'
            - 'Comprehensive test coverage'
          recommendation: 'APPROVE - Safe to merge immediately'
        adopt_with_conditions:
          criteria:
            - 'Minor issues that can be addressed'
            - 'Medium risk with mitigation strategies'
            - 'Good overall quality with specific concerns'
          recommendation: 'CONDITIONAL APPROVAL - Address specific items before merge'
        defer_adoption:
          criteria:
            - 'Significant architectural concerns'
            - 'High risk without clear mitigation'
            - 'Major quality issues requiring rework'
          recommendation: 'REQUEST CHANGES - Major revisions needed'
        reject_adoption:
          criteria:
            - 'Security vulnerabilities'
            - 'Fundamental design flaws'
            - 'Breaks project standards'
          recommendation: 'REJECT - Do not adopt in current form'

    - step: present_findings
      action: 'Present comprehensive review analysis to console'
      outputs:
        review_summary:
          - 'Executive summary of findings'
          - 'Key metrics and scores'
          - 'Risk assessment results'
          - 'Final adoption recommendation'
        detailed_analysis:
          - 'Code quality breakdown by file'
          - 'Security findings and implications'
          - 'Performance impact analysis'
          - 'Architectural compatibility assessment'
        feedback_for_pr_author:
          - 'Required changes before adoption'
          - 'Suggested improvements'
          - 'Areas of concern to address'
          - 'Positive aspects to highlight'

  operational_context:
    review_criteria:
      code_quality_metrics:
        - 'Cyclomatic complexity scores'
        - 'Code duplication percentage'
        - 'Test coverage percentage'
        - 'TypeScript strict mode compliance'
        - 'ESLint rule violations'
      security_checkpoints:
        - 'Input validation completeness'
        - 'Output encoding consistency'
        - 'Authentication mechanism integrity'
        - 'Data exposure prevention'
        - 'Dependency vulnerability scan'
      architectural_standards:
        - 'Design pattern consistency'
        - 'Module boundary respect'
        - 'Interface contract adherence'
        - 'Error propagation strategy'
        - 'Resource management practices'

    scoring_system:
      overall_score:
        calculation: 'Weighted average of quality, security, and architecture scores'
        thresholds:
          excellent: '>= 90'
          good: '>= 75'
          acceptable: '>= 60'
          needs_work: '< 60'
      quality_weights:
        code_quality: 40
        security_assessment: 35
        architectural_impact: 25

    decision_matrix:
      auto_approve_conditions:
        - 'Overall score >= 85'
        - 'No critical security issues'
        - 'All tests passing'
        - 'No breaking changes'
      manual_review_triggers:
        - 'Score between 60-84'
        - 'Minor security concerns'
        - 'Non-critical breaking changes'
        - 'Large file modifications (>500 lines)'
      rejection_triggers:
        - 'Critical security vulnerabilities'
        - 'Score < 60'
        - 'Major architectural violations'
        - 'Incomplete or failing tests'

    data_sources:
      github_api:
        - command: 'gh pr view $PR_NUMBER --json number,title,body,state,author'
          purpose: 'Basic PR metadata'
        - command: 'gh pr checks $PR_NUMBER --json name,status,conclusion'
          purpose: 'CI/CD pipeline status'
        - command: 'gh pr diff $PR_NUMBER'
          purpose: 'Complete change diff'
      git_analysis:
        - command: 'git diff --stat origin/main..HEAD'
          purpose: 'Change statistics'
        - command: 'git log --oneline origin/main..HEAD'
          purpose: 'Commit history analysis'
      project_context:
        - '@CLAUDE.md'
        - '@package.json'
        - '@tsconfig.json'
        - '@.eslintrc.js'

    quality_gates:
      mandatory_requirements:
        - 'All CI checks must pass'
        - 'No critical linting errors'
        - 'TypeScript compilation successful'
        - 'No high-severity security issues'
      recommended_standards:
        - 'Test coverage >= 80%'
        - 'No code duplication > 5%'
        - 'Cyclomatic complexity < 10'
        - 'All public functions documented'

    review_templates:
      approval_template: |
        ## ✅ APPROVED FOR ADOPTION

        **Overall Score:** {overall_score}/100

        ### Summary
        {executive_summary}

        ### Key Strengths
        {positive_findings}

        ### Minor Suggestions
        {optional_improvements}

        ### Recommendation
        This PR meets all quality standards and is ready for immediate merge.

      conditional_template: |
        ## ⚠️ CONDITIONAL APPROVAL

        **Overall Score:** {overall_score}/100

        ### Summary
        {executive_summary}

        ### Required Changes
        {mandatory_fixes}

        ### Recommended Improvements
        {suggested_improvements}

        ### Recommendation
        Address the required changes above before merging.

      rejection_template: |
        ## ❌ REQUEST CHANGES

        **Overall Score:** {overall_score}/100

        ### Summary
        {executive_summary}

        ### Critical Issues
        {critical_problems}

        ### Major Concerns
        {significant_issues}

        ### Recommendation
        Significant rework required before this PR can be adopted.
```

**Implementation Features:**

- **Pure Analysis Mode**: Read-only assessment without modifying any files
- **Target Branch Perspective**: Evaluates incoming changes from maintainer viewpoint
- **Automated Quality Assessment**: Comprehensive code quality metrics and scoring
- **Security-First Review**: Built-in security vulnerability detection and assessment
- **Architectural Compatibility**: Evaluation of system-wide integration implications
- **Risk-Based Decision Making**: Clear adoption recommendations based on risk assessment
- **Standardized Scoring**: Consistent evaluation criteria across all reviews
- **Console-Based Reporting**: Immediate feedback without creating files
- **Non-Intrusive Review**: No modifications to codebase during analysis
