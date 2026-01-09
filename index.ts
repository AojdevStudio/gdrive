#!/usr/bin/env node

import { authenticate } from "@google-cloud/local-auth";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import { google } from "googleapis";
import * as path from "path";
import { createClient, RedisClientType } from "redis";
import winston from "winston";
import { AuthManager, AuthState } from "./src/auth/AuthManager.js";
import { TokenManager } from "./src/auth/TokenManager.js";
import { KeyRotationManager } from "./src/auth/KeyRotationManager.js";
import { performHealthCheck, HealthStatus } from "./src/health-check.js";
import { LIST_TOOLS_RESOURCE, generateToolStructure } from "./src/tools/listTools.js";

// Import module types for type casting
import type {
  SearchOptions,
  EnhancedSearchOptions,
  ReadOptions,
  CreateFileOptions,
  CreateFolderOptions,
  UpdateFileOptions,
  BatchOperationsOptions,
} from "./src/modules/drive/index.js";

import type {
  ListSheetsOptions,
  ReadSheetOptions,
  CreateSheetOptions,
  RenameSheetOptions,
  DeleteSheetOptions,
  UpdateCellsOptions,
  UpdateFormulaOptions,
  FormatCellsOptions,
  ConditionalFormatOptions,
  FreezeOptions,
  SetColumnWidthOptions,
  AppendRowsOptions,
} from "./src/modules/sheets/index.js";

import type {
  CreateFormOptions,
  ReadFormOptions,
  AddQuestionOptions,
  ListResponsesOptions,
} from "./src/modules/forms/index.js";

import type {
  CreateDocumentOptions,
  InsertTextOptions,
  ReplaceTextOptions,
  ApplyTextStyleOptions,
  InsertTableOptions,
} from "./src/modules/docs/index.js";

import type {
  ListMessagesOptions,
  ListThreadsOptions,
  GetMessageOptions,
  GetThreadOptions,
  SearchMessagesOptions,
  CreateDraftOptions,
  SendMessageOptions,
  SendDraftOptions,
  ListLabelsOptions,
  ModifyLabelsOptions,
} from "./src/modules/gmail/index.js";

import type {
  ListCalendarsOptions,
  GetCalendarOptions,
  ListEventsOptions,
  GetEventOptions,
  CreateEventOptions,
  UpdateEventOptions,
  DeleteEventOptions,
  QuickAddOptions,
  FreeBusyOptions,
} from "./src/modules/calendar/index.js";

const drive = google.drive("v3");
const sheets = google.sheets("v4");
const forms = google.forms("v1");
const docs = google.docs("v1");
const gmail = google.gmail("v1");
const calendar = google.calendar("v3");

// Performance monitoring types
interface PerformanceStats {
  uptime: number;
  operations: Record<string, {
    count: number;
    avgTime: number;
    errorRate: number;
  }>;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// Redis Cache types
interface CacheData {
  [key: string]: unknown;
}

// Google Sheets interfaces for createSheet
/**
 * RGBA color definition that matches the Google Sheets API structure. All
 * channels are normalized numbers between 0 and 1 inclusive.
 */
// Structured logging with Winston
// Ensure Error instances inside metadata are serialized with details
const errorSerializer = winston.format((info) => {
  const serialize = (value: unknown): unknown => {
    if (value instanceof Error) {
      const plain: Record<string, unknown> = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
      // Include enumerable and non-enumerable own props
      try {
        for (const key of Object.getOwnPropertyNames(value)) {
          const valAsRecord = value as unknown as Record<string, unknown>;
          plain[key] = valAsRecord[key];
        }
      } catch {
        // Ignore property access errors
      }
      // Common Node error fields
      const nodeErr = value as unknown as { code?: unknown; cause?: unknown };
      if (nodeErr.code !== undefined) {
        plain.code = nodeErr.code;
      }
      if (nodeErr.cause !== undefined) {
        plain.cause = serialize(nodeErr.cause);
      }
      return plain;
    }
    if (Array.isArray(value)) {
      return value.map(serialize);
    }
    if (value && typeof value === 'object') {
      const obj: Record<string, unknown> = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        obj[key] = serialize(obj[key]);
      }
      return obj;
    }
    return value;
  };

  for (const key of Object.keys(info)) {
    const record = info as unknown as Record<string, unknown>;
    record[key] = serialize(record[key]);
  }
  return info;
});

