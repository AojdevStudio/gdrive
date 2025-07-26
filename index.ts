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
      ),
      stderrLevels: ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
    })
  ]
});

// Performance monitoring
class PerformanceMonitor {
  private static operationTimes: Map<string, number[]> = new Map();
  
  static startTimer(operation: string): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      
      if (!this.operationTimes.has(operation)) {
        this.operationTimes.set(operation, []);
      }
      
      const times = this.operationTimes.get(operation)!;
      times.push(duration);
      
      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift();
      }
      
      logger.info('Operation completed', {
        operation,
        duration,
        unit: 'ms'
      });
      
      // Log slow operations
      if (duration > 5000) {
        logger.warn('Slow operation detected', {
          operation,
          duration,
          threshold: 5000,
          unit: 'ms'
        });
      }
    };
  }
  
  static getStats(operation: string) {
    const times = this.operationTimes.get(operation) || [];
    if (times.length === 0) return null;
    
    const sorted = times.slice().sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return {
      count: times.length,
      avg: Math.round(avg),
      min: Math.min(...times),
      max: Math.max(...times),
      p50,
      p95,
      p99
    };
  }
  
  static logStats() {
    for (const [operation, times] of this.operationTimes.entries()) {
      const stats = this.getStats(operation);
      if (stats && stats.count > 0) {
        logger.info('Performance statistics', {
          operation,
          ...stats,
          unit: 'ms'
        });
      }
    }
  }
}

// Log performance stats every 5 minutes
setInterval(() => {
  PerformanceMonitor.logStats();
}, 5 * 60 * 1000);

// Redis Cache Manager
class CacheManager {
  private client: any;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = createClient({ url: redisUrl });
    
    this.client.on('error', (err: any) => {
      logger.warn('Redis Client Error', { error: err.message });
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.info('Disconnected from Redis');
      this.isConnected = false;
    });
  }

  async connect() {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
    } catch (error) {
      logger.warn('Failed to connect to Redis', { error });
      this.isConnected = false;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.isConnected) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.warn('Redis GET error', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn('Redis SET error', { key, ttl, error });
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.warn('Redis INVALIDATE error', { pattern, error });
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}

// Initialize cache manager
const cacheManager = new CacheManager();

