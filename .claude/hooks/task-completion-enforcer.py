#!/usr/bin/env -S uv run --script

# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List


async def enforce_task_completion(hook_input: Dict[str, Any]):
    """Main enforcement function"""
    tool_name = hook_input.get('tool_name')
    tool_input = hook_input.get('tool_input')
    phase = hook_input.get('phase', os.environ.get('CLAUDE_HOOK_PHASE', 'unknown'))
    
    # Only run compliance checks in PostToolUse and Stop phases
    # Skip PreToolUse to avoid redundant execution
    if phase == 'PreToolUse':
        print(json.dumps({ 
            'approve': True, 
            'message': "Task completion enforcement skipped in PreToolUse (avoiding redundancy)" 
        }))
        return
    
    # Detect task completion indicators
    if is_task_completion_attempt(tool_input):
        print("🔍 TASK COMPLETION DETECTED - Running mandatory compliance checks...", file=sys.stderr)
        
        compliance_results = await run_compliance_checks(tool_input)
        
        if not compliance_results['allPassed']:
            print(json.dumps({
                'approve': False,
                'message': generate_blocking_message(compliance_results)
            }))
            return
        
        print("✅ All compliance checks passed - Task completion approved", file=sys.stderr)
    
    print(json.dumps({ 
        'approve': True, 
        'message': "Task completion enforcement passed" 
    }))


def is_task_completion_attempt(tool_input: Any) -> bool:
    """Check if this is a task completion attempt"""
    content = json.dumps(tool_input) if isinstance(tool_input, dict) else str(tool_input)
    
    # Check for TodoWrite tool with completed status
    if isinstance(tool_input, dict) and tool_input.get('todos'):
        has_completed_todo = any(
            todo.get('status') in ['completed', 'done']
            for todo in tool_input['todos']
        )
        if has_completed_todo:
            return True
    
    # Original completion indicators for other tools
    completion_indicators = [
        r'✅.*complete',
        r'✅.*done',
        r'✅.*fixed',
        r'✅.*finished',
        r'task.*complete',
        r'workflow.*complete',
        r'all.*fixed',
        r'ready.*review',
        r'implementation.*complete',
        r'changes.*made',
        r'should.*work.*now',
        r'⏺.*fixed',
        r'⏺.*complete',
        r'"status":\s*"completed"',
        r'"status":\s*"done"'
    ]
    
    return any(re.search(pattern, content, re.IGNORECASE) for pattern in completion_indicators)


async def run_compliance_checks(tool_input: Any) -> Dict[str, Any]:
    """Run all compliance checks"""
    results = {
        'allPassed': True,
        'checks': [],
        'failures': []
    }

    # Determine validation scope based on task completion type
    validation_scope = determine_validation_scope(tool_input)
    print(f"📋 VALIDATION SCOPE: {validation_scope['type']} ({validation_scope['reason']})", file=sys.stderr)
    
    # 1. TypeScript validation (includes Biome, type checking, coding standards) - Centralized
    try:
        print("Running centralized TypeScript validation...", file=sys.stderr)
        ts_validator_path = Path(__file__).parent / 'typescript-validator.py'
        
        if ts_validator_path.exists():
            ts_result = await run_typescript_validator(ts_validator_path, tool_input)
            
            if ts_result.get('approve', False):
                results['checks'].append(f"✅ TypeScript validation passed ({validation_scope['type']})")
            else:
                results['allPassed'] = False
                results['failures'].append({
                    'check': "TypeScript",
                    'error': ts_result.get('message', 'TypeScript validation failed'),
                    'fix': "Fix all TypeScript validation issues listed above"
                })
        else:
            results['checks'].append("ℹ️ TypeScript validator not found")
    except Exception as error:
        results['allPassed'] = False
        results['failures'].append({
            'check': "TypeScript",
            'error': str(error),
            'fix': "Fix TypeScript validation system error"
        })

    # 2. Test check (if tests exist)
    if Path('package.json').exists():
        try:
            with open('package.json', 'r') as f:
                package_json = json.load(f)
            
            if package_json.get('scripts', {}).get('test'):
                try:
                    print("Running tests...", file=sys.stderr)
                    subprocess.run(['pnpm', 'test'], check=True, capture_output=True, text=True)
                    results['checks'].append("✅ Tests passed")
                except subprocess.CalledProcessError as error:
                    results['allPassed'] = False
                    results['failures'].append({
                        'check': "Tests",
                        'error': error.stdout or str(error),
                        'fix': "Fix all failing tests before completing task"
                    })
        except Exception as error:
            results['checks'].append(f"ℹ️ Could not check tests: {error}")

    # 3. Git status check (warn about uncommitted changes)
    try:
        result = subprocess.run(['git', 'status', '--porcelain'], 
                              capture_output=True, text=True, check=True)
        if result.stdout.strip():
            results['checks'].append("⚠️ Uncommitted changes detected")
        else:
            results['checks'].append("✅ Git status clean")
    except subprocess.CalledProcessError:
        # Git not available or not a git repo - not critical
        results['checks'].append("ℹ️ Git status not available")

    # 4. Claude.md compliance check
    if Path('.claude/CLAUDE.md').exists() or Path('CLAUDE.md').exists():
        results['checks'].append("✅ CLAUDE.md compliance assumed (manual verification)")

    return results


