#!/usr/bin/env -S uv run --script

# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import hashlib
import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

# Simple file validation cache to prevent redundant work
validation_cache = {}
CACHE_TTL = timedelta(minutes=5)

def get_file_hash(file_path: str) -> Optional[str]:
    """Generate file hash for cache key"""
    try:
        path = Path(file_path)
        if not path.exists():
            return None
        
        content = path.read_text(encoding='utf-8')
        mtime = path.stat().st_mtime
        return hashlib.md5(f"{content}{mtime}".encode()).hexdigest()
    except Exception:
        return None

def is_cached_valid(file_path: str) -> Optional[Dict[str, Any]]:
    """Check if file was recently validated"""
    file_hash = get_file_hash(file_path)
    if not file_hash:
        return None
    
    cache_key = f"{file_path}:{file_hash}"
    cached = validation_cache.get(cache_key)
    
    if cached and datetime.now() - cached['timestamp'] < CACHE_TTL:
        return cached['result']
    
    return None

def cache_result(file_path: str, result: Dict[str, Any]):
    """Cache validation result"""
    file_hash = get_file_hash(file_path)
    if not file_hash:
        return
    
    cache_key = f"{file_path}:{file_hash}"
    validation_cache[cache_key] = {
        'result': result,
        'timestamp': datetime.now()
    }

def should_validate_file(file_path: str, project_type: str) -> bool:
    """Check if file should be validated"""
    if not file_path:
        return False
    
    # Skip non-existent files
    if not Path(file_path).exists():
        return False
    
    # Get file extension
    ext = Path(file_path).suffix
    
    # Check based on project type
    if project_type == 'javascript':
        return ext in ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
    elif project_type == 'python':
        return ext in ['.py', '.pyi']
    elif project_type == 'rust':
        return ext in ['.rs']
    elif project_type == 'go':
        return ext in ['.go']
    
    # For unknown project types, try to validate common code files
    return ext in ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go']

def detect_package_manager() -> str:
    """Detect which package manager to use based on project files"""
    project_root = Path.cwd()
    
    # Check for lock files in order of preference
    if (project_root / 'pnpm-lock.yaml').exists():
        return 'pnpm'
    elif (project_root / 'yarn.lock').exists():
        return 'yarn'
    elif (project_root / 'package-lock.json').exists():
        return 'npm'
    
    # Fallback to npm if no lock file found
    return 'npm'

def detect_project_type() -> str:
    """Detect project type based on files and dependencies"""
    project_root = Path.cwd()
    
    # Check for Python files
    if (project_root / 'pyproject.toml').exists() or (project_root / 'requirements.txt').exists():
        return 'python'
    
    # Check for Rust files
    if (project_root / 'Cargo.toml').exists():
        return 'rust'
    
    # Check for package.json (JavaScript/TypeScript)
    if (project_root / 'package.json').exists():
        return 'javascript'
    
    # Check for Go files
    if (project_root / 'go.mod').exists():
        return 'go'
    
    return 'unknown'

