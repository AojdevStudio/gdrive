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
import { handleSheetsTool } from "./src/sheets/sheets-handler.js";
import { handleDriveTool } from "./src/drive/drive-handler.js";
import { handleFormsTool } from "./src/forms/forms-handler.js";
import { handleDocsTool } from "./src/docs/docs-handler.js";

const drive = google.drive("v3");
const sheets = google.sheets("v4");
const forms = google.forms("v1");
const docs = google.docs("v1");
const script = google.script("v1");

// Apps Script type definitions
interface AppsScriptFile {
  name: string;
  type: 'SERVER_JS' | 'HTML' | 'JSON';
  source: string;
  functionSet?: {
    values?: Array<{
      name: string;
    }>;
  };
}

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
    version: "0.6.2",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async (_request) => {
  const startTime = Date.now();

  try {
    // Ensure we're authenticated
    if (!authManager || authManager.getState() !== AuthState.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run with "auth" argument first.');
    }

    const cacheKey = 'resources:list';
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached resources list');
      performanceMonitor.track('listResources', Date.now() - startTime);
      return cached;
    }

    const response = await drive.files.list({
      pageSize: 10,
      fields: "files(id, name, mimeType, webViewLink)",
    });

    const resources = response.data.files?.map((file) => ({
      uri: `gdrive:///${file.id}`,
      name: file.name ?? "Untitled",
      mimeType: file.mimeType,
      description: `Google Drive file: ${file.name}`,
    })) ?? [];

    const result = { resources };
    await cacheManager.set(cacheKey, result);

    performanceMonitor.track('listResources', Date.now() - startTime);
    logger.info('Listed resources', { count: resources.length });

    return result;
  } catch (error) {
    performanceMonitor.track('listResources', Date.now() - startTime, true);
    logger.error('Failed to list resources', { error });
    throw error;
  }
});

