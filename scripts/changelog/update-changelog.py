#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "gitpython>=3.1.0",
#   "semver>=3.0.0",
#   "click>=8.0.0",
#   "colorama>=0.4.0",
# ]
# requires-python = ">=3.8"
# ///
"""
CDEV Changelog Update Script

Production-ready changelog automation script following ai-docs/changelog-conventions.md
Supports automatic git analysis and manual entry modes

Usage:
  python update-changelog.py [version] [--auto|--manual] [--dry-run]

Examples:
  python update-changelog.py 1.5.0 --auto          # Auto-analyze git commits
  python update-changelog.py 1.5.0 --manual        # Interactive mode
  python update-changelog.py --auto --dry-run      # Preview without changes
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

import click
from colorama import Fore, Style, init

# Import utility functions from utils.py
try:
    from utils import (
        validate_version,
        parse_commits,
        format_changelog,
        update_changelog_file,
        get_next_version,
    )
except ImportError:
    # If utils.py is not available, we'll inline minimal functions
    print(f"{Fore.RED}Warning: Could not import utils.py. Using minimal inline functions.")
    
    import re
    import git
    import semver
    from datetime import datetime
    
    def validate_version(version: str) -> bool:
        try:
            semver.VersionInfo.parse(version)
            return True
        except ValueError:
            return False
    
    def parse_commits():
        # Minimal implementation
        try:
            repo = git.Repo(".")
            try:
                last_tag = str(repo.git.describe("--tags", "--abbrev=0"))
                commits = list(repo.iter_commits(f"{last_tag}..HEAD"))
            except git.exc.GitCommandError:
                commits = list(repo.iter_commits())
            
            parsed_commits = []
            for commit in commits:
                subject = commit.message.split('\n')[0] if commit.message else ""
                if not subject.startswith("Merge "):
                    parsed_commits.append({
                        "hash": str(commit.hexsha)[:8],
                        "subject": subject,
                        "type": "change"  # Default type
                    })
            return parsed_commits
        except Exception:
            return []
    
    def format_changelog(changes: Dict[str, List[str]], version: str) -> str:
        today = datetime.now().date().isoformat()
        entry = f"## [{version}] - {today}\n"
        
        ordered_categories = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"]
        for category in ordered_categories:
            if changes.get(category) and len(changes[category]) > 0:
                entry += f"\n### {category}\n\n"
                for item in changes[category]:
                    entry += f"- {item}\n"
        return entry
    
    def update_changelog_file(changelog_entry: str, version: str) -> None:
        changelog_path = Path.cwd() / "CHANGELOG.md"
        if not changelog_path.exists():
            raise FileNotFoundError(f"CHANGELOG.md not found at {changelog_path}")
        
        current_content = changelog_path.read_text(encoding="utf-8")
        unreleased_pattern = r"## \[Unreleased\]\s*\n"
        match = re.search(unreleased_pattern, current_content)
        
        if not match:
            raise ValueError("Could not find [Unreleased] section in CHANGELOG.md")
        
        before_unreleased = current_content[:match.end()]
        after_unreleased = current_content[match.end():]
        new_content = before_unreleased + "\n" + changelog_entry + "\n" + after_unreleased
        
        changelog_path.write_text(new_content, encoding="utf-8")
    
    def get_next_version(current_version: str, auto_mode: bool = False, force_mode: bool = False) -> str:
        if force_mode or auto_mode:
            # Default to patch bump
            return str(semver.VersionInfo.parse(current_version).bump_patch())
        else:
            print("Version bump options:")
            print("1. Patch (bug fixes)")
            print("2. Minor (new features)")
            print("3. Major (breaking changes)")
            print("4. Custom version")
            
            choice = input("Enter choice (1-4): ").strip()
            current_ver = semver.VersionInfo.parse(current_version)
            
            if choice == "1":
                return str(current_ver.bump_patch())
            elif choice == "2":
                return str(current_ver.bump_minor())
            elif choice == "3":
                return str(current_ver.bump_major())
            elif choice == "4":
                custom = input("Enter custom version: ").strip()
                if validate_version(custom):
                    return custom
                else:
                    raise ValueError("Invalid version format")
            else:
                raise ValueError("Invalid choice")

# Initialize colorama for cross-platform color support
init(autoreset=True)

# Configuration
CHANGELOG_PATH = Path.cwd() / "CHANGELOG.md"
PACKAGE_JSON_PATH = Path.cwd() / "package.json"


def update_changelog(version: Optional[str], auto: bool, manual: bool, dry_run: bool, 
                    verbose: bool, force: bool) -> None:
    """
    Main changelog update function
    """
    try:
        print(f"{Fore.BLUE}🔄 CDEV Changelog Updater\n")

        # Validate environment
        if not CHANGELOG_PATH.exists():
            raise FileNotFoundError(f"CHANGELOG.md not found at {CHANGELOG_PATH}")

        # Determine version
        if not version:
            if PACKAGE_JSON_PATH.exists():
                package_json = json.loads(PACKAGE_JSON_PATH.read_text())
                current_version = package_json.get("version", "0.1.0")
            else:
                # Default version if no package.json exists
                current_version = "0.1.0"
            version = get_next_version(current_version, auto, force)

        # Validate version format
        if not validate_version(version):
            raise ValueError(f"Invalid version format: {version}. Expected format: X.Y.Z")

        print(f"{Fore.GREEN}📝 Updating changelog for version {version}")

        # Get changes based on mode
        if auto or force:
            if force and manual:
                print(f"{Fore.YELLOW}⚠️  Force mode overrides manual mode - using auto mode")
            print(f"{Fore.BLUE}🔍 Analyzing git commits since last release...\n")
            changes = get_changes_from_git()
        else:
            print(f"{Fore.BLUE}✏️  Manual entry mode\n")
            changes = get_changes_manually()

        # Validate changes
        if not changes or not any(changes.get(key) for key in changes):
            print(f"{Fore.YELLOW}⚠️  No changes detected. Aborting.")
            return

        # Format changelog entry
        changelog_entry = format_changelog(changes, version)

        # Preview changes
        print(f"{Fore.BLUE}\n📋 Preview of changelog entry:")
        print(f"{Fore.CYAN}{'─' * 60}")
        print(changelog_entry)
        print(f"{Fore.CYAN}{'─' * 60}")

        # Confirm or dry-run
        if dry_run:
            print(f"{Fore.YELLOW}\n🔍 Dry run complete. No files were modified.")
            return

        # Skip confirmation if force flag is set
        if not force:
            confirm = input(f"\n{Fore.BLUE}Add this entry to CHANGELOG.md? (y/N): ").strip().lower()
            if confirm not in ['y', 'yes']:
                print(f"{Fore.YELLOW}❌ Changelog update cancelled.")
                return
        else:
            print(f"{Fore.GREEN}\n🚀 Force mode enabled - automatically proceeding...")

        # Update changelog file
        update_changelog_file(changelog_entry, version)

        print(f"{Fore.GREEN}✅ Successfully updated CHANGELOG.md for version {version}")
        print(f"{Fore.BLUE}📁 File location: {CHANGELOG_PATH}")

        # Suggest next steps
        print(f"{Fore.BLUE}\n💡 Next steps:")
        print(f"{Fore.CYAN}   1. Review the changes in CHANGELOG.md")
        print(f"{Fore.CYAN}   2. Update package.json version if needed")
        print(f"{Fore.CYAN}   3. Commit changes: git add CHANGELOG.md && git commit -m \"docs: update changelog for v{version}\"")
        print(f"{Fore.CYAN}   4. Create release tag: git tag v{version}")

    except Exception as error:
        print(f"{Fore.RED}❌ Error updating changelog: {error}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


def get_changes_from_git() -> Optional[Dict[str, List[str]]]:
    """
    Get changes from git commits since last tag
    """
    try:
        commits = parse_commits()

        if not commits:
            print(f"{Fore.YELLOW}⚠️  No commits found since last release.")
            return None

        print(f"{Fore.GREEN}📊 Found {len(commits)} commits to analyze\n")

        # Group commits by type
        changes = {
            "Added": [],
            "Changed": [],
            "Deprecated": [],
            "Removed": [],
            "Fixed": [],
            "Security": [],
        }

        for commit in commits:
            pr_info = f" [#{commit['pr']}]" if commit.get('pr') else ""
            entry = f"{commit['subject']}{pr_info}"

            commit_type = commit.get("type", "change")
            
            if commit_type in ["feat", "add"]:
                changes["Added"].append(entry)
            elif commit_type in ["fix", "bugfix"]:
                changes["Fixed"].append(entry)
            elif commit_type in ["refactor", "perf", "improve"]:
                changes["Changed"].append(entry)
            elif commit_type == "remove":
                changes["Removed"].append(entry)
            elif commit_type == "security":
                changes["Security"].append(entry)
            elif commit_type == "deprecate":
                changes["Deprecated"].append(entry)
            else:
                # Default to Changed for misc commits
                if commit_type not in ["docs", "test", "chore", "style"]:
                    changes["Changed"].append(entry)

        # Show summary
        for category, items in changes.items():
            if items:
                print(f"{Fore.BLUE}{category}: {len(items)} items")

        return changes

    except Exception as error:
        print(f"{Fore.RED}Error parsing git commits: {error}")
        raise error


def get_changes_manually() -> Dict[str, List[str]]:
    """
    Get changes through manual entry
    """
    changes = {
        "Added": [],
        "Changed": [],
        "Deprecated": [],
        "Removed": [],
        "Fixed": [],
        "Security": [],
    }

    descriptions = {
        "Added": "new features or capabilities",
        "Changed": "changes in existing functionality",
        "Deprecated": "features that will be removed in future versions",
        "Removed": "features that have been removed",
        "Fixed": "bug fixes",
        "Security": "security-related changes",
    }

    print(f"{Fore.BLUE}📝 Enter changes for each category (press Enter with empty line to finish each section)\n")

    for category, description in descriptions.items():
        print(f"\n{Fore.BLUE}{category} ({description}):")
        
        items = []
        while True:
            item = input(f"  {category} item (empty to finish): ").strip()
            if not item:
                break
            items.append(item)
        
        changes[category] = items

    return changes


@click.command()
@click.argument('version', required=False)
@click.option('--auto', is_flag=True, help='Automatically analyze git commits since last release')
@click.option('--manual', is_flag=True, help='Manual entry mode')
@click.option('--dry-run', is_flag=True, help='Preview changes without modifying files')
@click.option('--verbose', is_flag=True, help='Show detailed error information')
@click.option('--force', is_flag=True, help='Skip all confirmation prompts for autonomous execution')
def main(version: Optional[str], auto: bool, manual: bool, dry_run: bool, verbose: bool, force: bool):
    """
    Update CHANGELOG.md with new version entries
    
    Examples:
      python update-changelog.py 1.5.0 --auto          # Auto-analyze git commits
      python update-changelog.py 1.5.0 --manual        # Interactive mode  
      python update-changelog.py --auto --dry-run      # Preview without changes
    """
    # Default to auto mode if neither specified
    if not auto and not manual:
        auto = True

    update_changelog(version, auto, manual, dry_run, verbose, force)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Operation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"{Fore.RED}Unexpected error: {e}")
        sys.exit(1)