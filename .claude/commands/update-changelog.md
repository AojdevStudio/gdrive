---
allowed-tools: Read, Write, Bash
description: Add new entries to project CHANGELOG.md following Keep a Changelog format
---

# Update Changelog

This command adds a new entry to the project's CHANGELOG.md file following Keep a Changelog conventions and Semantic Versioning standards. For maximum efficiency, whenever you need to perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially.

**variables:**
VersionEntry: $ARGUMENTS

**Usage Examples:**

- `/update-changelog` - Analyze git history and automatically generate changelog entries
- `/update-changelog 1.1.0 added "New user authentication system"`
- `/update-changelog 1.0.2 fixed "Bug in file upload causing timeout errors"`
- `/update-changelog 2.0.0 removed "Deprecated legacy API endpoints"`

```yaml
# This is the workflow for automating CHANGELOG.md generation.
changelog_automation_workflow:
  description: 'A process to generate or update a CHANGELOG.md file based on git commit history or explicit arguments, following the Keep a Changelog standard.'

  # This is the sequence of operations for the workflow.
  execution_flow:
    # This handles how the process starts based on input.
    - phase: 'Input Handling'
      steps:
        - condition: 'No arguments are provided.'
          action: 'Analyze git history to automatically suggest changelog entries.'
        - condition: 'Arguments are provided.'
          action: 'Parse $ARGUMENTS to extract version, change_type, and message.'

    # This ensures the changelog file exists and is properly formatted.
    - phase: 'File Initialization'
      steps:
        - 'Check if CHANGELOG.md exists in the project root.'
        - if_missing: "Create a new file with the 'Keep a Changelog' standard header and structure."
          initial_versioning: 'Start with version 0.1.0 or 1.0.0 based on perceived project maturity.'

    # This gathers and formats the changelog content.
    - phase: 'Content Generation'
      steps:
        - 'Analyze recent git commits since the last release/tag.'
        - 'Categorize commit messages into appropriate change types (e.g., Added, Fixed).'
        - if_exists: 'Read and parse the existing CHANGELOG.md structure.'
        - "Find the correct version section or create a new one with today's date."
        - 'Add new entries under the appropriate change types.'
        - "Ensure all content is formatted according to 'Keep a Changelog' markdown conventions."

    # Writes changes and provides final instructions.
    - phase: 'Finalization'
      steps:
        - 'Write the updated content back to CHANGELOG.md.'
        - 'Suggest committing the changes.'
        - 'Suggest updating project version files if a new version was created.'

  # Contextual data, commands, and standards for the workflow.
  context_and_standards:
    # Data sources used to understand the project state.
    data_sources:
      - name: 'Current Changelog'
        source_file: '@CHANGELOG.md'
      - name: 'Project Structure Files'
        source_command: '!`find . -name "package.json" -o -name "pyproject.toml" -o -name "Cargo.toml" -o -name "go.mod" -o -name "pom.xml" | head -5`'
      - name: 'Git Status'
        source_command: '!`git status --porcelain | head -10`'
      - name: 'Recent Commits'
        source_command: '!`git log --oneline -20`'
      - name: 'Recent Git Tags'
        source_command: '!`git tag --sort=-version:refname | head -10`'
      - name: 'Last Release Tag'
        source_command: '!`git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"`'
      - name: 'Commits Since Last Tag'
        source_command: '!`git rev-list $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --oneline 2>/dev/null || git log --oneline`'
      - name: 'Recent File Changes'
        source_command: '!`git diff --name-status HEAD~10..HEAD | head -10`'

    # External standards and formatting conventions.
    conventions:
      - name: 'Keep a Changelog'
        url: 'https://keepachangelog.com/en/1.1.0/'
      - name: 'Semantic Versioning (SemVer)'
        url: 'https://semver.org/'

    # Core definitions and mappings used in the process.
    definitions:
      version_format: 'MAJOR.MINOR.PATCH (e.g., 1.2.3)'
      entry_format: '- Description of change [#issue-number]'
      change_types:
        - 'Added'
        - 'Changed'
        - 'Deprecated'
        - 'Removed'
        - 'Fixed'
        - 'Security'
      # Maps git commit message keywords to changelog categories.
      commit_keyword_mapping:
        'feat': 'Added'
        'add': 'Added'
        'fix': 'Fixed'
        'refactor': 'Changed'
        'remove': 'Removed'
        'delete': 'Removed'
        'deprecate': 'Deprecated'
        'security': 'Security'
```