const safeStringify = (value: unknown): string => {
  const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (_key: string, val: unknown) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {return '[Circular]';}
        seen.add(val);
      }
      if (val instanceof Error) {
        return {
          name: val.name,
          message: val.message,
          stack: val.stack,
          ...Object.fromEntries(Object.getOwnPropertyNames(val).map(k => [k, (val as unknown as Record<string, unknown>)[k]])),
        };
      }
      return val;
    };
  };
  try {
    return JSON.stringify(value, getCircularReplacer());
  } catch {
    return String(value);
  }
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    errorSerializer(),
    winston.format.json()
  ),
  defaultMeta: { service: 'gdrive-mcp-server' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      // Route all levels to stderr to avoid contaminating MCP stdio on stdout
      stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? safeStringify(meta) : ''}`;
        })
      )
    })
  ]
});

// Sheet metadata resolution helper
// Performance monitoring
class PerformanceMonitor {
  private metrics: Map<string, { count: number; totalTime: number; errors: number }> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private startTime = Date.now();

  track(operation: string, duration: number, error: boolean = false) {
    const current = this.metrics.get(operation) ?? { count: 0, totalTime: 0, errors: 0 };
    current.count++;
    current.totalTime += duration;
    if (error) {
      current.errors++;
    }
    this.metrics.set(operation, current);
  }

  recordCacheHit() { this.cacheHits++; }
  recordCacheMiss() { this.cacheMisses++; }

  getStats() {
    const stats: PerformanceStats = {
      uptime: Date.now() - this.startTime,
      operations: {},
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: (this.cacheHits + this.cacheMisses) > 0 ? this.cacheHits / (this.cacheHits + this.cacheMisses) : 0
      }
    };

    for (const [op, data] of this.metrics) {
      stats.operations[op] = {
        count: data.count,
        avgTime: data.totalTime / data.count,
        errorRate: data.errors / data.count
      };
    }

    return stats;
  }
}

const performanceMonitor = new PerformanceMonitor();

// Log performance stats every 30 seconds
setInterval(() => {
  logger.info('Performance stats', performanceMonitor.getStats());
}, 30000);

// Redis Cache Manager
class CacheManager {
  private client: RedisClientType | null = null;
  private connected = false;
  private ttl = 300; // 5 minutes

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 attempts');
              return false;
            }
            return Math.min(retries * 50, 500);
          }
        }
      });

      this.client.on('error', (err: Error) => {
        logger.error('Redis client error', { error: err.message });
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.warn('Redis connection failed, continuing without cache', { error });
      this.connected = false;
    }
  }

  async get(key: string): Promise<CacheData | null> {
    if (!this.connected) {
      return null;
    }

    try {
      const data = await this.client?.get(key);
      if (data) {
        performanceMonitor.recordCacheHit();
        return JSON.parse(data);
      }
      performanceMonitor.recordCacheMiss();
      return null;
    } catch (error) {
      logger.error('Cache get error', { error, key });
      return null;
    }
  }

  async set(key: string, value: CacheData): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      if (this.client) {
        await this.client.setEx(key, this.ttl, JSON.stringify(value));
      }
    } catch (error) {
      logger.error('Cache set error', { error, key });
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      if (this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
          logger.debug(`Invalidated ${keys.length} cache entries`);
        }
      }
    } catch (error) {
      logger.error('Cache invalidation error', { error, pattern });
    }
  }

  async disconnect() {
    if (this.client && this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }
}

const cacheManager = new CacheManager();

// Initialize auth manager
let authManager: AuthManager | null = null;
let tokenManager: TokenManager | null = null;

const server = new Server(
  {
    name: "gdrive-mcp-server",
    version: "3.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

// List available resources - v3.1.0 operation-based progressive disclosure
server.setRequestHandler(ListResourcesRequestSchema, async (_request) => {
  const startTime = Date.now();

  try {
    // Ensure we're authenticated
    if (!authManager || authManager.getState() !== AuthState.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run with "auth" argument first.');
    }

    // v3.1.0: Operation-based progressive disclosure
    // Users read gdrive://tools to see available operations, then call tools directly
    const resources = [LIST_TOOLS_RESOURCE];

    performanceMonitor.track('listResources', Date.now() - startTime);
    logger.info('Listed resources (progressive disclosure only)', { count: resources.length });

    return { resources };
  } catch (error) {
    performanceMonitor.track('listResources', Date.now() - startTime, true);
    logger.error('Failed to list resources', { error });
    throw error;
  }
});

// Read a specific resource - Handle both files and tool discovery
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const startTime = Date.now();

  try {
    // Ensure we're authenticated
    if (!authManager || authManager.getState() !== AuthState.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run with "auth" argument first.');
    }

    // v3.0.0: ONLY handle tool discovery resource
    if (request.params.uri === "gdrive://tools") {
      const structure = await generateToolStructure();

      performanceMonitor.track('readResource', Date.now() - startTime);
      logger.info('Read tool discovery resource');

      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(structure, null, 2),
        }],
      };
    }

    // v3.0.0: Individual file resources removed
    // Use executeCode tool to read files instead
    throw new Error(`Unknown resource: ${request.params.uri}. Only gdrive://tools is supported in v3.0.0. Use executeCode to interact with Drive files.`);
  } catch (error) {
    performanceMonitor.track('readResource', Date.now() - startTime, true);
    logger.error('Failed to read resource', { error, uri: request.params.uri });
    throw error;
  }
});

