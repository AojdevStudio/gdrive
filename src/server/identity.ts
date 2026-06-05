export const PROJECT_IDENTITY = {
  productName: 'AOJ Workbench',
  upstreamSurfaceName: 'Google Workspace',
  mcpServerName: 'aoj-workbench',
  mcpServerVersion: '4.0.0-alpha',
  logServiceName: 'aoj-workbench-mcp',
} as const;

export const MCP_SERVER_INFO = {
  name: PROJECT_IDENTITY.mcpServerName,
  version: PROJECT_IDENTITY.mcpServerVersion,
} as const;

export const WORKER_ROOT_RESPONSE =
  `${PROJECT_IDENTITY.productName} Worker ${PROJECT_IDENTITY.mcpServerVersion}\n` +
  'POST /mcp to connect.';
