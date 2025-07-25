#!/usr/bin/env -S uv run --script

# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import json
import re
import sys
from typing import Any, Dict, List, Optional


class CommitMessageValidator:
    def __init__(self, input_data: Dict[str, Any]):
        self.input = input_data
        self.valid_types = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore']

    def validate(self) -> Dict[str, Any]:
        """Main validation entry point"""
        tool_name = self.input.get('tool_name')
        tool_input = self.input.get('tool_input', {})
        command = tool_input.get('command')
        
        # Security: Basic input validation
        if command and not isinstance(command, str):
            return self.approve('Invalid command format')
        
        # Only validate git commit commands
        if tool_name != 'Bash' or not self.is_commit_command(command):
            return self.approve()

        # Extract commit message from command
        message = self.extract_commit_message(command)
        if not message:
            return self.approve()  # Can't validate without message

        # Validate the commit message format
        validation = self.validate_message(message)
        
        if validation['valid']:
            return self.approve(validation['details'])
        else:
            return self.block(validation['errors'], validation['suggestions'])

    def is_commit_command(self, command: Optional[str]) -> bool:
        """Check if command is a git commit"""
        return command and (
            'git commit' in command or
            'git cm' in command or  # common alias
            'gc -m' in command  # common alias
        )

    def extract_commit_message(self, command: str) -> str:
        """Extract commit message from command"""
        message = ''
        
        # Format: git commit -m "message"
        single_quote_match = re.search(r"-m\s+'([^']+)'", command)
        double_quote_match = re.search(r'-m\s+"([^"]+)"', command)
        
        # Format: git commit -m "$(cat <<'EOF'...EOF)"
        heredoc_match = re.search(r"cat\s*<<\s*['\"]?EOF['\"]?\s*([\s\S]*?)\s*EOF", command)
        
        if single_quote_match:
            message = single_quote_match.group(1)
        elif double_quote_match:
            message = double_quote_match.group(1)
        elif heredoc_match:
            message = heredoc_match.group(1).strip()
        
        # Get just the first line for conventional commit validation
        return message.split('\n')[0].strip()

    def validate_message(self, message: str) -> Dict[str, Any]:
        """Validate commit message format"""
        errors = []
        suggestions = []
        details = []
        
        # Check for empty message
        if not message:
            errors.append('Commit message cannot be empty')
            return {'valid': False, 'errors': errors, 'suggestions': suggestions}
        
        # Check basic format: type(scope): subject or type: subject
        conventional_format = re.compile(r'^(\w+)(?:\(([^)]+)\))?:\s*(.+)$')
        match = conventional_format.match(message)
        
        if not match:
            errors.append('Commit message must follow conventional format: type(scope): subject')
            suggestions.extend([
                'Examples:',
                '  feat(auth): add login functionality',
                '  fix: resolve memory leak in provider list',
                '  docs(api): update REST endpoint documentation'
            ])
            return {'valid': False, 'errors': errors, 'suggestions': suggestions}
        
        type_, scope, subject = match.groups()
        
        # Validate type
        if type_ not in self.valid_types:
            errors.append(f"Invalid commit type '{type_}'")
            suggestions.append(f"Valid types: {', '.join(self.valid_types)}")
        else:
            details.append(f"Type: {type_} ✓")
        
        # Validate scope (optional but recommended for features)
        if scope:
            if len(scope) > 20:
                errors.append('Scope should be concise (max 20 characters)')
            else:
                details.append(f"Scope: {scope} ✓")
        elif type_ in ['feat', 'fix']:
            suggestions.append('Consider adding a scope for better context')
        
        # Validate subject
        if subject:
            # Check first character is lowercase
            if re.match(r'^[A-Z]', subject):
                errors.append('Subject should start with lowercase letter')
            
            # Check for ending punctuation
            if re.search(r'[.!?]$', subject):
                errors.append('Subject should not end with punctuation')
            
            # Check length
            if len(subject) > 50:
                suggestions.append(f"Subject is {len(subject)} characters (recommended: max 50)")
            
            # Check for imperative mood (basic check)
            first_word = subject.split()[0]
            imperative_words = ['add', 'update', 'fix', 'remove', 'implement', 'create', 'delete', 'improve', 'refactor', 'change', 'move', 'rename']
            past_tense_words = ['added', 'updated', 'fixed', 'removed', 'implemented', 'created', 'deleted', 'improved', 'refactored', 'changed', 'moved', 'renamed']
            
            if first_word.lower() in past_tense_words:
                errors.append('Use imperative mood in subject (e.g., "add" not "added")')
            
            if not errors:
                details.append(f'Subject: "{subject}" ✓')
        else:
            errors.append('Subject cannot be empty')
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'suggestions': suggestions,
            'details': details
        }

    def approve(self, details: Optional[List[str]] = None) -> Dict[str, Any]:
        """Approve the operation"""
        message = '✅ Commit message validation passed'
        if details:
            message += '\n' + '\n'.join(details)
        
        return {
            'approve': True,
            'message': message
        }

    def block(self, errors: List[str], suggestions: List[str]) -> Dict[str, Any]:
        """Block the operation due to invalid format"""
        message_parts = [
            '❌ Invalid commit message format:',
            *[f'  - {e}' for e in errors],
            '',
            *[f'  {s}' for s in suggestions],
            '',
            'Commit format: type(scope): subject',
            '',
            'Types:',
            '  feat     - New feature',
            '  fix      - Bug fix',
            '  docs     - Documentation only',
            '  style    - Code style changes',
            '  refactor - Code refactoring',
            '  test     - Add/update tests',
            '  chore    - Maintenance tasks',
            '',
            'Example: feat(providers): add location filter to provider list'
        ]

        return {
            'approve': False,
            'message': '\n'.join(message_parts)
        }


def main():
    """Main execution"""
    try:
        input_data = json.load(sys.stdin)
        validator = CommitMessageValidator(input_data)
        result = validator.validate()
        
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({
            'approve': True,
            'message': f'Commit validator error: {error}'
        }))


if __name__ == '__main__':
    main()