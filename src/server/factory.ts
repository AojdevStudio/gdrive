/**
 * MCP Server factory for the v4 Code Mode architecture.
 *
 * Registers exactly 2 tools:
 *   - search: Query the SDK spec to discover available operations
 *   - execute: Run arbitrary agent code in the NodeSandbox with full SDK access
 *
 * The 6 legacy operation-based tools (drive, sheets, forms, docs, gmail, calendar)
 * are intentionally NOT registered here. Agents use the sdk object instead.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import type { Logger } from 'winston';
import type { CacheManagerLike, PerformanceMonitorLike } from '../modules/types.js';
import { NodeSandbox } from '../sdk/sandbox-node.js';
import { SDK_SPEC } from '../sdk/spec.js';
import { createSDKRuntime } from '../sdk/runtime.js';
import { RateLimiter } from '../sdk/rate-limiter.js';
import type { FullContext } from '../sdk/types.js';

// Auth object accepted by googleapis — OAuth2Client or similar credential
// We use a broad type here since the factory accepts both OAuth2Client (Node) and
// the lightweight fetch-based auth object (Workers).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleAuth = any;

export interface ServerConfig {
  logger: Logger;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  auth: GoogleAuth;
}

export function createConfiguredServer(deps: ServerConfig): Server {
  const server = new Server(
    { name: 'gdrive-mcp', version: '4.0.0-alpha' },
    { capabilities: { tools: {} } }
  );

  const sandbox = new NodeSandbox();
  const sharedRateLimiter = new RateLimiter();

  function buildContext(): FullContext {
    const { auth, logger, cacheManager, performanceMonitor } = deps;
    return {
      logger,
      cacheManager,
      performanceMonitor,
      startTime: Date.now(),
      drive: google.drive({ version: 'v3', auth }),
      sheets: google.sheets({ version: 'v4', auth }),
      forms: google.forms({ version: 'v1', auth }),
      docs: google.docs({ version: 'v1', auth }),
      gmail: google.gmail({ version: 'v1', auth }),
      calendar: google.calendar({ version: 'v3', auth }),
    };
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search',
        description:
          'Query the SDK operation spec. Use this before execute() to discover available operations, their signatures, parameters, and examples. Returns the full spec or a filtered subset.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            service: {
              type: 'string',
              description:
                'Optional service name to filter (drive | sheets | forms | docs | gmail | calendar). Omit to get all services.',
              enum: ['drive', 'sheets', 'forms', 'docs', 'gmail', 'calendar'],
            },
            operation: {
              type: 'string',
              description:
                'Optional operation name to get details for a single operation (e.g. "search", "readSheet").',
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'execute',
        description:
          'Run arbitrary JavaScript code in a sandboxed Node.js environment with full access to the Google Workspace SDK. The sdk object provides typed methods for all 47 operations. console.log output is returned as logs.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            code: {
              type: 'string',
              description:
                'JavaScript code to execute. The sdk object is available globally. Use top-level await. Return a value with `return` to get structured output. Example: `const files = await sdk.drive.search({ query: "report" }); return files;`',
            },
          },
          required: ['code'],
          additionalProperties: false,
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'search') {
      const { service, operation } = (args ?? {}) as {
        service?: string;
        operation?: string;
      };

      if (service && operation) {
        const svc = SDK_SPEC[service as keyof typeof SDK_SPEC];
        const op = svc?.[operation];
        if (!op) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: `Operation '${service}.${operation}' not found` }),
              },
            ],
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ [operation]: op }) }],
        };
      }

      if (service) {
        const svc = SDK_SPEC[service as keyof typeof SDK_SPEC];
        if (!svc) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: `Unknown service '${service}'`,
                  available: Object.keys(SDK_SPEC),
                }),
              },
            ],
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(svc) }],
        };
      }

      // No filter — return summary of all services
      const summary: Record<string, string[]> = {};
      for (const [svc, ops] of Object.entries(SDK_SPEC)) {
        summary[svc] = Object.keys(ops);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary) }],
      };
    }

    if (name === 'execute') {
      const { code } = (args ?? {}) as { code: string };
      if (!code || typeof code !== 'string') {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'code is required' }) }],
          isError: true,
        };
      }

      const context = buildContext();
      const sdk = createSDKRuntime(context, sharedRateLimiter);

      const result = await sandbox.execute(code, { sdk });

      if (result.error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: result.error.message,
                logs: result.logs,
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ result: result.result, logs: result.logs }),
          },
        ],
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  });

  return server;
}
