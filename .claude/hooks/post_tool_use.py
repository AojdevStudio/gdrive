#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import sys
import subprocess
from pathlib import Path


def check_and_fix_structure():
    """Run structure enforcement after file operations."""
    try:
        # Only run structure check for file-writing tools
        project_root = Path.cwd()
        enforce_script = project_root / 'src' / 'commands' / 'enforce-structure.js'
        
        if enforce_script.exists():
            # Run structure enforcement with auto-fix
            result = subprocess.run(
                ['node', str(enforce_script), '--fix'],
                capture_output=True,
                text=True,
                cwd=project_root
            )
            
            # If violations were found and fixed, print the output
            if result.returncode == 0 and 'Fixed' in result.stdout:
                print("🔧 Structure enforcement auto-fix applied:", file=sys.stderr)
                print(result.stdout, file=sys.stderr)
                
    except Exception:
        # Don't fail the hook if structure enforcement fails
        pass


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Check if this was a file-writing operation
        tool_name = input_data.get('tool_name', '')
        file_writing_tools = {'Write', 'Edit', 'MultiEdit'}
        
        # Run structure enforcement for file-writing tools
        if tool_name in file_writing_tools:
            check_and_fix_structure()
        
        # Ensure log directory exists
        log_dir = Path.cwd() / 'logs'
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / 'post_tool_use.json'
        
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
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Exit cleanly on any other error
        sys.exit(0)

if __name__ == '__main__':
    main()