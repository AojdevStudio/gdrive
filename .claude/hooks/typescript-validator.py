#!/usr/bin/env -S uv run --script

# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import hashlib
import json
import logging
import os
import re
import subprocess
import sys
import threading
from collections import OrderedDict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

# Configure logging for cache operations
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# Thread-safe LRU cache with size limit
class ThreadSafeLRUCache:
    def __init__(self, max_size: int = 100, ttl: timedelta = timedelta(minutes=5)):
        self.max_size = max_size
        self.ttl = ttl
        self._cache: OrderedDict = OrderedDict()
        self._lock = threading.RLock()
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get cached value if exists and not expired"""
        with self._lock:
            if key not in self._cache:
                return None
            
            entry = self._cache[key]
            if datetime.now() - entry['timestamp'] >= self.ttl:
                # Remove expired entry
                del self._cache[key]
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            return entry['result']
    
    def set(self, key: str, value: Dict[str, Any]) -> None:
        """Set cached value with automatic cleanup"""
        with self._lock:
            # Remove oldest entries if at capacity
            while len(self._cache) >= self.max_size:
                self._cache.popitem(last=False)
            
            self._cache[key] = {
                'result': value,
                'timestamp': datetime.now()
            }
            # Move to end
            self._cache.move_to_end(key)
    
    def clear_expired(self) -> int:
        """Clear expired entries and return count removed"""
        with self._lock:
            current_time = datetime.now()
            expired_keys = [
                key for key, entry in self._cache.items()
                if current_time - entry['timestamp'] >= self.ttl
            ]
            
            for key in expired_keys:
                del self._cache[key]
            
            return len(expired_keys)
    
    def size(self) -> int:
        """Get current cache size"""
        with self._lock:
            return len(self._cache)

# Global cache instance
validation_cache = ThreadSafeLRUCache(max_size=100, ttl=timedelta(minutes=5))
CACHE_TTL = timedelta(minutes=5)

# Configuration
DEBUG_MODE = os.environ.get('CLAUDE_HOOKS_DEBUG') == '1'
FAST_MODE = '--fast' in sys.argv
ZERO_TOLERANCE = os.environ.get('CLAUDE_HOOKS_ZERO_TOLERANCE', 'true').lower() != 'false'


class TypeScriptValidator:
    def __init__(self, hook_input: Dict[str, Any]):
        self.hook_input = hook_input
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.violations: List[Dict[str, Any]] = []
        self.blockers: List[str] = []
        self.results: Dict[str, Any] = {
            'biome': None,
            'typecheck': None,
            'codeStandards': None
        }

    async def validate(self) -> Dict[str, Any]:
        """Main validation entry point"""
        tool_name = self.hook_input.get('tool_name')
        tool_input = self.hook_input.get('tool_input')
        phase = self.hook_input.get('phase')
        
        # Extract file path and determine if we should validate
        file_path = self.extract_file_path(tool_input)
        if not file_path or not self.should_validate_file(file_path):
            return self.approve('File skipped - not a TypeScript/JavaScript file')

        # Check cache first
        cached = self.get_cached_result(file_path)
        if cached and not FAST_MODE:
            if DEBUG_MODE:
                print(f"Using cached TypeScript validation for: {file_path}", file=sys.stderr)
            return cached

        # Determine validation mode based on phase and context
        validation_mode = self.determine_validation_mode(tool_input, phase)
        if DEBUG_MODE:
            print(f"TypeScript validation mode: {validation_mode['type']} ({validation_mode['reason']})", file=sys.stderr)

        # Run validation steps
        self.validate_biome(file_path, validation_mode)
        self.validate_typecheck(validation_mode)
        self.validate_coding_standards(tool_input, file_path)

        # Determine final result
        final_result = self.get_final_result()
        
        # Cache result
        self.cache_result(file_path, final_result)
        
        return final_result

    def extract_file_path(self, tool_input: Any) -> Optional[str]:
        """Extract file path from tool input"""
        if isinstance(tool_input, dict):
            return tool_input.get('file_path')
        return None

    def should_validate_file(self, file_path: str) -> bool:
        """Check if file should be validated"""
        if not file_path:
            return False
        
        ext = Path(file_path).suffix
        return ext in ['.ts', '.tsx', '.js', '.jsx']

    def get_cached_result(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get cached validation result"""
        try:
            if not Path(file_path).exists():
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            mtime = Path(file_path).stat().st_mtime
            # Use SHA-256 for better performance and security
            cache_key = hashlib.sha256(f"{content}{mtime}".encode()).hexdigest()
            
            return validation_cache.get(f"{file_path}:{cache_key}")
            
        except FileNotFoundError:
            logger.warning(f"File not found for cache lookup: {file_path}")
            return None
        except PermissionError:
            logger.warning(f"Permission denied reading file for cache: {file_path}")
            return None
        except UnicodeDecodeError:
            logger.warning(f"Unicode decode error reading file for cache: {file_path}")
            return None
        except OSError as e:
            logger.warning(f"OS error reading file for cache {file_path}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in cache lookup for {file_path}: {e}")
            return None

    def cache_result(self, file_path: str, result: Dict[str, Any]):
        """Cache validation result"""
        try:
            if not Path(file_path).exists():
                return
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            mtime = Path(file_path).stat().st_mtime
            # Use SHA-256 for better performance and security
            cache_key = hashlib.sha256(f"{content}{mtime}".encode()).hexdigest()
            
            validation_cache.set(f"{file_path}:{cache_key}", result)
            
            # Periodically clean up expired entries
            if validation_cache.size() > 80:  # Clean when 80% full
                expired_count = validation_cache.clear_expired()
                if expired_count > 0 and DEBUG_MODE:
                    logger.info(f"Cleaned {expired_count} expired cache entries")
                    
        except FileNotFoundError:
            logger.warning(f"File not found for caching: {file_path}")
        except PermissionError:
            logger.warning(f"Permission denied reading file for caching: {file_path}")
        except UnicodeDecodeError:
            logger.warning(f"Unicode decode error reading file for caching: {file_path}")
        except OSError as e:
            logger.warning(f"OS error reading file for caching {file_path}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error caching result for {file_path}: {e}")

    def determine_validation_mode(self, tool_input: Any, phase: Optional[str]) -> Dict[str, str]:
        """Determine validation mode based on phase and context"""
        if phase == 'Stop':
            return {'type': 'full', 'reason': 'Stop phase requires full validation'}
        
        if isinstance(tool_input, dict) and tool_input.get('file_path'):
            return {'type': 'file-specific', 'reason': 'File-specific validation'}
        
        return {'type': 'incremental', 'reason': 'Incremental validation'}

    def validate_biome(self, file_path: str, validation_mode: Dict[str, str]):
        """Run Biome validation (formatting, linting, imports)"""
        try:
            biome_command = self.build_biome_command(file_path, validation_mode)
            if DEBUG_MODE:
                print(f"Running: {' '.join(biome_command)}", file=sys.stderr)
            
            subprocess.run(biome_command, check=True, capture_output=True, text=True)
            
            self.results['biome'] = {'success': True, 'message': 'Biome validation passed'}
            
        except subprocess.CalledProcessError as error:
            error_output = error.stdout or error.stderr or str(error)
            
            # Parse Biome error types
            biome_errors = []
            if 'Format' in error_output:
                biome_errors.append(f'Biome formatting issues in {file_path}')
            if 'Lint' in error_output:
                biome_errors.append(f'Biome linting issues in {file_path}')
            if 'Organize imports' in error_output:
                biome_errors.append(f'Import organization issues in {file_path}')
            
            if not biome_errors:
                biome_errors.append(f'Biome check failed for {file_path}: {error_output[:200]}')
            
            self.errors.extend(biome_errors)
            self.results['biome'] = {
                'success': False,
                'errors': biome_errors,
                'fix': ("Run 'pnpm biome:check --apply' on changed files" if validation_mode['type'] == 'incremental'
                       else "Run 'pnpm biome:check --apply' and fix all remaining issues")
            }

    def validate_typecheck(self, validation_mode: Dict[str, str]):
        """Run TypeScript type checking"""
        try:
            typecheck_command = self.build_typecheck_command(validation_mode)
            if DEBUG_MODE:
                print(f"Running: {' '.join(typecheck_command)}", file=sys.stderr)
            
            subprocess.run(typecheck_command, check=True, capture_output=True, text=True)
            
            self.results['typecheck'] = {'success': True, 'message': 'TypeScript check passed'}
            
        except subprocess.CalledProcessError as error:
            error_output = error.stdout or error.stderr or str(error)
            
            self.errors.append(f'TypeScript type errors: {error_output[:300]}')
            self.results['typecheck'] = {
                'success': False,
                'error': error_output,
                'fix': ("Fix TypeScript errors in modified files" if validation_mode['type'] == 'incremental'
                       else "Fix all TypeScript errors before completing task")
            }

    def validate_coding_standards(self, tool_input: Any, file_path: str):
        """Run coding standards validation"""
        try:
            content = tool_input.get('content') if isinstance(tool_input, dict) else None
            if not content:
                self.results['codeStandards'] = {'success': True, 'message': 'No content to validate'}
                return

            # Run all coding standards checks
            self.validate_no_any_type(content)
            self.validate_no_var(content)
            self.validate_null_safety(content)
            self.validate_implicit_globals(content)
            self.validate_empty_catch(content)
            self.validate_magic_numbers(content)
            self.validate_component_structure(content, file_path)
            self.validate_api_route_structure(content, file_path)
            self.validate_file_name(file_path)

            self.results['codeStandards'] = {
                'success': len(self.blockers) == 0,
                'violations': len(self.violations),
                'blockers': len(self.blockers)
            }

        except Exception as error:
            self.warnings.append(f'Coding standards validation error: {error}')
            self.results['codeStandards'] = {'success': True, 'message': 'Coding standards check skipped due to error'}

    def build_biome_command(self, file_path: str, validation_mode: Dict[str, str]) -> List[str]:
        """Build Biome command based on validation mode"""
        if validation_mode['type'] == 'full':
            return ['pnpm', 'biome:check', '--apply']
        
        if validation_mode['type'] == 'file-specific':
            return ['pnpm', 'biome', 'check', file_path, '--apply']
        
        # For incremental validation, check changed files
        try:
            changed_files = subprocess.run(['git', 'diff', '--name-only', 'HEAD'], 
                                         capture_output=True, text=True, check=True).stdout.strip()
            staged_files = subprocess.run(['git', 'diff', '--cached', '--name-only'], 
                                        capture_output=True, text=True, check=True).stdout.strip()
            
            if not changed_files and not staged_files:
                return ['pnpm', 'biome', 'check', file_path, '--apply']
            
            # Build command for changed files
            all_files = []
            if changed_files:
                all_files.extend(changed_files.split('\n'))
            if staged_files:
                all_files.extend(staged_files.split('\n'))
            
            # Filter for TypeScript/JavaScript files
            ts_files = [f for f in all_files if Path(f).suffix in ['.ts', '.tsx', '.js', '.jsx']]
            
            if ts_files:
                command = ['pnpm', 'biome', 'check'] + ts_files + ['--apply']
                return command
            else:
                return ['pnpm', 'biome', 'check', file_path, '--apply']
                
        except subprocess.CalledProcessError:
            return ['pnpm', 'biome', 'check', file_path, '--apply']

    def build_typecheck_command(self, validation_mode: Dict[str, str]) -> List[str]:
        """Build TypeScript check command"""
        if validation_mode['type'] == 'full':
            return ['pnpm', 'typecheck']
        else:
            return ['pnpm', 'typecheck', '--noEmit']

    def validate_no_any_type(self, content: str):
        """Check for 'any' type usage"""
        any_pattern = r'\b:\s*any\b'
        matches = re.findall(any_pattern, content)
        if matches:
            self.violations.append({
                'rule': 'No Any Type',
                'message': f'Found {len(matches)} usage(s) of "any" type',
                'severity': 'error'
            })
            self.blockers.append('Use "unknown" or specific types instead of "any"')

    def validate_no_var(self, content: str):
        """Check for 'var' declarations"""
        var_pattern = r'\bvar\s+\w+'
        matches = re.findall(var_pattern, content)
        if matches:
            self.violations.append({
                'rule': 'No Var',
                'message': f'Found {len(matches)} usage(s) of "var" declaration',
                'severity': 'error'
            })
            self.blockers.append('Use "const" or "let" instead of "var"')

    def validate_null_safety(self, content: str):
        """Check for null safety issues"""
        # DISABLED: This regex-based check causes too many false positives
        # TypeScript's type system and strict null checks handle this better
        # To properly implement this, we would need AST parsing to understand:
        # - Type guarantees (non-nullable types)
        # - Control flow analysis (null checks before access)
        # - Type guards and narrowing
        # 
        # Example false positives this regex would catch:
        # - myArray.map() where myArray is guaranteed non-null by type
        # - obj.method() after explicit null check
        # - React component props that are required
        #
        # If you need null safety checks, enable TypeScript's strictNullChecks instead
        pass

    def validate_implicit_globals(self, content: str):
        """Check for implicit global variables"""
        # DISABLED: This regex-based check is too simplistic and causes false positives
        # Issues with the current approach:
        # - Doesn't understand scoping (function parameters, block scope, module scope)
        # - Doesn't recognize property assignments (this.prop = value, obj.prop = value)
        # - Doesn't understand destructuring assignments
        # - Doesn't recognize TypeScript class properties
        # - Doesn't handle imports/exports
        #
        # Example false positives:
        # - Class property assignments: this.name = 'value'
        # - Object property updates: user.name = 'new name'
        # - Array element updates: items[0] = newItem
        # - Destructuring: const { name } = user; name = 'new'
        # - Function parameters: function(param) { param = transform(param) }
        #
        # TypeScript's noImplicitAny and strict mode handle this properly
        pass

    def validate_empty_catch(self, content: str):
        """Check for empty catch blocks"""
        empty_catch_pattern = r'catch\s*\(\s*\w*\s*\)\s*\{\s*\}'
        if re.search(empty_catch_pattern, content):
            self.violations.append({
                'rule': 'Empty Catch',
                'message': 'Empty catch block detected',
                'severity': 'warning'
            })

    def validate_magic_numbers(self, content: str):
        """Check for magic numbers"""
        magic_number_pattern = r'\b\d{2,}\b'
        matches = re.findall(magic_number_pattern, content)
        if len(matches) > 3:
            self.violations.append({
                'rule': 'Magic Numbers',
                'message': f'Found {len(matches)} potential magic numbers',
                'severity': 'warning'
            })

    def validate_component_structure(self, content: str, file_path: str):
        """Validate React component structure"""
        if Path(file_path).suffix in ['.tsx', '.jsx']:
            if 'export default' not in content:
                self.violations.append({
                    'rule': 'Component Structure',
                    'message': 'React component should have default export',
                    'severity': 'warning'
                })

    def validate_api_route_structure(self, content: str, file_path: str):
        """Validate API route structure"""
        if '/api/' in file_path:
            if 'export' not in content:
                self.violations.append({
                    'rule': 'API Route Structure',
                    'message': 'API route should export handler functions',
                    'severity': 'warning'
                })

    def validate_file_name(self, file_path: str):
        """Validate file naming conventions"""
        file_name = Path(file_path).name
        if not re.match(r'^[a-z0-9-_.]+$', file_name):
            self.violations.append({
                'rule': 'File Naming',
                'message': f'File name "{file_name}" should use kebab-case',
                'severity': 'warning'
            })

    def get_final_result(self) -> Dict[str, Any]:
        """Determine final validation result"""
        if self.errors or self.blockers:
            return self.block()
        else:
            return self.approve()

    def approve(self, custom_message: Optional[str] = None) -> Dict[str, Any]:
        """Approve validation"""
        message = custom_message or '✅ TypeScript validation passed'
        if self.warnings:
            message += f' ({len(self.warnings)} warnings)'
        
        return {
            'approve': True,
            'message': message
        }

    def block(self) -> Dict[str, Any]:
        """Block validation due to errors"""
        message_parts = ['❌ TypeScript validation failed:']
        
        if self.errors:
            message_parts.extend([f'  - {error}' for error in self.errors])
        
        if self.blockers:
            message_parts.append('')
            message_parts.append('🔧 Required fixes:')
            message_parts.extend([f'  - {blocker}' for blocker in self.blockers])
        
        return {
            'approve': False,
            'message': '\n'.join(message_parts)
        }


async def main():
    """Main execution"""
    try:
        input_data = json.load(sys.stdin)
        validator = TypeScriptValidator(input_data)
        result = await validator.validate()
        
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({
            'approve': False,
            'message': f'TypeScript validator error: {error}'
        }))
        sys.exit(1)


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())