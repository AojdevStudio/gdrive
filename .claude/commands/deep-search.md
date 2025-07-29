---
allowed-tools: Bash, Grep, Read, Task
description: Deep analysis of logs with context preservation and smart filtering
---

# Deep Search

Use the deep-searcher sub-agent to perform comprehensive searches through structured logs with advanced filtering and context preservation. Parse $ARGUMENTS for search pattern and filters (--context, --type, --last, --json-path, --file), discover log files in logs/ directory, apply progressive search techniques for large files, preserve complete message objects for JSON logs, highlight matched patterns in results, group by filename, and provide search statistics with refinement suggestions.
