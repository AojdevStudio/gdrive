#!/usr/bin/env -S uv run --script

# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class CodeQualityReporter:
    def __init__(self):
        self.session_file = Path(__file__).parent / '.session-quality.json'
        self.reports_dir = Path.cwd() / 'docs' / 'reports'
        self.ensure_reports_directory()
        self.load_session()

    def ensure_reports_directory(self):
        """Ensure reports directory exists"""
        try:
            self.reports_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            # Silently fail - don't interrupt the workflow
            pass

    def load_session(self):
        """Load or initialize session data"""
        try:
            if self.session_file.exists():
                with open(self.session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Convert list back to set for filesModified
                    self.session = data
                    if isinstance(data.get('filesModified'), list):
                        self.session['filesModified'] = set(data['filesModified'])
                    else:
                        self.session['filesModified'] = set()
            else:
                self.session = self.create_new_session()
        except Exception:
            self.session = self.create_new_session()

    def create_new_session(self) -> Dict[str, Any]:
        """Create a new session"""
        return {
            'startTime': datetime.now().isoformat(),
            'filesModified': set(),
            'violations': [],
            'improvements': [],
            'statistics': {
                'totalFiles': 0,
                'totalViolations': 0,
                'blockedOperations': 0,
                'autoFixed': 0
            }
        }

    def process_event(self, input_data: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Process hook event"""
        event = input_data.get('event')
        tool_name = input_data.get('tool_name')
        tool_input = input_data.get('tool_input', {})
        message = input_data.get('message')
        file_path = tool_input.get('file_path')
        
        # Security: Validate file path
        if file_path:
            try:
                resolved_path = Path(file_path).resolve()
                cwd = Path.cwd()
                # Ensure the path is within the current working directory
                resolved_path.relative_to(cwd)
            except (ValueError, OSError):
                return {'message': 'Invalid or unsafe file path detected'}
        # Track file modifications
        if file_path and tool_name in ['Write', 'Edit', 'MultiEdit', 'Task']:
            self.session['filesModified'].add(file_path)
            self.session['statistics']['totalFiles'] += 1

        # Track violations and improvements
        if message:
            if '❌' in message:
                self.session['statistics']['blockedOperations'] += 1
                self.record_violation(message, file_path)
            elif '⚠️' in message:
                self.session['statistics']['totalViolations'] += 1
                self.record_violation(message, file_path)
            elif '✅' in message and 'organized' in message:
                self.session['statistics']['autoFixed'] += 1
                self.record_improvement(message, file_path)

        # Save session data
        self.save_session()

        # Generate report on Stop event
        if event == 'Stop':
            return self.generate_report()

        return None

    def record_violation(self, message: str, file_path: Optional[str]):
        """Record a violation"""
        lines = message.split('\n')
        violations = [
            line.strip()[2:]  # Remove '- '
            for line in lines
            if ':' in line and line.strip().startswith('-')
        ]

        for violation in violations:
            self.session['violations'].append({
                'file': file_path or 'unknown',
                'issue': violation,
                'timestamp': datetime.now().isoformat()
            })

    def record_improvement(self, message: str, file_path: Optional[str]):
        """Record an improvement"""
        self.session['improvements'].append({
            'file': file_path or 'unknown',
            'action': message.split('\n')[0],
            'timestamp': datetime.now().isoformat()
        })

    def save_session(self):
        """Save session data"""
        try:
            # Convert Set to List for JSON serialization
            session_data = {
                **self.session,
                'filesModified': list(self.session['filesModified'])
            }
            with open(self.session_file, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2)
        except Exception:
            # Silently fail - don't interrupt the workflow
            pass

    def generate_report(self) -> Dict[str, str]:
        """Generate quality report"""
        duration = self.calculate_duration()
        top_issues = self.get_top_issues()
        file_stats = self.get_file_statistics()

        report = [
            '# Code Quality Session Report',
            '',
            f'**Duration:** {duration}  ',
            f'**Files Modified:** {len(self.session["filesModified"])}  ',
            f'**Generated:** {datetime.now().isoformat()}',
            '',
            '## Statistics',
            '',
            f'- **Total Operations:** {self.session["statistics"]["totalFiles"]}',
            f'- **Violations Found:** {self.session["statistics"]["totalViolations"]}',
            f'- **Operations Blocked:** {self.session["statistics"]["blockedOperations"]}',
            f'- **Auto-fixes Applied:** {self.session["statistics"]["autoFixed"]}',
            ''
        ]

        if top_issues:
            report.extend([
                '## Top Issues',
                ''
            ])
            for issue in top_issues:
                report.append(f'- **{issue["type"]}** ({issue["count"]} occurrences)')
            report.append('')

        if self.session['improvements']:
            report.extend([
                '## Improvements Made',
                ''
            ])
            for imp in self.session['improvements'][:5]:
                report.append(f'- **{Path(imp["file"]).name}:** {imp["action"]}')
            report.append('')

        if file_stats['mostProblematic']:
            report.extend([
                '## Files Needing Attention',
                ''
            ])
            for file in file_stats['mostProblematic']:
                report.append(f'- **{file["path"]}** ({file["issues"]} issues)')
            report.append('')

        report.extend([
            '## Recommendations',
            ''
        ])
        for rec in self.get_recommendations():
            report.append(f'- {rec.lstrip("- ")}')
        
        report.extend([
            '',
            '## Reference',
            '',
            'For detailed coding standards, see: [docs/architecture/coding-standards.md](../architecture/coding-standards.md)'
        ])

        # Save report to file with proper naming
        self.save_report_to_file('\n'.join(report))

        # Clean up session file
        self.cleanup()

        return {'message': '📊 Code quality session report generated'}

    def save_report_to_file(self, report_content: str):
        """Save report to file with proper kebab-case naming"""
        try:
            timestamp = datetime.now().isoformat()[:19].replace(':', '-')
            filename = f'code-quality-session-{timestamp}.md'
            filepath = self.reports_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(report_content)
            
            print(f'📁 Report saved: docs/reports/{filename}', file=sys.stderr)
        except Exception as error:
            print(f'⚠️ Failed to save report: {error}', file=sys.stderr)

    def calculate_duration(self) -> str:
        """Calculate session duration"""
        start = datetime.fromisoformat(self.session['startTime'])
        end = datetime.now()
        diff = end - start
        
        hours = int(diff.total_seconds() // 3600)
        minutes = int((diff.total_seconds() % 3600) // 60)
        
        if hours > 0:
            return f'{hours}h {minutes}m'
        return f'{minutes}m'

    def get_top_issues(self) -> List[Dict[str, Any]]:
        """Get top issues by frequency"""
        issue_counts = {}
        
        for violation in self.session['violations']:
            issue_type = violation['issue'].split(':')[0]
            issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1

        return sorted(
            [{'type': type_, 'count': count} for type_, count in issue_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )[:5]

    def get_file_statistics(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get file statistics"""
        file_issues = {}
        
        for violation in self.session['violations']:
            if violation['file'] and violation['file'] != 'unknown':
                file_issues[violation['file']] = file_issues.get(violation['file'], 0) + 1

        most_problematic = sorted(
            [{'path': Path(path).name, 'issues': issues} for path, issues in file_issues.items()],
            key=lambda x: x['issues'],
            reverse=True
        )[:3]

        return {'mostProblematic': most_problematic}

    def get_recommendations(self) -> List[str]:
        """Generate recommendations based on findings"""
        recommendations = []
        top_issues = self.get_top_issues()

        # Check for specific issue patterns
        has_any_type = any('Any Type' in issue['type'] for issue in top_issues)
        has_var = any('Var' in issue['type'] for issue in top_issues)
        has_null_safety = any('Null Safety' in issue['type'] for issue in top_issues)

        if has_any_type:
            recommendations.extend([
                '  - Replace "any" types with "unknown" or specific types',
                '  - Run: pnpm typecheck to identify type issues'
            ])

        if has_var:
            recommendations.extend([
                '  - Use "const" or "let" instead of "var"',
                '  - Enable no-var ESLint rule for automatic detection'
            ])

        if has_null_safety:
            recommendations.extend([
                '  - Use optional chaining (?.) for nullable values',
                '  - Add null checks before property access'
            ])

        if self.session['statistics']['blockedOperations'] > 0:
            recommendations.extend([
                '  - Review blocked operations and fix violations',
                '  - Run: pnpm biome:check for comprehensive linting'
            ])

        if not recommendations:
            recommendations.extend([
                '  - Great job! Continue following coding standards',
                '  - Consider running: pnpm code-quality for full validation'
            ])

        return recommendations

    def cleanup(self):
        """Clean up session data"""
        try:
            if self.session_file.exists():
                self.session_file.unlink()
        except Exception:
            # Silently fail
            pass


def main():
    """Main execution"""
    try:
        input_data = json.load(sys.stdin)
        reporter = CodeQualityReporter()
        result = reporter.process_event(input_data)
        
        if result:
            print(json.dumps(result))
        else:
            # No output for non-Stop events
            print(json.dumps({'message': ''}))
    except Exception as error:
        print(json.dumps({
            'message': f'Reporter error: {error}'
        }))


if __name__ == '__main__':
    main()