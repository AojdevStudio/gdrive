# Google Drive MCP Server Documentation

Welcome to the documentation for the Google Drive MCP Server. This index helps you navigate all available guides, references, and examples.

## Quick Navigation

### Getting Started

Start here if you're new to the project:

1. **[Initial Setup and Installation](./Guides/01-initial-setup.md)** - Google Cloud configuration and local installation
2. **[Authentication Flow Guide](./Guides/02-authentication-flow.md)** - Complete OAuth 2.0 authentication process
3. **[Docker Deployment](./Guides/03-docker-deployment.md)** - Containerized deployment setup

### API and Developer Resources

Learn about using the MCP server:

- **[API Documentation](./Developer-Guidelines/API.md)** - Complete API reference with all tools and operations
- **[Examples](./Examples/)** - Code examples and usage patterns for all operations

### Advanced Topics

- **[Claude Desktop Integration](./Guides/05-claude-desktop-integration.md)** - Connect to Claude Desktop
- **[Environment Variables](./Guides/06-environment-variables.md)** - Configuration and optimization
- **[Deployment Guide](./Deployment/DOCKER.md)** - Docker and production deployment details
- **[Architecture Documentation](./Architecture/ARCHITECTURE.md)** - System design and components

### Migration and Upgrades

- **[v1.x to v2.0.0 Migration Guide](./MIGRATION_V2.md)** - Detailed guide for updating from v1.x (41+ tools) to v2.0.0 (5 consolidated tools)
- **[Tool Consolidation Guide](./Migration/consolidation-guide.md)** - Technical implementation reference for HOW2MCP patterns

### Troubleshooting

- **[Troubleshooting Guide](./Troubleshooting/)** - Solutions for common issues and problems

---

## Documentation Structure

```
docs/
├── README.md (this file)
├── MIGRATION_V2.md                   # User migration guide v1.x → v2.0.0
├── authentication.md                 # Token security & refresh details
│
├── Architecture/                      # System design documentation
│   ├── ARCHITECTURE.md               # Complete architecture overview
│   └── [other architecture docs]
│
├── Deployment/                        # Deployment guides
│   └── DOCKER.md                     # Docker setup and configuration
│
├── Developer-Guidelines/              # Developer resources
│   ├── API.md                        # API reference documentation
│   └── [other developer docs]
│
├── Examples/                          # Code examples
│   ├── [example implementations]
│   └── README.md                     # Examples index
│
├── Guides/                            # Step-by-step guides
│   ├── 01-initial-setup.md           # Google Cloud setup
│   ├── 02-authentication-flow.md     # OAuth authentication
│   ├── 03-docker-deployment.md       # Docker setup
│   ├── 05-claude-desktop-integration.md
│   ├── 06-environment-variables.md
│   └── [other guides]
│
├── Migration/                         # Migration documentation
│   └── consolidation-guide.md        # HOW2MCP implementation reference
│
├── Research/                          # Research and reference materials
│   └── [archived research docs]
│
└── Troubleshooting/                   # Troubleshooting guides
    └── [troubleshooting documents]
```

---

## Documentation by Use Case

### I want to set up the server locally
1. [Initial Setup and Installation](./Guides/01-initial-setup.md)
2. [Authentication Flow Guide](./Guides/02-authentication-flow.md)
3. [Environment Variables](./Guides/06-environment-variables.md)

### I want to deploy with Docker
1. [Docker Deployment](./Guides/03-docker-deployment.md)
2. [Claude Desktop Integration](./Guides/05-claude-desktop-integration.md) (if using Claude)

### I want to use the MCP server
1. [API Documentation](./Developer-Guidelines/API.md)
2. [Examples](./Examples/)
3. [Claude Desktop Integration](./Guides/05-claude-desktop-integration.md) (for Claude users)

### I'm migrating from v1.x
1. [v1.x to v2.0.0 Migration Guide](./MIGRATION_V2.md)
2. [API Documentation](./Developer-Guidelines/API.md) (for new tool names)

### I need to understand the architecture
1. [Architecture Documentation](./Architecture/ARCHITECTURE.md)
2. [Tool Consolidation Guide](./Migration/consolidation-guide.md) (for v2.0.0 patterns)

### I'm experiencing issues
1. Check the relevant [Troubleshooting Guide](./Troubleshooting/)
2. Review [Authentication Flow Guide](./Guides/02-authentication-flow.md) for auth issues
3. Check [Docker Deployment](./Guides/03-docker-deployment.md) for Docker issues

