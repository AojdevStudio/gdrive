# Google Drive MCP Server Documentation Index

## Overview

The Google Drive MCP Server is a Model Context Protocol implementation that provides AI assistants with seamless access to Google Workspace services including Drive, Sheets, Docs, and Forms.

## Quick Links

- [README](../README.md) - Getting started and basic usage
- [API Documentation](./API.md) - Detailed API reference
- [Architecture](./ARCHITECTURE.md) - System design and components
- [Docker Guide](./DOCKER.md) - Containerization and deployment
- [Development Plan](../PLAN.md) - Roadmap and future features

## Documentation Structure

### 1. Getting Started
- **[README](../README.md)**
  - Installation instructions
  - Basic configuration
  - Quick start guide
  - Available tools and resources

### 2. Technical Documentation
- **[API Documentation](./API.md)**
  - MCP protocol implementation
  - Tool specifications
  - Request/response formats
  - Error handling
  - Rate limits and quotas

- **[Architecture](./ARCHITECTURE.md)**
  - System components
  - Data flow diagrams
  - Security model
  - Extension points
  - Performance considerations

### 3. Deployment
- **[Docker Guide](./DOCKER.md)**
  - Container setup
  - Docker Compose configuration
  - Claude Desktop integration
  - Production deployment
  - Security best practices

### 4. Development
- **[Development Plan](../PLAN.md)**
  - Planned features
  - Implementation phases
  - Technical requirements
  - Timeline estimates

## Feature Matrix

| Feature | Current Status | Documentation |
|---------|---------------|---------------|
| Google Drive Search | ✅ Implemented | [API.md#search](./API.md#search) |
| File Reading | ✅ Implemented | [API.md#read](./API.md#read) |
| Sheets Reading | ✅ Implemented | [API.md#readsheet](./API.md#readsheet) |
| File Creation | 📋 Planned | [PLAN.md](../PLAN.md) |
| Sheets Writing | 📋 Planned | [PLAN.md](../PLAN.md) |
| Docs Integration | 📋 Planned | [PLAN.md](../PLAN.md) |
| Forms Support | 📋 Planned | [PLAN.md](../PLAN.md) |
| Docker Support | 📋 Planned | [DOCKER.md](./DOCKER.md) |

## Key Concepts

### Model Context Protocol (MCP)
MCP is an open protocol that standardizes how applications provide context to LLMs. Think of it as a USB-C port for AI applications - providing a standardized way to connect AI models to different data sources and tools.

### Google Workspace Integration
The server integrates with:
- **Google Drive**: File management and search
- **Google Sheets**: Spreadsheet data access and manipulation
- **Google Docs**: Document creation and editing
- **Google Forms**: Form creation and response handling

### Authentication
Uses OAuth 2.0 for secure authentication with Google APIs. Credentials are stored locally and never transmitted.

## Common Use Cases

### 1. Data Analysis
- Search for spreadsheets
- Read and analyze data
- Export results

### 2. Document Management
- Search for documents
- Read content
- Create summaries

### 3. Form Automation
- Create survey forms
- Collect responses
- Analyze results

### 4. Workflow Integration
- Automate file operations
- Sync data between services
- Generate reports

## API Overview

### Available Tools

| Tool | Purpose | Status |
|------|---------|--------|
| `search` | Search Google Drive | ✅ Ready |
| `read` | Read file contents | ✅ Ready |
| `listSheets` | List spreadsheet sheets | ✅ Ready |
| `readSheet` | Read sheet data | ✅ Ready |
| `createFile` | Create new files | 📋 Planned |
| `updateSheet` | Update sheet data | 📋 Planned |
| `createForm` | Create Google Forms | 📋 Planned |

### Resource Format
- Pattern: `gdrive:///<file_id>`
- Example: `gdrive:///1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

## Configuration

### Environment Variables
```bash
# Authentication
GDRIVE_CREDENTIALS_PATH=~/.gdrive-server-credentials.json
GDRIVE_OAUTH_PATH=~/gcp-oauth.keys.json

# Logging (planned)
LOG_LEVEL=info
LOG_FORMAT=json

# Performance (planned)
CACHE_ENABLED=true
MAX_CONCURRENT_REQUESTS=10
```

### OAuth Scopes
Current:
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`

Planned:
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/forms`

## Development Workflow

### 1. Setup
```bash
npm install
npm run build
node dist/index.js auth
```

### 2. Development
```bash
npm run watch  # Auto-rebuild on changes
```

### 3. Testing
```bash
npm test       # Run tests (planned)
npm run lint   # Check code style (planned)
```

### 4. Deployment
```bash
docker build -t gdrive-mcp .
docker run -i gdrive-mcp
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure OAuth credentials are valid
   - Check scope permissions
   - Re-run authentication flow

2. **API Limits**
   - Monitor quota usage
   - Implement caching
   - Use batch requests

3. **Connection Issues**
   - Verify network connectivity
   - Check firewall settings
   - Validate Docker configuration

### Debug Mode
```bash
LOG_LEVEL=debug node dist/index.js
```

## Contributing

### Code Style
- TypeScript with strict mode
- ESLint configuration (planned)
- Prettier formatting (planned)

### Testing
- Unit tests for tools
- Integration tests for APIs
- E2E tests for workflows

### Documentation
- Keep README updated
- Document new features
- Add code examples

## Support

### Resources
- [GitHub Issues](https://github.com/your-repo/issues)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Google APIs Documentation](https://developers.google.com/apis)

### Contact
- Create an issue for bugs
- Discussion forum for questions
- Pull requests for contributions

## License

This project is licensed under the MIT License. See [LICENSE](../LICENSE) file for details.

---

Last updated: January 2024