const server = new Server(
  {
    name: "example-servers/gdrive",
    version: "0.6.2",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const pageSize = 10;
  const params: any = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType)",
  };

  if (request.params?.cursor) {
    params.pageToken = request.params.cursor;
  }

  const res = await drive.files.list(params);
  const files = res.data.files!;

  return {
    resources: files.map((file) => ({
      uri: `gdrive:///${file.id}`,
      mimeType: file.mimeType,
      name: file.name,
    })),
    nextCursor: res.data.nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const fileId = request.params.uri.replace("gdrive:///", "");

  // First get file metadata to check mime type
  const file = await drive.files.get({
    fileId,
    fields: "mimeType",
  });

  // For Google Docs/Sheets/etc we need to export
  if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
    let exportMimeType: string;
    switch (file.data.mimeType) {
      case "application/vnd.google-apps.document":
        exportMimeType = "text/markdown";
        break;
      case "application/vnd.google-apps.spreadsheet":
        exportMimeType = "text/csv";
        break;
      case "application/vnd.google-apps.presentation":
        exportMimeType = "text/plain";
        break;
      case "application/vnd.google-apps.drawing":
        exportMimeType = "image/png";
        break;
      default:
        exportMimeType = "text/plain";
    }

    const res = await drive.files.export(
      { fileId, mimeType: exportMimeType },
      { responseType: "text" },
    );

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: exportMimeType,
          text: res.data,
        },
      ],
    };
  }

  // For regular files download content
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  const mimeType = file.data.mimeType || "application/octet-stream";
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: mimeType,
          text: Buffer.from(res.data as ArrayBuffer).toString("utf-8"),
        },
      ],
    };
  } else {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: mimeType,
          blob: Buffer.from(res.data as ArrayBuffer).toString("base64"),
        },
      ],
    };
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search for files in Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "read",
        description: "Read contents of a file from Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            fileId: {
              type: "string",
              description: "The Google Drive file ID to read",
            },
          },
          required: ["fileId"],
        },
      },
      {
        name: "listSheets",
        description: "List all sheets within a Google Spreadsheet",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Spreadsheet",
            },
          },
          required: ["spreadsheetId"],
        },
      },
      {
        name: "readSheet",
        description: "Read contents of a specific sheet from Google Spreadsheet",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Spreadsheet",
            },
            sheetName: {
              type: "string",
              description: "The name of the sheet to read",
            },
            range: {
              type: "string",
              description: "Optional A1 notation range (e.g. 'A1:D10')",
            },
          },
          required: ["spreadsheetId", "sheetName"],
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
              description: "Name of the file to create",
            },
            mimeType: {
              type: "string",
              description: "MIME type of the file (e.g., 'text/plain', 'application/json')",
            },
            content: {
              type: "string",
              description: "Content of the file",
            },
            parentFolderId: {
              type: "string",
              description: "Optional parent folder ID",
            },
          },
          required: ["name", "mimeType", "content"],
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
              description: "ID of the file to update",
            },
            content: {
              type: "string",
              description: "New content for the file",
            },
            mimeType: {
              type: "string",
              description: "MIME type of the content",
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
              description: "Name of the folder to create",
            },
            parentFolderId: {
              type: "string",
              description: "Optional parent folder ID",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "updateCells",
        description: "Update cells in a Google Sheets spreadsheet",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Spreadsheet",
            },
            range: {
              type: "string",
              description: "A1 notation range to update (e.g., 'Sheet1!A1:B2')",
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
            valueInputOption: {
              type: "string",
              description: "How to interpret the input values (RAW or USER_ENTERED)",
              enum: ["RAW", "USER_ENTERED"],
              default: "USER_ENTERED",
            },
          },
          required: ["spreadsheetId", "range", "values"],
        },
      },
      {
        name: "appendRows",
        description: "Append rows to a Google Sheets spreadsheet",
        inputSchema: {
          type: "object",
          properties: {
            spreadsheetId: {
              type: "string",
              description: "The ID of the Google Spreadsheet",
            },
            range: {
              type: "string",
              description: "A1 notation range or sheet name to append to",
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
            valueInputOption: {
              type: "string",
              description: "How to interpret the input values",
              enum: ["RAW", "USER_ENTERED"],
              default: "USER_ENTERED",
            },
          },
          required: ["spreadsheetId", "range", "values"],
        },
      },
      {
        name: "createForm",
        description: "Create a new Google Form",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the form",
            },
            description: {
              type: "string",
              description: "Description of the form (optional)",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "getForm",
        description: "Get form structure and metadata",
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
        description: "Add a question to a Google Form",
        inputSchema: {
          type: "object",
          properties: {
            formId: {
              type: "string",
              description: "The ID of the Google Form",
            },
            questionType: {
              type: "string",
              description: "Type of question",
              enum: ["TEXT", "PARAGRAPH_TEXT", "MULTIPLE_CHOICE", "CHECKBOX", "DROPDOWN", "LINEAR_SCALE", "DATE", "TIME", "FILE_UPLOAD"],
            },
            title: {
              type: "string",
              description: "Question title/text",
            },
            options: {
              type: "array",
              description: "Options for multiple choice, checkbox, or dropdown questions",
              items: {
                type: "string",
              },
            },
            required: {
              type: "boolean",
              description: "Whether the question is required",
              default: false,
            },
          },
          required: ["formId", "questionType", "title"],
        },
      },
      {
        name: "listResponses",
        description: "List responses for a Google Form",
        inputSchema: {
          type: "object",
          properties: {
            formId: {
              type: "string",
              description: "The ID of the Google Form",
            },
            pageSize: {
              type: "number",
              description: "Maximum number of responses to return (1-5000)",
              minimum: 1,
              maximum: 5000,
              default: 100,
            },
          },
          required: ["formId"],
        },
      },
      {
        name: "enhancedSearch",
        description: "Enhanced search with natural language parsing",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language search query",
            },
            maxResults: {
              type: "number",
              description: "Maximum number of results to return",
              default: 10,
              minimum: 1,
              maximum: 100,
            },
            filters: {
              type: "object",
              description: "Additional filters",
              properties: {
                mimeType: {
                  type: "string",
                  description: "Filter by MIME type",
                },
                modifiedAfter: {
                  type: "string",
                  description: "Filter by modification date (ISO 8601)",
                },
                owner: {
                  type: "string",
                  description: "Filter by owner email",
                },
              },
            },
          },
          required: ["query"],
        },
      },
      {
        name: "createDocument",
        description: "Create a new Google Document",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the document",
            },
            content: {
              type: "string",
              description: "Initial content for the document (optional)",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "insertText",
        description: "Insert text into a Google Document at a specific location",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The Google Document ID",
            },
            text: {
              type: "string",
              description: "Text to insert",
            },
            location: {
              type: "number",
              description: "Index where to insert text (default: end of document)",
              default: -1,
            },
          },
          required: ["documentId", "text"],
        },
      },
      {
        name: "replaceText",
        description: "Find and replace text in a Google Document",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The Google Document ID",
            },
            findText: {
              type: "string",
              description: "Text to find",
            },
            replaceText: {
              type: "string",
              description: "Text to replace with",
            },
            matchCase: {
              type: "boolean",
              description: "Whether to match case",
              default: false,
            },
          },
          required: ["documentId", "findText", "replaceText"],
        },
      },
      {
        name: "applyTextStyle",
        description: "Apply formatting to text in a Google Document",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The Google Document ID",
            },
            startIndex: {
              type: "number",
              description: "Start index of text to format",
            },
            endIndex: {
              type: "number",
              description: "End index of text to format",
            },
            style: {
              type: "object",
              description: "Text formatting style",
              properties: {
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
                  type: "string",
                  description: "Text color in hex format (e.g., #FF0000)",
                },
              },
            },
          },
          required: ["documentId", "startIndex", "endIndex", "style"],
        },
      },
      {
        name: "insertTable",
        description: "Insert a table into a Google Document",
        inputSchema: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description: "The Google Document ID",
            },
            rows: {
              type: "number",
              description: "Number of rows",
              minimum: 1,
              maximum: 20,
            },
            columns: {
              type: "number",
              description: "Number of columns",
              minimum: 1,
              maximum: 20,
            },
            location: {
              type: "number",
              description: "Index where to insert table (default: end of document)",
              default: -1,
            },
          },
          required: ["documentId", "rows", "columns"],
        },
      },
      {
        name: "batchFileOperations",
        description: "Perform multiple file operations in a single batch request",
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
                    enum: ["create", "update", "delete", "move", "copy"],
                    description: "Type of operation",
                  },
                  fileId: {
                    type: "string",
                    description: "File ID (for update, delete, move, copy operations)",
                  },
                  name: {
                    type: "string",
                    description: "File name (for create, move operations)",
                  },
                  content: {
                    type: "string",
                    description: "File content (for create, update operations)",
                  },
                  mimeType: {
                    type: "string",
                    description: "MIME type (for create operations)",
                  },
                  parentFolderId: {
                    type: "string",
                    description: "Parent folder ID (for create, move operations)",
                  },
                },
                required: ["type"],
              },
              maxItems: 10,
            },
          },
          required: ["operations"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search") {
    const endTimer = PerformanceMonitor.startTimer('search');
    const userQuery = request.params.arguments?.query as string;
    const cacheKey = `search:${userQuery}`;
    
    logger.info('Search operation started', { query: userQuery });
    
    // Try to get from cache first
    const cachedResult = await cacheManager.get(cacheKey);
    if (cachedResult) {
      logger.info('Search cache hit', { query: userQuery });
      endTimer();
      return cachedResult;
    }
    
    const escapedQuery = userQuery.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const formattedQuery = `fullText contains '${escapedQuery}'`;

    const res = await drive.files.list({
      q: formattedQuery,
      pageSize: 10,
      fields: "files(id, name, mimeType, modifiedTime, size)",
    });

    const fileList = res.data.files
      ?.map((file: any) => `${file.name} (${file.mimeType}) - ID: ${file.id}`)
      .join("\n");
    
    const result = {
      content: [
        {
          type: "text",
          text: `Found ${res.data.files?.length ?? 0} files:\n${fileList}`,
        },
      ],
      isError: false,
    };
    
    // Cache the search result for 5 minutes
    await cacheManager.set(cacheKey, result, 300);
    
    logger.info('Search operation completed', { 
      query: userQuery, 
      resultCount: res.data.files?.length ?? 0 
    });
    endTimer();
    
    return result;
  } else if (request.params.name === "read") {
    const endTimer = PerformanceMonitor.startTimer('read');
    const fileId = request.params.arguments?.fileId as string;
    const cacheKey = `file:${fileId}`;
    
    logger.info('File read operation started', { fileId });
    
    // Try to get from cache first
    const cachedResult = await cacheManager.get(cacheKey);
    if (cachedResult) {
      logger.info('File read cache hit', { fileId });
      endTimer();
      return cachedResult;
    }
    
    // First get file metadata to check mime type
    const file = await drive.files.get({
      fileId,
      fields: "mimeType,name",
    });

    // For Google Docs/Sheets/etc we need to export
    if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
      let exportMimeType: string;
      switch (file.data.mimeType) {
        case "application/vnd.google-apps.document":
          exportMimeType = "text/markdown";
          break;
        case "application/vnd.google-apps.spreadsheet":
          exportMimeType = "text/csv";
          break;
        case "application/vnd.google-apps.presentation":
          exportMimeType = "text/plain";
          break;
        case "application/vnd.google-apps.drawing":
          exportMimeType = "image/png";
          break;
        default:
          exportMimeType = "text/plain";
      }

      const res = await drive.files.export(
        { fileId, mimeType: exportMimeType },
        { responseType: "text" },
      );

      return {
        content: [
          {
            type: "text",
            text: `Contents of ${file.data.name}:\n\n${res.data}`,
          },
        ],
        isError: false,
      };
    }

    // For regular files download content
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    const mimeType = file.data.mimeType || "application/octet-stream";
    
    const result = mimeType.startsWith("text/") || mimeType === "application/json" 
      ? {
          content: [
            {
              type: "text",
              text: `Contents of ${file.data.name}:\n\n${Buffer.from(res.data as ArrayBuffer).toString("utf-8")}`,
            },
          ],
          isError: false,
        }
      : {
          content: [
            {
              type: "text",
              text: `Unable to display contents of ${file.data.name} - binary file of type ${mimeType}`,
            },
          ],
          isError: false,
        };
    
    // Cache file content for 10 minutes
    await cacheManager.set(cacheKey, result, 600);
    
    logger.info('File read operation completed', { 
      fileId, 
      fileName: file.data.name,
      mimeType: file.data.mimeType 
    });
    endTimer();
    
    return result;
  } else if (request.params.name === "listSheets") {
    const spreadsheetId = request.params.arguments?.spreadsheetId as string;
    
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties',
      });

      const sheetsList = response.data.sheets?.map(sheet => ({
        name: sheet.properties?.title,
        id: sheet.properties?.sheetId,
      }));

      return {
        content: [{
          type: "text",
          text: `Available sheets:\n${sheetsList?.map(sheet => 
            `- ${sheet.name} (ID: ${sheet.id})`).join('\n')}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error listing sheets: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "readSheet") {
    const { spreadsheetId, sheetName, range } = request.params.arguments as {
      spreadsheetId: string;
      sheetName: string;
      range?: string;
    };

    try {
      const rangeNotation = range ? `${sheetName}!${range}` : sheetName;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rangeNotation,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });

      const values = response.data.values || [];
      
      // Format as a table with aligned columns
      const formattedTable = values.map(row => 
        row.map(cell => String(cell).padEnd(20)).join(' | ')
      ).join('\n');

      return {
        content: [{
          type: "text",
          text: `Contents of sheet "${sheetName}":\n\n${formattedTable}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error reading sheet: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "createFile") {
    const { name, mimeType, content, parentFolderId } = request.params.arguments as {
      name: string;
      mimeType: string;
      content: string;
      parentFolderId?: string;
    };

    try {
      const fileMetadata: any = {
        name,
        mimeType,
      };
      
      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      const media = {
        mimeType,
        body: content,
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType',
      });

      // Invalidate search cache since new file was created
      await cacheManager.invalidate('search:*');

      return {
        content: [{
          type: "text",
          text: `File created successfully:\n- Name: ${response.data.name}\n- ID: ${response.data.id}\n- Type: ${response.data.mimeType}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error creating file: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "updateFile") {
    const { fileId, content, mimeType } = request.params.arguments as {
      fileId: string;
      content: string;
      mimeType?: string;
    };

    try {
      // Get current file info if mimeType not provided
      let fileMimeType = mimeType;
      if (!fileMimeType) {
        const fileInfo = await drive.files.get({
          fileId,
          fields: 'mimeType',
        });
        fileMimeType = fileInfo.data.mimeType || 'text/plain';
      }

      const media = {
        mimeType: fileMimeType,
        body: content,
      };

      const response = await drive.files.update({
        fileId,
        media: media,
        fields: 'id, name, modifiedTime',
      });

      // Invalidate caches for the updated file
      await cacheManager.invalidate(`file:${fileId}`);
      await cacheManager.invalidate('search:*');

      return {
        content: [{
          type: "text",
          text: `File updated successfully:\n- Name: ${response.data.name}\n- ID: ${response.data.id}\n- Modified: ${response.data.modifiedTime}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error updating file: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "createFolder") {
    const { name, parentFolderId } = request.params.arguments as {
      name: string;
      parentFolderId?: string;
    };

    try {
      const fileMetadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
      };
      
      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });

      return {
        content: [{
          type: "text",
          text: `Folder created successfully:\n- Name: ${response.data.name}\n- ID: ${response.data.id}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error creating folder: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "updateCells") {
    const { spreadsheetId, range, values, valueInputOption = "USER_ENTERED" } = request.params.arguments as {
      spreadsheetId: string;
      range: string;
      values: any[][];
      valueInputOption?: string;
    };

    try {
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: valueInputOption as any,
        requestBody: {
          values,
        },
      });

      return {
        content: [{
          type: "text",
          text: `Updated ${response.data.updatedCells} cells in range ${response.data.updatedRange}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error updating cells: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "appendRows") {
    const { spreadsheetId, range, values, valueInputOption = "USER_ENTERED" } = request.params.arguments as {
      spreadsheetId: string;
      range: string;
      values: any[][];
      valueInputOption?: string;
    };

    try {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: valueInputOption as any,
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values,
        },
      });

      return {
        content: [{
          type: "text",
          text: `Appended ${response.data.updates?.updatedRows} rows to ${response.data.updates?.updatedRange}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error appending rows: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "createForm") {
    const { title, description } = request.params.arguments as {
      title: string;
      description?: string;
    };

    try {
      const formRequest = {
        info: {
          title,
          ...(description && { description }),
        },
      };

      const response = await forms.forms.create({
        requestBody: formRequest,
      });

      return {
        content: [{
          type: "text",
          text: `Form created successfully:\n- Title: ${response.data.info?.title}\n- Form ID: ${response.data.formId}\n- Edit URL: ${response.data.responderUri?.replace('/viewform', '/edit')}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error creating form: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "getForm") {
    const { formId } = request.params.arguments as {
      formId: string;
    };

    try {
      const response = await forms.forms.get({
        formId,
      });

      const form = response.data;
      const questionCount = form.items?.length || 0;
      
      return {
        content: [{
          type: "text",
          text: `Form Details:\n- Title: ${form.info?.title}\n- Description: ${form.info?.description || 'No description'}\n- Questions: ${questionCount}\n- Form ID: ${form.formId}\n- Published: ${form.linkedSheetId ? 'Yes (linked to sheet)' : 'Not linked to sheet'}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error retrieving form: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "addQuestion") {
    const { formId, questionType, title, options, required = false } = request.params.arguments as {
      formId: string;
      questionType: string;
      title: string;
      options?: string[];
      required?: boolean;
    };

    try {
      const questionItem: any = {
        title,
        questionItem: {
          question: {
            required,
          },
        },
      };

      // Set question type based on the input
      switch (questionType) {
        case "TEXT":
          questionItem.questionItem.question.textQuestion = {};
          break;
        case "PARAGRAPH_TEXT":
          questionItem.questionItem.question.textQuestion = {
            paragraph: true,
          };
          break;
        case "MULTIPLE_CHOICE":
          if (!options || options.length === 0) {
            throw new Error("Multiple choice questions require options");
          }
          questionItem.questionItem.question.choiceQuestion = {
            type: "RADIO",
            options: options.map(option => ({ value: option })),
          };
          break;
        case "CHECKBOX":
          if (!options || options.length === 0) {
            throw new Error("Checkbox questions require options");
          }
          questionItem.questionItem.question.choiceQuestion = {
            type: "CHECKBOX",
            options: options.map(option => ({ value: option })),
          };
          break;
        case "DROPDOWN":
          if (!options || options.length === 0) {
            throw new Error("Dropdown questions require options");
          }
          questionItem.questionItem.question.choiceQuestion = {
            type: "DROP_DOWN",
            options: options.map(option => ({ value: option })),
          };
          break;
        case "LINEAR_SCALE":
          questionItem.questionItem.question.scaleQuestion = {
            low: 1,
            high: 5,
            lowLabel: "Low",
            highLabel: "High",
          };
          break;
        case "DATE":
          questionItem.questionItem.question.dateQuestion = {};
          break;
        case "TIME":
          questionItem.questionItem.question.timeQuestion = {};
          break;
        case "FILE_UPLOAD":
          questionItem.questionItem.question.fileUploadQuestion = {};
          break;
        default:
          throw new Error(`Unsupported question type: ${questionType}`);
      }

      const response = await forms.forms.batchUpdate({
        formId,
        requestBody: {
          requests: [{
            createItem: {
              item: questionItem,
              location: {
                index: 0,
              },
            },
          }],
        },
      });

      return {
        content: [{
          type: "text",
          text: `Question added successfully:\n- Type: ${questionType}\n- Title: ${title}\n- Required: ${required}\n${options ? `- Options: ${options.join(', ')}` : ''}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error adding question: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "listResponses") {
    const { formId, pageSize = 100 } = request.params.arguments as {
      formId: string;
      pageSize?: number;
    };

    try {
      const response = await forms.forms.responses.list({
        formId,
        pageSize,
      });

      const responses = response.data.responses || [];
      const responseCount = responses.length;

      if (responseCount === 0) {
        return {
          content: [{
            type: "text",
            text: `No responses found for form ${formId}`,
          }],
          isError: false,
        };
      }

      const responseInfo = responses.map((resp, index) => {
        const timestamp = resp.createTime ? new Date(resp.createTime).toLocaleString() : 'Unknown';
        const answersCount = Object.keys(resp.answers || {}).length;
        return `${index + 1}. Response ID: ${resp.responseId}\n   Submitted: ${timestamp}\n   Answers: ${answersCount}`;
      }).join('\n\n');

      return {
        content: [{
          type: "text",
          text: `Found ${responseCount} responses:\n\n${responseInfo}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error listing responses: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "enhancedSearch") {
    const { query, maxResults = 10, filters } = request.params.arguments as {
      query: string;
      maxResults?: number;
      filters?: {
        mimeType?: string;
        modifiedAfter?: string;
        owner?: string;
      };
    };

    try {
      // Natural language query mappings
      const queryMappings: { [key: string]: string } = {
        "spreadsheets": "mimeType='application/vnd.google-apps.spreadsheet'",
        "documents": "mimeType='application/vnd.google-apps.document'",
        "forms": "mimeType='application/vnd.google-apps.form'",
        "presentations": "mimeType='application/vnd.google-apps.presentation'",
        "folders": "mimeType='application/vnd.google-apps.folder'",
        "modified today": `modifiedTime > '${new Date(Date.now() - 24*60*60*1000).toISOString()}'`,
        "modified this week": `modifiedTime > '${new Date(Date.now() - 7*24*60*60*1000).toISOString()}'`,
        "modified this month": `modifiedTime > '${new Date(Date.now() - 30*24*60*60*1000).toISOString()}'`,
        "shared with me": "sharedWithMe=true",
        "owned by me": "owners='me'",
      };

      let searchQuery = '';
      let hasTextSearch = false;

      // Parse natural language elements
      for (const [phrase, apiQuery] of Object.entries(queryMappings)) {
        if (query.toLowerCase().includes(phrase)) {
          if (searchQuery) searchQuery += ' and ';
          searchQuery += apiQuery;
        }
      }

      // Add text search if query contains words not covered by mappings
      const remainingText = query.toLowerCase()
        .replace(/(spreadsheets|documents|forms|presentations|folders|modified today|modified this week|modified this month|shared with me|owned by me)/g, '')
        .trim();

      if (remainingText && !searchQuery) {
        searchQuery = `fullText contains '${remainingText.replace(/'/g, "\\'")}'`;
        hasTextSearch = true;
      } else if (remainingText) {
        searchQuery += ` and fullText contains '${remainingText.replace(/'/g, "\\'")}'`;
        hasTextSearch = true;
      }

      // Apply additional filters
      if (filters?.mimeType) {
        if (searchQuery) searchQuery += ' and ';
        searchQuery += `mimeType='${filters.mimeType}'`;
      }
      if (filters?.modifiedAfter) {
        if (searchQuery) searchQuery += ' and ';
        searchQuery += `modifiedTime > '${filters.modifiedAfter}'`;
      }
      if (filters?.owner) {
        if (searchQuery) searchQuery += ' and ';
        searchQuery += `owners='${filters.owner}'`;
      }

      // Fallback to simple text search if no mappings found
      if (!searchQuery) {
        searchQuery = `fullText contains '${query.replace(/'/g, "\\'")}'`;
      }

      const response = await drive.files.list({
        q: searchQuery,
        pageSize: maxResults,
        fields: "files(id, name, mimeType, modifiedTime, owners, shared, webViewLink)",
        orderBy: "modifiedTime desc",
      });

      const files = response.data.files || [];
      
      if (files.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No files found for query: "${query}"\nSearch query used: ${searchQuery}`,
          }],
          isError: false,
        };
      }

      const fileList = files.map((file, index) => {
        const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'Unknown';
        const owner = file.owners?.[0]?.displayName || 'Unknown';
        const shared = file.shared ? ' (Shared)' : '';
        return `${index + 1}. ${file.name}${shared}\n   Type: ${file.mimeType}\n   Modified: ${modified} by ${owner}\n   ID: ${file.id}`;
      }).join('\n\n');

      return {
        content: [{
          type: "text",
          text: `Enhanced search found ${files.length} results for: "${query}"\n\n${fileList}`,
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error in enhanced search: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "createDocument") {
    try {
      const { title, content } = request.params.arguments as { title: string; content?: string };
      
      const response = await docs.documents.create({
        requestBody: {
          title,
        },
      });

      const documentId = response.data.documentId!;

      // Add content if provided
      if (content) {
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

      return {
        content: [{
          type: "text",
          text: `Document created successfully: ${response.data.title} (ID: ${documentId})`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error creating document: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "insertText") {
    try {
      const { documentId, text, location } = request.params.arguments as { 
        documentId: string; 
        text: string; 
        location: number 
      };
      
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            insertText: {
              location: { index: location },
              text,
            },
          }],
        },
      });

      return {
        content: [{
          type: "text",
          text: `Text inserted successfully at position ${location}`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error inserting text: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "replaceText") {
    try {
      const { documentId, find, replace, matchCase } = request.params.arguments as { 
        documentId: string; 
        find: string; 
        replace: string; 
        matchCase?: boolean 
      };
      
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            replaceAllText: {
              containsText: {
                text: find,
                matchCase: matchCase || false,
              },
              replaceText: replace,
            },
          }],
        },
      });

      return {
        content: [{
          type: "text",
          text: `Text replaced successfully: "${find}" → "${replace}"`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error replacing text: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "applyTextStyle") {
    try {
      const { documentId, startIndex, endIndex, style } = request.params.arguments as { 
        documentId: string; 
        startIndex: number; 
        endIndex: number; 
        style: any 
      };
      
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            updateTextStyle: {
              range: {
                startIndex,
                endIndex,
              },
              textStyle: style,
              fields: Object.keys(style).join(','),
            },
          }],
        },
      });

      return {
        content: [{
          type: "text",
          text: `Text style applied successfully to range ${startIndex}-${endIndex}`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error applying text style: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "insertTable") {
    try {
      const { documentId, rows, columns, location } = request.params.arguments as { 
        documentId: string; 
        rows: number; 
        columns: number; 
        location: number 
      };
      
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            insertTable: {
              location: { index: location },
              rows,
              columns,
            },
          }],
        },
      });

      return {
        content: [{
          type: "text",
          text: `Table inserted successfully: ${rows}x${columns} at position ${location}`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error inserting table: ${error.message}`,
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "batchFileOperations") {
    try {
      const { operations } = request.params.arguments as { 
        operations: Array<{
          type: 'create' | 'update' | 'delete' | 'move';
          fileId?: string;
          name?: string;
          content?: string;
          mimeType?: string;
          parentFolderId?: string;
          newParentId?: string;
        }>
      };
      
      const results = [];
      
      for (const operation of operations) {
        try {
          let result;
          
          switch (operation.type) {
            case 'create':
              const createResponse = await drive.files.create({
                requestBody: {
                  name: operation.name,
                  parents: operation.parentFolderId ? [operation.parentFolderId] : undefined,
                  mimeType: operation.mimeType,
                },
                media: operation.content ? {
                  mimeType: operation.mimeType || 'text/plain',
                  body: operation.content,
                } : undefined,
              });
              result = `Created: ${operation.name} (${createResponse.data.id})`;
              break;
              
            case 'update':
              await drive.files.update({
                fileId: operation.fileId!,
                requestBody: {
                  name: operation.name,
                },
                media: operation.content ? {
                  mimeType: operation.mimeType || 'text/plain',
                  body: operation.content,
                } : undefined,
              });
              result = `Updated: ${operation.name || operation.fileId}`;
              break;
              
            case 'delete':
              await drive.files.delete({
                fileId: operation.fileId!,
              });
              result = `Deleted: ${operation.fileId}`;
              break;
              
            case 'move':
              const file = await drive.files.get({
                fileId: operation.fileId!,
                fields: 'parents',
              });
              
              const previousParents = file.data.parents?.join(',');
              
              await drive.files.update({
                fileId: operation.fileId!,
                addParents: operation.newParentId,
                removeParents: previousParents,
                requestBody: {
                  name: operation.name,
                },
              });
              result = `Moved: ${operation.name || operation.fileId}`;
              break;
              
            default:
              result = `Unknown operation type: ${operation.type}`;
          }
          
          results.push(result);
        } catch (opError: any) {
          results.push(`Error in ${operation.type} operation: ${opError.message}`);
        }
      }

      return {
        content: [{
          type: "text",
          text: `Batch operations completed:\n${results.join('\n')}`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error in batch operations: ${error.message}`,
        }],
        isError: true,
      };
    }
  }

  throw new Error("Tool not found");
});

const credentialsPath = process.env.GDRIVE_CREDENTIALS_PATH || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../credentials/.gdrive-server-credentials.json",
);

async function authenticateAndSaveCredentials() {
  logger.info("Launching auth flow…");
  const auth = await authenticate({
    keyfilePath: process.env.GDRIVE_OAUTH_PATH || path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../credentials/gcp-oauth.keys.json",
    ),
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/forms"
    ],
  });
  fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
  logger.info(`Credentials saved to: ${credentialsPath}`);
  logger.info("You can now run the server.");
  process.exit(0); // Exit cleanly after saving credentials
}

async function loadCredentialsAndRunServer() {
  if (!fs.existsSync(credentialsPath)) {
    console.error(
      "Credentials not found. Please run with 'auth' argument first.",
    );
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  const auth = new google.auth.OAuth2();
  auth.setCredentials(credentials);
  google.options({ auth });

  logger.info("Credentials loaded. Starting server.");
  
  // Connect to Redis cache
  await cacheManager.connect();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}