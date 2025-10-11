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
import {
  buildFormulaRows,
  getSheetId,
  parseA1Notation,
  parseRangeInput,
} from "./src/sheets/helpers.js";

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

// Search filters interface
interface SearchFilters {
  mimeType?: string;
  modifiedTime?: string;
  createdTime?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  createdAfter?: string;
  createdBefore?: string;
  sharedWithMe?: boolean;
  ownedByMe?: boolean;
  parents?: string;
  trashed?: boolean;
  [key: string]: unknown;
}

// File metadata interface
interface FileMetadata {
  name: string;
  mimeType?: string;
  parents?: string[];
  [key: string]: unknown;
}

// Question item interface for forms - matching Google Forms API structure for createItem
interface QuestionItem {
  question: {
    required: boolean;  // Required field is inside question structure for createItem API
    textQuestion?: {
      paragraph: boolean;
    };
    choiceQuestion?: {
      type: "RADIO" | "CHECKBOX" | "DROP_DOWN";  // More specific typing for better type safety
      options: Array<{ value: string }>;
    };
    scaleQuestion?: {
      low: number;
      high: number;
      lowLabel?: string;
      highLabel?: string;
    };
    dateQuestion?: {
      includeTime: boolean;
      includeYear: boolean;
    };
    timeQuestion?: {
      duration: boolean;
    };
    [key: string]: unknown;
  };
}

// Text style interface for Google Docs
interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: {
    magnitude: number;
    unit: string;
  };
  foregroundColor?: {
    color: {
      rgbColor: {
        red: number;
        green: number;
        blue: number;
      };
    };
  };
}

// Google Sheets interfaces for createSheet
/**
 * RGBA color definition that matches the Google Sheets API structure. All
 * channels are normalized numbers between 0 and 1 inclusive.
 */
interface Color {
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
}

/**
 * Optional grid configuration values for a sheet. Individual properties are
 * forwarded directly to `GridProperties` in the Sheets API.
 */
interface GridProperties {
  rowCount?: number;
  columnCount?: number;
  frozenRowCount?: number;
  frozenColumnCount?: number;
}

/**
 * Sheet-level configuration that is sent in the addSheet batchUpdate request.
 */
interface SheetProperties {
  sheetId?: number;
  title?: string;
  index?: number;
  gridProperties?: GridProperties;
  hidden?: boolean;
  tabColor?: Color;
  rightToLeft?: boolean;
}

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

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return safeStringify(error);
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

