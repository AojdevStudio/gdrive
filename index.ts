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
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import { sheets_v4 } from 'googleapis';

const drive = google.drive("v3");
const sheets = google.sheets("v4");

const server = new Server(
  {
    name: "example-servers/gdrive",
    version: "0.1.0",
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
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search") {
    const userQuery = request.params.arguments?.query as string;
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
    return {
      content: [
        {
          type: "text",
          text: `Found ${res.data.files?.length ?? 0} files:\n${fileList}`,
        },
      ],
      isError: false,
    };
  } else if (request.params.name === "read") {
    const fileId = request.params.arguments?.fileId as string;
    
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
    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      return {
        content: [
          {
            type: "text",
            text: `Contents of ${file.data.name}:\n\n${Buffer.from(res.data as ArrayBuffer).toString("utf-8")}`,
          },
        ],
        isError: false,
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Unable to display contents of ${file.data.name} - binary file of type ${mimeType}`,
          },
        ],
        isError: false,
      };
    }
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
  }
  throw new Error("Tool not found");
});

const credentialsPath = process.env.GDRIVE_CREDENTIALS_PATH || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../.gdrive-server-credentials.json",
);

async function authenticateAndSaveCredentials() {
  console.log("Launching auth flow…");
  const auth = await authenticate({
    keyfilePath: process.env.GDRIVE_OAUTH_PATH || path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../../../gcp-oauth.keys.json",
    ),
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly"
    ],
  });
  fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
  console.log("Credentials saved. You can now run the server.");
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

  console.error("Credentials loaded. Starting server.");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}