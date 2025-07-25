#!/usr/bin/env python3
"""
Claude Code Hook: Command Template Guard
Prevents creation/editing of .claude/commands/ files without reading template first
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path


def main():
    # Get the tool being used and the file path
    tool_name = os.environ.get('CLAUDE_TOOL', '')
    
    # Only check Write, Edit, and MultiEdit tools
    if tool_name not in ['Write', 'Edit', 'MultiEdit']:
        sys.exit(0)
    
    # Get the file path from environment variables
    file_path = (
        os.environ.get('CLAUDE_TOOL_WRITE_PATH') or
        os.environ.get('CLAUDE_TOOL_EDIT_PATH') or 
        os.environ.get('CLAUDE_TOOL_MULTIEDIT_PATH', '')
    )
    
    if not file_path:
        sys.exit(0)
    
    # Check if this is a .claude/commands/ file
    normalized_path = os.path.normpath(file_path)
    if '/.claude/commands/' not in normalized_path and not normalized_path.endswith('/.claude/commands'):
        sys.exit(0)
    
    # Only check .md files in commands directory
    if not file_path.endswith('.md'):
        sys.exit(0)
    
    print(f"🔒 Command Template Guard: Checking access to {file_path}")
    
    # Template file to read
    template_file = find_template_file()
    if not template_file:
        print("❌ Error: Custom command template not found!")
        print("📝 Expected: ai-docs/custom-command-template.yaml")
        sys.exit(2)
    
    # Check if template has been read and understood
    if not check_template_understanding(template_file):
        print("❌ BLOCKED: You must read and understand the custom command template first!")
        print(f"📖 Please read: {template_file}")
        print("💡 After reading, confirm understanding by echoing:")
        print("   'I have read and understood the custom command template requirements'")
        print("")
        print("🔑 Key requirements from template:")
        print("   • 6-part structure: YAML frontmatter, heading, description, arguments, instructions, context")
        print("   • Use action verbs and keep descriptions under 80 characters")
        print("   • Include dynamic data gathering with ! commands")
        print("   • Reference files with @ syntax")
        print("   • Follow consistent naming and formatting patterns")
        sys.exit(2)
    
    print("✅ Template understanding confirmed. Access granted.")
    sys.exit(0)

def find_template_file():
    """Find the custom command template file"""
    possible_paths = [
        "ai-docs/custom-command-template.yaml",
        "./ai-docs/custom-command-template.yaml",
        "../ai-docs/custom-command-template.yaml",
        "ai_docs/custom-command-template.yaml",
        "./ai_docs/custom-command-template.yaml"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    return None

def check_template_understanding(template_file):
    """Check if the template has been read and understanding confirmed"""
    
    # Create a session state directory
    session_dir = Path.home() / '.claude' / 'session_state'
    session_dir.mkdir(parents=True, exist_ok=True)
    
    # State file for template understanding
    state_file = session_dir / 'template_understanding.json'
    
    # Check recent understanding confirmation
    if state_file.exists():
        try:
            with open(state_file, 'r') as f:
                state = json.load(f)
            
            # Check if understanding was confirmed recently (within 24 hours)
            last_confirmation = state.get('last_confirmation', 0)
            template_hash = state.get('template_hash', '')
            
            # Get current template hash
            current_hash = get_file_hash(template_file)
            
            # If template unchanged and confirmed recently, allow access
            if (template_hash == current_hash and 
                time.time() - last_confirmation < 86400):  # 24 hours
                return True
                
        except (json.JSONDecodeError, FileNotFoundError):
            pass
    
    # Check if understanding was just echoed in recent logs
    return check_recent_understanding_confirmation(template_file, state_file)

def check_recent_understanding_confirmation(template_file, state_file):
    """Check logs for recent understanding confirmation"""
    
    # First, check for a temporary confirmation file that Claude can create
    temp_confirmation_file = Path.home() / '.claude' / 'session_state' / 'template_confirmed.tmp'
    if temp_confirmation_file.exists():
        try:
            # Check if file was created recently (within 10 minutes)
            file_stat = temp_confirmation_file.stat()
            if time.time() - file_stat.st_mtime < 600:  # 10 minutes
                # Save permanent confirmation and remove temp file
                save_understanding_confirmation(template_file, state_file)
                temp_confirmation_file.unlink()
                return True
        except (FileNotFoundError, PermissionError):
            pass
    
    # Look for recent echo of understanding in logs as fallback
    log_paths = [
        Path.home() / '.claude' / 'logs' / 'chat.json',
        Path('logs/chat.json'),
        Path('../logs/chat.json')
    ]
    
    understanding_phrases = [
        "I have read and understood the custom command template requirements",
        "I understand the custom command template requirements",
        "I have read and understand the template",
        "Template requirements understood"
    ]
    
    for log_path in log_paths:
        if log_path.exists():
            try:
                # Check last 10 minutes of logs
                cutoff_time = time.time() - 600  # 10 minutes
                
                with open(log_path, 'r') as f:
                    content = f.read()
                    
                    # Check if any understanding phrase exists in recent content
                    # Simple approach: check if phrases exist in the log file
                    content_lower = content.lower()
                    for phrase in understanding_phrases:
                        if phrase.lower() in content_lower:
                            # Save confirmation state
                            save_understanding_confirmation(template_file, state_file)
                            return True
            except (FileNotFoundError, PermissionError):
                continue
    
    return False

def save_understanding_confirmation(template_file, state_file):
    """Save the understanding confirmation state"""
    state = {
        'last_confirmation': time.time(),
        'template_hash': get_file_hash(template_file),
        'template_path': template_file
    }
    
    try:
        with open(state_file, 'w') as f:
            json.dump(state, f)
    except (FileNotFoundError, PermissionError):
        pass

def get_file_hash(file_path):
    """Get SHA256 hash of file content"""
    try:
        with open(file_path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except (FileNotFoundError, PermissionError):
        return ""

if __name__ == "__main__":
    main()