def get_available_linters(project_type: str) -> list:
    """Get available linting tools for the project"""
    linters = []
    project_root = Path.cwd()
    
    if project_type == 'python':
        # Check for Python linters
        if subprocess.run(['which', 'ruff'], capture_output=True).returncode == 0:
            linters.append(('ruff', ['ruff', 'check', '--fix']))
        if subprocess.run(['which', 'black'], capture_output=True).returncode == 0:
            linters.append(('black', ['black', '.']))
        if subprocess.run(['which', 'flake8'], capture_output=True).returncode == 0:
            linters.append(('flake8', ['flake8']))
        if subprocess.run(['which', 'pylint'], capture_output=True).returncode == 0:
            linters.append(('pylint', ['pylint']))
    
    elif project_type == 'javascript':
        package_manager = detect_package_manager()
        
        # Check package.json for available scripts and dependencies
        package_json_path = project_root / 'package.json'
        if package_json_path.exists():
            try:
                with open(package_json_path) as f:
                    package_data = json.load(f)
                
                scripts = package_data.get('scripts', {})
                deps = {**package_data.get('dependencies', {}), **package_data.get('devDependencies', {})}
                
                # Check for common linting scripts
                if 'lint' in scripts:
                    linters.append(('lint', [package_manager, 'run', 'lint']))
                if 'lint:fix' in scripts:
                    linters.append(('lint:fix', [package_manager, 'run', 'lint:fix']))
                
                # Check for Biome
                if 'biome' in scripts or '@biomejs/biome' in deps:
                    linters.append(('biome', [package_manager, 'biome', 'check', '--apply']))
                
                # Check for ESLint
                if 'eslint' in deps:
                    linters.append(('eslint', [package_manager, 'run', 'lint']))
                
                # Check for Prettier
                if 'prettier' in deps:
                    linters.append(('prettier', [package_manager, 'run', 'format']))
                
            except (json.JSONDecodeError, FileNotFoundError):
                pass
    
    elif project_type == 'rust':
        # Check for Rust tools
        if subprocess.run(['which', 'cargo'], capture_output=True).returncode == 0:
            linters.append(('clippy', ['cargo', 'clippy', '--fix', '--allow-dirty']))
            linters.append(('fmt', ['cargo', 'fmt']))
    
    elif project_type == 'go':
        # Check for Go tools
        if subprocess.run(['which', 'go'], capture_output=True).returncode == 0:
            linters.append(('fmt', ['go', 'fmt', './...']))
            linters.append(('vet', ['go', 'vet', './...']))
        if subprocess.run(['which', 'golangci-lint'], capture_output=True).returncode == 0:
            linters.append(('golangci-lint', ['golangci-lint', 'run', '--fix']))
    
    return linters

def get_available_type_checkers(project_type: str) -> list:
    """Get available type checking tools for the project"""
    type_checkers = []
    project_root = Path.cwd()
    
    if project_type == 'python':
        if subprocess.run(['which', 'mypy'], capture_output=True).returncode == 0:
            type_checkers.append(('mypy', ['mypy', '.']))
        if subprocess.run(['which', 'pyright'], capture_output=True).returncode == 0:
            type_checkers.append(('pyright', ['pyright']))
    
    elif project_type == 'javascript':
        package_manager = detect_package_manager()
        package_json_path = project_root / 'package.json'
        
        if package_json_path.exists():
            try:
                with open(package_json_path) as f:
                    package_data = json.load(f)
                
                scripts = package_data.get('scripts', {})
                deps = {**package_data.get('dependencies', {}), **package_data.get('devDependencies', {})}
                
                # Check for TypeScript
                if 'typecheck' in scripts:
                    type_checkers.append(('typecheck', [package_manager, 'run', 'typecheck']))
                elif 'typescript' in deps:
                    type_checkers.append(('tsc', [package_manager, 'tsc', '--noEmit']))
                
            except (json.JSONDecodeError, FileNotFoundError):
                pass
    
    elif project_type == 'rust':
        # Rust has built-in type checking via cargo check
        if subprocess.run(['which', 'cargo'], capture_output=True).returncode == 0:
            type_checkers.append(('check', ['cargo', 'check']))
    
    elif project_type == 'go':
        # Go has built-in type checking via go build
        if subprocess.run(['which', 'go'], capture_output=True).returncode == 0:
            type_checkers.append(('build', ['go', 'build', './...']))
    
    return type_checkers

def run_linting_checks(file_path: str, project_type: str) -> list:
    """Run all available linting checks"""
    results = []
    linters = get_available_linters(project_type)
    
    if not linters:
        return [{
            'success': True,
            'message': 'ℹ️ No linters available, skipping checks',
            'output': ''
        }]
    
    for linter_name, linter_cmd in linters:
        try:
            # For file-specific linters, add the file path
            if linter_name in ['ruff', 'biome'] and file_path:
                cmd = linter_cmd + [file_path]
            else:
                cmd = linter_cmd
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            results.append({
                'success': True,
                'message': f'✅ {linter_name} check passed for {Path(file_path).name if file_path else "project"}',
                'output': result.stdout,
                'linter': linter_name
            })
            
        except subprocess.CalledProcessError as error:
            error_output = error.stdout or error.stderr or str(error)
            
            results.append({
                'success': False,
                'message': f'❌ {linter_name} found issues in {Path(file_path).name if file_path else "project"}',
                'output': error_output,
                'fix': f'Run: {" ".join(cmd)}',
                'linter': linter_name
            })
            
        except FileNotFoundError:
            results.append({
                'success': True,
                'message': f'ℹ️ {linter_name} not available, skipping check',
                'output': '',
                'linter': linter_name
            })
    
    return results

