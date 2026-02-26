# GDrive MCP Server - Command Launchpad
set dotenv-load := true

cc := "claude --dangerously-skip-permissions"

# List all recipes
default:
  @just --list

# --- Development ---

# Compile TypeScript to dist/
build:
  npm run build

# Watch mode (auto-rebuild on change)
watch:
  npm run watch

# Run all unit tests
test:
  npm test

# Run tests in watch mode
test-watch:
  npm run test:watch

# Run tests with coverage report
test-coverage:
  npm run test:coverage

# Run integration tests
test-integration:
  npm run test:integration

# Run end-to-end tests
test-e2e:
  npm run test:e2e

# Run ESLint
lint:
  npm run lint

# TypeScript type checking (no emit)
type-check:
  npm run type-check

# --- CI ---

# Run full pre-push check suite (lint + type-check + test)
ci: lint type-check test

# --- BMAD ---

# Refresh BMAD method codex
bmad-refresh:
  npm run bmad:refresh

# List BMAD agents
bmad-list:
  npm run bmad:list

# Validate BMAD configuration
bmad-validate:
  npm run bmad:validate

# --- Server ---

# Run OAuth authentication flow (opens browser)
auth:
  node ./dist/index.js auth

# Start MCP server (stdio transport)
serve:
  node ./dist/index.js

# --- Docker ---

# Build Docker image
docker-build:
  docker build -t gdrive-mcp-server .

# Start server with Redis via docker-compose
docker-up:
  docker-compose up -d

# Stop docker-compose services
docker-down:
  docker-compose down

# View docker-compose logs (follow)
docker-logs:
  docker-compose logs -f

# Run standalone container (no Redis)
docker-run:
  docker run -i --rm \
    -v ${PWD}/credentials:/credentials:ro \
    -v ${PWD}/data:/data \
    -v ${PWD}/logs:/app/logs \
    --env-file .env \
    gdrive-mcp-server

# --- Scripts ---

# Rotate token encryption keys
rotate-keys:
  ./scripts/rotate-keys.sh

# Test server connectivity
test-server:
  ./scripts/test-server.sh

# Update changelog (auto-detect changes)
changelog:
  ./scripts/changelog/update-changelog.py --auto

# Run OAuth via auth script
auth-script:
  ./scripts/auth.sh

# Migrate encrypted tokens to new format
migrate-tokens:
  npx tsx ./scripts/migrate-tokens.ts

# --- Git ---

# Quick git status
gs:
  git status -sb

# Push current branch
push:
  git push origin HEAD

# --- Setup ---

# Interactive guided Cloudflare Workers setup (reads INSTALL.md, walks you through every step)
install:
  {{cc}} "Read INSTALL.md carefully, then follow every step in sequence to deploy the gdrive MCP server to Cloudflare Workers. Use the AskUserQuestion tool whenever you need input from me. Run all bash commands yourself — don't ask me to run them."

# Full dev setup: install deps, build, check encryption key
setup:
  npm install
  npm run build
  @echo "Setup complete. Ensure GDRIVE_TOKEN_ENCRYPTION_KEY is set in .env"
  @echo "Generate one with: openssl rand -base64 32"

# Generate a new token encryption key
gen-key:
  @openssl rand -base64 32

# --- Cleanup ---

# Remove build artifacts and coverage
clean:
  rm -rf dist/ coverage/
  rm -rf logs/*.log

# Full reset: clean + reinstall + rebuild
reset: clean
  rm -rf node_modules/
  npm install
  npm run build

# --- Claude Code ---

# Start Claude with skip-permissions (default: opus)
start model="opus":
  {{cc}} --model {{model}}

# Start Claude with project context loaded
start-ctx model="opus":
  {{cc}} --model {{model}} --append-system-prompt "$(cat CLAUDE.md)"

# Start Claude with planning docs loaded
start-plan model="opus":
  {{cc}} --model {{model}} --append-system-prompt "$(cat docs/planning/*.md 2>/dev/null)"
