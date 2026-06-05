#!/usr/bin/env node

/* global console, fetch, process */

const workerUrl = process.env.WORKER_URL;
const mcpToken = process.env.MCP_BEARER_TOKEN;
const setupToken = process.env.MCP_SETUP_TOKEN;
const executePlan = process.env.AOJ_WORKBENCH_SMOKE_EXECUTE_JSON;

const secretValues = [
  mcpToken,
  setupToken,
  process.env.COMPOSIO_API_KEY,
  process.env.AOJ_WORKBENCH_MCP_TOKEN,
  process.env.GDRIVE_CLIENT_SECRET,
  process.env.GDRIVE_TOKEN_ENCRYPTION_KEY,
  process.env.GOOGLE_AUTH_CODE,
  process.env.GOOGLE_ACCESS_TOKEN,
  process.env.GOOGLE_REFRESH_TOKEN,
].filter(Boolean);

function redact(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of secretValues) {
    text = text.split(secret).join('[REDACTED]');
  }
  return text;
}

function fail(message, detail) {
  console.error(`FAIL ${message}`);
  if (detail !== undefined) {
    console.error(redact(detail));
  }
  process.exitCode = 1;
}

/**
 * Log a passing test message.
 * @param {string} message - Description of the successful check.
 */
function pass(message) {
  console.log(`PASS ${message}`);
}

/**
 * Send an authenticated JSON-RPC request to the worker's /mcp endpoint and return the parsed response.
 *
 * @param {string} method - The JSON-RPC method name to invoke.
 * @param {Object} params - Parameters for the JSON-RPC call.
 * @returns {any} The parsed response body (JSON object when JSON is returned, otherwise raw text).
 * @throws {Error} If the HTTP response status is not 200; the error message includes a redacted response body.
 */
async function callMcp(method, params) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mcpToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const body = await readBody(response);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}: ${redact(body)}`);
  }
  return body;
}

/**
 * Parse an HTTP Response body, handling JSON and Server-Sent Events payloads.
 * 
 * When the response has a `content-type` that includes `text/event-stream`, extracts
 * the first line starting with `data: ` and returns its parsed JSON payload if present;
 * otherwise returns the response text. For non-event-stream responses, attempts to
 * parse the body as JSON and returns the parsed value on success or the raw text on failure.
 * 
 * @param {Response} response - The Fetch API Response to read.
 * @returns {any} The parsed JSON value when present (from SSE `data: ` or plain JSON), otherwise the raw response text.
 */
async function readBody(response) {
  const text = await response.text();
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
    return dataLine ? JSON.parse(dataLine.slice('data: '.length)) : text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function check(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error instanceof Error ? error.message : error);
  }
}

if (!workerUrl) {
  fail('WORKER_URL is required', 'Example: WORKER_URL=https://your-worker.workers.dev npm run smoke:worker');
  process.exit();
}

const baseUrl = workerUrl.replace(/\/+$/, '');

await check('root identifies the Worker', async () => {
  const response = await fetch(`${baseUrl}/`);
  const text = await response.text();
  if (response.status !== 200 || !text.includes('Worker') || !text.includes('POST /mcp')) {
    throw new Error(`Unexpected root response ${response.status}: ${redact(text)}`);
  }
});

await check('unauthenticated /mcp is rejected', async () => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}: ${redact(await readBody(response))}`);
  }
});

if (setupToken) {
  await check('setup/status route responds with setup bearer auth', async () => {
    const response = await fetch(`${baseUrl}/setup/status`, {
      headers: { Authorization: `Bearer ${setupToken}` },
    });
    const body = await readBody(response);
    if (response.status !== 200 || typeof body !== 'object' || body === null || !('status' in body)) {
      throw new Error(`Unexpected setup/status response ${response.status}: ${redact(body)}`);
    }
    const serialized = JSON.stringify(body);
    if (secretValues.some((secret) => serialized.includes(secret))) {
      throw new Error('setup/status response leaked a configured secret');
    }
  });
} else {
  console.log('SKIP setup/status route responds with setup bearer auth (MCP_SETUP_TOKEN not set)');
}

if (mcpToken) {
  await check('authenticated tools/list exposes search and execute', async () => {
    const body = await callMcp('tools/list', {});
    const names = body?.result?.tools?.map((tool) => tool.name).sort();
    if (JSON.stringify(names) !== JSON.stringify(['execute', 'search'])) {
      throw new Error(`Unexpected tools/list response: ${redact(body)}`);
    }
  });

  const services = ['drive', 'sheets', 'docs', 'gmail', 'forms', 'calendar'];
  for (const service of services) {
    await check(`search discovers Composio-backed ${service} operations`, async () => {
      const body = await callMcp('tools/call', {
        name: 'search',
        arguments: { service },
      });
      const text = body?.result?.content?.[0]?.text;
      const parsed = typeof text === 'string' ? JSON.parse(text) : undefined;
      if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
        throw new Error(`Unexpected search response for ${service}: ${redact(body)}`);
      }
      const serialized = JSON.stringify(parsed);
      if (!serialized.includes('"provider":"composio"')) {
        throw new Error(`Search response did not report Composio provider for ${service}: ${redact(body)}`);
      }
    });
  }

  if (executePlan) {
    const operations = JSON.parse(executePlan);
    if (!Array.isArray(operations)) {
      throw new Error('AOJ_WORKBENCH_SMOKE_EXECUTE_JSON must be an array of { service, operation, args } objects');
    }
    for (const item of operations) {
      const { service, operation, args } = item;
      await check(`execute runs ${service}.${operation} through AOJ Workbench`, async () => {
        const body = await callMcp('tools/call', {
          name: 'execute',
          arguments: { service, operation, args },
        });
        const text = body?.result?.content?.[0]?.text;
        const parsed = typeof text === 'string' ? JSON.parse(text) : undefined;
        if (!parsed || parsed.error || !('result' in parsed)) {
          throw new Error(`Unexpected execute response for ${service}.${operation}: ${redact(body)}`);
        }
      });
    }
  } else {
    console.log('SKIP execute service smoke (AOJ_WORKBENCH_SMOKE_EXECUTE_JSON not set)');
  }
} else {
  console.log('SKIP authenticated tools/list exposes search and execute (MCP_BEARER_TOKEN not set)');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
