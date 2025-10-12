# Naming Conventions Guide

## 🎯 Overview

This document establishes official naming conventions for consistent code, file, and project organization. These conventions can be applied across all repositories and projects for maximum consistency and readability.

## 📁 File and Directory Naming

### Markdown Files

**Use kebab-case for all regular documentation:**

- ✅ `api-reference.md`
- ✅ `installation-guide.md`
- ✅ `troubleshooting-tips.md`
- ✅ `user-authentication.md`
- ❌ `API_REFERENCE.md`
- ❌ `Installation_Guide.md`
- ❌ `UserAuthentication.md`

**Exception - Special Files (ALL_CAPS):**

- ✅ `README.md`
- ✅ `CHANGELOG.md`
- ✅ `ROADMAP.md`
- ✅ `LICENSE.md`
- ✅ `SECURITY.md`
- ✅ `CONTRIBUTING.md`
- ✅ `CLAUDE.md` (project-specific configuration)

**Use YAML frontmatter for all markdown files except Special Files (README.md, CHANGELOG.md, LICENSE.md, SECURITY.md, CONTRIBUTING.md, CLAUDE.md), all other markdown files must include frontmatter with the following fields:**

```yaml
  ---
  title: "Document Title"
  description: "A brief, one-sentence summary of the document's purpose."
  category: "Primary Category"
  subcategory: "Secondary Category"
  product_line: "Associated Product"
  audience: "Intended Audience"
  status: "Document Status"
  author: "AOJDevStudio"
  created_date: "YYYY-MM-DD"
  last_updated: "YYYY-MM-DD"
  tags:
    - keyword1
    - keyword2
    - keyword3
  ---

```

### Source Code Files

**JavaScript/TypeScript:**

- ✅ `user-service.js`
- ✅ `data-processor.ts`
- ✅ `auth-middleware.js`
- ❌ `UserService.js`
- ❌ `dataProcessor.ts`
- ❌ `auth_middleware.js`

**Configuration Files:**

- ✅ `eslint.config.js`
- ✅ `typescript.config.json`
- ✅ `docker-compose.yml`
- ❌ `ESLint.config.js`
- ❌ `TypeScript_Config.json`

### Directory Structure

**Use kebab-case for directories:**

- ✅ `src/user-management/`
- ✅ `docs/api-reference/`
- ✅ `tests/integration-tests/`
- ❌ `src/UserManagement/`
- ❌ `docs/API_Reference/`
- ❌ `tests/integration_tests/`

**Exception - Node.js conventions:**

- ✅ `node_modules/` (follow ecosystem standard)
- ✅ `.github/` (follow platform standard)

## 💻 Code Naming Conventions

### Variables and Functions

**Use camelCase:**

```javascript
// ✅ Good
const userName = 'john_doe';
const apiKey = process.env.API_KEY;
const isAuthenticated = true;

function getUserProfile(userId) {
  return database.findUser(userId);
}

const calculateTotalAmount = (items) => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

// ❌ Bad
const user_name = 'john_doe';
const UserName = 'john_doe';
const user-name = 'john_doe';

function get_user_profile(user_id) {
  return database.find_user(user_id);
}
```

### Constants

**Use SCREAMING_SNAKE_CASE:**

```javascript
// ✅ Good
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT = 5000;

// ❌ Bad
const maxRetryAttempts = 3;
const apiBaseUrl = 'https://api.example.com';
const defaultTimeout = 5000;
```

### Classes and Constructors

**Use PascalCase:**

```javascript
// ✅ Good
class UserManager {
  constructor(config) {
    this.config = config;
  }
}

class ApiClient {
  async fetchData() {
    // implementation
  }
}

// ❌ Bad
class userManager {
  constructor(config) {
    this.config = config;
  }
}

class api_client {
  async fetch_data() {
    // implementation
  }
}
```

### Object Properties

**Use camelCase for object properties:**

```javascript
// ✅ Good
const userConfig = {
  firstName: 'John',
  lastName: 'Doe',
  emailAddress: 'john@example.com',
  isActive: true,
  lastLoginDate: new Date()
};

// ❌ Bad
const userConfig = {
  first_name: 'John',
  last_name: 'Doe',
  'email-address': 'john@example.com',
  IsActive: true,
  'last-login-date': new Date()
};
```

