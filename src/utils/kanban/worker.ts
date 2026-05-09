import { exec } from 'child_process'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  claimNextTask,
  completeWithEvidence,
  failWithEvidence,
} from './agentRuntime.js'
import { startHeartbeatLoop, addCommandEvidence } from './agentRuntime.js'
import {
  registerWorker,
  heartbeatWorker,
  markWorkerOffline,
} from './workers.js'
import type { ClaimOptions } from './agentRuntime.js'
import type { HeartbeatHandle } from './agentRuntime.js'
import type { KanbanEvent, KanbanTask } from './types.js'
import { addEvidenceToTask, generateArtifact, readKanbanBoard, writeKanbanBoard } from './store.js'

// ─── Types ────────────────────────────────────────────────

export type WorkerOptions = {
  workerId: string
  projectId?: string
  /** Shell command to run for the task. Overrides task.metadata.command. */
  cmd?: string
  /** Shell command to verify the task result. Overrides task.metadata.verifyCommand. */
  verifyCmd?: string
  /** Max tasks to process in one run. Default: 1 for --once, Infinity for --loop. */
  maxTasks?: number
  /** Poll interval in ms when --loop. Default: 30000. */
  pollMs?: number
  /** Heartbeat interval in ms. Default: 30000 (KANBAN_HEARTBEAT_INTERVAL_MS). */
  heartbeatMs?: number
  /** If true, only show what would be claimed without claiming. */
  dryRun?: boolean
  /** Only claim tasks with one of these statuses. Default: ['ready', 'todo'] */
  statuses?: Array<'ready' | 'todo'>
  allowBlocked?: boolean
  /** Print verbose progress to stdout. Default: false. */
  verbose?: boolean
  /** Suppress all output except final results and errors. Default: false. */
  quiet?: boolean
  /**
   * Safe command mode: spawn program directly without shell.
   * Example: ['bun', 'test', 'src/utils/kanban/']
   * Preferred over --cmd for untrusted task commands.
   */
  commandArgv?: string[]
  /** Command execution timeout in ms. Default: 300000 (5 minutes). */
  timeoutMs?: number
  /** Max characters per stdout/stderr output. Default: 5000. */
  outputLimit?: number
  /** Lease duration in minutes. Default: KANBAN_LEASE_TTL_MS / 60000 (2 min). */
  leaseMinutes?: number
}

export type WorkerResult = {
  taskId: string
  title: string
  status: 'completed' | 'failed' | 'skipped' | 'released'
  summary?: string
  evidenceCount: number
}

type CommandResult = {
  stdout: string
  stderr: string
  exitCode: number
}

// ─── Defaults ─────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_OUTPUT_LIMIT = 5000

// ─── Logging ─────────────────────────────────────────────

/**
 * Progress output controlled by verbose/quiet options.
 * - verbose: detailed per-step output
 * - default (concise): minimal task-level output
 * - quiet: only errors and final summary
 */
function workerLog(options: WorkerOptions, message: string): void {
  if (options.quiet) return
  if (options.verbose) {
    console.log(`[worker] ${message}`)
    return
  }
  // Concise mode: print key progress milestones
  if (
    message.startsWith('claimed ') ||
    message.startsWith('completed') ||
    message.startsWith('failed')
  ) {
    console.log(`[worker] ${message}`)
  }
}

// ─── Event appending ──────────────────────────────────────

