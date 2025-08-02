# Google Drive MCP Server - Code Examples

This directory contains comprehensive code examples demonstrating how to use the Google Drive MCP Server's capabilities. Each example includes detailed explanations, practical use cases, and complete code snippets.

## 📁 Available Examples

### 🔍 **Search Operations**
- **[Natural Language Search](./search-natural-language.md)** - Search files using natural language queries
- **[Advanced Search](./search-enhanced.md)** - Complex filtering and sorting capabilities

### 📄 **Document Management**
- **[Reading Documents](./documents-reading.md)** - Read various file formats with automatic conversion
- **[Creating Documents](./documents-creating.md)** - Create and format Google Docs
- **[Document Operations](./documents-operations.md)** - Insert, replace, and style text

### 📊 **Spreadsheet Management**
- **[Reading Sheets](./sheets-reading.md)** - Read spreadsheet data and metadata
- **[Writing to Sheets](./sheets-writing.md)** - Update cells and append rows
- **[Sheet Management](./sheets-management.md)** - Create and manage multiple sheets

### 📋 **Forms Management**
- **[Creating Forms](./forms-creating.md)** - Build forms with various question types
- **[Managing Forms](./forms-management.md)** - Add questions and retrieve responses

### 🔧 **Batch Operations**
- **[Batch File Operations](./batch-operations.md)** - Process multiple files efficiently
- **[Bulk Data Processing](./bulk-processing.md)** - Handle large-scale operations

### ⚡ **Performance & Caching**
- **[Redis Caching](./redis-caching.md)** - Optimize performance with intelligent caching
- **[Performance Monitoring](./performance-monitoring.md)** - Track and optimize operations

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
If you have the server configured with Claude Desktop, you can copy and paste the tool calls directly into your conversation.

### Using Node.js
For standalone testing, you can create a test script:

```javascript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

// Your example code here
```

### Using curl (Advanced)
For direct MCP protocol testing:

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "search", "arguments": {"query": "test"}}}' | node ./dist/index.js
```

## 🤝 Contributing Examples

We welcome additional examples! When contributing:

1. **Follow the established format** with clear explanations
2. **Include error handling** and edge cases
3. **Add performance considerations** where relevant
4. **Test your examples** before submitting
5. **Update this README** with your new example

## 📚 Additional Resources

- **[Main README](../../README.md)** - Complete server documentation
- **[API Reference](../api-reference.md)** - Detailed tool and resource specifications
- **[Authentication Guide](../authentication.md)** - Setup and security best practices
- **[Performance Guide](../performance.md)** - Optimization strategies

---

**Need help?** Open an issue or check the troubleshooting section in the main README.