#!/usr/bin/env node
import { createLogger, format, transports } from 'winston';
import { TokenManager } from './auth/TokenManager.js';
import { AuthManager, AuthState } from './auth/AuthManager.js';

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED', 
  UNHEALTHY = 'UNHEALTHY',
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  checks: {
    tokenStatus: {
      status: 'pass' | 'fail' | 'warn';
      message: string;
      metadata?: {
        expiresIn?: number;
        state?: AuthState;
        lastRefresh?: string;
      };
    };
    refreshCapability: {
      status: 'pass' | 'fail';
      message: string;
    };
  };
  metrics?: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    executionTimeMs?: number;
  };
}

// Create logger for health check
const logger = createLogger({
  level: 'error', // Only log errors in health check
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
  ],
});

/**
 * Perform health check for OAuth token status
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const result: HealthCheckResult = {
    status: HealthStatus.HEALTHY,
    timestamp: new Date().toISOString(),
    checks: {
      tokenStatus: {
        status: 'pass',
        message: 'Token is valid',
      },
      refreshCapability: {
        status: 'pass',
        message: 'Token refresh capability available',
      },
    },
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
  };

  try {
    // Check if we have OAuth keys
    const oauthPath = process.env.GDRIVE_OAUTH_PATH ?? './gcp-oauth.keys.json';
    const fs = await import('fs/promises');
    
    let authManager: AuthManager | null = null;
    
    try {
      const keysContent = await fs.readFile(oauthPath, 'utf-8');
      const keys = JSON.parse(keysContent);
      const oauthKeys = keys.web ?? keys.installed;
      
      if (!oauthKeys) {
        throw new Error('Invalid OAuth keys format');
      }
      
      // Initialize managers
      const tokenManager = TokenManager.getInstance(logger);
      authManager = AuthManager.getInstance(oauthKeys, logger);
      
      // Load tokens
      const tokens = await tokenManager.loadTokens();
      
      if (!tokens) {
        result.checks.tokenStatus = {
          status: 'fail',
          message: 'No tokens found',
        };
        result.status = HealthStatus.UNHEALTHY;
      } else {
        // Check token expiry
        const now = Date.now();
        const expiresIn = tokens.expiry_date - now;
        
        if (tokenManager.isTokenExpired(tokens)) {
          result.checks.tokenStatus = {
            status: 'fail',
            message: 'Token is expired',
            metadata: {
              state: AuthState.TOKEN_EXPIRED,
            },
          };
          result.status = HealthStatus.UNHEALTHY;
        } else if (tokenManager.isTokenExpiringSoon(tokens, 10 * 60 * 1000)) {
          result.checks.tokenStatus = {
            status: 'warn',
            message: 'Token expiring soon',
            metadata: {
              expiresIn: Math.floor(expiresIn / 1000),
              state: AuthState.AUTHENTICATED,
            },
          };
          result.status = HealthStatus.DEGRADED;
        } else {
          result.checks.tokenStatus = {
            status: 'pass',
            message: 'Token is valid',
            metadata: {
              expiresIn: Math.floor(expiresIn / 1000),
              state: AuthState.AUTHENTICATED,
            },
          };
        }
        
        // Check refresh token exists
        if (!tokens.refresh_token) {
          result.checks.refreshCapability = {
            status: 'fail',
            message: 'No refresh token available',
          };
          result.status = HealthStatus.UNHEALTHY;
        }
      }
    } catch (error: unknown) {
      logger.error('Health check error', { error });
      
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        result.checks.tokenStatus = {
          status: 'fail',
          message: 'OAuth configuration not found',
        };
      } else {
        result.checks.tokenStatus = {
          status: 'fail',
          message: `Health check failed: ${(error instanceof Error ? error.message : String(error))}`,
        };
      }
      
      result.checks.refreshCapability = {
        status: 'fail',
        message: 'Cannot verify refresh capability',
      };
      
      result.status = HealthStatus.UNHEALTHY;
    } finally {
      // Clean up
      if (authManager) {
        authManager.stopTokenMonitoring();
      }
    }
  } catch (error: unknown) {
    logger.error('Unexpected health check error', { error });
    result.status = HealthStatus.UNHEALTHY;
    result.checks.tokenStatus = {
      status: 'fail',
      message: 'Unexpected error during health check',
    };
  }

  // Calculate execution time
  const executionTime = Date.now() - startTime;
  if (result.metrics) {
    result.metrics = {
      ...result.metrics,
      executionTimeMs: executionTime,
    };
  }

  return result;
}

/**
 * Main function for standalone health check script
 */
async function main() {
  try {
    const result = await performHealthCheck();
    
    // Output result as JSON
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with appropriate code
    switch (result.status) {
      case HealthStatus.HEALTHY:
        process.exit(0);
        break;
      case HealthStatus.DEGRADED:
        process.exit(1);
        break;
      case HealthStatus.UNHEALTHY:
        process.exit(2);
        break;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    process.exit(2);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}