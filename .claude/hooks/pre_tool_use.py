#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path


def is_dangerous_rm_command(command):
    """
    Comprehensive detection of dangerous rm commands.
    Matches various forms of rm -rf and similar destructive patterns.
    """
    # Normalize command by removing extra spaces and converting to lowercase
    normalized = ' '.join(command.lower().split())
    
    # Pattern 1: Standard rm -rf variations
    patterns = [
        r'\brm\s+.*-[a-z]*r[a-z]*f',  # rm -rf, rm -fr, rm -Rf, etc.
        r'\brm\s+.*-[a-z]*f[a-z]*r',  # rm -fr variations
        r'\brm\s+--recursive\s+--force',  # rm --recursive --force
        r'\brm\s+--force\s+--recursive',  # rm --force --recursive
        r'\brm\s+-r\s+.*-f',  # rm -r ... -f
        r'\brm\s+-f\s+.*-r',  # rm -f ... -r
    ]
    
    # Check for dangerous patterns
    for pattern in patterns:
        if re.search(pattern, normalized):
            return True
    
    # Pattern 2: Check for rm with recursive flag targeting dangerous paths
    dangerous_paths = [
        r'/',           # Root directory
        r'/\*',         # Root with wildcard
        r'~',           # Home directory
        r'~/',          # Home directory path
        r'\$HOME',      # Home environment variable
        r'\.\.',        # Parent directory references
        r'\*',          # Wildcards in general rm -rf context
        r'\.',          # Current directory
        r'\.\s*$',      # Current directory at end of command
    ]
    
    if re.search(r'\brm\s+.*-[a-z]*r', normalized):  # If rm has recursive flag
        for path in dangerous_paths:
            if re.search(path, normalized):
                return True
    
    return False

def is_env_file_access(tool_name, tool_input):
    """
    Check if any tool is trying to access .env files containing sensitive data.
    Allows reading .env files but blocks editing/writing operations.
    Also allows access to .env.sample and .env.example files.
    """
    if tool_name in ['Read', 'Edit', 'MultiEdit', 'Write', 'Bash']:
        # Check file paths for file-based tools
        if tool_name in ['Edit', 'MultiEdit', 'Write']:  # Only block edit operations, allow Read
            file_path = tool_input.get('file_path', '')
            if '.env' in file_path and not (file_path.endswith('.env.sample') or file_path.endswith('.env.example')):
                return True
        
        # Check bash commands for .env file access
        elif tool_name == 'Bash':
            command = tool_input.get('command', '')
            # Pattern to detect .env file write/edit operations (but allow .env.sample and .env.example)
            # Allow cat/read operations but block write operations
            env_write_patterns = [
                r'echo\s+.*>\s*\.env\b(?!\.sample|\.example)',  # echo > .env
                r'touch\s+.*\.env\b(?!\.sample|\.example)',  # touch .env
                r'cp\s+.*\.env\b(?!\.sample|\.example)',  # cp .env (as destination)
                r'mv\s+.*\.env\b(?!\.sample|\.example)',  # mv .env (as destination)
                r'>\s*\.env\b(?!\.sample|\.example)',  # any redirection to .env
                r'>>\s*\.env\b(?!\.sample|\.example)',  # any append to .env
                r'vim\s+.*\.env\b(?!\.sample|\.example)',  # vim .env
                r'nano\s+.*\.env\b(?!\.sample|\.example)',  # nano .env
                r'emacs\s+.*\.env\b(?!\.sample|\.example)',  # emacs .env
                r'sed\s+.*-i.*\.env\b(?!\.sample|\.example)',  # sed -i .env (in-place edit)
            ]
            
            for pattern in env_write_patterns:
                if re.search(pattern, command):
                    return True
    
    return False

def is_command_file_access(tool_name, tool_input):
    """
    Check if any tool is trying to access .claude/commands/ files.
    This now only provides warnings, not blocks, to avoid workflow disruption.
    """
    if tool_name not in ['Write', 'Edit', 'MultiEdit']:
        return False
    
    file_path = tool_input.get('file_path', '')
    if not file_path:
        return False
    
    # Check if this is a .claude/commands/ file
    normalized_path = os.path.normpath(file_path)
    
    # Check for both relative and absolute paths
    is_commands_file = (
        '/.claude/commands/' in normalized_path or
        normalized_path.startswith('.claude/commands/') or
        normalized_path.startswith('.claude\\commands\\') or  # Windows
        '/.claude/commands/' in normalized_path or
        normalized_path.endswith('/.claude/commands') or
        normalized_path.endswith('\\.claude\\commands')  # Windows
    )
    
    if not is_commands_file:
        return False
    
    # Only check .md files in commands directory
    if not file_path.endswith('.md'):
        return False
    
    return True

