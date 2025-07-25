---
allowed-tools: Read, Grep, Task, Bash
description: Deep analysis of logs with context preservation and smart filtering
---

# Deep Search

This command performs comprehensive searches through structured logs with advanced filtering, context preservation, and intelligent result grouping.

**variables:**
Query: $ARGUMENTS

**Usage Examples:**

- `/log-search "npm.*EACCES|permission.*denied"` - Find npm permission errors
- `/log-search "git.*conflict" --type tool --last 50` - Recent git conflicts in tool calls
- `/log-search "database.*connection.*failed" --context 20` - Database errors with context
- `/log-search "webhook.*payload" notification.json --json-path data.url` - Search webhook URLs
- `/log-search "timestamp:2025-07.*WARNING|ERROR" --type system` - System warnings by date

```yaml
# Protocol for a comprehensive log searching utility.
log_search_protocol:
  # Defines the command-line arguments the utility accepts.
  argument_parsing:
    parameters:
      - name: 'Primary Search Pattern'
        type: 'string'
        required: true
        description: 'The main text or regex pattern to search for.'
      - name: '--context'
        type: 'integer'
        default: 5
        description: 'Number of lines of context to show around a match.'
      - name: '--type'
        type: 'string'
        description: 'Filter results by message type (user, assistant, tool, system).'
      - name: '--last'
        type: 'integer'
        description: 'Search only the last N log entries.'
      - name: '--json-path'
        type: 'string'
        description: 'Specific JSON path to search within a JSON log entry.'
      - name: '--file'
        type: 'string'
        default: 'all files in logs/'
        description: 'Specify a single log file to search.'
      - name: 'timestamp'
        type: 'prefix'
        description: 'A timestamp prefix for time-based searches.'

  # The core logic for executing the search.
  execution_logic:
    search_strategy:
      - condition: 'JSON files < 50MB'
        action: 'Load and parse the entire file for a structured search.'
      - condition: 'JSON files > 50MB'
        action: 'Use a streaming JSON parser or grep with JSON object boundaries.'
      - condition: 'Text logs'
        action: 'Use grep with appropriate context flags.'

    json_log_handling:
      - 'Parse the full JSON structure to maintain the integrity of each log entry.'
      - 'Extract complete message objects, not partial content.'
      - 'Include relevant metadata in results, such as timestamp, uuid, and type.'

    filter_application_order:
      - 'First: Apply the primary pattern match.'
      - 'Second: Apply type and time-based filters.'
      - 'Third: Extract the final context for display.'

  # Rules for formatting and presenting the search results.
  output_formatting:
    rules:
      - 'Group results by filename if searching multiple logs.'
      - 'Display the entry number or position for context in large logs.'
      - 'Highlight the matched patterns within the results.'
      - 'Include actionable context like timestamps, message types, and tool results.'
    summary:
      - 'Provide search statistics (e.g., number of matches, files searched).'
      - 'Offer suggestions for refining the search if results are too broad or narrow.'

  # Contextual information about the logging environment.
  operational_context:
    data_sources:
      discovery_command: 'find logs -name "*.json" -o -name "*.log" 2>/dev/null | sort'
      structure_command: 'head -1 logs/chat.json 2>/dev/null | jq -r ''keys[]'' 2>/dev/null | head -5 || echo "No JSON logs found"'

    data_schema:
      json_entry_structure:
        - 'timestamp'
        - 'type'
        - 'message': { 'role', 'content' }
        - 'uuid'
        - 'toolUse'
        - 'toolUseResult'
      message_types:
        - 'user'
        - 'assistant'
        - 'tool'
        - 'system'

    search_capabilities:
      supported_patterns:
        - 'Simple text'
        - 'Regex (e.g., .*, |)'
        - 'Timestamp prefix (e.g., timestamp:)'
        - 'JSON path notation'

    performance_and_handling:
      large_log_note: 'chat.json can exceed 300KB; use progressive search techniques.'
      context_boundaries:
        - 'For JSON, preserve complete message objects.'
        - 'For text, preserve semantic paragraphs where possible.'
      performance_tips:
        - 'Start with a broad search, then refine with more filters.'
        - 'Use --last for quick searches of recent activity.'
        - 'Specify --type to significantly reduce the search scope.'
```
