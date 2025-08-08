# Coding Standards

## Overview
This document defines the coding standards and conventions used throughout the Google Drive MCP Server codebase. Following these standards ensures consistency, maintainability, and quality across the project.

## TypeScript Standards

### General Principles
- **Type Safety First**: Always prefer explicit types over `any`
- **Strict Mode**: All TypeScript strict flags are enabled
- **ES2022 Features**: Use modern JavaScript features (async/await, optional chaining, nullish coalescing)
- **Functional Approach**: Prefer immutability and pure functions where practical

### Naming Conventions

#### Files and Directories
```typescript
// Files: PascalCase for classes/types, camelCase for utilities
AuthManager.ts       // Class file
TokenManager.ts      // Class file
health-check.ts      // Utility file
index.ts             // Entry points

// Directories: kebab-case
src/auth/            // Authentication module
src/health-check/    // Health monitoring
```

#### Variables and Functions
```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const TOKEN_REFRESH_INTERVAL = 1800000;

// Variables: camelCase
let authState: AuthState;
const refreshToken = await getRefreshToken();

// Functions: camelCase, verb-noun pattern
async function refreshAccessToken(): Promise<void> { }
function parseNaturalLanguageQuery(query: string): QueryResult { }

// Private methods: prefix with underscore
private _encryptTokens(tokens: TokenData): string { }
```

#### Classes and Interfaces
```typescript
// Classes: PascalCase
class AuthManager {
  private oauth2Client: OAuth2Client;
  constructor() { }
}

// Interfaces: PascalCase, prefix with 'I' for complex types
interface IHealthCheckResult {
  status: HealthStatus;
  timestamp: string;
}

// Type aliases: PascalCase
type AuthState = 'authenticated' | 'expired' | 'failed';

// Enums: PascalCase for name, UPPER_SNAKE_CASE for values
enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY'
}
```

### Code Organization

#### Module Structure
```typescript
// 1. Imports (grouped and ordered)
import { OAuth2Client } from 'google-auth-library';
import { drive_v3 } from 'googleapis';
import * as fs from 'fs/promises';

// 2. Constants
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// 3. Types/Interfaces
interface TokenData {
  access_token: string;
  refresh_token?: string;
}

// 4. Main class/function
export class AuthManager {
  // 5. Properties
  private oauth2Client: OAuth2Client;
  
  // 6. Constructor
  constructor(clientId: string) { }
  
  // 7. Public methods
  public async initialize(): Promise<void> { }
  
  // 8. Private methods
  private async _loadTokens(): Promise<void> { }
}

// 9. Helper functions
function validateTokens(tokens: TokenData): boolean { }

// 10. Exports
export { TokenData };
```

### Error Handling

#### Consistent Error Pattern
```typescript
// Always use try-catch with proper error typing
try {
  const result = await performOperation();
  return result;
} catch (error) {
  // Type guard for Error instances
  if (error instanceof Error) {
    logger.error('Operation failed', {
      error: error.message,
      stack: error.stack,
      context: { operation: 'performOperation' }
    });
    
    // Re-throw with context
    throw new Error(`Operation failed: ${error.message}`);
  }
  
  // Handle unknown errors
  logger.error('Unknown error occurred', { error });
  throw new Error('Operation failed: Unknown error');
}
```

#### Custom Error Classes
```typescript
// Define specific error types
export class AuthenticationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Usage
throw new AuthenticationError('Invalid credentials', 'AUTH_INVALID');
```

### Async/Await Patterns

#### Proper Async Usage
```typescript
// Always use async/await over promises
// Good
async function fetchFile(fileId: string): Promise<FileData> {
  const file = await drive.files.get({ fileId });
  return file.data;
}

// Avoid
function fetchFile(fileId: string): Promise<FileData> {
  return drive.files.get({ fileId }).then(file => file.data);
}

// Parallel operations
const [file, metadata] = await Promise.all([
  drive.files.get({ fileId }),
  drive.files.get({ fileId, fields: 'metadata' })
]);
```

### Performance Patterns

#### Caching Implementation
```typescript
// Consistent caching pattern
async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Check cache
  const cached = await cacheManager.get(key);
  if (cached) {
    performanceMonitor.recordCacheHit();
    return cached as T;
  }
  
  // 2. Fetch data
  performanceMonitor.recordCacheMiss();
  const data = await fetcher();
  
  // 3. Store in cache
  await cacheManager.set(key, data);
  
  return data;
}
```

#### Performance Tracking
```typescript
// Standard performance tracking wrapper
async function trackPerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    performanceMonitor.track(operation, Date.now() - startTime);
    return result;
  } catch (error) {
    performanceMonitor.track(operation, Date.now() - startTime, true);
    throw error;
  }
}
```

### Testing Standards

