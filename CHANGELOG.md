# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-11

### 🚨 BREAKING CHANGES

- **Consolidated 41+ individual tools into 5 operation-based tools**
  - `sheets` - Unified tool for all Google Sheets operations (12 operations)
  - `drive` - Unified tool for all Google Drive file operations (7 operations)
  - `forms` - Unified tool for all Google Forms operations (4 operations)
  - `docs` - Unified tool for all Google Docs operations (5 operations)
  - `batch` - Batch file operations (4 operations)

### ⚠️ Migration Required

If you're using individual tools like `listSheets`, `readSheet`, etc., you must migrate to the new operation-based tools:

**Before (v1.x):**
```json
{
  "name": "listSheets",
  "args": {
    "spreadsheetId": "abc123"
  }
}
```

**After (v2.0.0):**
```json
{
  "name": "sheets",
  "args": {
    "operation": "list",
    "spreadsheetId": "abc123"
  }
}
```

### ✨ Benefits

- **Improved LLM Tool Selection:** 88% reduction in tool count (41+ → 5)
- **Better Type Safety:** Zod discriminated unions for operation routing
- **Cleaner Codebase:** Reduced code duplication, centralized handlers
- **HOW2MCP 2025 Compliance:** Follows modern MCP architecture patterns

### 📚 Documentation

- Added comprehensive migration guide to `docs/MIGRATION_V2.md`
- Updated README.md with breaking changes section and quick migration examples
- Updated API documentation with all 32 operations
- Added examples for each operation type

### 🔧 Technical Changes

- Implemented Zod discriminated unions for type-safe operation routing
- Centralized logger pattern (single logger instance)
- Single ListTools handler to prevent tool registration overwriting
- New file structure: `src/sheets/`, `src/drive/`, `src/forms/`, `src/docs/`, `src/batch/`

### 🧪 Testing

- All 32 operations tested end-to-end with MCP Inspector
- 100% functional compatibility maintained
- No performance degradation

---

