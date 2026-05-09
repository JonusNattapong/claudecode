# Kanban Agent Runtime Protocol

This document defines the lifecycle and protocol for AI agents/workers that interact with the Kanban task system.

## Lifecycle Overview

```
ready/todo task
    │
    ▼
  claim ─────────────────────────────┐
    │                                │
    ▼                                │
  heartbeat loop (every 30s)         │
    │                                │
    ▼                                │
  work / execute                     │
    │                                │
    ├── add evidence (commands,      │
    │    files, test output)         │
    │                                │
    ▼                                │
  verify                             │
    │                                │
    ├── ✓ all pass → complete ───────┤
    ├── ✗ some fail → fail ──────────┤
    └── missing evidence → review ───┤
                                      │
    if stopped mid-way:               │
      release (frees lease) ──────────┘
      or retry/reclaim if zombie
```

## Required Commands

| Command | Function | HTTP Endpoint |
|---------|----------|---------------|
| Find claimable tasks | `findClaimableTasks()` | `GET /api/tasks` (filter client-side) |
| Claim next task | `claimNextTask()` | `POST /api/tasks/claim-next` |
| Heartbeat | `heartbeatKanbanTask()` | `POST /api/tasks/:id/heartbeat` |
| Add evidence | `addCommandEvidence()` | `POST /api/tasks/:id/evidence` |
| Complete | `completeWithEvidence()` | `POST /api/tasks/:id/complete` |
| Fail | `failWithEvidence()` | `POST /api/tasks/:id/fail` |
| Release lease | `releaseKanbanTask()` | `POST /api/tasks/:id/release` |
| Block | `blockKanbanTask()` | `POST /api/tasks/:id/block` |
| Retry | `retryKanbanTask()` | `POST /api/tasks/:id/retry` |
| Reclaim | `reclaimKanbanTask()` | `POST /api/tasks/:id/reclaim` |

## HTTP Endpoints

### POST /api/tasks/claim-next

Claim the highest-priority available task.

**Request:**
```json
{
  "workerId": "agent-1",
  "claimedBy": "agent-1",
  "projectId": "proj-xxx",
  "allowBlocked": false
}
```

**Response (200):**
```json
{
  "task": {
    "id": "kb-xxx",
    "title": "Implement login page",
    "status": "running",
    "priority": "high",
    "lease": {
      "workerId": "agent-1",
      "claimedBy": "agent-1",
      "claimedAt": "2026-05-09T00:00:00.000Z",
      "expiresAt": "2026-05-09T00:02:00.000Z",
      "status": "active"
    }
  }
}
```

If no task available, `task` is `null`.

### POST /api/tasks/:id/heartbeat

Extend lease TTL.

**Request:**
```json
{ "workerId": "agent-1" }
```

### POST /api/tasks/:id/evidence

Attach verification evidence to a task.

**Request:**
```json
{
  "type": "command",
  "label": "npm test",
  "content": "✓ 42 tests passed"
}
```

### POST /api/tasks/:id/complete

Complete a task with optional summary.

**Request:**
```json
{
  "summary": "Login page implemented and tested",
  "workerId": "agent-1"
}
```

Note: The system checks hallucination guard and required commands before completing.

### POST /api/tasks/:id/fail

Mark a task as failed.

**Request:**
```json
{
  "reason": "Tests failed: 3 of 42 failed",
  "workerId": "agent-1"
}
```

### POST /api/tasks/:id/block

Block a task with a reason.

**Request:**
```json
{
  "reason": "Waiting for API endpoint to be deployed"
}
```

## Expected JSON Payloads

All POST/PATCH endpoints accept `Content-Type: application/json`.

**Common fields across endpoints:**
- `workerId` — identifies the agent/worker
- `claimedBy` — human-readable identifier (often same as workerId)

## Heartbeat Interval

- **Default interval:** 30 seconds (`KANBAN_HEARTBEAT_INTERVAL_MS`)
- **Lease TTL:** 120 seconds (`KANBAN_LEASE_TTL_MS`)
- **Zombie grace period:** 300 seconds (`KANBAN_ZOMBIE_GRACE_MS`)