function createEventId(): string {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Append a worker lifecycle event to a task.
 * Internal helper used by processTask and runKanbanWorker.
 */
async function appendWorkerEvent(
  rootDir: string,
  taskId: string,
  actor: string,
  eventType: KanbanEvent['type'],
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const board = await readKanbanBoard(rootDir)
  const taskIndex = board.tasks.findIndex(t => t.id === taskId)
  if (taskIndex === -1) return

  const task = board.tasks[taskIndex]
  const event: KanbanEvent = {
    id: createEventId(),
    taskId,
    type: eventType,
    actor,
    message,
    metadata,
    createdAt: new Date().toISOString(),
  }

  const events = task.events ?? []
  const updatedTask: KanbanTask = {
    ...task,
    events: [...events, event],
    updatedAt: new Date().toISOString(),
  }

  const tasks = board.tasks.slice()
  tasks[taskIndex] = updatedTask
  await writeKanbanBoard({ ...board, tasks }, rootDir)
}

// ─── Command execution ────────────────────────────────────

/**
 * Execute a shell command via exec() with shell: true.
 * Uses options.timeoutMs and options.outputLimit.
 * ⚠️ Shell mode is inherently risky in multi-tenant environments.
 */
function executeShellCommand(
  command: string,
  timeoutMs: number,
  outputLimit: number,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = exec(
      command,
      { timeout: timeoutMs, maxBuffer: outputLimit * 2, windowsHide: true },
      (error, stdout, stderr) => {
        const exitCode = error?.code ?? (error ? 1 : 0)
        resolve({
          stdout: stdout.length > outputLimit
            ? stdout.slice(0, outputLimit) + '\n... (truncated)'
            : stdout,
          stderr: stderr.length > outputLimit
            ? stderr.slice(0, outputLimit) + '\n... (truncated)'
            : stderr,
          exitCode,
        })
      },
    )
  })
}

/**
 * Execute a command via spawn() without shell — safe mode.
 * Program and args are passed as separate array elements.
 * Captures stdout/stderr with timeout and output limit.
 */
function executeArgvCommand(
  argv: string[],
  timeoutMs: number,
  outputLimit: number,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    let killed = false
    let stdout = ''
    let stderr = ''
    let timer: ReturnType<typeof setTimeout> | null = null

    const child = spawn(argv[0], argv.slice(1), {
      windowsHide: true,
    })

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      if (!child.killed) child.kill()
    }

    timer = setTimeout(() => {
      killed = true
      cleanup()
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      const remaining = outputLimit - stdout.length
      if (remaining > 0) {
        stdout += chunk.toString().slice(0, remaining)
        if (stdout.length >= outputLimit) stdout += '\n... (truncated)'
      }
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const remaining = outputLimit - stderr.length
      if (remaining > 0) {
        stderr += chunk.toString().slice(0, remaining)
        if (stderr.length >= outputLimit) stderr += '\n... (truncated)'
      }
    })

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      const exitCode = killed ? 124 : (code ?? 0)
      resolve({ stdout, stderr, exitCode })
    })

    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      resolve({ stdout, stderr: error.message, exitCode: 1 })
    })
  })
}

/**
 * Run a command using either argv spawn mode (safe) or shell exec mode.
 */
async function executeTaskCommand(
  cmd: string,
  argv: string[] | undefined,
  timeoutMs: number,
  outputLimit: number,
): Promise<CommandResult> {
  if (argv && argv.length > 0) {
    return executeArgvCommand(argv, timeoutMs, outputLimit)
  }
  return executeShellCommand(cmd, timeoutMs, outputLimit)
}

// ─── expectedFiles validation ────────────────────────────

type FileCheckResult = {
  path: string
  found: boolean
}

/**
 * Check whether all expected files exist under rootDir.
 * Returns an array of { path, found } results.
 */
function checkExpectedFiles(
  rootDir: string,
  expectedFiles: string[],
): FileCheckResult[] {
  return expectedFiles.map(file => {
    const fullPath = join(rootDir, file)
    return { path: file, found: existsSync(fullPath) }
  })
}

// ─── Task processing ──────────────────────────────────────

/**
 * Process a single claimed task: run command, collect evidence, complete or fail.
 */
