import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { KanbanTask } from './types.js'

// ─── Types ────────────────────────────────────────────────

export type WorkerStatus = 'idle' | 'running' | 'stale' | 'offline'

export type RegisteredWorker = {
  id: string
  name?: string
  status: WorkerStatus
  currentTaskId?: string
  projectId?: string
  workspaceId?: string
  startedAt: string
  lastHeartbeatAt: string
  tasksCompleted?: number
  metadata?: Record<string, unknown>
}

export type WorkerRegistry = {
  version: 1
  workers: RegisteredWorker[]
}

// ─── Constants ─────────────────────────────────────────────

const WORKERS_FILE = '.kanban/workers.json'
const WORKER_STALE_THRESHOLD_MS = 90000 // 90s without heartbeat → stale
const WORKER_VERSION = 1 as const

// ─── File helpers ─────────────────────────────────────────

function getWorkersPath(cwd: string): string {
  return join(cwd, WORKERS_FILE)
}

async function atomicWriteFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
}

function now(): string {
  return new Date().toISOString()
}

function isStale(worker: RegisteredWorker): boolean {
  const lastBeat = new Date(worker.lastHeartbeatAt).getTime()
  return Date.now() - lastBeat > WORKER_STALE_THRESHOLD_MS
}

// ─── Core CRUD ────────────────────────────────────────────

async function readWorkerRegistry(cwd: string): Promise<WorkerRegistry> {
  const path = getWorkersPath(cwd)
  try {
    const content = await readFile(path, 'utf8')
    const parsed = JSON.parse(content) as WorkerRegistry
    if (parsed.version !== WORKER_VERSION) {
      return { version: WORKER_VERSION, workers: [] }
    }
    return parsed
  } catch {
    return { version: WORKER_VERSION, workers: [] }
  }
}

async function writeWorkerRegistry(cwd: string, registry: WorkerRegistry): Promise<void> {
  const path = getWorkersPath(cwd)
  await atomicWriteFile(path, `${JSON.stringify(registry, null, 2)}\n`)
}

// ─── Public API ───────────────────────────────────────────

/**
 * List all registered workers for a rootDir.
 * Also updates stale status based on heartbeat age.
 */
export async function listWorkers(cwd: string): Promise<RegisteredWorker[]> {
  const registry = await readWorkerRegistry(cwd)
  return registry.workers.map(w => {
    if (w.status === 'offline') return w
    if (isStale(w)) return { ...w, status: 'stale' as WorkerStatus }
    return w
  })
}

/**
 * Get a single registered worker by ID.
 */
export async function getWorker(cwd: string, workerId: string): Promise<RegisteredWorker | null> {
  const workers = await listWorkers(cwd)
  return workers.find(w => w.id === workerId) ?? null
}

/**
 * Register (create or update) a worker.
 * If worker with same ID exists, updates it. Otherwise creates new.
 */
export async function registerWorker(
  cwd: string,
  worker: Omit<RegisteredWorker, 'startedAt' | 'lastHeartbeatAt'> & {
    name?: string
    startedAt?: string
    lastHeartbeatAt?: string
  },
): Promise<RegisteredWorker> {
  const registry = await readWorkerRegistry(cwd)
  const existing = registry.workers.findIndex(w => w.id === worker.id)

  const nowIso = now()
  const record: RegisteredWorker = {
    id: worker.id,
    name: worker.name,
    status: worker.status ?? 'idle',
    currentTaskId: worker.currentTaskId,
    projectId: worker.projectId,
    workspaceId: worker.workspaceId,
    startedAt: worker.startedAt ?? nowIso,
    lastHeartbeatAt: worker.lastHeartbeatAt ?? nowIso,
    tasksCompleted: worker.tasksCompleted ?? 0,
    metadata: worker.metadata,
  }

  if (existing >= 0) {
    registry.workers[existing] = record
  } else {
    registry.workers.push(record)
  }

  await writeWorkerRegistry(cwd, registry)
  return record
}

/**
 * Update heartbeat for a worker. Also updates status and optional currentTaskId.
 */
export async function heartbeatWorker(
  cwd: string,
  workerId: string,
  updates?: {
    status?: WorkerStatus
    currentTaskId?: string
    tasksCompleted?: number
    metadata?: Record<string, unknown>
  },
): Promise<RegisteredWorker | null> {
  const registry = await readWorkerRegistry(cwd)
  const idx = registry.workers.findIndex(w => w.id === workerId)
  if (idx === -1) return null

  const nowIso = now()
  const w = registry.workers[idx]

  const updated: RegisteredWorker = {
    ...w,
    lastHeartbeatAt: nowIso,
    status: updates?.status ?? (w.status === 'offline' ? 'offline' : 'running'),
    currentTaskId: updates?.currentTaskId ?? w.currentTaskId,
    tasksCompleted: updates?.tasksCompleted ?? w.tasksCompleted,
    metadata: updates?.metadata ?? w.metadata,
  }

  registry.workers[idx] = updated
  await writeWorkerRegistry(cwd, registry)
  return updated
}

/**
 * Mark a worker as offline.
 */
export async function markWorkerOffline(cwd: string, workerId: string): Promise<RegisteredWorker | null> {
  const registry = await readWorkerRegistry(cwd)
  const idx = registry.workers.findIndex(w => w.id === workerId)
  if (idx === -1) return null

  registry.workers[idx] = { ...registry.workers[idx], status: 'offline' }
  await writeWorkerRegistry(cwd, registry)
  return registry.workers[idx]
}

/**
 * Remove a worker from the registry.
 */
export async function unregisterWorker(cwd: string, workerId: string): Promise<boolean> {
  const registry = await readWorkerRegistry(cwd)
  const before = registry.workers.length
  registry.workers = registry.workers.filter(w => w.id !== workerId)
  if (registry.workers.length === before) return false
  await writeWorkerRegistry(cwd, registry)
  return true
}

/**
 * Get all stale workers (no heartbeat in 90s, not offline).
 */
export async function listStaleWorkers(cwd: string): Promise<RegisteredWorker[]> {
  const workers = await listWorkers(cwd)
  return workers.filter(w => w.status === 'stale')
}

/**
 * Clear currentTaskId from a worker (called when task completes/fails/released).
 */
export async function clearWorkerTask(cwd: string, workerId: string): Promise<void> {
  const registry = await readWorkerRegistry(cwd)
  const idx = registry.workers.findIndex(w => w.id === workerId)
  if (idx === -1) return

  registry.workers[idx] = {
    ...registry.workers[idx],
    currentTaskId: undefined,
    status: 'idle',
  }
  await writeWorkerRegistry(cwd, registry)
}