def find_template_file():
    """Find the custom command template file"""
    possible_paths = [
        "ai-docs/custom-command-template.md",
        "./ai-docs/custom-command-template.md",
        "../ai-docs/custom-command-template.md",
        "ai_docs/custom-command-template.md",
        "./ai_docs/custom-command-template.md"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    return None

def contains_date_patterns(content):
    """
    Check if content contains date patterns that might be hallucinated.
    Returns True if dates are found that should be verified.
    """
    # Common date patterns that LLMs might hallucinate
    date_patterns = [
        r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b',
        r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b',
        r'\bQ[1-4]\s+\d{4}\b',  # Q1 2025, etc.
        r'\b\d{4}-\d{2}-\d{2}\b',  # 2025-01-15
        r'\b\d{1,2}/\d{1,2}/\d{4}\b',  # 1/15/2025 or 01/15/2025
        r'\b(by|in|on|before|after)\s+(end\s+of\s+)?\d{4}\b',  # by 2025, by end of 2025
        r'\b(early|mid|late)\s+\d{4}\b',  # early 2025
        r'(next|last|this)\s+(month|quarter|year)',  # next quarter
        r'(within|in)\s+\d+\s+(days|weeks|months)',  # within 30 days
    ]
    
    for pattern in date_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            return True
    
    return False

def check_date_awareness(tool_name, tool_input):
    """
    Check if the tool is writing date-sensitive content without verifying current date.
    """
    # Only check tools that write content
    if tool_name not in ['Write', 'Edit', 'MultiEdit']:
        return False
    
    # Get the content being written
    content = ''
    if tool_name == 'Write':
        content = tool_input.get('content', '')
    elif tool_name == 'Edit':
        content = tool_input.get('new_string', '')
    elif tool_name == 'MultiEdit':
        edits = tool_input.get('edits', [])
        content = ' '.join([edit.get('new_string', '') for edit in edits])
    
    # Check if content contains date patterns
    return contains_date_patterns(content)

def check_recent_date_command():
    """
    Check if the date command was run recently (within last 5 minutes).
    """
    # Check logs for recent date command
    log_paths = [
        Path.home() / '.claude' / 'logs' / 'pre_tool_use.json',
        Path('logs/pre_tool_use.json'),
        Path('../logs/pre_tool_use.json')
    ]
    
    cutoff_time = time.time() - 300  # 5 minutes
    
    for log_path in log_paths:
        if log_path.exists():
            try:
                with open(log_path, 'r') as f:
                    log_data = json.load(f)
                    
                    # Check recent entries for date command
                    for entry in reversed(log_data[-20:]):  # Check last 20 entries
                        if entry.get('tool_name') == 'Bash':
                            command = entry.get('tool_input', {}).get('command', '')
                            if command.strip() == 'date' or 'date' in command.split():
                                return True
                                
            except (json.JSONDecodeError, FileNotFoundError):
                continue
    
    return False

def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        
        # Check for .env file access (blocks access to sensitive environment files)
        if is_env_file_access(tool_name, tool_input):
            print("BLOCKED: Access to .env files containing sensitive data is prohibited", file=sys.stderr)
            print("Use .env.sample for template files instead", file=sys.stderr)
            sys.exit(2)  # Exit code 2 blocks tool call and shows error to Claude
        
        # Check for dangerous rm -rf commands
        if tool_name == 'Bash':
            command = tool_input.get('command', '')
            
            # Block rm -rf commands with comprehensive pattern matching
            if is_dangerous_rm_command(command):
                print("BLOCKED: Dangerous rm command detected and prevented", file=sys.stderr)
                sys.exit(2)  # Exit code 2 blocks tool call and shows error to Claude
        
        # Check for .claude/commands/ file access - NOW JUST A WARNING
        if is_command_file_access(tool_name, tool_input):
            file_path = tool_input.get('file_path', '')
            print(f"📝 Command Template Reminder: Editing {file_path}", file=sys.stderr)
            
            # Template file to read
            template_file = find_template_file()
            if template_file and os.path.exists(template_file):
                print(f"💡 Reference template: {template_file}", file=sys.stderr)
                print("🔑 Key requirements:", file=sys.stderr)
                print("   • 6-part structure: YAML frontmatter, heading, description, arguments, instructions, context", file=sys.stderr)
                print("   • Use action verbs and keep descriptions under 80 characters", file=sys.stderr)
                print("   • Include dynamic data gathering with ! commands", file=sys.stderr)
                print("   • Reference files with @ syntax", file=sys.stderr)
                print("   • Follow consistent naming and formatting patterns", file=sys.stderr)
                print("", file=sys.stderr)
            # NOTE: No longer blocking - just providing helpful reminder
        
        # Check for date-sensitive content
        if check_date_awareness(tool_name, tool_input):
            if not check_recent_date_command():
                print("📅 Date Awareness Check: Content contains date references", file=sys.stderr)
                print("⚠️  WARNING: You're writing date-sensitive content without verifying the current date!", file=sys.stderr)
                print("💡 Recommendation: Run 'date' command first to ensure accuracy", file=sys.stderr)
                print("", file=sys.stderr)
                print("🗓️  Common date hallucination patterns detected:", file=sys.stderr)
                print("   • Month/Year references (e.g., 'January 2025')", file=sys.stderr)
                print("   • Quarter references (e.g., 'Q1 2025')", file=sys.stderr)
                print("   • Relative dates (e.g., 'next quarter', 'by end of 2025')", file=sys.stderr)
                print("", file=sys.stderr)
                print("✅ To proceed accurately: Run the Bash tool with command 'date' first", file=sys.stderr)
                # Note: This is a warning, not a block - allows Claude to decide
                # If you want to enforce it, change to sys.exit(2)
        
        # Ensure log directory exists
        log_dir = Path.cwd() / 'logs'
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / 'pre_tool_use.json'
        
        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []
        
        # Append new data
        log_data.append(input_data)
        
        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Gracefully handle JSON decode errors
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)

if __name__ == '__main__':
    main()