def run_type_checks(project_type: str) -> list:
    """Run all available type checking"""
    results = []
    type_checkers = get_available_type_checkers(project_type)
    
    if not type_checkers:
        return [{
            'success': True,
            'message': 'ℹ️ No type checkers available, skipping checks',
            'output': ''
        }]
    
    for checker_name, checker_cmd in type_checkers:
        try:
            result = subprocess.run(
                checker_cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            results.append({
                'success': True,
                'message': f'✅ {checker_name} type check passed',
                'output': result.stdout,
                'checker': checker_name
            })
            
        except subprocess.CalledProcessError as error:
            error_output = error.stdout or error.stderr or str(error)
            
            results.append({
                'success': False,
                'message': f'❌ {checker_name} type check failed',
                'output': error_output,
                'fix': f'Run: {" ".join(checker_cmd)}',
                'checker': checker_name
            })
            
        except FileNotFoundError:
            results.append({
                'success': True,
                'message': f'ℹ️ {checker_name} not available, skipping check',
                'output': '',
                'checker': checker_name
            })
    
    return results

def validate_file(file_path: str) -> Dict[str, Any]:
    """Validate a single file"""
    # Check cache first
    cached = is_cached_valid(file_path)
    if cached:
        return cached
    
    # Detect project type
    project_type = detect_project_type()
    
    # Check if file should be validated
    if not should_validate_file(file_path, project_type):
        result = {
            'approve': True,
            'message': f'ℹ️ Skipped {Path(file_path).name} (not a supported file type for {project_type} project)'
        }
        return result
    
    # Run linting checks
    lint_results = run_linting_checks(file_path, project_type)
    
    # Run type checking (project-wide)
    type_results = run_type_checks(project_type)
    
    # Combine all results
    all_results = lint_results + type_results
    all_passed = all(result['success'] for result in all_results)
    
    if all_passed:
        successful_tools = [r.get('linter', r.get('checker', 'tool')) for r in all_results if r['success']]
        tools_used = ', '.join(filter(None, successful_tools))
        result = {
            'approve': True,
            'message': f'✅ All checks passed for {Path(file_path).name}' + (f' ({tools_used})' if tools_used else '')
        }
    else:
        issues = []
        fixes = []
        
        for check_result in all_results:
            if not check_result['success']:
                issues.append(check_result['message'])
                if 'fix' in check_result:
                    fixes.append(check_result['fix'])
        
        message_parts = ['❌ Validation failed:'] + issues
        if fixes:
            message_parts.extend(['', '🔧 Fixes:'] + fixes)
        
        result = {
            'approve': False,
            'message': '\n'.join(message_parts)
        }
    
    # Cache result
    cache_result(file_path, result)
    
    return result

def main():
    """Main execution"""
    try:
        input_data = json.load(sys.stdin)
        
        # Extract file path from tool input
        tool_input = input_data.get('tool_input', {})
        file_path = tool_input.get('file_path')
        
        if not file_path:
            # No file path provided, approve by default
            result = {
                'approve': True,
                'message': 'ℹ️ No file path provided, skipping validation'
            }
        else:
            # Show user-friendly message that linter is running
            file_name = Path(file_path).name if file_path else "file"
            print(f"🔍 Running linter on {file_name}...", file=sys.stderr)
            
            result = validate_file(file_path)
            
            # Show result to user
            if result.get('approve', True):
                print(f"✨ Linting complete for {file_name}", file=sys.stderr)
            else:
                print(f"🔧 Linter found issues in {file_name} (see details above)", file=sys.stderr)
        
        print(json.dumps(result))
        
    except Exception as error:
        print(json.dumps({
            'approve': True,
            'message': f'Universal linter error: {error}'
        }))


if __name__ == '__main__':
    main()