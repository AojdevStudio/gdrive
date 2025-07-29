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
import { createClient } from "redis";
import winston from "winston";
import { AuthManager, AuthState } from "./src/auth/AuthManager.js";
import { TokenManager } from "./src/auth/TokenManager.js";
import { performHealthCheck, HealthStatus } from "./src/health-check.js";

const drive = google.drive("v3");
const sheets = google.sheets("v4");
const forms = google.forms("v1");
const docs = google.docs("v1");

// Structured logging with Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
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
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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
    const current = this.metrics.get(operation) || { count: 0, totalTime: 0, errors: 0 };
    current.count++;
    current.totalTime += duration;
    if (error) current.errors++;
    this.metrics.set(operation, current);
  }

  recordCacheHit() { this.cacheHits++; }
  recordCacheMiss() { this.cacheMisses++; }

  getStats() {
    const stats: any = {
      uptime: Date.now() - this.startTime,
      operations: {},
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
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
  private client: any;
  private connected = false;
  private ttl = 300; // 5 minutes

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
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

      this.client.on('error', (err: any) => {
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

  async get(key: string): Promise<any> {
    if (!this.connected) return null;

    try {
      const data = await this.client.get(key);
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

  async set(key: string, value: any): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.setEx(key, this.ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error', { error, key });
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.connected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug(`Invalidated ${keys.length} cache entries`);
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
function parseNaturalLanguageQuery(query: string) {
  const lowerQuery = query.toLowerCase();
  const filters: any = {};

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
server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
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
      name: file.name || "Untitled",
      mimeType: file.mimeType,
      description: `Google Drive file: ${file.name}`,
    })) || [];

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
      text = `Error reading file: ${error}`;
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

        const cacheKey = `search:${q}:${args.pageSize || 10}`;
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          performanceMonitor.track('search', Date.now() - startTime);
          return cached;
        }

        const response = await drive.files.list({
          q: q || undefined,
          pageSize: Math.min(args.pageSize || 10, 100),
          fields: "files(id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink, iconLink, owners, permissions)",
          orderBy: "modifiedTime desc",
        });

        const result = {
          content: [{
            type: "text",
            text: JSON.stringify(response.data.files || [], null, 2),
          }],
        };

        await cacheManager.set(cacheKey, result);
        performanceMonitor.track('search', Date.now() - startTime);
        
        return result;
      }

      case "enhancedSearch": {
        const { query, filters = {}, pageSize = 10, orderBy = "modifiedTime desc" } = args;
        
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
          q: q || undefined,
          pageSize: Math.min(pageSize, 100),
          fields: "files(id, name, mimeType, createdTime, modifiedTime, size, parents, webViewLink, iconLink, owners, permissions, description, starred)",
          orderBy,
        });

        const result = {
          content: [{
            type: "text",
            text: JSON.stringify({
              query: q,
              totalResults: response.data.files?.length || 0,
              files: response.data.files || [],
            }, null, 2),
          }],
        };

        await cacheManager.set(cacheKey, result);
        performanceMonitor.track('enhancedSearch', Date.now() - startTime);
        
        return result;
      }

      case "read": {
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
        const { name, content, mimeType = "text/plain", parentId } = args;
        
        const fileMetadata: any = {
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
        const { name, parentId } = args;
        
        const fileMetadata: any = {
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
        })) || [];

        performanceMonitor.track('listSheets', Date.now() - startTime);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(sheetList, null, 2),
          }],
        };
      }

      case "readSheet": {
        const { spreadsheetId, range = "Sheet1" } = args;
        
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
              values: response.data.values || [],
            }, null, 2),
          }],
        };

        await cacheManager.set(cacheKey, result);
        performanceMonitor.track('readSheet', Date.now() - startTime);
        
        return result;
      }

      case "updateCells": {
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

      case "appendRows": {
        const { spreadsheetId, sheetName = "Sheet1", values } = args;
        
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

      case "createForm": {
        const { title, description } = args;
        
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
            required: item.questionItem?.required || false,
          })) || [],
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
        const { 
          formId, 
          title, 
          type, 
          required = false, 
          options,
          scaleMin = 1,
          scaleMax = 5,
          scaleMinLabel,
          scaleMaxLabel,
        } = args;
        
        let questionItem: any = {
          required,
          question: {},
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
              lowLabel: scaleMinLabel,
              highLabel: scaleMaxLabel,
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

        const response = await forms.forms.batchUpdate({
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
            answer: answer.textAnswers?.answers?.[0]?.value || 
                   answer.choiceAnswers?.answers?.map((a: any) => a.value).join(", ") ||
                   "No answer",
          })) : [],
        })) || [];

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
        const { title, content, parentId } = args;
        
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
        const { documentId, text, index = 1 } = args;
        
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
        const { documentId, searchText, replaceText, matchCase = false } = args;
        
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
        const { 
          documentId, 
          startIndex, 
          endIndex, 
          bold, 
          italic, 
          underline, 
          fontSize,
          foregroundColor,
        } = args;
        
        const textStyle: any = {};
        
        if (bold !== undefined) textStyle.bold = bold;
        if (italic !== undefined) textStyle.italic = italic;
        if (underline !== undefined) textStyle.underline = underline;
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
        const { documentId, rows, columns, index = 1 } = args;
        
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

      case "batchFileOperations": {
        const { operations } = args;
        const results = [];
        const errors = [];

        for (const op of operations) {
          try {
            switch (op.type) {
              case "create": {
                const fileMetadata: any = {
                  name: op.name,
                  mimeType: op.mimeType || "text/plain",
                };
                
                if (op.parentId) {
                  fileMetadata.parents = [op.parentId];
                }

                const response = await drive.files.create({
                  requestBody: fileMetadata,
                  media: {
                    mimeType: op.mimeType || "text/plain",
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
                await drive.files.update({
                  fileId: op.fileId,
                  requestBody: op.name ? { name: op.name } : undefined,
                  media: op.content ? {
                    mimeType: "text/plain",
                    body: op.content,
                  } : undefined,
                });

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

                const previousParents = file.data.parents?.join(",") || "";

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
          } catch (error: any) {
            errors.push({
              operation: op,
              error: error.message,
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
const oauthPath = process.env.GDRIVE_OAUTH_PATH || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../credentials/gcp-oauth.keys.json",
);

// Credentials path handling
const credentialsPath = process.env.GDRIVE_CREDENTIALS_PATH || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../credentials/.gdrive-server-credentials.json",
);

async function authenticateAndSaveCredentials() {
  logger.info("Launching auth flow…");
  
  // Ensure encryption key is set for token storage
  if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
    console.error("GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required for secure token storage.");
    console.error("Generate a key with: openssl rand -base64 32");
    process.exit(1);
  }
  
  const auth = await authenticate({
    keyfilePath: oauthPath,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/forms"
    ],
  });
  
  // Initialize token manager and save credentials
  tokenManager = TokenManager.getInstance(logger);
  
  const tokenData = {
    access_token: auth.credentials.access_token!,
    refresh_token: auth.credentials.refresh_token!,
    expiry_date: auth.credentials.expiry_date!,
    token_type: auth.credentials.token_type!,
    scope: auth.credentials.scope!,
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
      console.error("GDRIVE_TOKEN_ENCRYPTION_KEY environment variable is required.");
      console.error("Generate a key with: openssl rand -base64 32");
      process.exit(1);
    }
    
    // Load OAuth keys
    if (!fs.existsSync(oauthPath)) {
      console.error(`OAuth keys not found at: ${oauthPath}`);
      console.error("Please ensure gcp-oauth.keys.json is present.");
      process.exit(1);
    }
    
    const keysContent = fs.readFileSync(oauthPath, "utf-8");
    const keys = JSON.parse(keysContent);
    const oauthKeys = keys.web || keys.installed;
    
    if (!oauthKeys) {
      console.error("Invalid OAuth keys format. Expected 'web' or 'installed' configuration.");
      process.exit(1);
    }
    
    // Initialize managers
    tokenManager = TokenManager.getInstance(logger);
    authManager = AuthManager.getInstance(oauthKeys, logger);
    
    // Initialize authentication
    await authManager.initialize();
    
    // Check authentication state
    if (authManager.getState() === AuthState.UNAUTHENTICATED) {
      console.error("Authentication required. Please run with 'auth' argument first.");
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
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Add health check endpoint handler
if (process.argv[2] === "health") {
  performHealthCheck()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === HealthStatus.HEALTHY ? 0 : 1);
    })
    .catch((error) => {
      console.error("Health check failed:", error);
      process.exit(2);
    });
} else if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}