// Natural language search parser
function parseNaturalLanguageQuery(query: string): { searchTerms: string; filters: SearchFilters } {
  const lowerQuery = query.toLowerCase();
  const filters: SearchFilters = {};

  // Document type detection
  if (lowerQuery.includes('spreadsheet') || lowerQuery.includes('sheet')) {
    filters.mimeType = 'application/vnd.google-apps.spreadsheet';
  } else if (lowerQuery.includes('document') || lowerQuery.includes('doc')) {
    filters.mimeType = 'application/vnd.google-apps.document';
  } else if (lowerQuery.includes('presentation') || lowerQuery.includes('slide')) {
    filters.mimeType = 'application/vnd.google-apps.presentation';
  } else if (lowerQuery.includes('folder')) {
    filters.mimeType = 'application/vnd.google-apps.folder';
  }

  // Time-based filters
  const timePatterns = [
    { pattern: /modified\s+(today|yesterday)/, field: 'modifiedTime' },
    { pattern: /created\s+(today|yesterday)/, field: 'createdTime' },
    { pattern: /modified\s+last\s+(\d+)\s+days?/, field: 'modifiedTime', relative: true },
    { pattern: /created\s+last\s+(\d+)\s+days?/, field: 'createdTime', relative: true }
  ];

  for (const { pattern, field, relative } of timePatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      if (relative && match[1]) {
        const days = parseInt(match[1]);
        const date = new Date();
        date.setDate(date.getDate() - days);
        filters[field] = date.toISOString();
      } else if (match[1] === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filters[field] = today.toISOString();
      } else if (match[1] === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        filters[field] = yesterday.toISOString();
      }
    }
  }

  // Owner/shared filters
  if (lowerQuery.includes('shared with me')) {
    filters.sharedWithMe = true;
  } else if (lowerQuery.includes('owned by me') || lowerQuery.includes('my files')) {
    filters.ownedByMe = true;
  }

  // Extract the actual search terms (remove filter keywords)
  const filterKeywords = [
    'spreadsheet', 'sheet', 'document', 'doc', 'presentation', 'slide', 'folder',
    'modified', 'created', 'today', 'yesterday', 'last', 'days', 'day',
    'shared with me', 'owned by me', 'my files'
  ];

  let searchTerms = query;
  filterKeywords.forEach(keyword => {
    searchTerms = searchTerms.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '');
  });

  searchTerms = searchTerms.replace(/\s+/g, ' ').trim();

  return { searchTerms, filters };
}

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
        name: "search",
        description: "Search for files in Google Drive. Supports natural language queries like 'spreadsheets modified last 7 days' or 'documents shared with me'.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language search query (e.g., 'budget spreadsheet modified yesterday', 'presentations created last week')",
            },
            pageSize: {
              type: "number",
              description: "Number of results to return (default: 10, max: 100)",
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "enhancedSearch",
        description: "Enhanced search with advanced filtering options for Google Drive files",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for file names and content",
            },
            filters: {
              type: "object",
              properties: {
                mimeType: {
                  type: "string",
                  description: "Filter by MIME type (e.g., 'application/vnd.google-apps.spreadsheet')",
                },
                modifiedAfter: {
                  type: "string",
                  description: "ISO 8601 date string for files modified after this date",
                },
                modifiedBefore: {
                  type: "string",
                  description: "ISO 8601 date string for files modified before this date",
                },
                createdAfter: {
                  type: "string",
                  description: "ISO 8601 date string for files created after this date",
                },
                createdBefore: {
                  type: "string",
                  description: "ISO 8601 date string for files created before this date",
                },
                sharedWithMe: {
                  type: "boolean",
                  description: "Only show files shared with me",
                },
                ownedByMe: {
                  type: "boolean",
                  description: "Only show files I own",
                },
                parents: {
                  type: "string",
                  description: "Parent folder ID to search within",
                },
                trashed: {
                  type: "boolean",
                  description: "Include trashed files (default: false)",
                },
              },
            },
            pageSize: {
              type: "number",
              description: "Number of results to return (default: 10, max: 100)",
              default: 10,
            },
            orderBy: {
              type: "string",
              description: "Sort order (e.g., 'modifiedTime desc', 'name', 'createdTime')",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "read",
        description: "Read the contents of a Google Drive file",
        inputSchema: {
          type: "object",
          properties: {
            fileId: {
              type: "string",
              description: "The ID of the file to read",
            },
          },
          required: ["fileId"],
        },
      },
      {
        name: "createFile",
        description: "Create a new file in Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the file",
            },
            content: {
              type: "string",
              description: "The content of the file",
            },
            mimeType: {
              type: "string",
              description: "The MIME type of the file (default: text/plain)",
              default: "text/plain",
            },
            parentId: {
              type: "string",
              description: "The ID of the parent folder (optional)",
            },
          },
          required: ["name", "content"],
        },
      },
      {
        name: "updateFile",
        description: "Update the content of an existing file",
        inputSchema: {
          type: "object",
          properties: {
            fileId: {
              type: "string",
              description: "The ID of the file to update",
            },
            content: {
              type: "string",
              description: "The new content of the file",
            },
          },
          required: ["fileId", "content"],
        },
      },
      {
        name: "createFolder",
        description: "Create a new folder in Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the folder",
            },
            parentId: {
              type: "string",
              description: "The ID of the parent folder (optional)",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "listSheets",
        description: "List all sheets in a Google Sheets document",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Sheets document",
            },
          },
          required: ["spreadsheetId"],
        },
      },
      {
        name: "readSheet",
        description: "Read data from a specific sheet or range in Google Sheets",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Sheets document",
            },
            range: {
              type: "string",
              description: "The A1 notation range to read (e.g., 'Sheet1!A1:B10', 'Sheet1')",
              default: "Sheet1",
            },
          },
          required: ["spreadsheetId"],
        },
      },
      {
        name: "updateCells",
        description: "Update cells in a Google Sheets document",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Sheets document",
            },
            range: {
              type: "string",
              description: "The A1 notation range to update (e.g., 'Sheet1!A1:B2')",
            },
            values: {
              type: "array",
              description: "2D array of values to write",
              items: {
                type: "array",
                items: {
                  type: ["string", "number", "boolean", "null"],
                },
              },
            },
          },
          required: ["spreadsheetId", "range", "values"],
        },
      },
      {
        name: "updateCellsWithFormula",
        description: "Set cell formulas in Google Sheets (e.g., =SUM(A1:A10))",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Sheets document",
            },
            range: {
              type: "string",
              description: "The A1 notation range to update (e.g., 'Sheet1!A1')",
            },
            formula: {
              type: "string",
              description: "Formula to apply (must include leading '=' sign)",
            },
            sheetName: {
              type: "string",
              description: "Optional sheet name when not included in the range",
            },
          },
          required: ["spreadsheetId", "range", "formula"],
        },
      },
      {
        name: "appendRows",
        description: "Append rows to a Google Sheets document",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Sheets document",
            },
            sheetName: {
              type: "string",
              description: "The name of the sheet to append to",
              default: "Sheet1",
            },
            values: {
              type: "array",
              description: "2D array of values to append",
              items: {
                type: "array",
                items: {
                  type: ["string", "number", "boolean", "null"],
                },
              },
            },
          },
          required: ["spreadsheetId", "values"],
        },
      },
      {
        name: "createSheet",
        description: "Create a new sheet in an existing Google Spreadsheet. Examples: {\"spreadsheetId\": \"abc123\", \"title\": \"Quarterly 📊\"} and {\"spreadsheetId\": \"abc123\", \"title\": \"Roadmap\", \"tabColor\": {\"red\": 0.1, \"green\": 0.3, \"blue\": 0.7}}",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Sheets document",
            },
            title: {
              type: "string",
              description: "The name of the new sheet",
            },
            index: {
              type: "number",
              description: "The position where the sheet should be inserted (0-based)",
            },
            rowCount: {
              type: "number",
              description: "Number of rows in the new sheet",
              default: 1000,
            },
            columnCount: {
              type: "number",
              description: "Number of columns in the new sheet",
              default: 26,
            },
            hidden: {
              type: "boolean",
              description: "Whether the sheet should be hidden",
              default: false,
            },
            tabColor: {
              type: "object",
              description: "RGB color for the sheet tab using normalized 0-1 values (e.g. 0.5 = 50% intensity)",
              properties: {
                red: { type: "number", minimum: 0, maximum: 1 },
                green: { type: "number", minimum: 0, maximum: 1 },
                blue: { type: "number", minimum: 0, maximum: 1 },
                alpha: { type: "number", minimum: 0, maximum: 1 },
              },
            },
            frozenRowCount: {
              type: "number",
              description: "Number of rows to freeze",
              default: 0,
            },
            frozenColumnCount: {
              type: "number",
              description: "Number of columns to freeze",
              default: 0,
            },
            rightToLeft: {
              type: "boolean",
              description: "Whether text should be right-to-left",
              default: false,
            },
          },
          required: ["spreadsheetId"],
        },
      },
      {
        name: "createForm",
        description: "Create a new Google Form with questions",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the form",
            },
            description: {
              type: "string",
              description: "The description of the form (optional)",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "getForm",
        description: "Get details of a Google Form including questions and settings",
        inputSchema: {
          type: "object",
          properties: {
            formId: {
              type: "string",
              description: "The ID of the Google Form",
            },
          },
          required: ["formId"],
        },
      },
      {
        name: "addQuestion",
        description: "Add a question to an existing Google Form",
        inputSchema: {
          type: "object",
          properties: {
            formId: {
              type: "string",
              description: "The ID of the Google Form",
            },
            title: {
              type: "string",
              description: "The question title/text",
            },
            type: {
              type: "string",
              enum: ["TEXT", "PARAGRAPH_TEXT", "MULTIPLE_CHOICE", "CHECKBOX", "DROPDOWN", "LINEAR_SCALE", "DATE", "TIME"],
              description: "The type of question",
            },
            required: {
              type: "boolean",
              description: "Whether the question is required",
              default: false,
            },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Options for multiple choice, checkbox, or dropdown questions",
            },
            scaleMin: {
              type: "number",
              description: "Minimum value for linear scale (default: 1)",
              default: 1,
            },
            scaleMax: {
              type: "number",
              description: "Maximum value for linear scale (default: 5)",
              default: 5,
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
          required: ["formId", "title", "type"],
        },
      },
      {
        name: "listResponses",
        description: "List all responses to a Google Form",
        inputSchema: {
          type: "object",
          properties: {
            formId: {
              type: "string",
              description: "The ID of the Google Form",
            },
          },
          required: ["formId"],
        },
      },
      {
        name: "createDocument",
        description: "Create a new Google Docs document",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the document",
            },
            content: {
              type: "string",
              description: "Initial content for the document (optional)",
            },
            parentId: {
              type: "string",
              description: "The ID of the parent folder (optional)",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "insertText",
        description: "Insert text at a specific location in a Google Docs document",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The ID of the Google Docs document",
            },
            text: {
              type: "string",
              description: "The text to insert",
            },
            index: {
              type: "number",
              description: "The zero-based index where to insert the text (1 for beginning of document)",
              default: 1,
            },
          },
          required: ["documentId", "text"],
        },
      },
      {
        name: "replaceText",
        description: "Replace all occurrences of text in a Google Docs document",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The ID of the Google Docs document",
            },
            searchText: {
              type: "string",
              description: "The text to search for",
            },
            replaceText: {
              type: "string",
              description: "The text to replace with",
            },
            matchCase: {
              type: "boolean",
              description: "Whether to match case when searching",
              default: false,
            },
          },
          required: ["documentId", "searchText", "replaceText"],
        },
      },
      {
        name: "applyTextStyle",
        description: "Apply text styling to a range in a Google Docs document",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The ID of the Google Docs document",
            },
            startIndex: {
              type: "number",
              description: "The start index of the range",
            },
            endIndex: {
              type: "number",
              description: "The end index of the range",
            },
            bold: {
              type: "boolean",
              description: "Make text bold",
            },
            italic: {
              type: "boolean",
              description: "Make text italic",
            },
            underline: {
              type: "boolean",
              description: "Underline text",
            },
            fontSize: {
              type: "number",
              description: "Font size in points",
            },
            foregroundColor: {
              type: "object",
              description: "Text color (RGB values 0-1)",
              properties: {
                red: { type: "number" },
                green: { type: "number" },
                blue: { type: "number" },
              },
            },
          },
          required: ["documentId", "startIndex", "endIndex"],
        },
      },
      {
        name: "insertTable",
        description: "Insert a table at a specific location in a Google Docs document",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The ID of the Google Docs document",
            },
            rows: {
              type: "number",
              description: "Number of rows in the table",
            },
            columns: {
              type: "number",
              description: "Number of columns in the table",
            },
            index: {
              type: "number",
              description: "The zero-based index where to insert the table",
              default: 1,
            },
          },
          required: ["documentId", "rows", "columns"],
        },
      },
      {
        name: "batchFileOperations",
        description: "Perform batch operations on multiple files (create, update, delete, move)",
        inputSchema: {
          type: "object",
          properties: {
            operations: {
              type: "array",
              description: "Array of operations to perform",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["create", "update", "delete", "move"],
                    description: "Type of operation",
                  },
                  fileId: {
                    type: "string",
                    description: "File ID (required for update, delete, move)",
                  },
                  name: {
                    type: "string",
                    description: "File name (required for create, optional for update)",
                  },
                  content: {
                    type: "string",
                    description: "File content (required for create and update)",
                  },
                  mimeType: {
                    type: "string",
                    description: "MIME type for create operation",
                  },
                  parentId: {
                    type: "string",
                    description: "Parent folder ID (for create and move)",
                  },
                },
                required: ["type"],
              },
            },
          },
          required: ["operations"],
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
      case "search": {
        if (!args || typeof args.query !== 'string') {
          throw new Error('Query parameter is required');
        }
        const { searchTerms, filters } = parseNaturalLanguageQuery(args.query);

        // Build Google Drive query
        let q = searchTerms ? `fullText contains '${searchTerms}'` : "";

        if (filters.mimeType) {
          q += q ? " and " : "";
          q += `mimeType = '${filters.mimeType}'`;
        }

        if (filters.modifiedTime) {
          q += q ? " and " : "";
          q += `modifiedTime > '${filters.modifiedTime}'`;
        }

        if (filters.createdTime) {
          q += q ? " and " : "";
          q += `createdTime > '${filters.createdTime}'`;
        }

        if (filters.sharedWithMe) {
          q += q ? " and " : "";
          q += "sharedWithMe = true";
        }

        if (filters.ownedByMe) {
          q += q ? " and " : "";
          q += "'me' in owners";
        }

        const pageSize = (typeof args.pageSize === 'number' ? args.pageSize : 10);
        const cacheKey = `search:${q}:${pageSize}`;
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          performanceMonitor.track('search', Date.now() - startTime);
          return cached;
        }

        const response = await drive.files.list({
          q: q ?? undefined,
          pageSize: Math.min(pageSize, 100),
          fields: "files(id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink, iconLink, owners, permissions)",
          orderBy: "modifiedTime desc",
        });

        const result = {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.files ?? [], null, 2),
          }],
        };

        await cacheManager.set(cacheKey, result);
        performanceMonitor.track('search', Date.now() - startTime);

        return result;
      }

      case "enhancedSearch": {
        if (!args) {
          throw new Error('Arguments are required');
        }
        const query = args.query as string | undefined;
        const filters = (args.filters ?? {}) as SearchFilters;
        const pageSize = (typeof args.pageSize === 'number' ? args.pageSize : 10);
        const orderBy = (typeof args.orderBy === 'string' ? args.orderBy : "modifiedTime desc");

        // Build complex query
        let q = "";

        if (query) {
          q = `fullText contains '${query}'`;
        }

        // Add all filter conditions
        const filterConditions = [];

        if (filters.mimeType) {
          filterConditions.push(`mimeType = '${filters.mimeType}'`);
        }

        if (filters.modifiedAfter) {
          filterConditions.push(`modifiedTime > '${filters.modifiedAfter}'`);
        }

        if (filters.modifiedBefore) {
          filterConditions.push(`modifiedTime < '${filters.modifiedBefore}'`);
        }

        if (filters.createdAfter) {
          filterConditions.push(`createdTime > '${filters.createdAfter}'`);
        }

        if (filters.createdBefore) {
          filterConditions.push(`createdTime < '${filters.createdBefore}'`);
        }

        if (filters.sharedWithMe) {
          filterConditions.push("sharedWithMe = true");
        }

        if (filters.ownedByMe) {
          filterConditions.push("'me' in owners");
        }

        if (filters.parents) {
          filterConditions.push(`'${filters.parents}' in parents`);
        }

        if (!filters.trashed) {
          filterConditions.push("trashed = false");
        }

        // Combine query and filters
        if (filterConditions.length > 0) {
          q = q ? `${q} and ${filterConditions.join(" and ")}` : filterConditions.join(" and ");
        }

        const cacheKey = `enhancedSearch:${q}:${pageSize}:${orderBy}`;
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          performanceMonitor.track('enhancedSearch', Date.now() - startTime);
          return cached;
        }

        const response = await drive.files.list({
          q: q ?? undefined,
          pageSize: Math.min(pageSize, 100),
          fields: "files(id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink, iconLink, owners, permissions, description, starred)",
          orderBy,
        });

        const result = {
          content: [{
            type: "text",
            text: JSON.stringify({
              query: q,
              totalResults: response.data.files?.length ?? 0,
              files: response.data.files ?? [],
            }, null, 2),
          }],
        };

        await cacheManager.set(cacheKey, result);
        performanceMonitor.track('enhancedSearch', Date.now() - startTime);

        return result;
      }

      case "read": {
        if (!args || typeof args.fileId !== 'string') {
          throw new Error('fileId parameter is required');
        }
        const { fileId } = args;

        const cacheKey = `read:${fileId}`;
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          performanceMonitor.track('read', Date.now() - startTime);
          return cached;
        }

        const file = await drive.files.get({
          fileId,
          fields: "id, name, mimeType",
        });

        let text = "";

        if (file.data.mimeType?.startsWith("application/vnd.google-apps.")) {
          // Export Google Workspace files
          let exportMimeType = "text/plain";

          if (file.data.mimeType === "application/vnd.google-apps.document") {
            exportMimeType = "text/markdown";
          } else if (file.data.mimeType === "application/vnd.google-apps.spreadsheet") {
            exportMimeType = "text/csv";
          } else if (file.data.mimeType === "application/vnd.google-apps.presentation") {
            exportMimeType = "text/plain";
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
          text = `Binary file (${file.data.mimeType}). Use the resource URI to access the full content.`;
        }

        const result = {
          content: [{
            type: "text",
            text: text,
          }],
        };

        await cacheManager.set(cacheKey, result);
        performanceMonitor.track('read', Date.now() - startTime);

        return result;
      }

      case "createFile": {
        if (!args || typeof args.name !== 'string' || typeof args.content !== 'string') {
          throw new Error('name and content parameters are required');
        }
        const { name, content } = args;
        const mimeType = (typeof args.mimeType === 'string' ? args.mimeType : "text/plain");
        const parentId = args.parentId as string | undefined;

        const fileMetadata: FileMetadata = {
          name,
          mimeType,
        };

        if (parentId) {
          fileMetadata.parents = [parentId];
        }

        const media = {
          mimeType,
          body: content,
        };

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id, name, webViewLink",
        });

        // Invalidate cache
        await cacheManager.invalidate('resources:*');
        await cacheManager.invalidate('search:*');

        performanceMonitor.track('createFile', Date.now() - startTime);
        logger.info('File created', { fileId: response.data.id, name });

        return {
          content: [{
            type: "text",
            text: `File created successfully!\nID: ${response.data.id}\nName: ${response.data.name}\nLink: ${response.data.webViewLink}`,
          }],
        };
      }

      case "updateFile": {
        if (!args || typeof args.fileId !== 'string' || typeof args.content !== 'string') {
          throw new Error('fileId and content parameters are required');
        }
        const { fileId, content } = args;

        const media = {
          mimeType: "text/plain",
          body: content,
        };

        await drive.files.update({
          fileId,
          media,
        });

        // Invalidate cache
        await cacheManager.invalidate(`read:${fileId}`);
        await cacheManager.invalidate(`resource:${fileId}`);

        performanceMonitor.track('updateFile', Date.now() - startTime);
        logger.info('File updated', { fileId });

        return {
          content: [{
            type: "text",
            text: `File ${fileId} updated successfully!`,
          }],
        };
      }

      case "createFolder": {
        if (!args || typeof args.name !== 'string') {
          throw new Error('name parameter is required');
        }
        const { name } = args;
        const parentId = args.parentId as string | undefined;

        const fileMetadata: FileMetadata = {
          name,
          mimeType: "application/vnd.google-apps.folder",
        };

        if (parentId) {
          fileMetadata.parents = [parentId];
        }

        const response = await drive.files.create({
          requestBody: fileMetadata,
          fields: "id, name, webViewLink",
        });

        // Invalidate cache
        await cacheManager.invalidate('resources:*');
        await cacheManager.invalidate('search:*');

        performanceMonitor.track('createFolder', Date.now() - startTime);
        logger.info('Folder created', { folderId: response.data.id, name });

        return {
          content: [{
            type: "text",
            text: `Folder created successfully!\nID: ${response.data.id}\nName: ${response.data.name}\nLink: ${response.data.webViewLink}`,
          }],
        };
      }

      case "listSheets": {
        if (!args || typeof args.spreadsheetId !== 'string') {
          throw new Error('spreadsheetId parameter is required');
        }
        const { spreadsheetId } = args;

        const response = await sheets.spreadsheets.get({
          spreadsheetId,
        });

        const sheetList = response.data.sheets?.map((sheet) => ({
          sheetId: sheet.properties?.sheetId,
          title: sheet.properties?.title,
          index: sheet.properties?.index,
          rowCount: sheet.properties?.gridProperties?.rowCount,
          columnCount: sheet.properties?.gridProperties?.columnCount,
        })) ?? [];

        performanceMonitor.track('listSheets', Date.now() - startTime);

        return {
          content: [{
            type: "text",
            text: JSON.stringify(sheetList, null, 2),
          }],
        };
      }

      case "readSheet": {
        if (!args || typeof args.spreadsheetId !== 'string') {
          throw new Error('spreadsheetId parameter is required');
        }
        const { spreadsheetId } = args;
        const range = (typeof args.range === 'string' ? args.range : "Sheet1");

        const cacheKey = `sheet:${spreadsheetId}:${range}`;
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          performanceMonitor.track('readSheet', Date.now() - startTime);
          return cached;
        }

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const result = {
          content: [{
            type: "text",
            text: JSON.stringify({
              range: response.data.range,
              values: response.data.values ?? [],
            }, null, 2),
          }],
        };

        await cacheManager.set(cacheKey, result);
        performanceMonitor.track('readSheet', Date.now() - startTime);

        return result;
      }

      case "updateCells": {
        if (!args || typeof args.spreadsheetId !== 'string' || typeof args.range !== 'string' || !Array.isArray(args.values)) {
          throw new Error('spreadsheetId, range, and values parameters are required');
        }
        const { spreadsheetId, range, values } = args;

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values,
          },
        });

        // Invalidate cache
        await cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

        performanceMonitor.track('updateCells', Date.now() - startTime);
        logger.info('Cells updated', { spreadsheetId, range });

        return {
          content: [{
            type: "text",
            text: `Successfully updated ${values.length} rows in range ${range}`,
          }],
        };
      }

      case "updateCellsWithFormula": {
        if (
          !args ||
          typeof args.spreadsheetId !== 'string' ||
          typeof args.range !== 'string' ||
          typeof args.formula !== 'string'
        ) {
          throw new Error('spreadsheetId, range, and formula parameters are required');
        }

        const spreadsheetId = args.spreadsheetId;
        const rawRange = args.range;
        const formula = args.formula;
        const providedSheetName =
          typeof args.sheetName === 'string' && args.sheetName.trim() ? args.sheetName.trim() : undefined;

        try {
          const { sheetName: rangeSheetName, a1Range } = parseRangeInput(rawRange);

          if (providedSheetName && rangeSheetName && providedSheetName !== rangeSheetName) {
            throw new Error('sheetName does not match the sheet specified in range');
          }

          const { sheetId, title } = await getSheetId(
            sheets,
            spreadsheetId,
            providedSheetName ?? rangeSheetName
          );

          const gridRange = parseA1Notation(a1Range, sheetId);
          const normalizedFormula = formula.trim();
          const rows = buildFormulaRows(gridRange, normalizedFormula);

          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  updateCells: {
                    range: gridRange,
                    fields: "userEnteredValue",
                    rows,
                  },
                },
              ],
            },
          });

          await cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

          performanceMonitor.track('updateCellsWithFormula', Date.now() - startTime);
          logger.info('Formula updated', {
            spreadsheetId,
            sheetId,
            sheetTitle: title,
            range: `${title}!${a1Range}`,
            formula: normalizedFormula,
          });

          return {
            content: [
              {
                type: "text",
                text: `Successfully set formula ${normalizedFormula} in range ${title}!${a1Range}`,
              },
            ],
          };
        } catch (error) {
          const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
          const errorMessage = error instanceof Error ? error.message : String(error);

          logger.error('Formula update failed', {
            spreadsheetId,
            range: rawRange,
            formula: formula,
            error: errorMessage,
            errorType: errorType,
          });

          // Track failed operation
          performanceMonitor.track('updateCellsWithFormula', Date.now() - startTime, true);

          throw error;
        }
      }

      case "appendRows": {
        if (!args || typeof args.spreadsheetId !== 'string' || !Array.isArray(args.values)) {
          throw new Error('spreadsheetId and values parameters are required');
        }
        const { spreadsheetId, values } = args;
        const sheetName = (typeof args.sheetName === 'string' ? args.sheetName : "Sheet1");

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: sheetName,
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: {
            values,
          },
        });

        // Invalidate cache
        await cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

        performanceMonitor.track('appendRows', Date.now() - startTime);
        logger.info('Rows appended', { spreadsheetId, sheetName, rowCount: values.length });

        return {
          content: [{
            type: "text",
            text: `Successfully appended ${values.length} rows to ${sheetName}`,
          }],
        };
      }

      case "createSheet": {
        if (!args || typeof args.spreadsheetId !== 'string') {
          throw new Error('spreadsheetId parameter is required');
        }

        const { spreadsheetId } = args;

        // Build SheetProperties from arguments
        const sheetProperties: SheetProperties = {};

        if (typeof args.title === 'string') {
          sheetProperties.title = args.title;
        }

        if (typeof args.index === 'number') {
          sheetProperties.index = args.index;
        }

        if (typeof args.hidden === 'boolean') {
          sheetProperties.hidden = args.hidden;
        }

        if (typeof args.rightToLeft === 'boolean') {
          sheetProperties.rightToLeft = args.rightToLeft;
        }

        // Build GridProperties if any grid params are provided
        const hasGridProps = typeof args.rowCount === 'number' ||
                             typeof args.columnCount === 'number' ||
                             typeof args.frozenRowCount === 'number' ||
                             typeof args.frozenColumnCount === 'number';

        if (hasGridProps) {
          sheetProperties.gridProperties = {};

          if (typeof args.rowCount === 'number') {
            sheetProperties.gridProperties.rowCount = args.rowCount;
          }

          if (typeof args.columnCount === 'number') {
            sheetProperties.gridProperties.columnCount = args.columnCount;
          }

          if (typeof args.frozenRowCount === 'number') {
            sheetProperties.gridProperties.frozenRowCount = args.frozenRowCount;
          }

          if (typeof args.frozenColumnCount === 'number') {
            sheetProperties.gridProperties.frozenColumnCount = args.frozenColumnCount;
          }
        }

        // Handle tabColor if provided
        if (args.tabColor && typeof args.tabColor === 'object') {
          const color = args.tabColor as Color;
          const validatedColor: Color = {};
          (['red', 'green', 'blue', 'alpha'] as Array<keyof Color>).forEach((channel) => {
            const value = color[channel];
            if (value !== undefined) {
              if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
                throw new Error(`tabColor.${channel} must be a number between 0 and 1`);
              }
              validatedColor[channel] = value;
            }
          });

          if (Object.keys(validatedColor).length > 0) {
            sheetProperties.tabColor = validatedColor;
          }
        }

        // Execute batchUpdate to create the sheet
        let response;
        try {
          response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: sheetProperties,
                },
              }],
            },
          });
        } catch (error) {
          performanceMonitor.track('createSheet', Date.now() - startTime, true);
          const message = toErrorMessage(error);
          logger.error('Failed to create sheet with batchUpdate', { spreadsheetId, error });
          throw new Error(`Failed to create sheet in spreadsheet ${spreadsheetId}: ${message}`);
        }

        // Extract the new sheet ID from response
        const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
        const newSheetTitle = response.data.replies?.[0]?.addSheet?.properties?.title ?? sheetProperties.title ?? 'Untitled Sheet';

        // Invalidate cache for this spreadsheet
        await cacheManager.invalidate(`sheet:${spreadsheetId}:*`);

        performanceMonitor.track('createSheet', Date.now() - startTime);
        logger.info('Sheet created', { spreadsheetId, sheetId: newSheetId, title: newSheetTitle });

        return {
          content: [{
            type: "text",
            text: `Successfully created sheet "${newSheetTitle}" with ID ${newSheetId} in spreadsheet ${spreadsheetId}`,
          }],
        };
      }

      case "createForm": {
        if (!args || typeof args.title !== 'string') {
          throw new Error('title parameter is required');
        }
        const { title } = args;
        const description = args.description as string | undefined;

        const createResponse = await forms.forms.create({
          requestBody: {
            info: {
              title,
              documentTitle: title,
            },
          },
        });

        const formId = createResponse.data.formId;

        // If description is provided, update the form
        if (description && formId) {
          await forms.forms.batchUpdate({
            formId,
            requestBody: {
              requests: [{
                updateFormInfo: {
                  info: {
                    description,
                  },
                  updateMask: "description",
                },
              }],
            },
          });
        }

        performanceMonitor.track('createForm', Date.now() - startTime);
        logger.info('Form created', { formId, title });

        return {
          content: [{
            type: "text",
            text: `Form created successfully!\nForm ID: ${formId}\nTitle: ${title}\nEdit URL: https://docs.google.com/forms/d/${formId}/edit\nResponse URL: https://docs.google.com/forms/d/${formId}/viewform`,
          }],
        };
      }

      case "getForm": {
        if (!args || typeof args.formId !== 'string') {
          throw new Error('formId parameter is required');
        }
        const { formId } = args;

        const response = await forms.forms.get({
          formId,
        });

        const formData = {
          formId: response.data.formId,
          title: response.data.info?.title,
          description: response.data.info?.description,
          publishedUrl: response.data.responderUri,
          editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
          questions: response.data.items?.map((item, index) => ({
            itemId: item.itemId,
            index,
            title: item.title,
            description: item.description,
            type: item.questionItem?.question ? Object.keys(item.questionItem.question)[0] : 'unknown',
            required: Boolean(item.questionItem && 'required' in item.questionItem && item.questionItem.required),
          })) ?? [],
        };

        performanceMonitor.track('getForm', Date.now() - startTime);

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formData, null, 2),
          }],
        };
      }

      case "addQuestion": {
        if (!args || typeof args.formId !== 'string' || typeof args.title !== 'string' || typeof args.type !== 'string') {
          throw new Error('formId, title, and type parameters are required');
        }
        const { formId, title, type } = args;
        const required = (typeof args.required === 'boolean' ? args.required : false);
        const options = args.options as string[] | undefined;
        const scaleMin = (typeof args.scaleMin === 'number' ? args.scaleMin : 1);
        const scaleMax = (typeof args.scaleMax === 'number' ? args.scaleMax : 5);
        const scaleMinLabel = args.scaleMinLabel as string | undefined;
        const scaleMaxLabel = args.scaleMaxLabel as string | undefined;

        // Build the question item structure for createItem API
        // The Google Forms API expects the required field to be part of the question structure
        const questionItem: QuestionItem = {
          question: {
            required,  // Move required field inside question structure
          },
        };

        // Build the question based on type
        switch (type) {
          case "TEXT":
            questionItem.question.textQuestion = {
              paragraph: false,
            };
            break;

          case "PARAGRAPH_TEXT":
            questionItem.question.textQuestion = {
              paragraph: true,
            };
            break;

          case "MULTIPLE_CHOICE":
            if (!options || options.length === 0) {
              throw new Error("Options required for multiple choice questions");
            }
            questionItem.question.choiceQuestion = {
              type: "RADIO",
              options: options.map((option: string) => ({ value: option })),
            };
            break;

          case "CHECKBOX":
            if (!options || options.length === 0) {
              throw new Error("Options required for checkbox questions");
            }
            questionItem.question.choiceQuestion = {
              type: "CHECKBOX",
              options: options.map((option: string) => ({ value: option })),
            };
            break;

          case "DROPDOWN":
            if (!options || options.length === 0) {
              throw new Error("Options required for dropdown questions");
            }
            questionItem.question.choiceQuestion = {
              type: "DROP_DOWN",
              options: options.map((option: string) => ({ value: option })),
            };
            break;

          case "LINEAR_SCALE":
            questionItem.question.scaleQuestion = {
              low: scaleMin,
              high: scaleMax,
              ...(scaleMinLabel ? { lowLabel: scaleMinLabel } : {}),
              ...(scaleMaxLabel ? { highLabel: scaleMaxLabel } : {}),
            };
            break;

          case "DATE":
            questionItem.question.dateQuestion = {
              includeTime: false,
              includeYear: true,
            };
            break;

          case "TIME":
            questionItem.question.timeQuestion = {
              duration: false,
            };
            break;

          default:
            throw new Error(`Unsupported question type: ${type}`);
        }

        await forms.forms.batchUpdate({
          formId,
          requestBody: {
            requests: [{
              createItem: {
                item: {
                  title,
                  questionItem,
                },
                location: {
                  index: 0,
                },
              },
            }],
          },
        });

        performanceMonitor.track('addQuestion', Date.now() - startTime);
        logger.info('Question added to form', { formId, type, title });

        return {
          content: [{
            type: "text",
            text: `Question added successfully to form ${formId}`,
          }],
        };
      }

      case "listResponses": {
        if (!args || typeof args.formId !== 'string') {
          throw new Error('formId parameter is required');
        }
        const { formId } = args;

        const response = await forms.forms.responses.list({
          formId,
        });

        const responses = response.data.responses?.map((resp) => ({
          responseId: resp.responseId,
          createTime: resp.createTime,
          lastSubmittedTime: resp.lastSubmittedTime,
          respondentEmail: resp.respondentEmail,
          answers: resp.answers ? Object.entries(resp.answers).map(([questionId, answer]) => ({
            questionId,
            answer: answer.textAnswers?.answers?.[0]?.value ??
              (answer as { choiceAnswers?: { answers?: Array<{ value: string }> } }).choiceAnswers?.answers?.map((a: { value: string }) => a.value).join(", ") ??
              "No answer",
          })) : [],
        })) ?? [];

        performanceMonitor.track('listResponses', Date.now() - startTime);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              formId,
              totalResponses: responses.length,
              responses,
            }, null, 2),
          }],
        };
      }

      case "createDocument": {
        if (!args || typeof args.title !== 'string') {
          throw new Error('title parameter is required');
        }
        const { title } = args;
        const content = args.content as string | undefined;
        const parentId = args.parentId as string | undefined;

        // Create the document
        const createResponse = await docs.documents.create({
          requestBody: {
            title,
          },
        });

        const documentId = createResponse.data.documentId;

        // If content is provided, insert it
        if (content && documentId) {
          await docs.documents.batchUpdate({
            documentId,
            requestBody: {
              requests: [{
                insertText: {
                  location: { index: 1 },
                  text: content,
                },
              }],
            },
          });
        }

        // If parentId is provided, move the document
        if (parentId && documentId) {
          await drive.files.update({
            fileId: documentId,
            addParents: parentId,
          });
        }

        performanceMonitor.track('createDocument', Date.now() - startTime);
        logger.info('Document created', { documentId, title });

        return {
          content: [{
            type: "text",
            text: `Document created successfully!\nDocument ID: ${documentId}\nTitle: ${title}\nURL: https://docs.google.com/document/d/${documentId}/edit`,
          }],
        };
      }

      case "insertText": {
        if (!args || typeof args.documentId !== 'string' || typeof args.text !== 'string') {
          throw new Error('documentId and text parameters are required');
        }
        const { documentId, text } = args;
        const index = (typeof args.index === 'number' ? args.index : 1);

        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index },
                text,
              },
            }],
          },
        });

        performanceMonitor.track('insertText', Date.now() - startTime);
        logger.info('Text inserted', { documentId, textLength: text.length });

        return {
          content: [{
            type: "text",
            text: `Text inserted successfully at index ${index}`,
          }],
        };
      }

      case "replaceText": {
        if (!args || typeof args.documentId !== 'string' || typeof args.searchText !== 'string' || typeof args.replaceText !== 'string') {
          throw new Error('documentId, searchText, and replaceText parameters are required');
        }
        const { documentId, searchText, replaceText } = args;
        const matchCase = (typeof args.matchCase === 'boolean' ? args.matchCase : false);

        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              replaceAllText: {
                containsText: {
                  text: searchText,
                  matchCase,
                },
                replaceText,
              },
            }],
          },
        });

        performanceMonitor.track('replaceText', Date.now() - startTime);
        logger.info('Text replaced', { documentId, searchText, replaceText });

        return {
          content: [{
            type: "text",
            text: `All occurrences of "${searchText}" replaced with "${replaceText}"`,
          }],
        };
      }

      case "applyTextStyle": {
        if (!args || typeof args.documentId !== 'string' || typeof args.startIndex !== 'number' || typeof args.endIndex !== 'number') {
          throw new Error('documentId, startIndex, and endIndex parameters are required');
        }
        const { documentId, startIndex, endIndex } = args;
        const bold = args.bold as boolean | undefined;
        const italic = args.italic as boolean | undefined;
        const underline = args.underline as boolean | undefined;
        const fontSize = args.fontSize as number | undefined;
        const foregroundColor = args.foregroundColor as { red: number; green: number; blue: number } | undefined;

        const textStyle: Partial<TextStyle> = {};

        if (bold !== undefined) {
          textStyle.bold = bold;
        }
        if (italic !== undefined) {
          textStyle.italic = italic;
        }
        if (underline !== undefined) {
          textStyle.underline = underline;
        }
        if (fontSize !== undefined) {
          textStyle.fontSize = {
            magnitude: fontSize,
            unit: "PT",
          };
        }
        if (foregroundColor) {
          textStyle.foregroundColor = {
            color: {
              rgbColor: foregroundColor,
            },
          };
        }

        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              updateTextStyle: {
                range: {
                  startIndex,
                  endIndex,
                },
                textStyle,
                fields: Object.keys(textStyle).join(","),
              },
            }],
          },
        });

        performanceMonitor.track('applyTextStyle', Date.now() - startTime);
        logger.info('Text style applied', { documentId, startIndex, endIndex });

        return {
          content: [{
            type: "text",
            text: `Text style applied successfully from index ${startIndex} to ${endIndex}`,
          }],
        };
      }

      case "insertTable": {
        if (!args || typeof args.documentId !== 'string' || typeof args.rows !== 'number' || typeof args.columns !== 'number') {
          throw new Error('documentId, rows, and columns parameters are required');
        }
        const { documentId, rows, columns } = args;
        const index = (typeof args.index === 'number' ? args.index : 1);

        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [{
              insertTable: {
                location: { index },
                rows,
                columns,
              },
            }],
          },
        });

        performanceMonitor.track('insertTable', Date.now() - startTime);
        logger.info('Table inserted', { documentId, rows, columns });

        return {
          content: [{
            type: "text",
            text: `Table with ${rows} rows and ${columns} columns inserted at index ${index}`,
          }],
        };
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

      case "batchFileOperations": {
        if (!args || !Array.isArray(args.operations)) {
          throw new Error('operations parameter must be an array');
        }
        const { operations } = args;
        const results = [];
        const errors = [];

        for (const op of operations) {
          try {
            switch (op.type) {
              case "create": {
                const fileMetadata: FileMetadata = {
                  name: op.name,
                  mimeType: op.mimeType ?? "text/plain",
                };

                if (op.parentId) {
                  fileMetadata.parents = [op.parentId];
                }

                const response = await drive.files.create({
                  requestBody: fileMetadata,
                  media: {
                    mimeType: op.mimeType ?? "text/plain",
                    body: op.content,
                  },
                  fields: "id, name",
                });

                results.push({
                  type: "create",
                  success: true,
                  fileId: response.data.id,
                  name: response.data.name,
                });
                break;
              }

              case "update": {
                const updateParams: {
                  fileId: string;
                  requestBody?: { name?: string };
                  media?: { mimeType: string; body: string };
                } = {
                  fileId: op.fileId,
                  requestBody: op.name ? { name: op.name } : {},
                };

                if (op.content) {
                  updateParams.media = {
                    mimeType: "text/plain",
                    body: op.content,
                  };
                }

                await drive.files.update(updateParams);

                results.push({
                  type: "update",
                  success: true,
                  fileId: op.fileId,
                });
                break;
              }

              case "delete": {
                await drive.files.delete({
                  fileId: op.fileId,
                });

                results.push({
                  type: "delete",
                  success: true,
                  fileId: op.fileId,
                });
                break;
              }

              case "move": {
                // Get current parents
                const file = await drive.files.get({
                  fileId: op.fileId,
                  fields: "parents",
                });

                const previousParents = file.data.parents?.join(",") ?? "";

                await drive.files.update({
                  fileId: op.fileId,
                  addParents: op.parentId,
                  removeParents: previousParents,
                });

                results.push({
                  type: "move",
                  success: true,
                  fileId: op.fileId,
                  newParentId: op.parentId,
                });
                break;
              }

              default:
                errors.push({
                  operation: op,
                  error: `Unknown operation type: ${op.type}`,
                });
            }
          } catch (error: unknown) {
            errors.push({
              operation: op,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Invalidate cache
        await cacheManager.invalidate('resources:*');
        await cacheManager.invalidate('search:*');

        performanceMonitor.track('batchFileOperations', Date.now() - startTime);
        logger.info('Batch operations completed', {
          total: operations.length,
          successful: results.length,
          failed: errors.length
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              summary: {
                total: operations.length,
                successful: results.length,
                failed: errors.length,
              },
              results,
              errors,
            }, null, 2),
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