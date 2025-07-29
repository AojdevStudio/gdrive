#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = []
# ///

import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path


def run_git_command(command: list[str]) -> subprocess.CompletedProcess:
    """Run a git command and return the completed process."""
    try:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            cwd=Path.cwd()
        )
    except subprocess.CalledProcessError as e:
        print(f"Git command failed: {' '.join(command)}")
        print(f"Error: {e.stderr}")
        sys.exit(1)


def count_changed_files(max_count: int = 6) -> int:
    """
    Count all changed files (staged, unstaged, and untracked) with early exit.
    Ignores files in .gitignore. Returns count up to max_count.
    """
    changed_files = set()
    
    try:
        # 1. Get unstaged changes (working tree vs index)
        result = subprocess.run(
            ["git", "diff-files", "--name-only"],
            capture_output=True,
            text=True,
            check=True
        )
        if result.stdout.strip():
            changed_files.update(result.stdout.strip().split('\n'))
            if len(changed_files) >= max_count:
                return max_count
        
        # 2. Get staged changes (index vs HEAD)
        result = subprocess.run(
            ["git", "diff-index", "--cached", "--name-only", "HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        if result.stdout.strip():
            changed_files.update(result.stdout.strip().split('\n'))
            if len(changed_files) >= max_count:
                return max_count
        
        # 3. Get untracked files (respects .gitignore)
        result = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard"],
            capture_output=True,
            text=True,
            check=True
        )
        if result.stdout.strip():
            changed_files.update(result.stdout.strip().split('\n'))
        
        return min(len(changed_files), max_count)
        
    except subprocess.CalledProcessError:
        # If git command fails, assume no changes
        return 0


def check_git_repository() -> bool:
    """Check if we're in a git repository."""
    try:
        subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
            check=True
        )
        return True
    except subprocess.CalledProcessError:
        return False


def request_claude_commit():
    """Request Claude Code to make a commit by echoing the appropriate message."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    commit_message = f"Auto-commit: 5+ file changes detected at {timestamp}"
    
    # Echo a message that Claude Code can interpret as a commit request
    print(f"CLAUDE_COMMIT_REQUEST: {commit_message}")
    print(f"🔄 Requesting Claude Code to stage and commit changes...")


def main():
    """Main execution function."""
    print("🔍 Checking for file changes...")
    
    # Verify we're in a git repository
    if not check_git_repository():
        print("❌ Not in a git repository. Exiting.")
        sys.exit(1)
    
    # Count changed files with early exit at 6
    changed_count = count_changed_files(max_count=6)
    
    print(f"📊 Found {changed_count} changed file(s)")
    
    # Check if we hit the threshold
    if changed_count >= 5:
        print("🚨 Threshold reached: 5+ files changed")
        request_claude_commit()
    else:
        print(f"✅ Below threshold: {changed_count}/5 files changed")


if __name__ == "__main__":
    main() 