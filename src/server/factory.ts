/**
 * MCP Server factory for the v4 Code Mode architecture.
 *
 * Registers exactly 2 tools:
 *   - search: Query the SDK spec to discover available operations
 *   - execute: Call SDK operations directly or run agent code in sandbox
 *
 * Supports two execution modes:
 *   - Structured: service + operation + args → direct SDK call (works everywhere)
 *   - Code: JavaScript string → NodeSandbox (Node.js only, not available on Workers)
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
import { SDK_SPEC } from '../sdk/spec.js';
import { createSDKRuntime } from '../sdk/runtime.js';
import { RateLimiter } from '../sdk/rate-limiter.js';
import type { FullContext, Executor } from '../sdk/types.js';

// Auth object accepted by googleapis — OAuth2Client or similar credential
// We use a broad type here since the factory accepts both OAuth2Client (Node) and
// the lightweight fetch-based auth object (Workers).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleAuth = any;

// Valid service names for structured execution
const VALID_SERVICES = ['drive', 'sheets', 'forms', 'docs', 'gmail', 'calendar'] as const;
type ServiceName = (typeof VALID_SERVICES)[number];

export interface ServerConfig {
  logger: Logger;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  auth: GoogleAuth;
  /** Optional sandbox for code execution. Omit on Workers where eval is unavailable. */
  sandbox?: Executor;
}

export function createConfiguredServer(deps: ServerConfig): Server {
  const server = new Server(
    { name: 'gdrive-mcp', version: '4.0.0-alpha' },
    { capabilities: { tools: {} } }
  );

  const sandbox = deps.sandbox;
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
          'Call Google Workspace SDK operations. Preferred: use service + operation + args for direct calls. Alternative (Node.js only): pass JavaScript code string.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            service: {
              type: 'string',
              description:
                'Service to call (drive | sheets | forms | docs | gmail | calendar). Use with operation and args.',
              enum: ['drive', 'sheets', 'forms', 'docs', 'gmail', 'calendar'],
            },
            operation: {
              type: 'string',
              description:
                'Operation name to call (e.g. "search", "readSheet", "sendMessage"). Use search tool to discover available operations.',
            },
            args: {
              type: 'object',
              description:
                'Arguments object to pass to the operation. Structure depends on the operation — use search tool to see parameter details.',
            },
            code: {
              type: 'string',
              description:
                'JavaScript code to execute in sandbox (Node.js only, not available on remote Workers). Use service + operation + args instead for universal compatibility.',
            },
          },
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
      const { service, operation, args: opArgs, code } = (args ?? {}) as {
        service?: string;
        operation?: string;
        args?: Record<string, unknown>;
        code?: string;
      };

      const context = buildContext();
      const sdk = createSDKRuntime(context, sharedRateLimiter);

      // Structured execution: service + operation + args → direct SDK call
      if (service && operation) {
        if (!VALID_SERVICES.includes(service as ServiceName)) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Unknown service '${service}'`,
                available: [...VALID_SERVICES],
              }),
            }],
            isError: true,
          };
        }

        const serviceObj = sdk[service as ServiceName];
        const candidate = Object.prototype.hasOwnProperty.call(serviceObj, operation)
          ? serviceObj[operation as keyof typeof serviceObj]
          : undefined;
        const fn = typeof candidate === 'function'
          ? (candidate as (opts: unknown) => Promise<unknown>)
          : undefined;

        if (!fn) {
          const available = Object.keys(serviceObj).filter(
            k => Object.prototype.hasOwnProperty.call(serviceObj, k) && typeof (serviceObj as Record<string, unknown>)[k] === 'function'
          );
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: `Unknown operation '${service}.${operation}'`,
                available,
              }),
            }],
            isError: true,
          };
        }

        try {
          const result = await fn(opArgs ?? {});
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ result }),
            }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: message }),
            }],
            isError: true,
          };
        }
      }

      // Code execution: requires sandbox (Node.js only)
      if (code && typeof code === 'string') {
        if (!sandbox) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Code execution is not available on this server. Use service + operation + args instead.',
                hint: 'Call search tool to discover available operations, then use execute with service, operation, and args parameters.',
              }),
            }],
            isError: true,
          };
        }

        try {
          const result = await sandbox.execute(code, { sdk });

          if (result.error) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  error: result.error.message,
                  logs: result.logs,
                }),
              }],
              isError: true,
            };
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ result: result.result, logs: result.logs }),
            }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: message }),
            }],
            isError: true,
          };
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Either provide service + operation (+ optional args), or code.',
            usage: {
              structured: '{ service: "drive", operation: "search", args: { query: "..." } }',
              code: '{ code: "return await sdk.drive.search({ query: \\"...\\" })" }',
            },
          }),
        }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  });

  return server;
}