#### Test Organization
```typescript
// Test file naming: *.test.ts or *.spec.ts
AuthManager.test.ts

// Test structure
describe('AuthManager', () => {
  let authManager: AuthManager;
  
  beforeEach(() => {
    authManager = new AuthManager();
  });
  
  describe('initialize', () => {
    it('should load tokens successfully', async () => {
      // Arrange
      const mockTokens = { access_token: 'test' };
      
      // Act
      await authManager.initialize();
      
      // Assert
      expect(authManager.isAuthenticated()).toBe(true);
    });
    
    it('should handle missing tokens gracefully', async () => {
      // Test error cases
    });
  });
});
```

### Documentation Standards

#### JSDoc Comments
```typescript
/**
 * Manages OAuth2 authentication for Google APIs
 * @class AuthManager
 * @example
 * const auth = new AuthManager(clientId, clientSecret);
 * await auth.initialize();
 */
export class AuthManager {
  /**
   * Refreshes the access token using the stored refresh token
   * @returns {Promise<void>} Resolves when token is refreshed
   * @throws {AuthenticationError} When refresh token is invalid
   */
  async refreshAccessToken(): Promise<void> {
    // Implementation
  }
}
```

#### Inline Comments
```typescript
// Use comments to explain "why", not "what"
// Good: Explains business logic
// Google Sheets has a different export limit than other services
const MAX_SHEET_CELLS = 5_000_000;

// Avoid: States the obvious
// Set variable to 5
const retries = 5;
```

### MCP-Specific Standards

#### Tool Implementation Pattern
```typescript
// Standard tool implementation structure
case "toolName": {
  // 1. Input validation
  if (!args || !args.requiredParam) {
    throw new Error('requiredParam is required');
  }
  
  // 2. Performance tracking start
  const startTime = Date.now();
  
  try {
    // 3. Cache check
    const cacheKey = `tool:${JSON.stringify(args)}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      performanceMonitor.track('toolName', Date.now() - startTime);
      return cached;
    }
    
    // 4. Main operation
    const result = await performToolOperation(args);
    
    // 5. Cache result
    await cacheManager.set(cacheKey, result);
    
    // 6. Return MCP-formatted response
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    // 7. Error handling
    performanceMonitor.track('toolName', Date.now() - startTime, true);
    throw error;
  }
}
```

#### Response Formatting
```typescript
// Consistent MCP response format
interface MCPResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

// Helper function for formatting
function formatMCPResponse(data: any, type: string = "text"): MCPResponse {
  return {
    content: [{
      type,
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    }]
  };
}
```

### Logging Standards

#### Structured Logging
```typescript
// Use consistent log structure
logger.info('Operation completed', {
  operation: 'fetchFile',
  fileId: 'abc123',
  duration: 150,
  timestamp: new Date().toISOString()
});

// Error logging with context
logger.error('Operation failed', {
  operation: 'fetchFile',
  error: error.message,
  stack: error.stack,
  context: {
    fileId: 'abc123',
    userId: 'user456'
  }
});
```

### Security Standards

#### Token Handling
```typescript
// Never log sensitive data
// Bad
logger.info('Token refreshed', { token: accessToken });

// Good
logger.info('Token refreshed', { 
  tokenType: 'access',
  expiresIn: 3600 
});

// Always encrypt stored credentials
const encrypted = crypto.createCipher('aes-256-gcm', key);
```

#### Input Validation
```typescript
// Validate all external inputs
function validateFileId(fileId: string): void {
  if (!fileId || typeof fileId !== 'string') {
    throw new Error('Invalid file ID');
  }
  
  // Google Drive file ID pattern
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    throw new Error('Invalid file ID format');
  }
}
```

### Code Quality Rules

#### Complexity Limits
- Maximum function length: 50 lines
- Maximum file length: 500 lines
- Cyclomatic complexity: < 10
- Maximum parameters: 4 (use objects for more)

#### Import Organization
```typescript
// Order: External -> Internal -> Types
// 1. Node built-ins
import * as fs from 'fs';
import * as path from 'path';

// 2. External packages
import { OAuth2Client } from 'google-auth-library';
import { drive_v3 } from 'googleapis';

// 3. Internal modules
import { AuthManager } from './auth/AuthManager';
import { logger } from './utils/logger';

// 4. Types
import type { TokenData, AuthState } from './types';
```

### Git Commit Standards

#### Commit Message Format
```
<emoji> <type>: <description>

[optional body]

[optional footer]
```

#### Common Types
- ✨ feat: New feature
- 🐛 fix: Bug fix
- 📝 docs: Documentation
- 🎨 style: Code style
- ♻️ refactor: Code refactoring
- ✅ test: Testing
- 🔧 chore: Maintenance

### Review Checklist

Before submitting code:
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Follows naming conventions
- [ ] Proper error handling
- [ ] Performance tracking added
- [ ] Logging implemented
- [ ] Documentation updated
- [ ] Security considerations addressed