## 🌐 API and URL Naming

### REST API Endpoints

**Use kebab-case for URL paths:**

```javascript
// ✅ Good
GET /api/user-profiles
POST /api/authentication-tokens
PUT /api/user-settings/{id}
DELETE /api/session-data/{sessionId}

// ❌ Bad
GET /api/userProfiles
POST /api/authentication_tokens
PUT /api/UserSettings/{id}
DELETE /api/session_Data/{sessionId}
```

### Query Parameters

**Use camelCase for query parameters:**

```javascript
// ✅ Good
GET /api/users?firstName=John&isActive=true&pageSize=20

// ❌ Bad
GET /api/users?first_name=John&is_active=true&page_size=20
GET /api/users?first-name=John&is-active=true&page-size=20
```

## 📦 Package and Project Naming

### NPM Package Names

**Use kebab-case with scope:**

```json
{
  "name": "@simple-memory/mcp-server",
  "name": "@company/user-authentication",
  "name": "@tools/data-processor"
}
```

**Avoid:**

```json
{
  "name": "@simple_memory/mcp_server",
  "name": "@Company/UserAuthentication",
  "name": "@tools/dataProcessor"
}
```

### Git Repository Names

**Use kebab-case:**

- ✅ `simple-memory-mcp`
- ✅ `user-authentication-service`
- ✅ `data-processing-pipeline`
- ❌ `simple_memory_mcp`
- ❌ `UserAuthenticationService`
- ❌ `dataProcessingPipeline`

## 🗄️ Database Naming

### Table Names

**Use snake_case (following SQL conventions):**

```sql
-- ✅ Good
CREATE TABLE user_profiles (
  user_id SERIAL PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email_address VARCHAR(100),
  created_at TIMESTAMP
);

-- ❌ Bad
CREATE TABLE userProfiles (
  userId SERIAL PRIMARY KEY,
  firstName VARCHAR(50),
  lastName VARCHAR(50),
  emailAddress VARCHAR(100),
  createdAt TIMESTAMP
);
```

### Column Names

**Use snake_case:**

```sql
-- ✅ Good
user_id, first_name, email_address, created_at, is_active

-- ❌ Bad
userId, firstName, emailAddress, createdAt, isActive
```

## 🔧 Configuration and Environment

### Environment Variables

**Use SCREAMING_SNAKE_CASE:**

```bash
# ✅ Good
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET_KEY=abc123
MAX_RETRY_ATTEMPTS=3
OBSIDIAN_VAULT_PATH=/path/to/vault

# ❌ Bad
databaseUrl=postgresql://localhost:5432/mydb
apiSecretKey=abc123
maxRetryAttempts=3
obsidian-vault-path=/path/to/vault
```

### Configuration Files

**Use kebab-case for filenames, appropriate casing for content:**

```javascript
// eslint.config.js
export default {
  rules: {
    'no-unused-vars': 'error',
    'prefer-const': 'warn'
  }
};

// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "moduleResolution": "node"
  }
}
```

## 📊 JSON and Data Formats

### JSON Keys

**Use camelCase for API responses and configuration:**

```json
{
  "userId": 123,
  "firstName": "John",
  "lastName": "Doe",
  "emailAddress": "john@example.com",
  "createdAt": "2023-01-15T10:30:00Z",
  "userPreferences": {
    "darkMode": true,
    "notificationsEnabled": false
  }
}
```

### Exception - External APIs

**Match the external API's conventions:**

```json
// If external API uses snake_case, match it
{
  "user_id": 123,
  "first_name": "John",
  "created_at": "2023-01-15T10:30:00Z"
}
```

## 🎨 CSS and Styling

### CSS Classes

**Use kebab-case:**

```css
/* ✅ Good */
.user-profile-card {
  background-color: #f5f5f5;
}

.navigation-menu-item {
  padding: 10px;
}

.is-active {
  color: #007bff;
}

/* ❌ Bad */
.userProfileCard {
  background-color: #f5f5f5;
}

.navigation_menu_item {
  padding: 10px;
}

.IsActive {
  color: #007bff;
}
```