// Read a specific resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const startTime = Date.now();

  try {
    // Ensure we're authenticated
    if (!authManager || authManager.getState() !== AuthState.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run with "auth" argument first.');
    }

    const fileId = request.params.uri.replace("gdrive:///", "");

    const cacheKey = `resource:${fileId}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached resource', { fileId });
      performanceMonitor.track('readResource', Date.now() - startTime);
      return cached;
    }

    const file = await drive.files.get({
      fileId,
      fields: "id, name, mimeType",
    });

    let text = "";
    let blob = undefined;

    try {
      if (file.data.mimeType?.startsWith("application/vnd.google-apps.")) {
        // Export Google Workspace files
        let exportMimeType = "text/plain";
        if (file.data.mimeType === "application/vnd.google-apps.document") {
          exportMimeType = "text/markdown";
        } else if (file.data.mimeType === "application/vnd.google-apps.spreadsheet") {
          exportMimeType = "text/csv";
        } else if (file.data.mimeType === "application/vnd.google-apps.presentation") {
          exportMimeType = "text/plain";
        } else if (file.data.mimeType === "application/vnd.google-apps.drawing") {
          const response = await drive.files.export({
            fileId,
            mimeType: "image/png",
          }, { responseType: "arraybuffer" });

          blob = Buffer.from(response.data as ArrayBuffer).toString("base64");

          const result = {
            contents: [{
              uri: request.params.uri,
              mimeType: "image/png",
              blob,
            }],
          };

          await cacheManager.set(cacheKey, result);
          performanceMonitor.track('readResource', Date.now() - startTime);
          logger.info('Read resource (drawing)', { fileId, mimeType: file.data.mimeType });

          return result;
        }

        const response = await drive.files.export({
          fileId,
          mimeType: exportMimeType,
        });
        text = response.data as string;
      } else if (file.data.mimeType?.startsWith("text/")) {
        // Download text files
        const response = await drive.files.get({
          fileId,
          alt: "media",
        });
        text = response.data as string;
      } else {
        // Binary files - return as base64 blob
        const response = await drive.files.get({
          fileId,
          alt: "media",
        }, { responseType: "arraybuffer" });

        blob = Buffer.from(response.data as ArrayBuffer).toString("base64");
      }
    } catch (error) {
      logger.error('Failed to read file content', { error, fileId });
      text = `Error reading file: ${String(error)}`;
    }

    const result = {
      contents: [{
        uri: request.params.uri,
        mimeType: blob ? file.data.mimeType : "text/plain",
        text: blob ? undefined : text,
        blob: blob,
      }],
    };

    await cacheManager.set(cacheKey, result);
    performanceMonitor.track('readResource', Date.now() - startTime);
    logger.info('Read resource', { fileId, mimeType: file.data.mimeType });

    return result;
  } catch (error) {
    performanceMonitor.track('readResource', Date.now() - startTime, true);
    logger.error('Failed to read resource', { error, uri: request.params.uri });
    throw error;
  }
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "sheets",
        description: "Consolidated Google Sheets tool supporting operations for list, read, create, rename, delete, update, updateFormula, format, conditionalFormat, append, freeze, and setColumnWidth",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [
                "list",
                "read",
                "create",
                "rename",
                "delete",
                "update",
                "updateFormula",
                "format",
                "conditionalFormat",
                "append",
                "freeze",
                "setColumnWidth"
              ],
              description: "The sheets tool operation to execute",
            },
            spreadsheetId: {
              type: "string",
              description: "The ID of the target spreadsheet",
            },
            range: {
              type: "string",
              description: "A1 notation range used by read, update, updateFormula, format, and conditionalFormat operations",
            },
            sheetName: {
              type: "string",
              description: "Optional sheet title used by create, append, freeze, setColumnWidth, and as an alternative identifier for rename/delete/updateFormula",
            },
            sheetId: {
              type: "number",
              description: "Optional numeric sheet identifier for rename and delete operations",
            },
            newName: {
              type: "string",
              description: "New sheet name for the rename operation",
            },
            values: {
              type: "array",
              description: "2D array of cell values for update and append operations",
              items: {
                type: "array",
                items: {},
              },
            },
            formula: {
              type: "string",
              description: "Formula string for the updateFormula operation",
            },
            format: {
              type: "object",
              description: "Formatting options for the format operation",
              properties: {
                bold: { type: "boolean" },
                italic: { type: "boolean" },
                fontSize: { type: "number" },
                foregroundColor: {
                  type: "object",
                  properties: {
                    red: { type: "number", minimum: 0, maximum: 1 },
                    green: { type: "number", minimum: 0, maximum: 1 },
                    blue: { type: "number", minimum: 0, maximum: 1 },
                    alpha: { type: "number", minimum: 0, maximum: 1 },
                  },
                },
                backgroundColor: {
                  type: "object",
                  properties: {
                    red: { type: "number", minimum: 0, maximum: 1 },
                    green: { type: "number", minimum: 0, maximum: 1 },
                    blue: { type: "number", minimum: 0, maximum: 1 },
                    alpha: { type: "number", minimum: 0, maximum: 1 },
                  },
                },
                numberFormat: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    pattern: { type: "string" },
                  },
                },
              },
            },
            rule: {
              type: "object",
              description: "Conditional formatting rule for the conditionalFormat operation",
              properties: {
                condition: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["NUMBER_GREATER", "NUMBER_LESS", "TEXT_CONTAINS", "CUSTOM_FORMULA"],
                    },
                    values: {
                      type: "array",
                      items: { type: "string" },
                    },
                    formula: { type: "string" },
                  },
                },
                format: {
                  type: "object",
                  properties: {
                    backgroundColor: {
                      type: "object",
                      properties: {
                        red: { type: "number", minimum: 0, maximum: 1 },
                        green: { type: "number", minimum: 0, maximum: 1 },
                        blue: { type: "number", minimum: 0, maximum: 1 },
                        alpha: { type: "number", minimum: 0, maximum: 1 },
                      },
                    },
                    foregroundColor: {
                      type: "object",
                      properties: {
                        red: { type: "number", minimum: 0, maximum: 1 },
                        green: { type: "number", minimum: 0, maximum: 1 },
                        blue: { type: "number", minimum: 0, maximum: 1 },
                        alpha: { type: "number", minimum: 0, maximum: 1 },
                      },
                    },
                    bold: { type: "boolean" },
                  },
                },
              },
            },
            rowCount: {
              type: "number",
              description: "Initial row count for the create operation",
              default: 1000,
            },
            columnCount: {
              type: "number",
              description: "Initial column count for the create operation",
              default: 26,
            },
            frozenRowCount: {
              type: "number",
              description: "Number of rows to freeze for the freeze operation",
              default: 0,
            },
            frozenColumnCount: {
              type: "number",
              description: "Number of columns to freeze for the freeze operation",
              default: 0,
            },
            columns: {
              type: "array",
              description: "Column definitions for the setColumnWidth operation",
              items: {
                type: "object",
                properties: {
                  columnIndex: { type: "number" },
                  width: { type: "number" },
                },
              },
            },
            index: {
              type: "number",
              description: "Optional zero-based index for where the new sheet should be inserted",
            },
            hidden: {
              type: "boolean",
              description: "Whether the new sheet should be hidden on creation",
            },
            rightToLeft: {
              type: "boolean",
              description: "Whether the new sheet should use right-to-left layout",
            },
            tabColor: {
              type: "object",
              description: "Tab color for the create operation",
              properties: {
                red: { type: "number", minimum: 0, maximum: 1 },
                green: { type: "number", minimum: 0, maximum: 1 },
                blue: { type: "number", minimum: 0, maximum: 1 },
                alpha: { type: "number", minimum: 0, maximum: 1 },
              },
            },
            title: {
              type: "string",
              description: "Optional alias for sheetName when creating or identifying sheets",
            },
          },
          required: ["operation", "spreadsheetId"],
        },
      },
      {
        name: "drive",
        description: "Consolidated Google Drive tool supporting operations for search, enhancedSearch, read, create, update, createFolder, and batch",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [
                "search",
                "enhancedSearch",
                "read",
                "create",
                "update",
                "createFolder",
                "batch"
              ],
              description: "The drive operation to execute",
            },
            query: {
              type: "string",
              description: "Search query for search and enhancedSearch operations",
            },
            filters: {
              type: "object",
              description: "Advanced filters for enhancedSearch operation",
              properties: {
                mimeType: { type: "string" },
                modifiedAfter: { type: "string" },
                modifiedBefore: { type: "string" },
                createdAfter: { type: "string" },
                createdBefore: { type: "string" },
                sharedWithMe: { type: "boolean" },
                ownedByMe: { type: "boolean" },
                parents: { type: "string" },
                trashed: { type: "boolean" },
              },
            },
            pageSize: {
              type: "number",
              description: "Number of results for search operations (default: 10, max: 100)",
              default: 10,
            },
            orderBy: {
              type: "string",
              description: "Sort order for enhancedSearch (e.g., 'modifiedTime desc')",
            },
            fileId: {
              type: "string",
              description: "File ID for read and update operations",
            },
            name: {
              type: "string",
              description: "File or folder name for create and createFolder operations",
            },
            content: {
              type: "string",
              description: "File content for create and update operations",
            },
            mimeType: {
              type: "string",
              description: "MIME type for create operation (default: 'text/plain')",
            },
            parentId: {
              type: "string",
              description: "Parent folder ID for create and createFolder operations",
            },
            operations: {
              type: "array",
              description: "Array of operations for batch operation",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["create", "update", "delete", "move"],
                  },
                  fileId: { type: "string" },
                  name: { type: "string" },
                  content: { type: "string" },
                  mimeType: { type: "string" },
                  parentId: { type: "string" },
                },
              },
            },
          },
          required: ["operation"],
        },
      },
      {
        name: "forms",
        description: "Consolidated Google Forms tool supporting operations for create, read, addQuestion, and listResponses",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [
                "create",
                "read",
                "addQuestion",
                "listResponses"
              ],
              description: "The forms operation to execute",
            },
            formId: {
              type: "string",
              description: "Form ID for read, addQuestion, and listResponses operations",
            },
            title: {
              type: "string",
              description: "Form title for create operation, or question title for addQuestion operation",
            },
            description: {
              type: "string",
              description: "Form description for create operation",
            },
            type: {
              type: "string",
              enum: ["TEXT", "PARAGRAPH_TEXT", "MULTIPLE_CHOICE", "CHECKBOX", "DROPDOWN", "LINEAR_SCALE", "DATE", "TIME"],
              description: "Question type for addQuestion operation",
            },
            required: {
              type: "boolean",
              description: "Whether question is required for addQuestion operation",
            },
            options: {
              type: "array",
              description: "Options for multiple choice/checkbox/dropdown questions",
              items: {
                type: "string",
              },
            },
            scaleMin: {
              type: "number",
              description: "Minimum value for linear scale questions (default: 1)",
            },
            scaleMax: {
              type: "number",
              description: "Maximum value for linear scale questions (default: 5)",
            },
            scaleMinLabel: {
              type: "string",
              description: "Label for minimum value in linear scale",
            },
            scaleMaxLabel: {
              type: "string",
              description: "Label for maximum value in linear scale",
            },
          },
          required: ["operation"],
        },
      },
      {
        name: "docs",
        description: "Consolidated Google Docs tool supporting operations for create, insertText, replaceText, applyTextStyle, and insertTable",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: [
                "create",
                "insertText",
                "replaceText",
                "applyTextStyle",
                "insertTable"
              ],
              description: "The docs operation to execute",
            },
            documentId: {
              type: "string",
              description: "Document ID for insertText, replaceText, applyTextStyle, and insertTable operations",
            },
            title: {
              type: "string",
              description: "Document title for create operation",
            },
            content: {
              type: "string",
              description: "Initial content for create operation",
            },
            parentId: {
              type: "string",
              description: "Parent folder ID for create operation",
            },
            text: {
              type: "string",
              description: "Text to insert for insertText operation",
            },
            index: {
              type: "number",
              description: "Index position for insertText and insertTable operations (default: 1)",
            },
            searchText: {
              type: "string",
              description: "Text to search for in replaceText operation",
            },
            replaceText: {
              type: "string",
              description: "Replacement text for replaceText operation",
            },
            matchCase: {
              type: "boolean",
              description: "Whether to match case in replaceText operation",
            },
            startIndex: {
              type: "number",
              description: "Start index for applyTextStyle operation",
            },
            endIndex: {
              type: "number",
              description: "End index for applyTextStyle operation",
            },
            bold: {
              type: "boolean",
              description: "Apply bold styling",
            },
            italic: {
              type: "boolean",
              description: "Apply italic styling",
            },
            underline: {
              type: "boolean",
              description: "Apply underline styling",
            },
            fontSize: {
              type: "number",
              description: "Font size in points",
            },
            foregroundColor: {
              type: "object",
              description: "Text color (RGB values 0-1)",
              properties: {
                red: { type: "number", minimum: 0, maximum: 1 },
                green: { type: "number", minimum: 0, maximum: 1 },
                blue: { type: "number", minimum: 0, maximum: 1 },
              },
            },
            rows: {
              type: "number",
              description: "Number of rows for insertTable operation",
            },
            columns: {
              type: "number",
              description: "Number of columns for insertTable operation",
            },
          },
          required: ["operation"],
        },
      },
      {
        name: "getAppScript",
        description: "Get Google Apps Script code by script ID",
        inputSchema: {
          type: "object",
          properties: {
            scriptId: {
              type: "string",
              description: "The Google Apps Script project ID",
            },
          },
          required: ["scriptId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();

  try {
    // Ensure we're authenticated
    if (!authManager || authManager.getState() !== AuthState.AUTHENTICATED) {
      throw new Error('Not authenticated. Please run with "auth" argument first.');
    }

    const { name, arguments: args } = request.params;

    logger.info('Tool called', { tool: name, args });

    switch (name) {
      case "sheets": {
        return await handleSheetsTool(args ?? {}, {
          logger,
          sheets,
          cacheManager,
          performanceMonitor,
          startTime,
        });
      }

      case "drive": {
        return await handleDriveTool(args ?? {}, {
          logger,
          drive,
          cacheManager,
          performanceMonitor,
          startTime,
        });
      }

      case "forms": {
        return await handleFormsTool(args ?? {}, {
          logger,
          forms,
          cacheManager,
          performanceMonitor,
          startTime,
        });
      }

      case "docs": {
        return await handleDocsTool(args ?? {}, {
          logger,
          docs,
          drive,
          cacheManager,
          performanceMonitor,
          startTime,
        });
      }

      case "getAppScript": {
        const startTime = Date.now();
        if (!args || typeof args.scriptId !== 'string') {
          throw new Error('scriptId parameter is required');
        }
        const { scriptId } = args;

        // Check cache first
        const cached = await cacheManager.get(`script:${scriptId}`);
        if (cached) {
          performanceMonitor.recordCacheHit();
          logger.info('getAppScript cache hit', { scriptId });

          // Format the cached response
          const filesText = (cached as { files: AppsScriptFile[] }).files.map((file: AppsScriptFile) => {
            let fileInfo = `File: ${file.name} (${file.type})\n`;
            fileInfo += '```' + (file.type === 'HTML' ? 'html' : 'javascript') + '\n';
            fileInfo += file.source;
            fileInfo += '\n```';
            return fileInfo;
          }).join('\n\n');

          return {
            content: [{
              type: "text",
              text: `Apps Script Project (ID: ${scriptId})\n\n${filesText}`,
            }],
          };
        }

        performanceMonitor.recordCacheMiss();

        // Get script content from API
        const response = await script.projects.getContent({
          scriptId: scriptId,
        });

        const content = response.data;

        // Cache the result
        await cacheManager.set(`script:${scriptId}`, content as CacheData);

        // Format the response
        if (!content.files) {
          throw new Error('No files found in script content');
        }

        const filesText = (content.files as AppsScriptFile[]).map((file: AppsScriptFile) => {
          let fileInfo = `File: ${file.name} (${file.type})\n`;
          fileInfo += '```' + (file.type === 'HTML' ? 'html' : 'javascript') + '\n';
          fileInfo += file.source;
          fileInfo += '\n```';
          return fileInfo;
        }).join('\n\n');

        performanceMonitor.track('getAppScript', Date.now() - startTime);

        return {
          content: [{
            type: "text",
            text: `Apps Script Project (ID: ${scriptId})\n\n${filesText}`,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
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
      "https://www.googleapis.com/auth/script.projects.readonly"
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
