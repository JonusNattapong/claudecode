import {
  addEvidenceToTask,
  claimKanbanTask,
  detectZombieTasks,
  failKanbanTask,
  heartbeatKanbanTask,
  listStaleTasks,
  readKanbanBoard,
  reclaimKanbanTask,
  verifyAndCompleteTask,
  verifyKanbanTask,
} from './store.js'
import type { KanbanPriority, KanbanTask, KanbanVerificationEvidence } from './types.js'
import { KANBAN_HEARTBEAT_INTERVAL_MS } from './types.js'

// ─── Types ────────────────────────────────────────────────

export type ClaimOptions = {
  projectId?: string
  allowBlocked?: boolean
  /** Only claim tasks with one of these statuses. Default: ['ready', 'todo'] */
  statuses?: Array<'ready' | 'todo'>
  /** Lease TTL in milliseconds. Default: KANBAN_LEASE_TTL_MS (120s). */
  ttlMs?: number
}

export type HeartbeatHandle = {
  stop: () => void
  running: boolean
  /** Promise that resolves after the first heartbeat completes (or fails) */
  ready: Promise<void>
}

export type HeartbeatOptions = {
  intervalMs?: number
  onError?: (error: Error) => void
}

export type EvidenceInput = {
  command: string
  output: string
  passed: boolean
}

export type RecoveryOptions = {
  reclaim?: boolean
  workerId?: string
  claimedBy?: string
}

export type RecoverySummary = {
  stale: number
  zombies: number
  reclaimed: number
}

// ─── Priority ordering ────────────────────────────────────

const PRIORITY_ORDER: Record<KanbanPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

function priorityScore(task: KanbanTask): number {
  return task.priority !== undefined ? PRIORITY_ORDER[task.priority] : 2 // default normal
}

// ─── Claim policy ─────────────────────────────────────────

/**
 * Find claimable tasks sorted by priority (urgent first), then oldest created first.
 */