After lease TTL expires, the lease becomes **stale**. After zombie grace period, the task becomes a **zombie** and can be reclaimed by another worker.

## Zombie Recovery

When a worker stops heartbeating:

1. **Stale** (120s+ since last heartbeat): Another worker can detect but not auto-claim.
2. **Zombie** (300s+ since expiry): Another worker can reclaim the task.

Recovery process:
```
recoverStaleTasks(rootDir, { reclaim: true, workerId: "new-worker" })
```
This detects all zombies and reclaims them for the new worker.

## Hallucination Guard Rules

Before completing a task, the system checks:

1. **Expected files** — if the task declared expected files but no files were changed, the task is moved to review instead of completed.
2. **Claimed vs verified commands** — if the task claimed commands were executed but verification has no record of them, a mismatch is flagged.
3. **Required commands** — if the task has `requiredCommands` and not all were run, the task is moved to review.

If any guard fails, the task is **not completed** but moved to `ready` status for review.

## Safe Completion Checklist

Before calling `complete`, an agent SHOULD:

- [ ] Run all required commands
- [ ] Attach evidence for each command (`POST /api/evidence`)
- [ ] Verify that test/build output is included in evidence
- [ ] Check that no expected files are missing
- [ ] Ensure all claimed commands are verifiable
- [ ] Write a summary of what was done
- [ ] Release the lease if stopping early (don't let it go zombie)

## Priority Order

When multiple tasks are claimable, the system selects in this order:

1. **High** priority first: `urgent > high > normal > low`
2. **Oldest** creation date first (within same priority)

Tasks with unmet dependencies are skipped unless `allowBlocked: true`.

## Agent Worker Helper Module

TypeScript/Node.js agents can use the helper module directly:

```typescript
import {
  findClaimableTasks,
  claimNextTask,
  startHeartbeatLoop,
  addCommandEvidence,
  completeWithEvidence,
  failWithEvidence,
  recoverStaleTasks,
} from './agentRuntime.js'
```

### Example: Full workflow

```typescript
const rootDir = '/path/to/project'
const worker = 'agent-1'

// 1. Find and claim
const result = await claimNextTask(rootDir, worker)
if (!result) { /* no work */ }
const task = result.task

// 2. Start heartbeat
const hb = startHeartbeatLoop(rootDir, task.id, worker)

// 3. Do work, add evidence
await addCommandEvidence(rootDir, task.id, 'npm test', '✓ all tests pass', true)

// 4. Complete with evidence
const { task: completed } = await completeWithEvidence(rootDir, task.id, 'Implemented login', [
  { command: 'npm test', output: '✓ 42 pass', passed: true },
])

// 5. Stop heartbeat
hb.stop()
```

### Example: Failure with evidence

```typescript
await failWithEvidence(rootDir, task.id, 'Implementation incomplete', [
  { command: 'npm test', output: '3 failures', passed: false },
])
```

### Example: Recovery

```typescript
const summary = await recoverStaleTasks(rootDir, {
  reclaim: true,
  workerId: 'agent-2',
  claimedBy: 'agent-2',
})
// { stale: 2, zombies: 1, reclaimed: 1 }
```

## Worker CLI

The `/kanban worker` command runs a headless worker that claims tasks, executes commands, collects evidence, and completes or fails tasks autonomously.

### Basic usage

```bash
# Process one task then exit
/kanban worker --worker my-agent --cmd "echo done"

# Run continuously in loop mode
/kanban worker --worker my-agent --loop --cmd "echo done"

# Dry-run: show what would be claimed
/kanban worker --worker my-agent --dry-run
```

### Full options

```
/kanban worker --worker <id>
  [--once] [--loop]
  [--cmd "<shell-command>"]
  [--cmd-argv '<json-array>']       -- preferred: safe spawn mode
  [--verify "<shell-command>"]
  [--project <projectId>]
  [--max-tasks <n>]                  -- default 1 (Infinity in --loop)
  [--poll-ms <ms>]                   -- poll interval, default 30000
  [--heartbeat-ms <ms>]              -- heartbeat interval, default 30000
  [--timeout-ms <ms>]                -- command timeout, default 300000 (5min)
  [--output-limit <n>]               -- max output chars, default 5000
  [--verbose]                         -- print all progress
  [--quiet]                           -- only final results/errors
  [--dry-run]
```

### Shell mode (--cmd)

```bash
/kanban worker --worker agent-1 --cmd "bun test src/utils/kanban/"
```

Shell mode uses `child_process.exec()` with `shell: true`. This is convenient but carries risk:

**⚠️ Shell injection warning:** The `--cmd` argument accepts raw shell strings. If task data is untrusted (e.g., task titles or metadata from external sources), a malicious actor could inject shell commands. In multi-user or shared environments, restrict access to `/kanban worker --cmd`.

For untrusted task commands, prefer **argv mode**.

### Safe mode (--cmd-argv)

```bash
/kanban worker --worker agent-1 --cmd-argv '["bun","test","src/utils/kanban/"]'
```

Uses `child_process.spawn()` without shell — program and arguments are passed as separate array elements. This prevents shell injection because no shell interpretation occurs.

**Recommended for:** CI runners, automated agents processing tasks from external sources, any environment where task data may not be fully trusted.

### Task metadata command

If a task has `metadata.command` set, the worker uses it automatically:

```json
{
  "id": "kb-xxx",
  "title": "Build the app",
  "metadata": {
    "command": "bun run build",
    "verifyCommand": "bun test",
    "expectedFiles": ["dist/bundle.js", "dist/index.html"]
  }
}
```

CLI `--cmd` and `--verify` override metadata values.

### expectedFiles validation

If `task.metadata.expectedFiles` is set, the worker checks that all listed files exist under `rootDir` after command execution:

- Adds a `file` evidence item with check results
- If any files are missing, the task **fails** instead of completing
- All files must exist to reach the complete path

Example task metadata:
```json
{
  "expectedFiles": ["dist/bundle.js", "package.json", "README.md"]
}
```

### Timeout and output limits

```bash
# 10 second timeout, 1000 char output cap
/kanban worker --worker agent-1 --cmd "long-running-task" --timeout-ms 10000 --output-limit 1000
```

### Verbose and quiet

```bash
# Verbose: print every claim, heartbeat, command start/end, complete/fail
/kanban worker --worker agent-1 --verbose

# Quiet: only final results and errors
/kanban worker --worker agent-1 --quiet
```

In loop mode, verbose logs appear per task cycle. Concise mode (default) is silent unless there are errors or `--verbose` is set.

### Event lifecycle

The worker appends these events to the task's event log:

| Event | When |
|-------|------|
| `worker_started` | Worker begins processing |
| `command_started` | Command execution begins |
| `command_completed` | Command succeeded (exit 0) |
| `command_failed` | Command failed (exit != 0) |
| `verify_started` | Verify command begins |
| `verify_completed` | Verify succeeded |
| `verify_failed` | Verify failed |
| `worker_completed` | Task completed successfully |
| `worker_failed` | Task failed (command, verify, or expectedFiles) |

These appear in the dashboard's **Event Timeline** for each task.

### Recommended usage

- **Local-only**: The worker is designed for local execution. In a shared or production environment, consider running it in a sandboxed or isolated context.
- **Single worker per task**: Only one worker should claim a task at a time. Multiple workers claiming the same task will conflict (lease race condition).
- **Heartbeat keepalive**: If the worker crashes mid-task, the lease expires after `KANBAN_LEASE_TTL_MS` (120 seconds) and the task becomes reclaimable by another worker.
- **Interrupt handling**: On SIGINT/SIGTERM, the worker calls `failWithEvidence` with "Worker interrupted" and releases the lease best-effort.