export async function processTask(
  rootDir: string,
  task: KanbanTask,
  options: WorkerOptions,
): Promise<WorkerResult> {
  const cmd = options.cmd ?? (task.metadata?.command as string | undefined)
  const verifyCmd = options.verifyCmd ?? (task.metadata?.verifyCommand as string | undefined)
  const expectedFiles = task.metadata?.expectedFiles as string[] | undefined
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const outputLimit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT

  // Start heartbeat while work is running
  let hb: HeartbeatHandle | null = null
  if (!options.dryRun) {
    await appendWorkerEvent(rootDir, task.id, options.workerId, 'worker_started', `Worker ${options.workerId} started processing task`)

    hb = startHeartbeatLoop(rootDir, task.id, options.workerId, {
      intervalMs: options.heartbeatMs,
      onError: (err) => {
        if (options.verbose) console.error(`[worker] heartbeat error for ${task.id}: ${err.message}`)
      },
    })
    workerLog(options, `[${task.id}] starting`)
    await hb.ready
  }

  try {
    const evidenceInputs: Array<{ command: string; output: string; passed: boolean }> = []

    // Run the main command
    if (cmd || options.commandArgv) {
      await appendWorkerEvent(rootDir, task.id, options.workerId, 'command_started', `Running command: ${cmd ?? options.commandArgv?.join(' ')}`)
      workerLog(options, `[${task.id}] cmd start`)

      const cmdResult = await executeTaskCommand(cmd ?? '', options.commandArgv, timeoutMs, outputLimit)
      const cmdPassed = cmdResult.exitCode === 0
      const cmdOutput = cmdResult.stderr
        ? `${cmdResult.stdout}\nstderr:\n${cmdResult.stderr}`
        : cmdResult.stdout

      evidenceInputs.push({
        command: cmd ?? options.commandArgv?.join(' ') ?? '',
        output: cmdOutput,
        passed: cmdPassed,
      })

      if (cmdPassed) {
        await appendWorkerEvent(rootDir, task.id, options.workerId, 'command_completed', `Command exited with code 0`)
      } else {
        await appendWorkerEvent(rootDir, task.id, options.workerId, 'command_failed', `Command exited with code ${cmdResult.exitCode}`)
      }

      if (!cmdPassed) {
        workerLog(options, `[${task.id}] cmd failed`)
        const { task: failedTask } = await failWithEvidence(rootDir, task.id, `Command exited with code ${cmdResult.exitCode}`, evidenceInputs)
        await appendWorkerEvent(rootDir, task.id, options.workerId, 'worker_failed', `Task failed: command exit code ${cmdResult.exitCode}`)
        return {
          taskId: failedTask.id,
          title: failedTask.title,
          status: 'failed',
          summary: `exit code ${cmdResult.exitCode}`,
          evidenceCount: evidenceInputs.length,
        }
      }
    }

    // Validate expectedFiles if present
    if (expectedFiles && expectedFiles.length > 0) {
      const fileResults = checkExpectedFiles(rootDir, expectedFiles)
      const missingFiles = fileResults.filter(f => !f.found)

      // Add file check as evidence
      const filesContent = fileResults.map(f =>
        `  ${f.found ? '✓' : '✗'} ${f.path}`
      ).join('\n')
      const filesPassed = missingFiles.length === 0

      evidenceInputs.push({
        command: '(file check)',
        output: filesContent,
        passed: filesPassed,
      })

      // Add evidence to task
      const label = `expectedFiles check (${fileResults.filter(f => f.found).length}/${fileResults.length} found)`
      await addEvidenceToTask(task.id, 'file', label, rootDir, {
        content: filesContent,
      })

      if (!filesPassed) {
        const missingList = missingFiles.map(f => `"${f.path}"`).join(', ')
        workerLog(options, `[${task.id}] expectedFiles missing: ${missingList}`)
        const { task: failedTask } = await failWithEvidence(rootDir, task.id, `Expected files missing: ${missingList}`, evidenceInputs)
        await appendWorkerEvent(rootDir, task.id, options.workerId, 'worker_failed', `Task failed: expected files missing`)
        return {
          taskId: failedTask.id,
          title: failedTask.title,
          status: 'failed',
          summary: `expectedFiles missing: ${missingFiles.length}`,
          evidenceCount: evidenceInputs.length,
        }
      }
    }

    // Run the verify command (if provided)
    if (verifyCmd) {
      await appendWorkerEvent(rootDir, task.id, options.workerId, 'verify_started', `Running verify: ${verifyCmd}`)
      workerLog(options, `[${task.id}] verify start`)

      const verifyResult = await executeTaskCommand(verifyCmd, undefined, timeoutMs, outputLimit)
      const verifyPassed = verifyResult.exitCode === 0
      const verifyOutput = verifyResult.stderr
        ? `${verifyResult.stdout}\nstderr:\n${verifyResult.stderr}`
        : verifyResult.stdout

      evidenceInputs.push({
        command: verifyCmd,
        output: verifyOutput,
        passed: verifyPassed,
      })

      if (verifyPassed) {
        await appendWorkerEvent(rootDir, task.id, options.workerId, 'verify_completed', `Verify exited with code 0`)
      } else {
        await appendWorkerEvent(rootDir, task.id, options.workerId, 'verify_failed', `Verify exited with code ${verifyResult.exitCode}`)
      }

      if (!verifyPassed) {
        workerLog(options, `[${task.id}] verify failed`)
        const { task: failedTask } = await failWithEvidence(rootDir, task.id, `Verify command exited with code ${verifyResult.exitCode}`, evidenceInputs)
        await appendWorkerEvent(rootDir, task.id, options.workerId, 'worker_failed', `Task failed: verify exit code ${verifyResult.exitCode}`)
        return {
          taskId: failedTask.id,
          title: failedTask.title,
          status: 'failed',
          summary: `verify exit code ${verifyResult.exitCode}`,
          evidenceCount: evidenceInputs.length,
        }
      }
    }

    // All commands passed (or no commands given) — complete
    workerLog(options, `[${task.id}] completed`)
    const { task: completedTask } = await completeWithEvidence(rootDir, task.id, 'Task completed by worker', evidenceInputs)
    await appendWorkerEvent(rootDir, task.id, options.workerId, 'worker_completed', `Worker completed task`)

    // Generate artifact summarizing the work
    const artifactLabel = `Worker run v${Date.now().toString(36).slice(-6)}`
    const artifactContent = evidenceInputs
      .map(e => `${e.passed ? '✓' : '✗'} ${e.command}\n${e.output}`)
      .join('\n\n')

    await generateArtifact(task.id, artifactLabel, rootDir, {
      content: artifactContent,
      type: 'output',
      createdBy: options.workerId,
    })

    return {
      taskId: completedTask.id,
      title: completedTask.title,
      status: 'completed',
      summary: 'worker completed',
      evidenceCount: evidenceInputs.length,
    }
  } finally {
    // Always stop heartbeat
    if (hb) {
      hb.stop()
    }
  }
}

