# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/modelcontextprotocol/servers/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/modelcontextprotocol/servers/compare/v0.6.2...v0.7.0
[0.6.2]: https://github.com/modelcontextprotocol/servers/compare/v0.1.0...v0.6.2
[0.1.0]: https://github.com/modelcontextprotocol/servers/releases/tag/v0.1.0