---

## Key Documents Explained

### authentication.md
**Purpose**: Technical reference for token encryption, refresh mechanisms, and security features.
**Audience**: Developers working on authentication systems or deploying production systems.
**Key Topics**: Token encryption, audit logging, health checks, Docker integration.

### Guides/02-authentication-flow.md
**Purpose**: Step-by-step user guide for completing OAuth authentication.
**Audience**: New users setting up the server.
**Key Topics**: Browser authentication, token storage, automatic refresh, troubleshooting.

### MIGRATION_V2.md
**Purpose**: User guide for migrating from v1.x (41+ individual tools) to v2.0.0 (5 consolidated tools).
**Audience**: Existing users upgrading to v2.0.0.
**Key Topics**: Breaking changes, tool consolidation, migration examples, FAQ.

### Migration/consolidation-guide.md
**Purpose**: Technical implementation reference for operation-based tool consolidation.
**Audience**: Developers implementing new tools or refactoring existing ones.
**Key Topics**: Zod schemas, handler patterns, centralized logging, testing.

---

## Authentication Documentation

The server uses a multi-layered authentication system:

- **User-facing**: Start with [02-authentication-flow.md](./Guides/02-authentication-flow.md)
- **Technical details**: Refer to [authentication.md](./authentication.md) for security implementation
- **Production**: See [Docker Deployment](./Deployment/DOCKER.md) for containerized setup

---

## Tool Documentation

### Operation-Based Tools (v2.0.0+)

The server provides 5 consolidated operation-based tools:

1. **drive** - File operations (search, read, create, update, batch)
2. **sheets** - Spreadsheet operations (list, read, update, format, etc.)
3. **forms** - Form operations (create, get, addQuestion, listResponses)
4. **docs** - Document operations (create, insertText, replaceText, etc.)
5. **batch** - Batch file operations

See [API Documentation](./Developer-Guidelines/API.md) for complete reference.

### Legacy Tools (v1.x)

If you're still using v1.x with 41+ individual tools, refer to [MIGRATION_V2.md](./MIGRATION_V2.md) for upgrade instructions.

---

## Examples and Code Samples

Complete code examples for all operations:

- **Drive operations**: [Examples/01-drive-operations.md](./Examples/01-drive-operations.md)
- **Sheets operations**: [Examples/02-sheets-operations.md](./Examples/02-sheets-operations.md)
- **Forms operations**: [Examples/03-forms-operations.md](./Examples/03-forms-operations.md)
- **Docs operations**: [Examples/04-docs-operations.md](./Examples/04-docs-operations.md)

---

## Research and Reference Materials

The `Research/` folder contains older research documents and API references. These are maintained for historical reference but may not reflect the current implementation. For current best practices, refer to:

- [Architecture Documentation](./Architecture/ARCHITECTURE.md)
- [Tool Consolidation Guide](./Migration/consolidation-guide.md)
- [API Documentation](./Developer-Guidelines/API.md)

---

## Version Information

- **Current Version**: 2.0.0
- **Node.js Requirement**: 18+
- **MCP Specification**: v1.0

### Breaking Changes in v2.0.0

The v2.0.0 release consolidated 41+ individual tools into 5 operation-based tools. This is a **breaking change** that requires updating tool calls.

See [MIGRATION_V2.md](./MIGRATION_V2.md) for detailed migration instructions.

---

## Contributing to Documentation

When updating documentation:

1. Keep user-facing guides in `Guides/`
2. Keep API reference in `Developer-Guidelines/`
3. Keep examples in `Examples/`
4. Keep architecture docs in `Architecture/`
5. Keep troubleshooting guides in `Troubleshooting/`
6. Update this README.md index when adding new documents

---

## Support and Help

### Getting Help

- **API Issues**: Check [API Documentation](./Developer-Guidelines/API.md)
- **Setup Issues**: Check relevant [Guides](./Guides/)
- **Troubleshooting**: Check [Troubleshooting Guide](./Troubleshooting/)
- **Migration Issues**: Check [MIGRATION_V2.md](./MIGRATION_V2.md)

### Reporting Issues

When reporting issues, please include:
1. Which guide you were following
2. What step failed
3. Error message received
4. Your environment (OS, Node.js version, etc.)

---

**Last Updated**: December 23, 2025

For the latest information, always check the main [README.md](../README.md) in the project root.
