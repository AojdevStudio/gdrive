# MCP Google Drive Documentation

This document provides comprehensive information about Model Context Protocol (MCP) integration with Google Drive, based on the available documentation and examples.

## Overview

MCP (Model Context Protocol) provides a standardized way for AI applications to access and interact with various data sources, including Google Drive. This integration enables AI assistants to access files, search content, and perform operations within Google Drive accounts.

## Google Drive API Integration

### Basic Google Drive API Support

The MCP specification includes support for Google Drive through its API framework:

```
Google Drive:
  Description: File access and search capabilities for Google Drive
```

### Core Capabilities

Google Drive MCP integration provides:

- **File Access**: Read and retrieve files from Google Drive
- **Search Functionality**: Search for files and content within Google Drive
- **Metadata Retrieval**: Get file information and properties
- **Authentication**: OAuth 2.0 integration for secure access

## Google OAuth 2.0 Authentication

### Authentication Setup

MCP uses Google OAuth 2.0 for secure authentication with Google services:

```python
# Initiate Google OAuth 2.0 authentication
start_google_auth(
  user_google_email: str,
  service_name: str,
  mcp_session_id: Optional[str]
) -> str
```

### Authentication Parameters

- **user_google_email**: The user's full Google email address (e.g., 'example@gmail.com')
- **service_name**: The Google service name (e.g., "Google Drive")
- **mcp_session_id**: Optional session ID for tracking OAuth flow state

### Authentication Flow

1. **Initiate Authentication**: Call `start_google_auth` with required parameters
2. **Authorization URL**: Present the returned authorization URL to the user
3. **User Sign-in**: User clicks the link and completes Google sign-in
4. **Email Confirmation**: User provides authenticated email back
5. **Retry Request**: Original request is retried with confirmed email

## Google Workspace MCP Server Integration

### Server Configuration

The Google Workspace MCP Server provides comprehensive Google Drive integration:

```python
# Tool for retrieving Google Calendar events (example of Google integration)
Tool: get_events
Server: Google Workspace MCP Server
Description: Retrieve formatted list of events from Google Calendar
Language: Python
```

### Authentication for Google Services

```python
# Authentication function for Google Workspace services
start_google_auth(
  user_google_email: str,
  service_name: str,
  mcp_session_id: Optional[str]
) -> str

# Authentication for Google Drive specifically
Function: start_google_auth
Description: Initiates Google OAuth 2.0 authentication for Google Drive
Parameters: user_google_email, service_name="Google Drive"
Returns: Authorization URL for user sign-in
```

## File Operations

### File Management API

MCP provides comprehensive file operations that can be used with Google Drive:

```python
# Read file contents
read_file:
  description: Read complete contents of a file
  input:
    path: string (File path)
  details: Reads complete file contents with UTF-8 encoding

# Write file contents
write_file:
  description: Create new file or overwrite existing
  inputs:
    path: string (File location)
    content: string (File content)

# Read multiple files
read_multiple_files:
  description: Read multiple files simultaneously
  input:
    paths: string[] (Array of file paths)
  details: Failed reads won't stop the entire operation
```

### File Search and Discovery

```python
# Search for files recursively
search_files:
  path (string): Starting directory
  pattern (string): Search pattern
  excludePatterns (string[]): Exclude patterns (glob formats supported)
Returns: full paths to matches
```

### File Metadata Operations

```python
# Get file information
get_file_info:
  path (string)
Returns:
  Size
  Creation time
  Modified time
  Access time
  Type (file/directory)
  Permissions
```

## Directory Operations

### Directory Management

```python
# List directory contents
list_directory:
  path (string)
Returns: Items prefixed with [FILE] or [DIR]

# Create directory
create_directory:
  path (string)
Description: Creates directory or ensures it exists, creates parents if needed

# List allowed directories
list_allowed_directories:
Returns: Directories that this server can read/write from
```

### File Movement Operations

```python
# Move or rename files
move_file:
  source (string)
  destination (string)
Description: Moves or renames file/directory, fails if destination exists
```

## Text Processing and Editing

### File Content Editing

```python
# Replace text in files
replace_in_file:
  filePath (string)
  oldText (string): Text to search for
  newText (string): Text to replace with
  dryRun (boolean): Preview changes without applying
Returns: detailed diff and match information for dry runs

# Advanced file editing
edit_file:
  description: Make selective edits using advanced pattern matching
  features:
    - Line-based and multi-line content matching
    - Whitespace normalization with indentation preservation
    - Multiple simultaneous edits with correct positioning
    - Git-style diff output with context
    - Preview changes with dry run mode
```

## Integration Examples

### HyperAgent MCP Google Sheets Integration

```typescript
const agent = new HyperAgent({
  llm: llm,
  debug: true,
});

await agent.initializeMCPClient({
  servers: [
    {
      command: "npx",
      args: [
        "@composio/mcp@latest",
        "start",
        "--url",
        "https://mcp.composio.dev/googlesheets/...",
      ],
      env: {
        npm_config_yes: "true",
      },
    },
  ],
});

const response = await agent.executeTask(
  "Go to https://en.wikipedia.org/wiki/List_of_U.S._states_and_territories_by_population and get the data on the top 5 most populous states from the table. Then insert that data into a google sheet."
);
```

### MCP Server Connection with Google Services

