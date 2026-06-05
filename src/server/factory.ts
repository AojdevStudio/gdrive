/**
 * MCP Server factory for the v4 Code Mode architecture.
 *
 * Registers exactly 2 tools:
 *   - search: Query the SDK spec to discover available operations
 *   - execute: Call SDK operations directly through service + operation + args
 *
 * The 6 legacy operation-based tools (drive, sheets, forms, docs, gmail, calendar)
 * are intentionally NOT registered here. Agents use execute to call SDK operations.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Logger } from 'winston';
import type { CacheManagerLike, PerformanceMonitorLike } from '../modules/types.js';
import { SDK_SPEC } from '../sdk/spec.js';
import {
  COMPOSIO_SERVICES,
  listComposioOperations,
  type ComposioServiceName,
} from '../provider/composio/operation-registry.js';
import {
  createComposioProviderRuntime,
  type ComposioProviderRuntime,
} from '../provider/composio/runtime.js';
import { MCP_SERVER_INFO } from './identity.js';
import { assertAnthropicCompatibleToolList } from './schema-compat.js';

// Valid service names for structured execution
const VALID_SERVICES = COMPOSIO_SERVICES;
type ServiceName = ComposioServiceName;

export interface ServerConfig {
  logger: Logger;
  cacheManager: CacheManagerLike;
  performanceMonitor: PerformanceMonitorLike;
  auth?: unknown;
  composio?: {
    apiKey?: string;
    userId?: string;
  };
  composioProvider?: ComposioProviderRuntime;
}

export function createConfiguredServer(deps: ServerConfig): Server {
  const server = new Server(
    MCP_SERVER_INFO,
    { capabilities: { tools: {} } }
  );

  const composioProvider = deps.composioProvider ?? createComposioProviderRuntime(deps.composio ?? {});

  const tools = [
    {
      name: 'search',
      description:
        'Use this first to discover AOJ Workbench operations, signatures, parameters, provider auth status, and examples before calling execute. Without filters, returns a service-to-operation summary; with service or operation filters, returns the matching detailed spec subset.',
      annotations: {
        readOnlyHint: true,
      },
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
        'Use this to run a specific AOJ Workbench operation through the Composio-backed provider runtime. Some operations modify files, send email, or update calendar events. Use service + operation + args.',
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
        },
        additionalProperties: false,
      },
    },
  ];

  assertAnthropicCompatibleToolList(tools);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

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
        try {
          const discovery = await composioProvider.discover(service, operation);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ [operation]: discovery.operations[operation] }) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
            isError: true,
          };
        }
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
        try {
          const discovery = await composioProvider.discover(service);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(discovery.operations) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
            isError: true,
          };
        }
      }

      // No filter — return summary of all services
      const summary: Record<string, string[]> = {};
      for (const svc of VALID_SERVICES) {
        summary[svc] = listComposioOperations(svc).map((op) => op.operation);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary) }],
      };
    }

    if (name === 'execute') {
      const { service, operation, args: opArgs } = (args ?? {}) as {
        service?: string;
        operation?: string;
        args?: Record<string, unknown>;
      };

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

        const available = listComposioOperations(service).map((op) => op.operation);
        if (!available.includes(operation)) {
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
          const result = await composioProvider.execute({
            service,
            operation,
            args: opArgs ?? {},
          });
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
        } finally {
          await composioProvider.flushTelemetry?.();
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Provide service + operation (+ optional args).',
            usage: {
              execute: '{ service: "drive", operation: "search", args: { query: "..." } }',
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
