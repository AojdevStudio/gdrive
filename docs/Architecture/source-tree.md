# Source Tree Structure

## Overview
This document provides a comprehensive guide to the Google Drive MCP Server's source code organization, explaining the purpose of each directory and file, along with the architectural decisions behind the structure.

## Project Root Structure

```
gdrive/
├── index.ts                    # Main entry point - MCP server implementation
├── package.json                # Project metadata and dependencies
├── tsconfig.json              # TypeScript compiler configuration
├── jest.config.js             # Jest testing configuration (if exists)
├── .env.example               # Environment variable template
├── .gitignore                 # Git ignore patterns
├── Dockerfile                 # Container build instructions
├── docker-compose.yml         # Multi-service orchestration
├── README.md                  # Project documentation
├── CLAUDE.md                  # Claude Code guidance file
└── LICENSE                    # MIT license file
```

## Source Code (`/src`)

### Authentication Module (`/src/auth`)
```
src/auth/
├── AuthManager.ts             # OAuth2 flow and token lifecycle management
│   ├── Class: AuthManager
│   ├── Methods: initialize(), refreshAccessToken(), monitorTokenExpiry()
│   └── State: oauth2Client, authState, refreshTimer
│
└── TokenManager.ts            # Encrypted token storage and retrieval
    ├── Class: TokenManager
    ├── Methods: saveTokens(), loadTokens(), deleteTokens()
    └── Encryption: AES-256-GCM
```

**Purpose**: Handles all authentication concerns including OAuth2 flow, token storage, refresh logic, and security.

### Health Monitoring (`/src/health-check.ts`)
```
src/health-check.ts            # Standalone health check utility
├── Function: performHealthCheck()
├── Interfaces: HealthCheckResult, HealthStatus
└── Checks: Token validity, refresh capability, memory usage
```

**Purpose**: Provides health monitoring capabilities for Docker and external monitoring systems.

## Distribution (`/dist`)

```
dist/                          # Compiled JavaScript output
├── index.js                   # Compiled server entry point
├── index.d.ts                 # TypeScript declarations
├── index.js.map              # Source maps for debugging
└── src/                      # Compiled source modules
    ├── auth/
    │   ├── AuthManager.js
    │   ├── AuthManager.d.ts
    │   └── TokenManager.js
    └── health-check.js
```

**Purpose**: Contains transpiled JavaScript code ready for production execution.

## Configuration Files

### TypeScript Configuration
```
tsconfig.json
├── target: "ES2022"          # Modern JavaScript features
├── module: "ES2022"          # ES modules
├── strict: true              # Type safety
└── outDir: "./dist"          # Output directory
```

### Package Configuration
```
package.json
├── type: "module"            # ES modules support
├── bin: mcp-server-gdrive    # CLI executable
├── scripts:                  # Build and dev scripts
│   ├── build                 # Compile TypeScript
│   ├── watch                 # Dev mode
│   └── test                  # Run tests
└── dependencies:             # Runtime deps
```

## Credentials Directory

```
credentials/                   # OAuth and token storage (gitignored)
├── gcp-oauth.keys.json       # Google Cloud OAuth2 credentials
│   └── Structure: {client_id, client_secret, redirect_uris}
│
├── .gdrive-server-credentials.json  # Legacy token format
│   └── Deprecated: Migrated to new format
│
├── .gdrive-mcp-tokens.json   # Encrypted token storage
│   └── Structure: Encrypted {access_token, refresh_token, expiry}
│
└── gdrive-mcp-audit.log      # Token lifecycle audit trail
    └── Format: JSON lines with timestamp, event, metadata
```

**Security**: This directory is excluded from version control and mounted read-only in Docker.

## Data Directory

```
data/                         # Application data (Docker volume)
├── cache/                    # Local file cache (if implemented)
├── temp/                     # Temporary file storage
└── exports/                  # Exported file storage
```

**Purpose**: Persistent data storage for Docker deployments.

## Logs Directory

```
logs/                         # Application logs (Docker volume)
├── error.log                 # Error-level logs only
│   └── Format: JSON, rotated at 5MB
│
├── combined.log              # All application logs
│   └── Format: JSON, includes info/warn/error
│
└── gdrive-mcp-audit.log     # Duplicate of credentials audit log
    └── Purpose: Container-friendly log access
```

**Purpose**: Centralized logging with rotation and multiple severity levels.

## Documentation (`/docs`)

```
docs/
├── Architecture/             # System design documentation
│   ├── ARCHITECTURE.md      # Comprehensive system design
│   ├── coding-standards.md  # Code style and conventions
│   ├── tech-stack.md        # Technology inventory
│   └── source-tree.md       # This file
│
├── Examples/                 # Usage examples
│   ├── basic-usage.md       # Getting started examples
│   ├── advanced-tools.md    # Complex tool usage
│   └── integration.md       # Integration patterns
│
├── Features/                 # Feature documentation
│   ├── authentication.md    # Auth system details
│   ├── caching.md          # Redis caching strategy
│   └── tools/              # Individual tool docs
│
├── Guides/                   # Setup and operation guides
│   ├── installation.md      # Setup instructions
│   ├── docker-setup.md      # Container deployment
│   └── troubleshooting.md   # Common issues
│
└── API.md                   # Legacy API reference
```

