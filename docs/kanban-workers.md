# Kanban Workers

The Kanban worker system enables autonomous task processing. Workers can run locally or distributed across machines sharing a filesystem.

## Worker Registry

Workers register themselves in `.kanban/workers.json`. This file is scoped to each project/workspace root directory.

```typescript
// Worker record shape
{
  id: string              // unique worker identifier
  name?: string           // human-readable name
  status: 'idle' | 'running' | 'stale' | 'offline'
  currentTaskId?: string  // task currently being processed
  projectId?: string
  workspaceId?: string
  startedAt: string       // ISO timestamp
  lastHeartbeatAt: string // ISO timestamp — used for stale detection
  tasksCompleted?: number
  metadata?: Record<string, unknown>
}
```

A worker is marked **stale** if no heartbeat is received for 90 seconds. Stale workers are automatically detected and can be reclaimed.

## Running a Worker

### Single task (--once)
```bash
/kanban worker --worker test-runner --once --statuses ready
```

### Continuous loop
```bash
/kanban worker --worker test-runner --loop --statuses ready,todo
```

### With a specific shell command
```bash
/kanban worker --worker builder --loop --statuses ready --cmd "bun run build"
```

### With safe argv mode (no shell)
```bash
/kanban worker --worker builder --loop --statuses ready --cmd-argv '["bun","run","build"]'
```

### With verification command
```bash
/kanban worker --worker verifier --loop --statuses review --verify "bun test src/utils/kanban/"
```

### Filtering by status
```bash
/kanban worker --worker test-runner --loop --statuses ready,todo
```

### Dry run mode
```bash
/kanban worker --worker test-runner --loop --statuses ready --dry-run
```

## Safe Command Execution

### Shell mode (--cmd)
The `--cmd` flag passes the command to the system shell. This gives full shell features but carries risks:

- Shell injection if task commands contain untrusted input
- Platform-dependent behavior
- Not recommended for untrusted task commands

### Argv mode (--cmd-argv)
The `--cmd-argv` flag spawns the program directly without a shell:

```bash
/kanban worker --worker build-bot --loop --statuses ready --cmd-argv '["bun","run","build"]'
```

**Advantages:**
- No shell injection risk
- Predictable cross-platform behavior
- Explicit argument control

**Use `--cmd-argv`** for all worker commands when task commands are controlled by the system.

## expectedFiles Validation

Tasks can declare expected files in their metadata:

```json
{
  "title": "Add user auth",
  "metadata": {
    "command": "git apply < fix.patch",
    "expectedFiles": ["src/auth/user.ts", "src/auth/user.test.ts"]
  }
}
```

If any expected file is missing after command execution, the task is automatically failed with evidence. This guards against hallucinated completions.

## Worker Lifecycle

1. **Register**: Worker writes itself to `.kanban/workers.json` with status `running`
2. **Claim**: Worker claims a task from the queue (sets `currentTaskId`)
3. **Process**: Worker executes task commands, collects evidence
4. **Complete/Fail**: Task moves to done/failed, `currentTaskId` is cleared
5. **Heartbeat**: Worker sends periodic heartbeats to prevent stale detection
6. **Shutdown**: Worker marks itself offline on clean exit or interrupt

## Multi-Worker Setup

### Per-project workers
```bash
# Worker 1: handles ready tasks
/kanban worker --worker builder --loop --project myproject --statuses ready --cmd-argv '["bun","run","build"]'

# Worker 2: handles review tasks  
/kanban worker --worker verifier --loop --project myproject --statuses running --verify "bun test"
```

### Multiple workers on same machine
Each worker needs a unique `--worker <id>`:

```bash
# Terminal 1
/kanban worker --worker build-1 --loop --statuses ready

# Terminal 2
/kanban worker --worker build-2 --loop --statuses ready
```

### Distributed workers
Workers communicate via the shared filesystem (`.kanban/workers.json`). Any machine with access to the same root directory can run workers:

```bash
# On machine A
ssh machine-a "/kanban worker --worker ci-runner --loop --project myproject --statuses ready"

# On machine B
ssh machine-b "/kanban worker --worker ci-runner --loop --project myproject --statuses review --verify 'bun test'"
```

## Dashboard Worker Monitor

Open the dashboard and navigate to **Worker Monitor** tab to see:

- All registered workers with status
- Current task being processed
- Heartbeat age
- Tasks completed count
- Actions: mark offline, reclaim task

## CLI Commands

### List workers
```bash
/kanban workers
```

Output:
```
Registered workers:
- builder running (15s ago) task=kb-abc123
- verifier idle (never)
```

### Worker endpoints (HTTP API)

```bash
# List all workers
GET /api/workers

# Get single worker
GET /api/workers/:id

# Register/update worker
POST /api/workers/register
{ "id": "w1", "status": "running" }

# Worker heartbeat
POST /api/workers/:id/heartbeat
{ "status": "running", "currentTaskId": "t1" }

# Mark worker offline
POST /api/workers/:id/offline
```

## Configuration Options

| Flag | Default | Description |
|------|---------|-------------|
| `--worker <id>` | required | Unique worker identifier |
| `--once` | true | Process one task and exit |
| `--loop` | false | Continuously poll for tasks |
| `--statuses` | ready,todo | Which statuses to claim from |
| `--allowBlocked` | false | Claim blocked tasks |
| `--cmd` | — | Shell command to run |
| `--cmd-argv` | — | Safe argv array (JSON) |
| `--verify` | — | Verification command |
| `--project <id>` | — | Restrict to project |
| `--max-tasks <n>` | 1 | Max tasks per run |
| `--poll-ms <n>` | 30000 | Poll interval in loop mode |
| `--heartbeat-ms <n>` | 30000 | Heartbeat interval |
| `--timeout-ms <n>` | 300000 | Command timeout |
| `--output-limit <n>` | 5000 | Max output chars |
| `--verbose` | false | Detailed progress output |
| `--quiet` | false | Suppress all output |
| `--dry-run` | false | Show what would be claimed |

## Local-Only Warning

The Kanban worker system uses a shared filesystem for coordination. It is designed for **local-only** or **trusted shared storage** environments.

**Do not use** in multi-tenant or adversarial environments where untrusted parties can write to the kanban board. The worker coordination relies on file-based leases and heartbeats that can be spoofed.

## Best Practices

1. **Use `--cmd-argv`** over `--cmd` whenever possible
2. **Set reasonable timeouts** (`--timeout-ms`) for your commands
3. **Use `--output-limit`** to prevent unbounded output
4. **Set `--statuses`** precisely to avoid worker contention
5. **Monitor the Worker Monitor** in the dashboard for stale workers
6. **Reclaim stale tasks** promptly to avoid zombie tasks blocking the queue
