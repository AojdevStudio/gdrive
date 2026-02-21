#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import winston from "winston";

import { TokenManager } from "./src/auth/TokenManager.js";
import { AuthManager } from "./src/auth/AuthManager.js";
import { loadWorkspaceSpec } from "./src/codemode/loadWorkspaceSpec.js";
import { runExecuteCode, runSearchCode } from "./src/codemode/sandbox.js";
import { makeGoogleApiRequest } from "./src/codemode/apiHost.js";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console({ stderrLevels: ["error", "warn", "info", "debug"] })],
  defaultMeta: { service: "gdrive-mcp-server-codemode" },
});

async function main() {
  const server = new Server(
    { name: "gdrive-mcp-server-codemode", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search",
          description: "Search the Google Workspace OpenAPI spec. All $refs are pre-resolved inline.",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "JavaScript async arrow function to search the OpenAPI spec",
              },
            },
            required: ["code"],
          },
        },
        {
          name: "execute",
          description: "Execute JavaScript code against the Google Workspace APIs.",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "JavaScript async arrow function to execute",
              },
            },
            required: ["code"],
          },
        },
      ],
    };
  });

  // Auth bootstrap (reuse existing TokenManager/AuthManager).
  // Initialize TokenManager singleton (used indirectly by AuthManager).
  TokenManager.getInstance(logger);

  // Load OAuth keys from the same place index.ts uses (TokenManager + env). We piggyback on TokenManager's config.
  // The existing server uses GOOGLE_APPLICATION_CREDENTIALS / credentials files; keep that behavior.
  const oauthKeysPath = process.env.GDRIVE_OAUTH_KEYS_PATH || process.env.GOOGLE_OAUTH_KEYS_PATH;
  if (!oauthKeysPath) {
    logger.warn(
      "Missing GDRIVE_OAUTH_KEYS_PATH/GOOGLE_OAUTH_KEYS_PATH; codemode execute will fail until OAuth keys are configured.",
    );
  }

  let auth: AuthManager | null = null;
  if (oauthKeysPath) {
    const keys = JSON.parse(await (await import("node:fs/promises")).readFile(oauthKeysPath, "utf8"));
    auth = AuthManager.getInstance(keys, logger);
    await auth.initialize();
  }

  const spec = await loadWorkspaceSpec();

  const limits = {
    timeoutMs: Number.parseInt(process.env.GDRIVE_CODEMODE_TIMEOUT_MS || "5000", 10),
    memoryMb: Number.parseInt(process.env.GDRIVE_CODEMODE_MEMORY_MB || "128", 10),
  };

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const code = (args as any)?.code;
    if (typeof code !== "string" || !code.trim()) {
      throw new Error("Missing required argument: code (string)");
    }

    if (name === "search") {
      const result = await runSearchCode({ code, spec, limits });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "execute") {
      if (!auth) {
        throw new Error(
          "Auth not configured. Set GDRIVE_OAUTH_KEYS_PATH (or GOOGLE_OAUTH_KEYS_PATH) to enable execute().",
        );
      }
      const apiRequest = makeGoogleApiRequest({ auth });
      const result = await runExecuteCode({ code, apiRequest, limits });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP Code Mode server started");
}

main().catch((err) => {
  logger.error("Fatal error in codemode server", { err });
  process.exit(1);
});
