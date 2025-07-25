---
allowed-tools: Read, Grep, Task
description: Fast pattern search across logs and files for quick results
---

# Quick Search

This command performs fast pattern-based searches across project files and logs for rapid results.

**variables:**
Query: $ARGUMENTS

**Usage Examples:**

- `/search-logs "failed.*authentication"` - Find authentication failures
- `/search-logs "memory.*leak|out.*of.*memory" 10` - Search memory issues with 10 lines context
- `/search-logs "POST.*api/users.*500" access.log` - Find specific API errors
- `/search-logs "hook.*blocked|prevented" pre_tool_use.json` - Search hook interventions

# Source: Structured Text with Shell Commands

# Converted: 2025-07-11T21:44:10.021Z

# Structure: A configuration and instruction set for a log search utility, detailing search rules, operational context, and examples.

```yaml
# Defines the configuration and operational instructions for a powerful log search utility.
log_search_utility:
  # Core instructions detailing the functionality of the search script.
  instructions:
    - "Parse $ARGUMENTS to extract: search_pattern, context_lines (default 3), specific_log_file, and time_filters."
    - "If no specific log file is provided, scan the 'logs/' directory for all .json and .log files."
    - "Use an intelligent search strategy based on pattern complexity: 'simple' for Grep, 'regex' for complex patterns, and 'combined' for multiple terms (OR/AND)."
    - "Apply time filters if provided, such as --after, --before, or --date."
    - "Extract relevant context around matches: complete JSON objects for .json logs and surrounding lines for .log files."
    - "Present results in a structured format including file location, line number, timestamp, highlighted match, and context."
    - "Provide a summary of findings and suggest refined searches if results are too numerous or too few."

  # Provides operational context, including file locations, structures, and optimization strategies.
  operational_context:
    log_directory_command:
      description: "Command to list the first 10 .json or .log files in the logs/ directory."
      command: "ls -la logs/ 2>/dev/null | grep -E '\\.(json|log)$' | awk '{print $9}' | head -10"
    log_file_sizes_command:
      description: "Command to show the sizes of the 5 largest log files."
      command: "du -h logs/*.json logs/*.log 2>/dev/null | sort -hr | head -5"
    common_log_files:
      description: "A list of frequently accessed log files and their purpose."
      files:
        - file: "logs/chat.json"
          purpose: "Contains conversation history."
        - file: "logs/pre_tool_use.json"
          purpose: "Logs pre-tool use hooks and events."
    json_log_structure:
      description: "Typical structure of a single entry in a JSON log file."
      fields:
        - name: "timestamp"
          type: "string"
          description: "ISO 8601 formatted timestamp of the event."
        - name: "type"
          type: "string"
          description: "The type of log entry (e.g., 'message', 'error')."
        - name: "message"
          type: "string"
          description: "The main content of the log."
        - name: "uuid"
          type: "string"
          description: "A unique identifier for the event or session."
    search_optimization:
      strategy: "Progressive Refinement"
      condition: "For files larger than 10MB to improve performance."
    pattern_examples:
      description: "Examples of different search patterns."
      - type: "regex"
        pattern: "model.*test"
        description: "Matches 'model' followed by any characters and then 'test'."
      - type: "alternatives"
        pattern: "error|warning|fail"
        description: "Matches any of the specified keywords."
      - type: "date matching"
        pattern: "timestamp.*2025-07"
        description: "Finds entries with a timestamp from July 2025."
    context_extraction_rules:
      description: "Rules for extracting context around a matched log entry."
      - file_type: "JSON"
        rule: "Extract the complete JSON object to ensure full context."
      - file_type: "Text"
        rule: "Extract surrounding lines based on semantic grouping or the 'context_lines' argument."
```