### CSS Custom Properties

**Use kebab-case:**

```css
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --font-size-large: 1.2rem;
  --border-radius-small: 4px;
}
```

## 🧪 Testing

### Test Files

**Use kebab-case with descriptive suffixes:**

- ✅ `user-service.test.js`
- ✅ `auth-middleware.spec.js`
- ✅ `integration-api.test.js`
- ❌ `UserService.test.js`
- ❌ `auth_middleware_spec.js`

### Test Descriptions

**Use descriptive sentences:**

```javascript
// ✅ Good
describe('UserService', () => {
  it('should return user profile when valid ID provided', () => {
    // test implementation
  });

  it('should throw error when user ID does not exist', () => {
    // test implementation
  });
});

// ❌ Bad
describe('UserService', () => {
  it('returns user', () => {
    // test implementation
  });

  it('throws error', () => {
    // test implementation
  });
});
```

## 🚀 Deployment and Infrastructure

### Docker Images

**Use kebab-case:**

```dockerfile
# ✅ Good
FROM node:18-alpine AS simple-memory-mcp
FROM nginx:alpine AS api-gateway

# ❌ Bad
FROM node:18-alpine AS SimpleMemoryMCP
FROM nginx:alpine AS api_gateway
```

### Docker Compose Services

**Use kebab-case:**

```yaml
# docker-compose.yml
version: '3.8'
services:
  api-server:
    build: .
    ports:
      - "3000:3000"

  postgres-db:
    image: postgres:14
    environment:
      POSTGRES_DB: simple_memory
```

## 📋 Quick Reference

| Context              | Convention           | Example                |
| -------------------- | -------------------- | ---------------------- |
| **Files**            | kebab-case           | `user-service.js`      |
| **Special Files**    | ALL_CAPS             | `README.md`            |
| **Directories**      | kebab-case           | `src/user-management/` |
| **Variables**        | camelCase            | `userName`             |
| **Constants**        | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`   |
| **Classes**          | PascalCase           | `UserManager`          |
| **Functions**        | camelCase            | `getUserProfile()`     |
| **API Endpoints**    | kebab-case           | `/api/user-profiles`   |
| **Query Params**     | camelCase            | `?firstName=John`      |
| **Database Tables**  | snake_case           | `user_profiles`        |
| **Database Columns** | snake_case           | `first_name`           |
| **Environment Vars** | SCREAMING_SNAKE_CASE | `DATABASE_URL`         |
| **CSS Classes**      | kebab-case           | `.user-profile-card`   |
| **NPM Packages**     | kebab-case           | `@scope/package-name`  |
| **Git Repos**        | kebab-case           | `simple-memory-mcp`    |

## ✅ Validation Checklist

Before committing code, verify:

- [ ] All file names use kebab-case (except special ALL_CAPS files)
- [ ] JavaScript variables and functions use camelCase
- [ ] Classes use PascalCase
- [ ] Constants use SCREAMING_SNAKE_CASE
- [ ] CSS classes use kebab-case
- [ ] API endpoints use kebab-case paths
- [ ] Environment variables use SCREAMING_SNAKE_CASE
- [ ] Database schema uses snake_case
- [ ] Test files and descriptions are descriptive
- [ ] Documentation links reference correct file names

## 🔄 Migration Strategy

When applying these conventions to existing projects:

1. **Audit Current Naming**: Identify inconsistencies
2. **Prioritize by Impact**: Start with public APIs and documentation
3. **Batch Similar Changes**: Rename all files of the same type together
4. **Update References**: Ensure all links and imports are updated
5. **Test Thoroughly**: Verify nothing breaks after renaming
6. **Document Changes**: Update documentation with new conventions

## 🎯 Benefits

Following these conventions provides:

- **Consistency**: Predictable naming across all projects
- **Readability**: Clear, descriptive names that are easy to understand
- **Maintainability**: Easier to navigate and modify codebases
- **Team Efficiency**: Reduced cognitive load when switching between projects
- **Professional Quality**: Clean, organized code that follows industry standards

---

_This document should be included in all repositories and referenced in project README files for consistency across all development work._
