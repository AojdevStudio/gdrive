# RBP Execution Protocol

You are executing a task as part of the RBP Stack (Ralph + Beads + PAI) autonomous loop.

## Your Mission

Complete the **Current Task** provided below following this exact protocol.

---

## Protocol Steps

### Step 1: Understand the Task

Read the task details from the Current Task section. The task comes from Beads (`bd ready`) and contains:
- Task ID (bead reference)
- Task title and description
- Acceptance criteria
- Parent story context (if applicable)

### Step 2: Implement the Solution

1. **Read relevant code** before making changes
2. **Make incremental changes** - small, focused edits
3. **Follow existing patterns** in the codebase
4. **Do not over-engineer** - implement exactly what's needed

### Step 3: Verify Your Work

Run verification commands based on task type:

```bash
# Always run typecheck
bun run typecheck

# Run tests
bun run test

# For UI tasks, verify with Playwright
bunx playwright test
```

### Step 4: Close the Bead with Proof

**CRITICAL**: You must use `close-with-proof.sh` to close the bead. This script:
1. Runs `bun run test`
2. Runs `bunx playwright test` (for UI tasks)
3. Only closes the bead if tests pass
4. Records the proof in the bead closure

```bash
# Close with test verification
./scripts/rbp/close-with-proof.sh <bead-id>

# For UI tasks, add --playwright flag
./scripts/rbp/close-with-proof.sh <bead-id> --playwright
```

**DO NOT** manually run `bd close` - always use `close-with-proof.sh`.

### Step 5: Signal Completion

After successfully closing the bead, output:

```
<rbp:complete/>
```

If you encounter an error you cannot resolve, output:

```
<rbp:error>Description of what went wrong</rbp:error>
```

---

## Rules

1. **One task per iteration** - Complete only the Current Task
2. **Test-gated closure** - Never close without passing tests
3. **No manual bd close** - Always use close-with-proof.sh
4. **Commit your work** - Commit changes before closing
5. **Clear signals** - Always end with `<rbp:complete/>` or `<rbp:error>`

---

## Commit Message Format

When committing, use this format:

```
[RBP] <type>: <short description>

- <detail 1>
- <detail 2>

Bead: <bead-id>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`

---

## What NOT to Do

- Do NOT implement multiple tasks
- Do NOT skip verification steps
- Do NOT close beads without test proof
- Do NOT modify unrelated code
- Do NOT add features not in the task

---

## Current Task

The task details will be appended below by Ralph.