// ─── Interrupt handling ────────────────────────────────────

let currentInterruptTask: { rootDir: string; taskId: string; workerId: string } | null = null

/**
 * Register the current task for interrupt handling.
 */
export function setInterruptTask(rootDir: string, taskId: string, workerId: string): void {
  currentInterruptTask = { rootDir, taskId, workerId }
}

export function clearInterruptTask(): void {
  currentInterruptTask = null
}

/**
 * Best-effort release of a task's lease on interrupt.
 * Exported for testability — does not depend on module-level state.
 */
export async function releaseActiveTaskOnInterrupt(
  rootDir: string,
  taskId: string,
  workerId: string,
): Promise<void> {
  try {
    await failWithEvidence(rootDir, taskId, 'Worker interrupted', [])
  } catch {
    // Best-effort — ignore cleanup errors
  }
}

/**
 * Handle worker interrupt using current task from module state.
 * Called by SIGINT/SIGTERM signal handlers.
 */
export async function handleWorkerInterrupt(): Promise<void> {
  const task = currentInterruptTask
  if (!task) return

  currentInterruptTask = null
  await releaseActiveTaskOnInterrupt(task.rootDir, task.taskId, task.workerId)
}

// ─── Worker loop ──────────────────────────────────────────

/**
 * Run the kanban worker loop.
 *
 * In --once mode (default), claims one task and processes it.
 * In --loop mode, continuously polls for claimable tasks.
 *
 * Yields WorkerResult for each processed task.
 */
