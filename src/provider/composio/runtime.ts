import { Composio } from '@composio/core';
import {
  getComposioOperation,
  listComposioOperations,
  listEnabledComposioToolkits,
  type ComposioOperationDefinition,
} from './operation-registry.js';

export interface ComposioProviderConfig {
  apiKey?: string;
  userId?: string;
}

export interface ComposioToolkitStatus {
  toolkit: string;
  connected: boolean;
  status: 'active' | 'not_connected' | 'unknown';
  auth: {
    managed?: boolean;
    mode?: string;
  };
}

export interface ComposioDiscoveryResult {
  provider: 'composio';
  service?: string;
  operation?: string;
  configured: boolean;
  operations: Record<string, unknown>;
  toolkits: Record<string, ComposioToolkitStatus>;
  guidance: string;
}

export interface ComposioExecuteRequest {
  service: string;
  operation: string;
  args?: Record<string, unknown>;
}

export interface ComposioProviderRuntime {
  discover(service?: string, operation?: string): Promise<ComposioDiscoveryResult>;
  execute(request: ComposioExecuteRequest): Promise<unknown>;
  flushTelemetry?(): Promise<void>;
}

interface ComposioSessionLike {
  sessionId: string;
  toolkits(options?: unknown): Promise<{
    items: Array<{
      slug: string;
      name: string;
      connection?: {
        isActive: boolean;
        authConfig?: {
          isComposioManaged: boolean;
          mode: string;
        } | null;
        connectedAccount?: {
          status: string;
          id: string;
        };
      };
    }>;
  }>;
  execute(toolSlug: string, args?: Record<string, unknown>): Promise<unknown>;
}

interface ComposioClientLike {
  create(userId: string, config?: unknown): Promise<ComposioSessionLike>;
  tools: {
    execute(toolSlug: string, body: {
      userId: string;
      arguments?: Record<string, unknown>;
      dangerouslySkipVersionCheck?: boolean;
    }): Promise<unknown>;
  };
}

function missingRuntimeError(): Error {
  return new Error(
    'Composio provider runtime is not configured. Set COMPOSIO_API_KEY and AOJ_WORKBENCH_USER_ID on the deployed Worker.'
  );
}