// List available tools - operation-based progressive disclosure
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "drive",
        description: "Google Drive operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["search", "enhancedSearch", "read", "createFile", "createFolder", "updateFile", "batchOperations"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "sheets",
        description: "Google Sheets operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["listSheets", "readSheet", "createSheet", "renameSheet", "deleteSheet", "updateCells", "updateFormula", "formatCells", "addConditionalFormat", "freezeRowsColumns", "setColumnWidth", "appendRows"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "forms",
        description: "Google Forms operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["createForm", "readForm", "addQuestion", "listResponses"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "docs",
        description: "Google Docs operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["createDocument", "insertText", "replaceText", "applyTextStyle", "insertTable"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "gmail",
        description: "Google Gmail operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["listMessages", "listThreads", "getMessage", "getThread", "searchMessages", "createDraft", "sendMessage", "sendDraft", "listLabels", "modifyLabels"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      },
      {
        name: "calendar",
        description: "Google Calendar operations. Read gdrive://tools resource to see available operations.",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["listCalendars", "getCalendar", "listEvents", "getEvent", "createEvent", "updateEvent", "deleteEvent", "quickAdd", "checkFreeBusy"],
              description: "Operation to perform"
            },
            params: {
              type: "object",
              description: "Operation-specific parameters. See gdrive://tools for details."
            }
          },
          required: ["operation", "params"]
        }
      }
    ]
  };
});

