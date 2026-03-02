# Google Drive MCP Server - Code Examples

This directory contains code examples for the **v4 architecture**, which exposes exactly two MCP tools: `search` and `execute`. You discover operations via `search`, then run code via `execute` using the `sdk` object.

## v4 Architecture

| Tool | Purpose |
|------|---------|
| **search** | Discover available operations. Call with `service` and optionally `operation` to get signatures, params, and examples. |
| **execute** | Run JavaScript code in a sandbox. The `sdk` object is available globally. Use `sdk.drive.search()`, `sdk.sheets.addConditionalFormat()`, etc. |

**Workflow:** 1) Call `search` to find the operation you need. 2) Call `execute` with code that uses `sdk.*` to perform the operation.

## 📁 Available Examples

### 🔍 **Search Operations**
- **[Natural Language Search](./search-natural-language.md)** - Basic Drive search via `sdk.drive.search()`
- **[Enhanced Search](./search-enhanced.md)** - Advanced filtering via `sdk.drive.enhancedSearch()`

### 📊 **Spreadsheet Management**
- **[Conditional Formatting](./sheets-conditional-formatting.md)** - Apply conditional formatting via `sdk.sheets.addConditionalFormat()`

## 🚀 Getting Started

Before running these examples, ensure you have:

1. **Authenticated** with Google Drive:
   ```bash
   node ./dist/index.js auth
   ```

2. **Set up your environment** with required variables:
   ```bash
   export GDRIVE_TOKEN_ENCRYPTION_KEY="your-base64-key"
   export REDIS_URL="redis://localhost:6379"  # Optional
   ```

3. **Started the MCP server** or configured it with Claude Desktop

## 📖 Example Format

Each example follows this structure:

- **Overview** - What the example demonstrates
- **Prerequisites** - Required setup and permissions
- **Code Examples** - Complete, runnable code snippets
- **Explanation** - Detailed breakdown of the code
- **Use Cases** - Real-world applications
- **Error Handling** - Common issues and solutions
- **Performance Tips** - Optimization recommendations

## 🛠️ Running Examples

### Using Claude Desktop
If the server is configured with Claude Desktop, use the `search` tool to discover operations, then the `execute` tool with the example code.

### Example: Discover and Run

**Step 1 — Discover Drive search:**
```json
{ "name": "search", "arguments": { "service": "drive", "operation": "search" } }
```

**Step 2 — Execute code:**
```json
{
  "name": "execute",
  "arguments": {
    "code": "const results = await sdk.drive.search({ query: 'budget', pageSize: 10 }); return results.files.map(f => ({ id: f.id, name: f.name }));"
  }
}
```

## 🤝 Contributing Examples

We welcome additional examples! When contributing:

1. **Follow the established format** with clear explanations
2. **Use v4 architecture** — `search` for discovery, `execute` with `sdk.*` for operations
3. **Include error handling** and edge cases
4. **Test your examples** before submitting
5. **Update this README** with your new example

## 📚 Additional Resources

- **[Main README](../../README.md)** - Complete server documentation
- **[Authentication Guide](../authentication.md)** - Setup and security best practices
- **[Architecture](../Architecture/ARCHITECTURE.md)** - Server architecture and design

---

**Need help?** Open an issue or check the troubleshooting section in the main README.