export async function findClaimableTasks(
  rootDir: string,
  options: ClaimOptions = {},
): Promise<KanbanTask[]> {
  const board = await readKanbanBoard(rootDir)
  const statuses = options.statuses ?? ['ready', 'todo']
  const projectId = options.projectId

  let tasks = board.tasks.filter(t => statuses.includes(t.status as 'ready' | 'todo'))

  // Filter by project
  if (projectId) {
    tasks = tasks.filter(t => t.projectId === projectId || !t.projectId)
  }

  // Skip tasks with unmet dependencies unless allowBlocked
  if (!options.allowBlocked) {
    const taskMap = new Map(board.tasks.map(t => [t.id, t]))
    tasks = tasks.filter(t => {
      const blockedBy = t.blockedBy ?? []
      if (blockedBy.length === 0) return true
      // All blockedBy tasks must be done/archived
      return blockedBy.every(b => {
        const bt = taskMap.get(b)
        return bt && (bt.status === 'done' || bt.status === 'archived')
      })
    })
  }

  // Sort by priority (ascending index = higher priority), then createdAt (oldest first)
  tasks.sort((a, b) => {
    const prioDiff = priorityScore(a) - priorityScore(b)
    if (prioDiff !== 0) return prioDiff
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  return tasks
}

/**
 * Claim the highest-priority claimable task.
 * Returns the claimed task, or null if none available.
 */
export async function claimNextTask(
  rootDir: string,
  worker: string,
  options: ClaimOptions & { claimedBy?: string } = {},
): Promise<{ task: KanbanTask } | null> {
  const tasks = await findClaimableTasks(rootDir, options)
  if (tasks.length === 0) return null

  const target = tasks[0]
  const { task } = await claimKanbanTask(target.id, worker, options.claimedBy ?? worker, rootDir, {
    ttlMs: options.ttlMs,
  })
  return { task }
}

// ─── Heartbeat helper ─────────────────────────────────────

/**
 * Start a periodic heartbeat loop for a claimed task.
 * Heartbeats immediately, then every intervalMs.
 * Returns a handle with `.stop()` to terminate the loop.
 */
export function startHeartbeatLoop(
  rootDir: string,
  taskId: string,
  worker: string,
  options: HeartbeatOptions = {},
): HeartbeatHandle {
  const intervalMs = options.intervalMs ?? KANBAN_HEARTBEAT_INTERVAL_MS
  let active = true
  let timerId: ReturnType<typeof setInterval> | null = null
  let firstBeatResolve: () => void = () => {}
  const firstBeatPromise = new Promise<void>((resolve) => {
    firstBeatResolve = resolve
  })

  async function beat(): Promise<void> {
    if (!active) return
    try {
      await heartbeatKanbanTask(taskId, worker, rootDir)
    } catch (error) {
      if (options.onError && error instanceof Error) {
        options.onError(error)
      }
      throw error
    }
  }

  // Heartbeat immediately
  // ready resolves on success AND failure — onError reports errors, ready signals completion
  beat()
    .then(() => { firstBeatResolve() })
    .catch(() => { firstBeatResolve() })

  timerId = setInterval(() => {
    beat().catch(() => { /* ignored, onError handles it */ })
  }, intervalMs)

  // Allow the process to exit even if the timer is still running
  if (typeof timerId === 'object' && timerId?.unref) {
    timerId.unref()
  }

  return {
    stop() {
      active = false
      if (timerId !== null) {
        clearInterval(timerId)
        timerId = null
      }
    },
    get running() {
      return active
    },
    get ready() {
      return firstBeatPromise
    },
  }
}

// ─── Evidence helpers ─────────────────────────────────────

/**
 * Add command output as evidence to a task.
 */
export async function addCommandEvidence(
  rootDir: string,
  taskId: string,
  command: string,
  output: string,
  passed: boolean,
): ReturnType<typeof addEvidenceToTask> {
  return addEvidenceToTask(
    taskId,
    'command',
    command,
    rootDir,
    {
      content: output.length > 5000 ? output.slice(0, 5000) + '\n... (truncated)' : output,
    },
  )
}

/**
 * Complete a task after attaching evidence and running verification.
 * - Adds command evidence
 * - Runs verification (pass/fail based on evidence)
 * - If verification passes, completes the task
 * - If verification fails, marks as failed
 */
export async function completeWithEvidence(
  rootDir: string,
  taskId: string,
  summary: string,
  evidenceInputs: EvidenceInput[],
): Promise<{ task: KanbanTask }> {
  // Add each piece of evidence
  for (const ev of evidenceInputs) {
    await addCommandEvidence(rootDir, taskId, ev.command, ev.output, ev.passed)
  }

  // Check if all evidence passed
  const allPassed = evidenceInputs.length === 0 || evidenceInputs.every(e => e.passed)

  if (allPassed) {
    // Verify passed, then complete
    await verifyKanbanTask(taskId, true, summary, rootDir)
    const { task } = await verifyAndCompleteTask(taskId, summary, undefined, rootDir)
    return { task }
  } else {
    // Some evidence failed — verify failed, then fail
    const failedInputs = evidenceInputs.filter(e => !e.passed)
    await verifyKanbanTask(taskId, false, `${summary}: ${failedInputs.length} evidence(s) failed`, rootDir)
    const failReasons = failedInputs.map(e => `"${e.command}" failed`).join('; ')
    const { task } = await failKanbanTask(taskId, `Evidence check failed: ${failReasons}`, undefined, rootDir)
    return { task }
  }
}

/**
 * Fail a task with evidence attached.
 */
export async function failWithEvidence(
  rootDir: string,
  taskId: string,
  reason: string,
  evidenceInputs: EvidenceInput[],
): Promise<{ task: KanbanTask }> {
  for (const ev of evidenceInputs) {
    await addCommandEvidence(rootDir, taskId, ev.command, ev.output, ev.passed)
  }
  const { task } = await failKanbanTask(taskId, reason, undefined, rootDir)
  return { task }
}

// ─── Recovery helper ──────────────────────────────────────

/**
 * Detect stale and zombie tasks. Optionally reclaim zombies.
 * Returns a summary of what was found and reclaimed.
 */
export async function recoverStaleTasks(
  rootDir: string,
  options: RecoveryOptions = {},
): Promise<RecoverySummary> {
  const board = await readKanbanBoard(rootDir)
  const now = new Date()

  const staleTasks = listStaleTasks(board, now)
  const zombieTasks = detectZombieTasks(board, now)

  let reclaimed = 0

  if (options.reclaim && options.workerId) {
    const claimedBy = options.claimedBy ?? options.workerId
    for (const zombie of zombieTasks) {
      try {
        await reclaimKanbanTask(zombie.id, options.workerId, claimedBy, rootDir)
        reclaimed++
      } catch {
        // Skip tasks that can't be reclaimed
      }
    }
  }

  // Merge zombie IDs with stale (zombies are a subset of stale)
  const zombieIds = new Set(zombieTasks.map(t => t.id))

  return {
    stale: staleTasks.length + zombieTasks.length,
    zombies: zombieTasks.length,
    reclaimed,
  }
}
