---
allowed-tools: Bash, Read, Glob, AskUserQuestion, Write
description: Start the RBP autonomous execution loop
argument-hint: [spec-file | max-iterations]
---

# /rbp:start

Start the RBP autonomous execution loop to implement tasks with test-gated verification.

**Runs in a forked context window** - your main session stays free.

## Variables

ARG1: $1 (optional - either a spec/story file path OR max iterations number)
MAX_ITERATIONS: default 10
SCRIPTS_DIR: scripts/rbp
PROGRESS_FILE: scripts/rbp/progress.txt

## Workflow Detection

**Two workflows supported:**

| Source | Parser | Executor | Features |
|--------|--------|----------|----------|
| Quick-plan spec (`specs/*.md`) | `parse-spec-to-beads.sh` | `ralph-execute.sh` | Codex pre-flight review |
| BMAD story (`stories/*.md`) | `parse-story-to-beads.sh` | `ralph.sh` | Direct execution |

**Detection logic:**
- File contains `<!-- RBP-TASKS-START -->` → Quick-plan spec
- File contains `## User Story` or in `stories/` folder → BMAD story
- Otherwise → Ask user which workflow

## Workflow

### Step 0: Launch PAI Observability Dashboard (if available)

Before starting execution, check for PAI Observability integration:

1. **Check if PAI Observability is installed:**
   - Look for `~/.claude/skills/Observability/manage.sh`
   - If not found: Print warning and continue without dashboard

2. **Check if dashboard is already running:**
   ```bash
   curl -s http://localhost:4000/health 2>/dev/null
   ```
   - If running: Skip launch, just note it's available

3. **Launch dashboard if not running:**
   ```bash
   ~/.claude/skills/Observability/manage.sh start
   ```
   - Wait up to 10 seconds for startup
   - Verify with health check

4. **Open browser (unless headless):**
   - Check for CI/headless environment variables: `$CI`, `$GITHUB_ACTIONS`, `$GITLAB_CI`, `$JENKINS_URL`, `$CODESPACES`
   - Check for SSH without display: `$SSH_CONNECTION` without `$DISPLAY`
   - If not headless: Open http://localhost:5172 in browser

5. **Always print dashboard URL:**
   ```
   Observability Dashboard: http://localhost:5172
   ```

### Main Workflow Steps

1. Run `bd status` to show current task state
2. Run `bd ready` to check for available tasks

### If NO tasks available:

3. **Auto-discover specs/stories** - Look for files:
   - Check if ARG1 is a file path (ends in .md) → use that file
   - Otherwise, search common locations:
     - `specs/*.md` (quick-plan)
     - `stories/*.md` (BMAD)
     - `docs/specs/*.md`
     - `docs/stories/*.md`
   - Use Glob tool to find files

4. **If file(s) found:**
   - Show the file(s) found
   - Ask user which to use (if multiple)
   - **Detect workflow type** using detection logic above
   - For quick-plan: Run `./rbp/scripts/ralph-execute.sh <spec-file>`
   - For BMAD: Run `./rbp/scripts/parse-story-to-beads.sh <story-file>` then `./rbp/scripts/ralph.sh`
   - Run `bd ready` to confirm tasks were created

5. **If NO file found:**
   - Report "No tasks in beads and no spec/story files found"
   - Suggest: "Create a spec with /quick-plan or a story with BMAD"
   - Stop

### If tasks ARE available:

6. Ask user: "Tasks exist. Run quick-plan workflow (with Codex) or BMAD workflow (direct)?"
7. Execute the selected workflow
8. Monitor output for completion or errors

## Report

RBP Execution Started
═══════════════════════════════════════════════════════

Observability Dashboard: http://localhost:5172
   Showing real-time task progress, test results, and errors

File Logs: scripts/rbp/progress.txt

Status: Execution loop running in forked context
Max Iterations: `MAX_ITERATIONS`

Monitor with:
- Browser: http://localhost:5172 (live updates)
- Terminal: tail -f `PROGRESS_FILE`
- Beads: bd activity --follow
- Tasks: bd status
- Stop: Ctrl+C