// Handle tool calls - operation-based dynamic dispatch
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();

  try {
    if (!authManager || authManager.getState() !== AuthState.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run with "auth" argument first.');
    }

    const { name, arguments: args } = request.params;
    const { operation, params } = args as { operation: string; params: unknown };

    logger.info('Tool called', { tool: name, operation, params });

    // Build context for operations
    const context = {
      logger,
      drive,
      sheets,
      forms,
      docs,
      gmail,
      calendar,
      cacheManager,
      performanceMonitor,
      startTime,
    };

    let result;

    switch (name) {
      case "drive": {
        const driveModule = await import('./src/modules/drive/index.js');

        switch (operation) {
          case "search":
            result = await driveModule.search(params as SearchOptions, context);
            break;
          case "enhancedSearch":
            result = await driveModule.enhancedSearch(params as EnhancedSearchOptions, context);
            break;
          case "read":
            result = await driveModule.read(params as ReadOptions, context);
            break;
          case "createFile":
            result = await driveModule.createFile(params as CreateFileOptions, context);
            break;
          case "createFolder":
            result = await driveModule.createFolder(params as CreateFolderOptions, context);
            break;
          case "updateFile":
            result = await driveModule.updateFile(params as UpdateFileOptions, context);
            break;
          case "batchOperations":
            result = await driveModule.batchOperations(params as BatchOperationsOptions, context);
            break;
          default:
            throw new Error(`Unknown drive operation: ${operation}`);
        }
        break;
      }

      case "sheets": {
        const sheetsModule = await import('./src/modules/sheets/index.js');

        switch (operation) {
          case "listSheets":
            result = await sheetsModule.listSheets(params as ListSheetsOptions, context);
            break;
          case "readSheet":
            result = await sheetsModule.readSheet(params as ReadSheetOptions, context);
            break;
          case "createSheet":
            result = await sheetsModule.createSheet(params as CreateSheetOptions, context);
            break;
          case "renameSheet":
            result = await sheetsModule.renameSheet(params as RenameSheetOptions, context);
            break;
          case "deleteSheet":
            result = await sheetsModule.deleteSheet(params as DeleteSheetOptions, context);
            break;
          case "updateCells":
            result = await sheetsModule.updateCells(params as UpdateCellsOptions, context);
            break;
          case "updateFormula":
            result = await sheetsModule.updateFormula(params as UpdateFormulaOptions, context);
            break;
          case "formatCells":
            result = await sheetsModule.formatCells(params as FormatCellsOptions, context);
            break;
          case "addConditionalFormat":
            result = await sheetsModule.addConditionalFormat(params as ConditionalFormatOptions, context);
            break;
          case "freezeRowsColumns":
            result = await sheetsModule.freezeRowsColumns(params as FreezeOptions, context);
            break;
          case "setColumnWidth":
            result = await sheetsModule.setColumnWidth(params as SetColumnWidthOptions, context);
            break;
          case "appendRows":
            result = await sheetsModule.appendRows(params as AppendRowsOptions, context);
            break;
          default:
            throw new Error(`Unknown sheets operation: ${operation}`);
        }
        break;
      }

      case "forms": {
        const formsModule = await import('./src/modules/forms/index.js');

        switch (operation) {
          case "createForm":
            result = await formsModule.createForm(params as CreateFormOptions, context);
            break;
          case "readForm":
            result = await formsModule.readForm(params as ReadFormOptions, context);
            break;
          case "addQuestion":
            result = await formsModule.addQuestion(params as AddQuestionOptions, context);
            break;
          case "listResponses":
            result = await formsModule.listResponses(params as ListResponsesOptions, context);
            break;
          default:
            throw new Error(`Unknown forms operation: ${operation}`);
        }
        break;
      }

      case "docs": {
        const docsModule = await import('./src/modules/docs/index.js');

        switch (operation) {
          case "createDocument":
            result = await docsModule.createDocument(params as CreateDocumentOptions, context);
            break;
          case "insertText":
            result = await docsModule.insertText(params as InsertTextOptions, context);
            break;
          case "replaceText":
            result = await docsModule.replaceText(params as ReplaceTextOptions, context);
            break;
          case "applyTextStyle":
            result = await docsModule.applyTextStyle(params as ApplyTextStyleOptions, context);
            break;
          case "insertTable":
            result = await docsModule.insertTable(params as InsertTableOptions, context);
            break;
          default:
            throw new Error(`Unknown docs operation: ${operation}`);
        }
        break;
      }

      case "gmail": {
        const gmailModule = await import('./src/modules/gmail/index.js');

        switch (operation) {
          case "listMessages":
            result = await gmailModule.listMessages(params as ListMessagesOptions, context);
            break;
          case "listThreads":
            result = await gmailModule.listThreads(params as ListThreadsOptions, context);
            break;
          case "getMessage":
            result = await gmailModule.getMessage(params as GetMessageOptions, context);
            break;
          case "getThread":
            result = await gmailModule.getThread(params as GetThreadOptions, context);
            break;
          case "searchMessages":
            result = await gmailModule.searchMessages(params as SearchMessagesOptions, context);
            break;
          case "createDraft":
            result = await gmailModule.createDraft(params as CreateDraftOptions, context);
            break;
          case "sendMessage":
            result = await gmailModule.sendMessage(params as SendMessageOptions, context);
            break;
          case "sendDraft":
            result = await gmailModule.sendDraft(params as SendDraftOptions, context);
            break;
          case "listLabels":
            result = await gmailModule.listLabels(params as ListLabelsOptions, context);
            break;
          case "modifyLabels":
            result = await gmailModule.modifyLabels(params as ModifyLabelsOptions, context);
            break;
          default:
            throw new Error(`Unknown gmail operation: ${operation}`);
        }
        break;
      }

      case "calendar": {
        const calendarModule = await import('./src/modules/calendar/index.js');

        switch (operation) {
          case "listCalendars":
            result = await calendarModule.listCalendars(params as ListCalendarsOptions, context);
            break;
          case "getCalendar":
            result = await calendarModule.getCalendar(params as GetCalendarOptions, context);
            break;
          case "listEvents":
            result = await calendarModule.listEvents(params as ListEventsOptions, context);
            break;
          case "getEvent":
            result = await calendarModule.getEvent(params as GetEventOptions, context);
            break;
          case "createEvent":
            result = await calendarModule.createEvent(params as CreateEventOptions, context);
            break;
          case "updateEvent":
            result = await calendarModule.updateEvent(params as UpdateEventOptions, context);
            break;
          case "deleteEvent":
            result = await calendarModule.deleteEvent(params as DeleteEventOptions, context);
            break;
          case "quickAdd":
            result = await calendarModule.quickAdd(params as QuickAddOptions, context);
            break;
          case "checkFreeBusy":
            result = await calendarModule.checkFreeBusy(params as FreeBusyOptions, context);
            break;
          default:
            throw new Error(`Unknown calendar operation: ${operation}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    performanceMonitor.track(`${name}.${operation}`, Date.now() - startTime);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    performanceMonitor.track(request.params.name, Date.now() - startTime, true);
    logger.error('Tool execution failed', {
      tool: request.params.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
});

// OAuth key path handling
const oauthPath = process.env.GDRIVE_OAUTH_PATH ?? path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../credentials/gcp-oauth.keys.json",
);


async function authenticateAndSaveCredentials() {
  logger.info("Launching auth flow…");

  // Ensure encryption key is set for token storage
  if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
    logger.error("GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required for secure token storage.");
    logger.error("Generate a key with: openssl rand -base64 32");
    process.exit(1);
  }

  const auth = await authenticate({
    keyfilePath: oauthPath,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/forms",
      "https://www.googleapis.com/auth/script.projects.readonly",
      // Gmail scopes (added in v3.2.0)
      "https://www.googleapis.com/auth/gmail.readonly",    // Read operations: listMessages, getMessage, getThread, searchMessages
      "https://www.googleapis.com/auth/gmail.send",        // messages.send only
      "https://www.googleapis.com/auth/gmail.compose",     // Draft operations: drafts.create, drafts.send
      "https://www.googleapis.com/auth/gmail.modify",      // Label/message modification: modifyLabels, listLabels
      // Calendar scopes (added in v3.3.0)
      "https://www.googleapis.com/auth/calendar.readonly", // Read calendars and events
      "https://www.googleapis.com/auth/calendar.events"    // Full event CRUD (create, update, delete)
    ],
  });

  // Initialize token manager and save credentials
  tokenManager = TokenManager.getInstance(logger);

  if (!auth.credentials.access_token || !auth.credentials.refresh_token || !auth.credentials.expiry_date || !auth.credentials.token_type || !auth.credentials.scope) {
    throw new Error('Missing required authentication credentials');
  }

  const tokenData = {
    access_token: auth.credentials.access_token,
    refresh_token: auth.credentials.refresh_token,
    expiry_date: auth.credentials.expiry_date,
    token_type: auth.credentials.token_type,
    scope: auth.credentials.scope,
  };

  await tokenManager.saveTokens(tokenData);

  logger.info("Credentials saved securely with encryption.");
  logger.info("You can now run the server.");
  process.exit(0);
}

async function loadCredentialsAndRunServer() {
  try {
    // Ensure encryption key is set
    if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
      logger.error("GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required.");
      logger.error("Generate a key with: openssl rand -base64 32");
      process.exit(1);
    }

    // Load OAuth keys
    if (!fs.existsSync(oauthPath)) {
      logger.error(`OAuth keys not found at: ${oauthPath}`);
      logger.error("Please ensure gcp-oauth.keys.json is present.");
      process.exit(1);
    }

    const keysContent = fs.readFileSync(oauthPath, "utf-8");
    const keys = JSON.parse(keysContent);
    const oauthKeys = keys.web ?? keys.installed;

    if (!oauthKeys) {
      logger.error("Invalid OAuth keys format. Expected 'web' or 'installed' configuration.");
      process.exit(1);
    }

    // Initialize managers
    tokenManager = TokenManager.getInstance(logger);
    authManager = AuthManager.getInstance(oauthKeys, logger);

    // Initialize authentication
    await authManager.initialize();

    // Check authentication state
    if (authManager.getState() === AuthState.UNAUTHENTICATED) {
      logger.error("Authentication required. Please run with 'auth' argument first.");
      process.exit(1);
    }

    // Set up Google API authentication
    const oauth2Client = authManager.getOAuth2Client();
    google.options({ auth: oauth2Client });

    logger.info("Authentication initialized with automatic token refresh.");

    // Connect to Redis cache
    await cacheManager.connect();

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("MCP server started successfully.");
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

// CLI command implementations
async function rotateKey(): Promise<void> {
  try {
    logger.info('🔄 Google Drive MCP Key Rotation Tool');
    logger.info('====================================');

    // Initialize logger and managers
    const tokenManager = TokenManager.getInstance(logger);
    const keyRotationManager = KeyRotationManager.getInstance(logger);

    // Get current key version
    const currentKey = keyRotationManager.getCurrentKey();
    const currentVersionNum = parseInt(currentKey.version.substring(1));
    const newVersionNum = currentVersionNum + 1;
    const newVersion = `v${newVersionNum}`;

    logger.info(`📍 Current key version: ${currentKey.version}`);
    logger.info(`🔑 Generating new key version: ${newVersion}`);

    // Check if new key already exists in environment
    const newKeyEnv = newVersionNum === 2 ? 'GDRIVE_TOKEN_ENCRYPTION_KEY_V2' : `GDRIVE_TOKEN_ENCRYPTION_KEY_V${newVersionNum}`;
    const existingNewKey = process.env[newKeyEnv];

    if (!existingNewKey) {
      logger.error(`❌ Error: ${newKeyEnv} environment variable not found`);
      logger.info('\n💡 To rotate keys:');
      logger.info(`   1. Generate a new 32-byte key: openssl rand -base64 32`);
      logger.info(`   2. Set environment variable: export ${newKeyEnv}="<your-new-key>"`);
      logger.info(`   3. Run this command again`);
      process.exit(1);
    }

    // Load tokens
    logger.info('📖 Loading current tokens...');
    const tokens = await tokenManager.loadTokens();
    if (!tokens) {
      logger.info('ℹ️  No tokens found to rotate');
      return;
    }

    // The TokenManager will automatically use the new key if we update the current version
    logger.info(`🔐 Setting current key version to ${newVersion}...`);
    process.env.GDRIVE_TOKEN_CURRENT_KEY_VERSION = newVersion;

    // Re-save tokens with new key
    logger.info('💾 Re-encrypting tokens with new key...');
    await tokenManager.saveTokens(tokens);

    logger.info(`✅ Key rotation complete!`);
    logger.info(`📊 Summary:`);
    logger.info(`   - Previous key version: ${currentKey.version}`);
    logger.info(`   - New key version: ${newVersion}`);
    logger.info(`   - Tokens re-encrypted successfully`);
    logger.info(`💡 Next steps:`);
    logger.info(`   1. Update GDRIVE_TOKEN_CURRENT_KEY_VERSION=${newVersion} in your environment`);
    logger.info(`   2. Test the application to ensure tokens work correctly`);
    logger.info(`   3. Keep the old key (${currentKey.version}) until you're certain the rotation succeeded`);

  } catch (error) {
    logger.error('❌ Key rotation failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  }
}

async function migrateTokens(): Promise<void> {
  try {
    // Dynamically import the migration script
    const { migrateTokens: runMigration } = await import('./scripts/migrate-tokens.js');
    await runMigration();
  } catch (error) {
    logger.error('❌ Migration failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  }
}

async function verifyKeys(): Promise<void> {
  try {
    logger.info('🔍 Google Drive MCP Key Verification Tool');
    logger.info('========================================');

    // Initialize managers
    const tokenManager = TokenManager.getInstance(logger);
    const keyRotationManager = KeyRotationManager.getInstance(logger);

    // Get current key info
    const currentKey = keyRotationManager.getCurrentKey();
    logger.info(`📍 Current key version: ${currentKey.version}`);
    logger.info(`🔑 Registered key versions: ${keyRotationManager.getVersions().join(', ')}`);

    // Try to load and decrypt tokens
    logger.info('🔓 Attempting to decrypt tokens...');
    const tokens = await tokenManager.loadTokens();

    if (!tokens) {
      logger.error('❌ No tokens found or unable to decrypt');
      process.exit(1);
    }

    // Verify token structure
    logger.info('✓ Tokens successfully decrypted');
    logger.info('📋 Token validation:');
    logger.info(`   - Access token: ${tokens.access_token ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Refresh token: ${tokens.refresh_token ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Expiry date: ${tokens.expiry_date ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Token type: ${tokens.token_type ? '✓ Present' : '❌ Missing'}`);
    logger.info(`   - Scope: ${tokens.scope ? '✓ Present' : '❌ Missing'}`);

    // Check token expiry
    if (tokens.expiry_date) {
      const isExpired = tokenManager.isTokenExpired(tokens);
      const expiryDate = new Date(tokens.expiry_date);
      logger.info(`⏰ Token expiry: ${expiryDate.toISOString()}`);
      logger.info(`   Status: ${isExpired ? '❌ Expired' : '✓ Valid'}`);
    }

    logger.info('✅ All tokens successfully verified with current key');

  } catch (error) {
    logger.error('❌ Verification failed', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  }
}

// Add health check endpoint handler
if (process.argv[2] === "health") {
  performHealthCheck()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exit(result.status === HealthStatus.HEALTHY ? 0 : 1);
    })
    .catch((error) => {
      const msg = `Health check failed: ${error instanceof Error ? error.message : String(error)}\n`;
      process.stderr.write(msg);
      process.exit(2);
    });
} else if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch((error) => {
    logger.error('Unhandled error in auth flow', { error });
    process.exit(1);
  });
} else if (process.argv[2] === "rotate-key") {
  rotateKey().catch((error) => {
    logger.error('Unhandled error in rotate-key', { error });
    process.exit(1);
  });
} else if (process.argv[2] === "migrate-tokens") {
  migrateTokens().catch((error) => {
    logger.error('Unhandled error in migrate-tokens', { error });
    process.exit(1);
  });
} else if (process.argv[2] === "verify-keys") {
  verifyKeys().catch((error) => {
    logger.error('Unhandled error in verify-keys', { error });
    process.exit(1);
  });
} else {
  loadCredentialsAndRunServer().catch((error) => {
    logger.error('Unhandled error starting server', { error });
    process.exit(1);
  });
}
