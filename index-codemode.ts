#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import winston from "winston";

import { TokenManager } from "./src/auth/TokenManager.js";
import { AuthManager, AuthState } from "./src/auth/AuthManager.js";
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

  // Auth bootstrap: follow the SAME pathing + key expectations as index.ts (main tree).
  // This intentionally avoids inventing new env var names.

  // Ensure encryption key is present (TokenManager requires it).
  if (!process.env.GDRIVE_TOKEN_ENCRYPTION_KEY) {
    logger.warn(
      "Missing GDRIVE_TOKEN_ENCRYPTION_KEY; codemode execute will be unavailable until it is set.",
    );
  }

  // Default oauth key path matches README (./credentials/gcp-oauth.keys.json)
  const oauthPath =
    process.env.GDRIVE_OAUTH_PATH ??
    new URL("../credentials/gcp-oauth.keys.json", import.meta.url).pathname;

  // Initialize TokenManager singleton (loads encryption key, token store paths, etc.)
  let auth: AuthManager | null = null;
  try {
    TokenManager.getInstance(logger);

    const fs = await import("node:fs");
    if (!fs.existsSync(oauthPath)) {
      logger.warn(`OAuth keys not found at: ${oauthPath}`);
    } else {
      const keysContent = (await import("node:fs/promises")).readFile(oauthPath, "utf8");
      const keys = JSON.parse(await keysContent) as { web?: unknown; installed?: unknown };
      const oauthKeys = (keys as { web?: unknown; installed?: unknown }).web ??
        (keys as { web?: unknown; installed?: unknown }).installed;

      if (!oauthKeys || typeof oauthKeys !== "object") {
        logger.warn("Invalid OAuth keys format. Expected 'web' or 'installed'.");
      } else {
        auth = AuthManager.getInstance(oauthKeys as never, logger);
        await auth.initialize();
        if (auth.getState() === AuthState.UNAUTHENTICATED) {
          auth = null;
          logger.warn("Not authenticated yet. Run: node ./dist/index.js auth");
        }
      }
    }
  } catch (err) {
    logger.warn("Auth bootstrap failed; codemode execute will be unavailable until fixed.", { err });
    auth = null;
  }

  const spec = await loadWorkspaceSpec();

  const limits = {
    timeoutMs: Number.parseInt(process.env.GDRIVE_CODEMODE_TIMEOUT_MS || "5000", 10),
    memoryMb: Number.parseInt(process.env.GDRIVE_CODEMODE_MEMORY_MB || "128", 10),
  };

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const code = (args as { code?: unknown } | undefined)?.code;
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
          "Auth not ready. Follow README: set GDRIVE_TOKEN_ENCRYPTION_KEY and place credentials/gcp-oauth.keys.json, then run: node ./dist/index.js auth",
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