```python
async def connect_to_server(self, server_script_path: str):
    """Connect to an MCP server for Google services"""
    command = "python" if server_script_path.endswith('.py') else "node"
    server_params = StdioServerParameters(
        command=command,
        args=[server_script_path],
        env=None
    )

    stdio_transport = await self.exit_stack.enter_async_context(
        stdio_client(server_params)
    )
    self.stdio, self.write = stdio_transport
    self.sessions = await self.exit_stack.enter_async_context(
        ClientSession(self.stdio, self.write)
    )

    await self.sessions.initialize()

    # List available tools
    response = await self.sessions.list_tools()
    tools = response.tools
    
    # Configure with Google Gemini
    self.model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        tools=available_tools
    )
    
    self.chat = self.model.start_chat()
```

## Root and Context Management

### Filesystem Roots

MCP supports defining filesystem roots for Google Drive integration:

```json
{
  "uri": "file:///home/user/projects/myproject",
  "name": "My Project"
}
```

### Root Data Structure

```python
# Root definition for filesystem access
Data Type: Root
  Description: A definition of an exposed filesystem root
  Properties:
    uri: string (file:// URI)
      Description: Unique identifier for the root
    name: string (optional)
      Description: Human-readable name for display
```

### Context Management API

```python
# Method for listing roots
Method: roots/list
  Type: Request
  Direction: Server to Client
  Parameters: None
  Response: roots/list Response
```

## GenAI Integration with Google Services

### Genkit Framework Integration

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const ai = genkit({ plugins: [googleAI()] });

const { text } = await ai.generate({
  model: googleAI.model('gemini-2.0-flash'),
  prompt: 'Process this Google Drive file content'
});
```

### Google AI Model Integration

```javascript
const { text } = await ai.generate({
  model: googleAI.model('gemini-2.0-flash'),
  prompt: 'Why is Firebase awesome?'
});
```

## Advanced Features

### File Processing and Analysis

```javascript
// Include files in context
def("DATA", file)
$`Analyze DATA and extract data in JSON in data.json.`

// Process multiple file types
def("PDF", env.files, { endsWith: ".pdf" })
const { pages } = await parsers.PDF(env.files[0])
```

### Search and Retrieval

```javascript
// Web search capabilities
const pages = await retrieval.webSearch("what are the latest news about AI?")

// Vector search for RAG
const index = await retrieval.index("documents", { type: "azure_ai_search" })
await index.insertOrUpdate(env.files)
const docs = await index.search("search query")
```

### Workspace Operations

```javascript
// File operations in workspace
const { files } = await workspace.grep(/[a-z][a-z0-9]+/, { globs: "*.md" })
const file = await workspace.readText("data.txt")
```

## Security and Authentication

### OAuth 2.0 Configuration

Google Drive MCP integration requires proper OAuth 2.0 setup:

1. **Google Cloud Project**: Create project in Google Cloud Console
2. **Enable APIs**: Enable Google Drive API and other required APIs
3. **OAuth Consent Screen**: Configure consent screen for your application
4. **Credentials**: Create OAuth 2.0 client credentials
5. **Scope Configuration**: Set appropriate scopes for Google Drive access

### Required Scopes

Common Google Drive scopes for MCP integration:

- `https://www.googleapis.com/auth/drive.readonly` - Read-only access
- `https://www.googleapis.com/auth/drive.file` - Access to files created by the app
- `https://www.googleapis.com/auth/drive` - Full access to Google Drive

## Error Handling and Best Practices

### Authentication Error Handling

```python
# Handle authentication failures
try:
    auth_url = start_google_auth(
        user_google_email="user@example.com",
        service_name="Google Drive"
    )
    # Present auth_url to user
except Exception as e:
    # Handle authentication error
    print(f"Authentication failed: {e}")
```

### File Operation Best Practices

1. **Dry Run First**: Always use `dryRun: true` before applying changes
2. **Error Resilience**: Use `read_multiple_files` for batch operations
3. **Path Validation**: Validate file paths before operations
4. **Permission Checks**: Verify user has necessary permissions

### Rate Limiting and Quotas

- **API Limits**: Respect Google Drive API rate limits
- **Batch Operations**: Use batch requests where possible
- **Caching**: Implement caching for frequently accessed files
- **Retry Logic**: Implement exponential backoff for rate limit errors

## Installation and Setup

### Genkit CLI Setup

```shell
# Install Genkit CLI globally
npm install -g genkit-cli

# Run with telemetry and developer UI
genkit start -- <command to run your code>
```

### MCP Server Setup

```shell
# Clone and setup MCP client
git clone https://github.com/apify/tester-mcp-client.git
cd tester-mcp-client
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify OAuth 2.0 credentials are correct
   - Check if required scopes are granted
   - Ensure user email is properly formatted

2. **File Access Issues**
   - Verify file permissions in Google Drive
   - Check if file exists and is accessible
   - Ensure proper file path formatting

3. **API Quota Exceeded**
   - Implement proper rate limiting
   - Use batch operations where possible
   - Monitor API usage in Google Cloud Console

### Debug Tools

```python
# Enable debug logging
const agent = new HyperAgent({
  llm: llm,
  debug: true,
});

# Check server connection
response = await self.sessions.list_tools()
print("Connected to server with tools:", [tool.name for tool in response.tools])
```

## Conclusion

MCP's Google Drive integration provides a powerful and standardized way to access Google Drive from AI applications. The combination of OAuth 2.0 authentication, comprehensive file operations, and seamless integration with AI models makes it an excellent choice for building AI-powered applications that need to work with Google Drive content.

The key to successful implementation lies in proper authentication setup, understanding the available APIs, and following best practices for error handling and rate limiting.

---

*This documentation is based on the MCP specification and available examples. For the most current information, refer to the official MCP documentation at https://modelcontextprotocol.io/*