**Full Migration Documentation:** See [Migration Guide](./docs/MIGRATION_V2.md)
**Epic Reference:** [Epic-001: Consolidate Workspace Tools](./docs/epics/consolidate-workspace-tools.md)
**HOW2MCP Reference:** [2025 MCP Architecture Patterns](https://github.com/modelcontextprotocol/servers)

## [Unreleased]

### Added

- **Google Sheets Formula Support** - `updateCellsWithFormula` tool for applying formulas to cells
  - Reusable range helpers and comprehensive unit tests (29 tests)
  - JSDoc documentation for all formula helper functions
  - Usage examples and security considerations in README
  - Maximum cell limit (10,000 cells) to prevent memory exhaustion
  - Structured error logging with error type tracking

- **Google Sheets Cell Formatting** - `formatCells` tool for styling cells
  - Bold/italic text formatting
  - Text and background colors (RGB 0.0-1.0 format)
  - Number format presets (CURRENCY, PERCENT, DATE, NUMBER, TEXT)
  - Dynamic field mask generation for efficient API calls
  - Spreadsheet metadata caching to reduce API calls
  - 5 additional unit tests for formatting helpers

- **Google Sheets Conditional Formatting** - `addConditionalFormatting` tool for rule-based cell highlighting
  - Number comparisons (NUMBER_GREATER, NUMBER_LESS)
  - Text matching (TEXT_CONTAINS)
  - Custom formula conditions (CUSTOM_FORMULA)
  - Color and bold text formatting for matching cells
  - Comprehensive validation and error handling
  - 3 unit tests for rule construction and validation
  - Complete documentation with examples in docs/Examples

- **Google Sheets Management Tools** - `renameSheet` and `deleteSheet` for sheet lifecycle management
  - Unified `resolveSheetMetadata` helper for flexible sheet identification
  - Support for both sheetId (numeric) and sheetName (string) parameters
  - Enhanced `createSheet` with `sheetName` alias and default row/column handling
  - Automatic cache invalidation after sheet operations
  - Comprehensive error logging and validation

- **Google Sheets Layout Controls** - `freezeRowsColumns` and `setColumnWidth` for UI optimization
  - Freeze header rows and columns for better scrolling UX
  - Set pixel widths for multiple columns in one operation
  - Dedicated `layoutHelpers.ts` module with JSDoc documentation
  - Batch operations for efficient API usage
  - Automatic cache invalidation and performance tracking

### Improved

- Test coverage expanded to 37 tests total (29 formula + 5 formatting + 3 conditional)
- Error handling with detailed logging including error types and context
- Documentation with practical examples for formulas, formatting, and conditional rules
- Unified helpers module combining formula and formatting operations
- createSheet now defaults to 1000 rows × 26 columns (standard Google Sheets)

## [0.8.0] - 2025-08-19

### Added

- 🔐 **Key Rotation Infrastructure**: Complete authentication key rotation system with automated scripts
  - New `scripts/rotate-keys.sh` script supporting OAuth, encryption, and token rotation
  - Automated key rotation workflows for enhanced security
  - Support for encryption key rotation without service downtime
- 📚 **Enhanced Documentation**: Comprehensive README improvements with step-by-step guides
  - Claude Desktop Integration section with detailed setup instructions
  - Enhanced Quick Start guide with prerequisites and authentication flow
  - Updated repository URLs and directory structure documentation
  - Docker setup guide with troubleshooting and logging details
- 📁 **Infrastructure Improvements**: Enhanced Docker and filesystem support
  - Data directory placeholder with `.gitkeep` for proper Docker bind mounts
  - Improved container deployment structure

### Changed

- 🔄 **Authentication System**: Major enhancements to token management robustness
  - Enhanced TokenManager with path sanitization and directory management
  - Deterministic key derivation for encrypted token decryption across environments
  - Improved audit log directory creation with retry logic
  - Comprehensive validation for environment variable paths
- 📚 **Documentation Structure**: Repository organization and link updates
  - Updated repository URLs from legacy references to current GitHub location
  - Consistent directory naming (`gdrive` instead of `gdrive-mcp-server`)
  - Reorganized documentation for better user experience

### Fixed

- 🐳 **Docker Configuration**: Resolved container startup and deployment issues
  - Fixed JavaScript heap out of memory error with `NODE_OPTIONS="--max-old-space-size=4096"`
  - Removed read-only flag from credentials volume mount for token updates
  - Eliminated obsolete `GDRIVE_CREDENTIALS_PATH` environment variable
  - Modernized Docker configuration for current authentication architecture
- 🔧 **Logging System**: Enhanced error handling and protocol compliance
  - Comprehensive Error object serialization in Winston logger
  - Routed all Winston console output to stderr for MCP protocol integrity
  - Improved structured logging capabilities with audit trail support
- 🛡️ **Authentication Robustness**: Enhanced token management reliability
  - Path sanitization for malformed environment variables
  - Automatic directory creation with proper error handling
  - Prevention of Docker container failures due to configuration issues

### Security

- 🔒 **Encryption Key Management**: Production-ready encryption key rotation
  - Complete GDRIVE-3 encryption key rotation epic implementation
  - Enhanced security through automated key rotation capabilities
  - Improved token encryption and decryption across host and container environments
- 🛡️ **Authentication Security**: Strengthened authentication system
  - Robust path validation and sanitization
  - Enhanced directory management with secure file operations
  - Improved error handling for security-related operations

### Removed

- 🗑️ **Cleanup Operations**: Repository maintenance and obsolete file removal
  - Removed `.github/README.md` (documentation consolidated to main README)
  - Cleaned up deprecated AuthManager backup files
  - Added `.cursor/` IDE files to `.gitignore` for cleaner repository

## [0.7.0] - 2025-08-05

### Added

- ✨ feat(auth): complete GDRIVE-3 encryption key rotation epic (Stories 2&3)
- ✨ feat(auth): implement versioned key system for GDRIVE-3 Story 1
- 📝 docs: add brownfield epic and stories for GDRIVE-3 encryption key rotation
- 🙈 chore: add BMad framework directories to .gitignore
- 🗺️ feat(planning): add comprehensive product roadmap for 2025-2026
- 📝 feat(docs): add phase-based developer checklists for GDRIVE-3
- 📋 feat(security): add comprehensive PRD for encryption key rotation
- 🤖 feat(agents): enhance prd-writer with phase-based checklist capabilities
- 📚 docs: add comprehensive documentation structure and MIT license
- 🙈 chore(config): add Claude Desktop config files to gitignore
- ✨ feat(dev): add authentication and testing scripts
- implement automatic OAuth token refresh with secure storage
- add support for viewing Google Apps Script projects
- 📚 docs: Reorganize documentation structure and add PRDs
- 🛠️ feat: add comprehensive roadmap building command and session tracking
- ✨ feat: enhance MCP server with comprehensive Google APIs integration
- 🐳 feat: add comprehensive Docker deployment infrastructure
- 📝 docs: add comprehensive OAuth token refresh research and implementation plan
- 🎉 feat: initialize Google Drive MCP server project with development environment

### Changed

- 🔄 refactor(framework): migrate from legacy .claude commands to BMad agent structure
- 📝 docs: update Story 1 completion status
- 📚 docs: update project metadata and changelog for v0.7.0
- 🗂️ refactor(scripts): reorganize scripts into structured directory
- 🧹 refactor(agents): reorganize Claude agents configuration
- 📚 docs: update Docker usage instructions and authentication flow
- cleaned up .claude dr
- ➕ chore: update dependencies and improve gitignore configuration
- initial commit

### Removed

- 🧹 chore(cleanup): remove old script files from root directory

### Fixed

- 🐛 fix(apps-script): add parameter validation for getAppScript tool
- resolve TypeScript compilation errors
- apply PR #2 review feedback from CodeRabbit [#2]

### Added
- OAuth2 automatic token refresh research and implementation plan
- Comprehensive documentation for token refresh solutions
- Implementation strategy for eliminating manual token renewal

## [0.7.0] - 2025-08-02

### Added
- MIT license for open source compliance
- Comprehensive documentation structure in docs/ directory:
  - Business-Processes/: Workflow and process documentation with team collaboration patterns
  - Examples/: Usage examples including enhanced search and natural language patterns
  - Guides/: Complete user and developer guides (setup, authentication, Docker, Redis, Claude Desktop integration)
  - Troubleshooting/: Common issues and solutions for authentication, Docker, Redis, and API problems
- Structured scripts directory for better organization and maintenance
- Authentication script (auth.sh) for simplified OAuth setup outside Docker
- Development testing script (test-server.sh) for streamlined testing
- Claude agents configuration with organized agent definitions
- Automated changelog generation tools with Python utilities

### Changed
- Reorganized project structure for better maintainability
- Moved scripts from root directory to organized scripts/ structure
- Improved Docker configuration and authentication flow documentation
- Enhanced architecture documentation with current project structure
- Updated Claude Desktop configuration files organization
- Reorganized Claude agents into structured .claude/agents/ directory

### Fixed
- Parameter validation for getAppScript tool to prevent errors
- Project file organization and reduced root directory clutter
- Script discoverability and maintenance workflows

### Removed
- Old script files from root directory (auth.sh, mcp-wrapper.sh, replace_open.sh, test-server.sh)
- Obsolete configuration files and documentation

## [0.6.2] - 2025-01-25

### Added
- Complete Google Drive MCP server implementation
- Full read/write access to Google Drive files and folders
- Resource access via `gdrive:///<file_id>` URIs
- Comprehensive Google Sheets operations (read, update, append)
- Google Forms creation and management with question types
- Google Docs API integration for document manipulation
- Batch file operations (create, update, delete, move)
- Enhanced search with natural language parsing
- Forms response handling and analysis
- Redis caching infrastructure for improved performance
- Performance monitoring and logging with Winston
- Structured logging with file rotation and console output
- Automatic export of Google Workspace files to readable formats
- Docker support for containerized deployment with Redis
- Authentication flow using Google Cloud local auth
- MCP SDK integration with stdio transport
- File type handling for various Google Workspace formats
- Environment variable configuration
- Comprehensive API documentation
- Architecture documentation
- Docker deployment guides

### Changed
- Updated project structure for better organization
- Enhanced error handling and logging throughout
- Improved Docker configuration with Redis integration
- Updated dependencies to latest versions

### Fixed
- Authentication flow stability
- File export format handling
- Error message clarity and user guidance

## [0.1.0] - 2025-01-24

### Added
- Initial project setup and repository structure
- Basic MCP server framework
- Google Drive API integration planning
- Development environment configuration
- Project documentation foundation

[unreleased]: https://github.com/AojdevStudio/gdrive/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/AojdevStudio/gdrive/compare/v0.8.0...v2.0.0
[0.8.0]: https://github.com/AojdevStudio/gdrive/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/AojdevStudio/gdrive/compare/v0.6.2...v0.7.0
[0.6.2]: https://github.com/AojdevStudio/gdrive/compare/v0.1.0...v0.6.2
[0.1.0]: https://github.com/AojdevStudio/gdrive/releases/tag/v0.1.0

## Links
[Unreleased]: https://github.com/AojdevStudio/gdrive/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/AojdevStudio/gdrive/releases/tag/v2.0.0
[0.8.0]: https://github.com/AojdevStudio/gdrive/releases/tag/v0.8.0
[0.7.0]: https://github.com/AojdevStudio/gdrive/releases/tag/v0.7.0