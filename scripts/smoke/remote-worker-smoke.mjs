#!/usr/bin/env node

/* global console, fetch, process */

const workerUrl = process.env.WORKER_URL;
const mcpToken = process.env.MCP_BEARER_TOKEN;
const setupToken = process.env.MCP_SETUP_TOKEN;

const secretValues = [
  mcpToken,
  setupToken,
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

function pass(message) {
  console.log(`PASS ${message}`);
}

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
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    const body = await readBody(response);
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${redact(body)}`);
    }
    const names = body?.result?.tools?.map((tool) => tool.name).sort();
    if (JSON.stringify(names) !== JSON.stringify(['execute', 'search'])) {
      throw new Error(`Unexpected tools/list response: ${redact(body)}`);
    }
  });
} else {
  console.log('SKIP authenticated tools/list exposes search and execute (MCP_BEARER_TOKEN not set)');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
