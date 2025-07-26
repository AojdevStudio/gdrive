#!/bin/bash
# MCP wrapper script for Claude Desktop
# This ensures clean JSON output without Docker warnings

# Run the MCP server in Docker, suppressing stderr warnings
exec docker exec -i gdrive-mcp-server node dist/index.js 2>/dev/null