function toSafeError(error: unknown): Error {
  const messages: string[] = [];
  let current: unknown = error;
  while (current) {
    messages.push(current instanceof Error ? current.message : String(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  const message = messages.join(' ');
  if (message.startsWith('Composio provider runtime is not configured')) {
    return new Error(message);
  }
  if (/No (?:active )?connected? account found|No active connection found|No active connection exists/i.test(message)) {
    return new Error(
      'Composio provider connection is not active for this AOJ Workbench user. Connect the provider account in Composio and retry.'
    );
  }
  if (/api[_ -]?key|bearer|token|secret|connected[_ -]?account/i.test(message)) {
    return new Error('Composio provider request failed. Inspect provider logs with credentials redacted.');
  }
  return new Error(message);
}

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function mapArguments(
  args: Record<string, unknown> | undefined,
  definition: ComposioOperationDefinition
): Record<string, unknown> {
  if (definition.service === 'forms' && definition.operation === 'createForm') {
    const sourceInfo = args?.info && typeof args.info === 'object' && !Array.isArray(args.info)
      ? args.info as Record<string, unknown>
      : {};
    const info: Record<string, unknown> = { ...sourceInfo };
    for (const key of ['title', 'description', 'documentTitle'] as const) {
      if (args?.[key] !== undefined && info[key] === undefined) {
        info[key] = args[key];
      }
    }
    if (typeof info.title !== 'string' || info.title.trim().length === 0) {
      throw new Error('forms.createForm requires a non-empty title string.');
    }
    const mapped: Record<string, unknown> = { info };
    if (typeof args?.unpublished === 'boolean') {
      mapped.unpublished = args.unpublished;
    }
    return mapped;
  }

  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    const alias = definition.argAliases?.[key] ?? key;
    mapped[alias] = value;
    const snake = toSnakeCase(alias);
    if (snake !== alias && mapped[snake] === undefined) {
      mapped[snake] = value;
    }
  }

  if (definition.service === 'drive' && definition.operation === 'search') {
    const query = args?.query;
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('drive.search requires a non-empty query string.');
    }
    mapped.q = query.trim();
    mapped.pageSize = Math.min(Math.max(Number(args?.pageSize ?? 10), 1), 100);
  }

  return mapped;
}

function normalizeDriveSearchResult(args: Record<string, unknown> | undefined, response: unknown): unknown {
  const query = typeof args?.query === 'string' ? args.query : '';
  const data = response && typeof response === 'object' && 'data' in response
    ? (response as { data?: unknown }).data
    : response;
  const filesCandidate = data && typeof data === 'object'
    ? (data as { files?: unknown; items?: unknown; result?: unknown }).files
      ?? (data as { files?: unknown; items?: unknown; result?: unknown }).items
      ?? (data as { files?: unknown; items?: unknown; result?: unknown }).result
    : undefined;
  const files = Array.isArray(filesCandidate) ? filesCandidate : [];

  return {
    query,
    totalResults: files.length,
    files: files.slice(0, Math.min(Number(args?.pageSize ?? 10), 100)).map((file) => {
      if (!file || typeof file !== 'object') {
        return null;
      }
      const record = file as Record<string, unknown>;
      return {
        id: record.id ?? record.fileId ?? record.file_id,
        name: record.name ?? record.fileName ?? record.file_name,
        mimeType: record.mimeType ?? record.mime_type,
        createdTime: record.createdTime ?? record.created_time,
        modifiedTime: record.modifiedTime ?? record.modified_time,
        webViewLink: record.webViewLink ?? record.web_view_link ?? record.url,
      };
    }),
  };
}

function normalizeExecutionResult(
  definition: ComposioOperationDefinition,
  args: Record<string, unknown> | undefined,
  response: unknown
): unknown {
  const maybeError = response && typeof response === 'object'
    ? (response as { error?: unknown }).error
    : undefined;
  if (typeof maybeError === 'string' && maybeError.length > 0) {
    throw new Error(maybeError);
  }

  if (definition.service === 'drive' && definition.operation === 'search') {
    return normalizeDriveSearchResult(args, response);
  }

  return response && typeof response === 'object' && 'data' in response
    ? (response as { data?: unknown }).data
    : response;
}

function operationToDiscovery(
  definition: ComposioOperationDefinition,
  toolkitStatus?: ComposioToolkitStatus
): Record<string, unknown> {
  return {
    ...definition.spec,
    provider: 'composio',
    service: definition.service,
    operation: definition.operation,
    toolkit: definition.toolkit,
    auth: toolkitStatus ?? {
      toolkit: definition.toolkit,
      connected: false,
      status: 'unknown',
      auth: {},
    },
    execute: {
      tool: 'execute',
      arguments: {
        service: definition.service,
        operation: definition.operation,
        args: 'Use the operation params described in this result.',
      },
    },
  };
}

export class SDKComposioProviderRuntime implements ComposioProviderRuntime {
  private readonly apiKey: string | undefined;
  private readonly userId: string | undefined;
  private readonly clientFactory: () => ComposioClientLike;
  private sessionPromise?: Promise<ComposioSessionLike>;

  constructor(
    config: ComposioProviderConfig,
    clientFactory: () => ComposioClientLike = () => new Composio({ apiKey: config.apiKey ?? null }) as unknown as ComposioClientLike
  ) {
    this.apiKey = config.apiKey;
    this.userId = config.userId;
    this.clientFactory = clientFactory;
  }

  private get configured(): boolean {
    return Boolean(this.apiKey && this.userId);
  }

  private async session(): Promise<ComposioSessionLike> {
    if (!this.configured || !this.userId) {
      throw missingRuntimeError();
    }
    this.sessionPromise ??= this.clientFactory().create(this.userId, {
      toolkits: { enable: listEnabledComposioToolkits() },
      workbench: { enable: false },
      manageConnections: { enable: true },
    });
    return this.sessionPromise;
  }

  async discover(service?: string, operation?: string): Promise<ComposioDiscoveryResult> {
    const definitions = operation && service
      ? [getComposioOperation(service, operation)].filter((op): op is ComposioOperationDefinition => Boolean(op))
      : listComposioOperations(service);
    const toolkits: Record<string, ComposioToolkitStatus> = {};

    if (this.configured) {
      try {
        const session = await this.session();
        const statuses = await session.toolkits();
        for (const item of statuses.items) {
          const auth: ComposioToolkitStatus['auth'] = {};
          if (item.connection?.authConfig?.isComposioManaged !== undefined) {
            auth.managed = item.connection.authConfig.isComposioManaged;
          }
          if (item.connection?.authConfig?.mode !== undefined) {
            auth.mode = item.connection.authConfig.mode;
          }
          toolkits[item.slug.toLowerCase()] = {
            toolkit: item.slug,
            connected: item.connection?.isActive ?? false,
            status: item.connection?.isActive ? 'active' : 'not_connected',
            auth,
          };
        }
      } catch (error) {
        throw toSafeError(error);
      }
    }

    const operations: Record<string, unknown> = {};
    for (const definition of definitions) {
      operations[definition.operation] = operationToDiscovery(
        definition,
        toolkits[definition.toolkit.toLowerCase()]
      );
    }

    return {
      provider: 'composio',
      configured: this.configured,
      operations,
      toolkits,
      guidance: this.configured
        ? 'Call AOJ Workbench execute with service, operation, and args. Composio tool slugs are internal implementation details.'
        : 'Composio runtime is not configured on this server. Set COMPOSIO_API_KEY and AOJ_WORKBENCH_USER_ID on the deployed Worker.',
      ...(service ? { service } : {}),
      ...(operation ? { operation } : {}),
    };
  }

  async execute(request: ComposioExecuteRequest): Promise<unknown> {
    const definition = getComposioOperation(request.service, request.operation);
    if (!definition) {
      throw new Error(`Unknown operation '${request.service}.${request.operation}'`);
    }

    let mappedArgs: Record<string, unknown>;
    try {
      mappedArgs = mapArguments(request.args, definition);
    } catch (error) {
      throw toSafeError(error);
    }

    try {
      if (!this.configured || !this.userId) {
        throw missingRuntimeError();
      }
      const response = await this.clientFactory().tools.execute(definition.toolSlug, {
        userId: this.userId,
        arguments: mappedArgs,
        dangerouslySkipVersionCheck: true,
      });
      return normalizeExecutionResult(definition, request.args, response);
    } catch (error) {
      throw toSafeError(error);
    }
  }
}

export function createComposioProviderRuntime(config: ComposioProviderConfig): ComposioProviderRuntime {
  return new SDKComposioProviderRuntime(config);
}