**Purpose**: Comprehensive documentation for developers and users.

## Scripts Directory

```
scripts/                      # Utility scripts
├── auth.sh                   # Host-based authentication helper
│   └── Purpose: Simplify OAuth setup process
│
├── health-check.sh          # Health monitoring script
│   └── Purpose: External health checks
│
└── changelog/               # Changelog management
    └── update-changelog.py  # Automated changelog generation
```

**Purpose**: Automation and utility scripts for common tasks.

## Test Structure

```
tests/                       # Test suites (planned)
├── unit/                    # Unit tests
│   ├── auth/               # Auth module tests
│   ├── tools/              # Individual tool tests
│   └── utils/              # Utility function tests
│
├── integration/             # Integration tests
│   ├── google-api/         # API integration tests
│   ├── redis/              # Cache integration tests
│   └── mcp/                # MCP protocol tests
│
└── e2e/                     # End-to-end tests
    ├── workflows/          # Complete workflow tests
    └── performance/        # Performance benchmarks
```

**Purpose**: Comprehensive testing coverage (currently not implemented).

## Docker Structure

### Dockerfile Organization
```
Dockerfile
├── Stage 1: Dependencies    # Install system deps
├── Stage 2: Build          # Compile TypeScript
├── Stage 3: Runtime        # Production image
└── Health Check            # Container health
```

### Docker Compose Services
```
docker-compose.yml
├── Service: gdrive-mcp     # Main MCP server
│   ├── Volumes: credentials, data, logs
│   └── Depends: redis
│
└── Service: redis          # Caching layer
    └── Volume: redis_data
```

## File Naming Conventions

### Source Files
- **Classes**: PascalCase (e.g., `AuthManager.ts`)
- **Utilities**: kebab-case (e.g., `health-check.ts`)
- **Interfaces**: Prefix with 'I' for complex types
- **Tests**: `*.test.ts` or `*.spec.ts`

### Configuration Files
- **Hidden files**: Prefixed with `.` (e.g., `.env`)
- **Config files**: Direct names (e.g., `tsconfig.json`)
- **Docker files**: Capitalized (e.g., `Dockerfile`)

## Module Dependencies

### Dependency Graph
```
index.ts (Entry Point)
├── @modelcontextprotocol/sdk
├── googleapis
├── src/auth/AuthManager
│   ├── google-auth-library
│   └── src/auth/TokenManager
├── redis (CacheManager)
└── winston (Logger)
```

### Import Hierarchy
1. **Core modules** (Node.js built-ins)
2. **External packages** (npm dependencies)
3. **Internal modules** (project code)
4. **Type imports** (TypeScript types)

## Code Organization Principles

### Separation of Concerns
- **Authentication**: Isolated in `/src/auth`
- **Health Monitoring**: Separate utility file
- **Main Server**: Single responsibility in `index.ts`
- **Configuration**: Environment-based

### Modularity
- Each module exports a single class or set of related functions
- Clear interfaces between modules
- Dependency injection where appropriate

### Scalability Considerations
- Module structure supports easy addition of new features
- Clear separation allows for microservice extraction
- Stateless design enables horizontal scaling

## Future Structure Considerations

### Planned Additions
```
src/
├── cache/                   # Cache abstraction layer
│   └── CacheManager.ts     # Redis-agnostic interface
│
├── monitoring/             # Enhanced monitoring
│   ├── PerformanceMonitor.ts
│   └── MetricsCollector.ts
│
├── tools/                  # Individual tool implementations
│   ├── drive/
│   ├── sheets/
│   └── docs/
│
└── utils/                  # Shared utilities
    ├── logger.ts
    └── validators.ts
```

### Refactoring Opportunities
1. Extract tool implementations into separate modules
2. Create abstraction layer for Google APIs
3. Implement dependency injection container
4. Add middleware layer for request processing

## Development Workflow

### Local Development
```bash
# Start from project root
cd gdrive/

# Install dependencies
npm install

# Build project
npm run build

# Watch mode for development
npm run watch

# Run tests
npm test
```

### Adding New Features
1. Create module in appropriate `/src` subdirectory
2. Export from module index
3. Import in `index.ts` or consuming module
4. Add tests in corresponding `/tests` directory
5. Update documentation

### Code Review Checklist
- [ ] Follows file naming conventions
- [ ] Placed in correct directory
- [ ] Proper module exports
- [ ] Tests in parallel structure
- [ ] Documentation updated
- [ ] No circular dependencies