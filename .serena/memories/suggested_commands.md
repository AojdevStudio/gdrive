# Suggested Commands for Development

## Build and Development Commands
- `npm run build` - Compile TypeScript to JavaScript in dist/ folder
- `npm run watch` - Watch mode for development (auto-rebuild on changes)
- `npm run prepare` - Runs build automatically (used by npm install)

## Testing Commands
- `npm test` - Run complete Jest test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run end-to-end tests

## Quality Assurance Commands
- `npm run lint` - Run ESLint for code quality
- `npm run type-check` - TypeScript type checking (no emit)

## Authentication Commands
- `node ./dist/index.js auth` - Run authentication flow to get Google Drive credentials
- `node ./dist/index.js migrate-tokens` - Migrate legacy tokens to new format
- `node ./dist/index.js verify-keys` - Verify encryption key integrity
- `node ./dist/index.js rotate-key` - Rotate encryption keys

## Server Commands
- `node ./dist/index.js` - Start the MCP server on stdio transport

## BMAD Framework Commands
- `npm run bmad:refresh` - Reinstall BMAD core and regenerate AGENTS.md
- `npm run bmad:list` - List all available agents
- `npm run bmad:validate` - Validate BMAD configuration

## Docker Commands
- `docker build -t gdrive-mcp-server .` - Build Docker image
- `docker-compose up -d` - Start with Redis caching
- `./scripts/auth.sh` - Authentication helper script

## Task Completion Commands
When a task is completed, run:
1. `npm run lint` - Ensure code style compliance
2. `npm run type-check` - Verify TypeScript types
3. `npm test` - Run tests to ensure functionality
4. `npm run build` - Compile for production