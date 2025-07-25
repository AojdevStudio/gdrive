#!/usr/bin/env -S uv run --script

# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List


class ImportOrganizer:
    def __init__(self, input_data: Dict[str, Any]):
        self.input = input_data
        self.import_groups = {
            'react': [],
            'thirdParty': [],
            'absolute': [],
            'relative': [],
            'types': []
        }

    def organize(self) -> Dict[str, Any]:
        """Main organization entry point"""
        tool_name = self.input.get('tool_name')
        tool_input = self.input.get('tool_input', {})
        output = self.input.get('output', {})
        content = tool_input.get('content')
        file_path = tool_input.get('file_path')
        
        # Security: Basic input validation
        if file_path and ('../' in file_path or '..\\' in file_path or file_path.startswith('/')):
            return self.skip('Potentially unsafe file path detected')
        
        # Only process TypeScript/JavaScript files
        file_ext = Path(file_path).suffix if file_path else ''
        if file_ext not in ['.ts', '.tsx', '.js', '.jsx']:
            return self.skip('Not a TypeScript/JavaScript file')

        # Work with the output content if available (PostToolUse), otherwise input content
        code_content = output.get('content') or content
        if not code_content:
            return self.skip('No content to organize')

        try:
            organized = self.organize_imports(code_content)
            
            # If content changed, write it back
            if organized != code_content:
                self.write_organized_content(file_path, organized)
                return self.success('Imports organized successfully')
            else:
                return self.skip('Imports already organized')
        except Exception as error:
            return self.error(f'Failed to organize imports: {error}')

    def organize_imports(self, content: str) -> str:
        """Parse and organize imports"""
        lines = content.split('\n')
        first_import_index = -1
        last_import_index = -1
        has_use_client = False
        has_use_server = False
        file_header = []
        
        # Find import boundaries and directives
        for i, line in enumerate(lines):
            trimmed_line = line.strip()
            
            # Check for 'use client' or 'use server' directives
            if trimmed_line in ["'use client'", '"use client"']:
                has_use_client = True
                file_header.append(line)
                continue
            if trimmed_line in ["'use server'", '"use server"']:
                has_use_server = True
                file_header.append(line)
                continue
            
            # Skip shebang and comments at the top
            if i == 0 and trimmed_line.startswith('#!'):
                file_header.append(line)
                continue
            
            # Detect imports
            if self.is_import_line(trimmed_line):
                if first_import_index == -1:
                    first_import_index = i
                last_import_index = i
                self.categorize_import(line)
            elif first_import_index != -1 and trimmed_line != '':
                # Stop when we hit non-import, non-empty content
                break
        
        # If no imports found, return original content
        if first_import_index == -1:
            return content
        
        # Build organized imports
        organized_imports = self.build_organized_imports()
        
        # Reconstruct the file
        before_imports = lines[:first_import_index]
        after_imports = lines[last_import_index + 1:]
        
        # Combine everything
        result = []
        result.extend(file_header)
        if file_header:
            result.append('')  # Add blank line after directives
        result.extend([line for line in before_imports if line not in file_header])
        result.extend(organized_imports)
        result.extend(after_imports)
        
        return '\n'.join(result)

    def is_import_line(self, line: str) -> bool:
        """Check if a line is an import statement"""
        return bool(
            re.match(r'^import\s+', line) or
            re.match(r'^import\s*{', line) or
            re.match(r'^import\s*type', line)
        )

    def categorize_import(self, import_line: str):
        """Categorize import into appropriate group"""
        trimmed = import_line.strip()
        
        # Type imports
        if 'import type' in trimmed or 'import { type' in trimmed:
            self.import_groups['types'].append(import_line)
            return
        
        # Extract the module path
        module_match = re.search(r"from\s+['\"]([^'\"]+)['\"]", import_line)
        if not module_match:
            # Handle side-effect imports (import 'module')
            if 'react' in import_line or 'next' in import_line:
                self.import_groups['react'].append(import_line)
            else:
                self.import_groups['thirdParty'].append(import_line)
            return
        
        module_path = module_match.group(1)
        
        # React/Next.js imports
        if self.is_react_import(module_path):
            self.import_groups['react'].append(import_line)
        # Absolute imports (@/)
        elif module_path.startswith('@/'):
            self.import_groups['absolute'].append(import_line)
        # Relative imports
        elif module_path.startswith('.'):
            self.import_groups['relative'].append(import_line)
        # Third-party imports
        else:
            self.import_groups['thirdParty'].append(import_line)

    def is_react_import(self, module_path: str) -> bool:
        """Check if import is React/Next.js related"""
        react_patterns = [
            'react',
            'react-dom',
            'next',
            '@next',
            'next/',
            '@vercel',
        ]
        
        return any(
            module_path == pattern or module_path.startswith(pattern + '/')
            for pattern in react_patterns
        )

    def build_organized_imports(self) -> List[str]:
        """Build organized import groups"""
        groups = []
        
        # Add each group with proper spacing
        if self.import_groups['react']:
            groups.extend(self.sort_imports(self.import_groups['react']))
        
        if self.import_groups['thirdParty']:
            if groups:
                groups.append('')  # Add blank line
            groups.extend(self.sort_imports(self.import_groups['thirdParty']))
        
        if self.import_groups['absolute']:
            if groups:
                groups.append('')  # Add blank line
            groups.extend(self.sort_imports(self.import_groups['absolute']))
        
        if self.import_groups['relative']:
            if groups:
                groups.append('')  # Add blank line
            groups.extend(self.sort_imports(self.import_groups['relative']))
        
        if self.import_groups['types']:
            if groups:
                groups.append('')  # Add blank line
            groups.extend(self.sort_imports(self.import_groups['types']))
        
        return groups

    def sort_imports(self, imports: List[str]) -> List[str]:
        """Sort imports alphabetically within a group"""
        def get_path(imp: str) -> str:
            match = re.search(r"from\s+['\"]([^'\"]+)['\"]", imp)
            return match.group(1) if match else imp
        
        return sorted(imports, key=get_path)

    def write_organized_content(self, file_path: str, content: str):
        """Write organized content back to file"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        except Exception as error:
            raise Exception(f'Failed to write file: {error}')

    def success(self, message: str) -> Dict[str, Any]:
        """Return success response"""
        return {
            'success': True,
            'message': f'✅ {message}',
            'modified': True
        }

    def skip(self, reason: str) -> Dict[str, Any]:
        """Return skip response"""
        return {
            'success': True,
            'message': f'ℹ️  Skipped: {reason}',
            'modified': False
        }

    def error(self, message: str) -> Dict[str, Any]:
        """Return error response"""
        return {
            'success': False,
            'message': f'❌ {message}',
            'modified': False
        }


def main():
    """Main execution"""
    try:
        input_data = json.load(sys.stdin)
        
        # Extract file path for user-friendly message
        tool_input = input_data.get('tool_input', {})
        file_path = tool_input.get('file_path', '')
        file_name = Path(file_path).name if file_path else "file"
        
        # Show friendly message
        print(f"📦 Organizing imports in {file_name}...", file=sys.stderr)
        
        organizer = ImportOrganizer(input_data)
        result = organizer.organize()
        
        # Show result to user
        if result.get('modified', False):
            print(f"✅ Imports organized in {file_name}", file=sys.stderr)
        else:
            print(f"👍 Imports already organized in {file_name}", file=sys.stderr)
        
        # For PostToolUse hooks, we don't need to return approve/block
        print(json.dumps({
            'message': result['message']
        }))
    except Exception as error:
        print(json.dumps({
            'message': f'Import organizer error: {error}'
        }))


if __name__ == '__main__':
    main()