export async function* runKanbanWorker(
  rootDir: string,
  options: WorkerOptions,
): AsyncGenerator<WorkerResult> {
  const maxTasks = options.maxTasks ?? 1
  let processed = 0
  let firstAttempt = true

  // Register worker with the durable registry (best-effort)
  let workerRegistered = false
  try {
    await registerWorker(rootDir, {
      id: options.workerId,
      name: options.workerId,
      status: 'running',
      projectId: options.projectId,
    })
    workerRegistered = true
  } catch {
    // Worker registry is optional — proceed without it
  }

  // Heartbeat loop for worker registry (separate from task heartbeat)
  let workerHeartbeatTimer: ReturnType<typeof setInterval> | null = null
  const startWorkerHeartbeat = () => {
    if (!workerRegistered) return
    const intervalMs = options.heartbeatMs ?? 30000
    workerHeartbeatTimer = setInterval(() => {
      heartbeatWorker(rootDir, options.workerId, { status: 'running' }).catch(() => {
        // Best-effort
      })
    }, intervalMs)
  }
  const stopWorkerHeartbeat = () => {
    if (workerHeartbeatTimer) {
      clearInterval(workerHeartbeatTimer)
      workerHeartbeatTimer = null
    }
  }

  startWorkerHeartbeat()

  // Register interrupt handler
  const sigIntHandler = () => {
    handleWorkerInterrupt().catch(() => {})
    process.exit(130)
  }
  const sigTermHandler = () => {
    handleWorkerInterrupt().catch(() => {})
    process.exit(143)
  }

  process.on('SIGINT', sigIntHandler)
  process.on('SIGTERM', sigTermHandler)

  try {
    while (processed < maxTasks) {
      const claimOptions: ClaimOptions = {}
      if (options.projectId) claimOptions.projectId = options.projectId
      if (options.allowBlocked) claimOptions.allowBlocked = true
      if (options.statuses) claimOptions.statuses = options.statuses
      if (options.leaseMinutes) claimOptions.ttlMs = options.leaseMinutes * 60 * 1000

      if (options.dryRun) {
        const { findClaimableTasks } = await import('./agentRuntime.js')
        const tasks = await findClaimableTasks(rootDir, claimOptions)
        if (tasks.length === 0) {
          if (firstAttempt) {
            workerLog(options, 'no claimable tasks')
            yield { taskId: '', title: '', status: 'skipped', summary: 'no claimable tasks', evidenceCount: 0 }
          }
          if (!options.pollMs) break
          await sleep(options.pollMs)
          continue
        }
        const task = tasks[0]
        processed++
        if (options.verbose) console.log(`[worker] dry-run: would claim ${task.id} (${task.title})`)
        yield {
          taskId: task.id,
          title: task.title,
          status: 'skipped',
          summary: `dry-run (would claim: "${task.title}")`,
          evidenceCount: 0,
        }
        if (!options.pollMs) break
        firstAttempt = false
        await sleep(options.pollMs)
        continue
      }

      // Try to claim the next task
      const result = await claimNextTask(rootDir, options.workerId, claimOptions)
      if (!result) {
        if (firstAttempt) {
          workerLog(options, 'no claimable tasks')
          yield { taskId: '', title: '', status: 'skipped', summary: 'no claimable tasks', evidenceCount: 0 }
        }
        if (!options.pollMs) break
        firstAttempt = false
        await sleep(options.pollMs)
        continue
      }

      const task = result.task
      if (options.verbose) console.log(`[worker] claimed ${task.id}: ${task.title}`)

      // Update worker registry with current task (best-effort)
      if (workerRegistered) {
        heartbeatWorker(rootDir, options.workerId, {
          status: 'running',
          currentTaskId: task.id,
        }).catch(() => {})
      }

      // Register for interrupt handling
      setInterruptTask(rootDir, task.id, options.workerId)

      // Process the task
      const workerResult = await processTask(rootDir, task, options)
      processed++
      firstAttempt = false

      // Clear worker registry currentTaskId (best-effort)
      if (workerRegistered) {
        const tasksCompleted = (workerResult.status === 'completed') ? 1 : 0
        heartbeatWorker(rootDir, options.workerId, {
          status: 'running',
          currentTaskId: undefined,
          tasksCompleted,
        }).catch(() => {})
      }

      // Clear interrupt tracking
      clearInterruptTask()

      yield workerResult

      // If not looping, stop after one cycle
      if (!options.pollMs) break
      await sleep(options.pollMs)
    }
  } finally {
    stopWorkerHeartbeat()
    process.off('SIGINT', sigIntHandler)
    process.off('SIGTERM', sigTermHandler)
    // Mark worker offline in registry (best-effort)
    if (workerRegistered) {
      markWorkerOffline(rootDir, options.workerId).catch(() => {})
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}