async def run_typescript_validator(validator_path: Path, tool_input: Any) -> Dict[str, Any]:
    """Run the TypeScript validator"""
    try:
        input_data = json.dumps({ 
            'tool_name': 'TaskCompletion', 
            'tool_input': tool_input,
            'phase': 'Stop'
        })
        
        process = await asyncio.create_subprocess_exec(
            'uv', 'run', '--script', str(validator_path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate(input_data.encode())
        
        if process.returncode == 0:
            return json.loads(stdout.decode())
        else:
            return {
                'approve': False,
                'message': f'TypeScript validator failed: {stderr.decode()}'
            }
    except Exception as error:
        return {
            'approve': False,
            'message': f'TypeScript validator output parsing failed: {error}'
        }


def determine_validation_scope(tool_input: Any) -> Dict[str, str]:
    """Determine the validation scope based on task completion type"""
    content = json.dumps(tool_input) if isinstance(tool_input, dict) else str(tool_input)
    
    # Major task completion indicators - require full validation
    major_completion_indicators = [
        r'feature.*complete',
        r'implementation.*complete',
        r'ready.*review',
        r'ready.*production',
        r'workflow.*complete',
        r'task.*finished',
        r'all.*done',
        r'fully.*implemented',
        r'complete.*testing',
        r'deployment.*ready',
        r'final.*implementation',
        r'story.*complete',
        r'epic.*complete'
    ]
    
    # Minor update indicators - can use incremental validation
    minor_update_indicators = [
        r'progress.*update',
        r'status.*update',
        r'partial.*complete',
        r'checkpoint',
        r'intermediate.*step',
        r'milestone.*reached',
        r'draft.*complete',
        r'initial.*implementation',
        r'work.*in.*progress',
        r'temporary.*fix'
    ]
    
    # Check for TodoWrite with multiple todos - likely full completion
    if isinstance(tool_input, dict) and tool_input.get('todos'):
        completed_todos = [
            todo for todo in tool_input['todos']
            if todo.get('status') in ['completed', 'done']
        ]
        total_todos = len(tool_input['todos'])
        
        # If completing more than 50% of todos or 3+ todos, treat as major
        if len(completed_todos) >= 3 or (len(completed_todos) / total_todos) > 0.5:
            return {'type': 'full', 'reason': 'Multiple todos completed'}
    
    # Check for major completion patterns
    is_major_completion = any(
        re.search(pattern, content, re.IGNORECASE) 
        for pattern in major_completion_indicators
    )
    if is_major_completion:
        return {'type': 'full', 'reason': 'Major task completion detected'}
    
    # Check for minor update patterns
    is_minor_update = any(
        re.search(pattern, content, re.IGNORECASE)
        for pattern in minor_update_indicators
    )
    if is_minor_update:
        return {'type': 'incremental', 'reason': 'Minor progress update detected'}
    
    # Default to incremental for single task completions
    return {'type': 'incremental', 'reason': 'Single task completion - using incremental validation'}


def get_changed_files() -> List[str]:
    """Get list of changed files from git"""
    try:
        unstaged = subprocess.run(['git', 'diff', '--name-only'], 
                                capture_output=True, text=True, check=True)
        staged = subprocess.run(['git', 'diff', '--cached', '--name-only'], 
                              capture_output=True, text=True, check=True)
        
        all_changed = []
        if unstaged.stdout.strip():
            all_changed.extend(unstaged.stdout.strip().split('\n'))
        if staged.stdout.strip():
            all_changed.extend(staged.stdout.strip().split('\n'))
        
        return list(set(all_changed))  # Remove duplicates
    except subprocess.CalledProcessError:
        return []


def generate_blocking_message(results: Dict[str, Any]) -> str:
    """Generate blocking message for failed compliance checks"""
    message = f"""🛑 TASK COMPLETION BLOCKED 🛑

{len(results['failures'])} CRITICAL ISSUE(S) MUST BE FIXED:

"""

    for i, failure in enumerate(results['failures']):
        message += f"""❌ {failure['check']} FAILED:
{failure['error']}

🔧 FIX: {failure['fix']}

"""

    message += """════════════════════════════════════════════
⚠️  CLAUDE.md COMPLIANCE VIOLATION DETECTED ⚠️
════════════════════════════════════════════

According to CLAUDE.md requirements:
• "ALL hook issues are BLOCKING"
• "STOP IMMEDIATELY - Do not continue with other tasks" 
• "FIX ALL ISSUES - Address every ❌ issue until everything is ✅ GREEN"
• "There are NO warnings, only requirements"

📋 MANDATORY NEXT STEPS:
1. Fix ALL issues listed above
2. Verify fixes by running the failed commands manually
3. Only THEN mark the task as complete
4. NEVER ignore blocking issues

🚫 TASK COMPLETION IS FORBIDDEN UNTIL ALL ISSUES ARE RESOLVED 🚫"""

    return message


async def main():
    """Main execution"""
    try:
        input_data = json.load(sys.stdin)
        await enforce_task_completion(input_data)
    except Exception as error:
        print(json.dumps({
            'approve': False,
            'message': f'🛑 CRITICAL: Task completion enforcement failed: {error}'
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())