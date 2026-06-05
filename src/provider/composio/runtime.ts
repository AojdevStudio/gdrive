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
}

/**
 * Create an Error indicating the Composio provider runtime is not configured.
 *
 * @returns An Error whose message instructs to set `COMPOSIO_API_KEY` and `AOJ_WORKBENCH_USER_ID` on the deployed Worker.
 */
function missingRuntimeError(): Error {
  return new Error(
    'Composio provider runtime is not configured. Set COMPOSIO_API_KEY and AOJ_WORKBENCH_USER_ID on the deployed Worker.'
  );
}

/**
 * Normalize an unknown error into a safe Error instance with credential-sensitive messages redacted.
 *
 * If the incoming error message begins with the runtime-not-configured text, that message is preserved.
 * If the message appears to contain credential-related terms (api key, bearer, token, secret, connected account),
 * the returned Error uses a generic redacted message.
 * Otherwise the returned Error preserves the original message.
 *
 * @param error - The caught or received value to convert into an Error
 * @returns An Error whose message is either preserved, redacted for credential-like content, or identical to the original message
 */
function toSafeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('Composio provider runtime is not configured')) {
    return new Error(message);
  }
  if (/api[_ -]?key|bearer|token|secret|connected[_ -]?account/i.test(message)) {
    return new Error('Composio provider request failed. Inspect provider logs with credentials redacted.');
  }
  return new Error(message);
}

/**
 * Convert a camelCase or PascalCase identifier to snake_case.
 *
 * @param key - The input string in camelCase or PascalCase
 * @returns The input converted to snake_case (underscores inserted before uppercase letters and all characters lowercased)
 */
function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

/**
 * Map incoming arguments to the operation's expected parameter names and snake_case variants, with required normalization for `drive.search`.
 *
 * @param args - Incoming argument object supplied to the operation
 * @param definition - Operation definition containing argument aliases and service/operation identifiers
 * @returns A new object whose keys are the operation argument aliases (and their snake_case variants when different). For `drive.search`, the result always contains `q` (trimmed non-empty query) and `pageSize` clamped to the range 1–100.
 */
function mapArguments(
  args: Record<string, unknown> | undefined,
  definition: ComposioOperationDefinition
): Record<string, unknown> {
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

/**
 * Normalize various Composio/Drive search response shapes into a consistent search-result object.
 *
 * @param args - Optional request args; `query` (string) is echoed back as `query` in the result, and `pageSize` controls the maximum number of returned files (defaults to 10, clamped to a maximum of 100).
 * @param response - The raw response from a Composio/Drive search call; may be the object itself or an object with a `data` wrapper and various file-list field names.
 * @returns An object with:
 *  - `query`: the original `args.query` string or an empty string,
 *  - `totalResults`: the number of files found,
 *  - `files`: an array (limited by `pageSize`) where each entry is either a normalized file object or `null` for non-object items. Each normalized file object contains `id`, `name`, `mimeType`, `createdTime`, `modifiedTime`, and `webViewLink` (each populated from multiple possible source field names when available).
 */
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

/**
 * Normalize the raw result of executing a Composio operation, applying operation-specific post-processing.
 *
 * @param definition - The operation definition used to determine special-case normalization (e.g., `drive.search`).
 * @param args - The original call arguments; used by special-case normalizers such as the Drive search normalizer.
 * @param response - The raw response returned by the Composio session.
 * @returns For `drive.search`, a normalized search result object containing `query`, `totalResults`, and `files`; otherwise returns `response.data` if present, or the original `response`.
 * @throws Error if the response contains a non-empty `error` string; the thrown error's message is the `error` string.
 */
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

/**
 * Builds a discovery payload for a Composio operation, combining the operation spec with toolkit auth and execution metadata.
 *
 * @param definition - The Composio operation definition containing the operation spec, service, operation name, and toolkit slug.
 * @param toolkitStatus - Optional toolkit connection/authentication status to attach; when omitted, a default unauthenticated status is used.
 * @returns A discovery record that includes the original `spec` fields plus `provider`, `service`, `operation`, `toolkit`, an `auth` object, and an `execute` descriptor suitable for provider discovery responses.
 */
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
      const session = await this.session();
      const response = await session.execute(definition.toolSlug, mappedArgs);
      return normalizeExecutionResult(definition, request.args, response);
    } catch (error) {
      throw toSafeError(error);
    }
  }
}

/**
 * Create a Composio-backed provider runtime configured with the given settings.
 *
 * @param config - Provider configuration containing optional `apiKey` and `userId` used to determine whether the runtime is configured
 * @returns A `ComposioProviderRuntime` instance that implements discovery and execution against Composio
 */
export function createComposioProviderRuntime(config: ComposioProviderConfig): ComposioProviderRuntime {
  return new SDKComposioProviderRuntime(config);
}
