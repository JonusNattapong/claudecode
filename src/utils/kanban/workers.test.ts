import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm } from 'fs/promises'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  initKanbanBoard,
  registerWorker,
  listWorkers,
  getWorker,
  heartbeatWorker,
  markWorkerOffline,
  unregisterWorker,
  clearWorkerTask,
} from './index.js'

const tempDirs: string[] = []

async function makeTempWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'claude-worker-test-'))
  tempDirs.push(dir)
  return dir
}

let tempDirsBeforeTest = 0

beforeEach(() => {
  tempDirsBeforeTest = tempDirs.length
})

afterEach(async () => {
  while (tempDirs.length > tempDirsBeforeTest) {
    const dir = tempDirs.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }
})

describe('Worker registry', () => {
  test('registerWorker creates a worker entry', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const worker = await registerWorker(cwd, { id: 'w1', status: 'idle' })
    expect(worker.id).toBe('w1')
    expect(worker.status).toBe('idle')
    expect(worker.startedAt).toBeTruthy()
    expect(worker.lastHeartbeatAt).toBeTruthy()
  })

  test('registerWorker updates existing worker', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'idle' })
    const updated = await registerWorker(cwd, { id: 'w1', status: 'running', name: 'Test Worker' })
    expect(updated.status).toBe('running')
    expect(updated.name).toBe('Test Worker')
  })

  test('listWorkers returns all workers', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'idle' })
    await registerWorker(cwd, { id: 'w2', status: 'running' })
    const workers = await listWorkers(cwd)
    expect(workers.length).toBe(2)
  })

  test('getWorker returns single worker', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'idle' })
    const worker = await getWorker(cwd, 'w1')
    expect(worker).not.toBeNull()
    expect(worker!.id).toBe('w1')
  })

  test('getWorker returns null for unknown worker', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const worker = await getWorker(cwd, 'unknown')
    expect(worker).toBeNull()
  })

  test('heartbeatWorker updates lastHeartbeatAt', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'idle' })
    await new Promise(r => setTimeout(r, 10))
    const updated = await heartbeatWorker(cwd, 'w1', { status: 'running' })
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('running')
    expect(updated!.lastHeartbeatAt).toBeTruthy()
  })

  test('heartbeatWorker returns null for unknown worker', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const result = await heartbeatWorker(cwd, 'unknown', { status: 'running' })
    expect(result).toBeNull()
  })

  test('markWorkerOffline marks worker offline', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'idle' })
    const worker = await markWorkerOffline(cwd, 'w1')
    expect(worker).not.toBeNull()
    expect(worker!.status).toBe('offline')
  })

  test('markWorkerOffline returns null for unknown worker', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const result = await markWorkerOffline(cwd, 'unknown')
    expect(result).toBeNull()
  })

  test('unregisterWorker removes worker', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'idle' })
    const removed = await unregisterWorker(cwd, 'w1')
    expect(removed).toBe(true)
    const worker = await getWorker(cwd, 'w1')
    expect(worker).toBeNull()
  })

  test('clearWorkerTask clears currentTaskId and resets status', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'running', currentTaskId: 't1' })
    await clearWorkerTask(cwd, 'w1')
    const worker = await getWorker(cwd, 'w1')
    expect(worker).not.toBeNull()
    expect(worker!.currentTaskId).toBeUndefined()
    expect(worker!.status).toBe('idle')
  })

  test('listWorkers returns stale for workers with old heartbeat', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const kanbanDir = join(cwd, '.kanban')
    await mkdir(kanbanDir, { recursive: true })
    const workersFile = join(kanbanDir, 'workers.json')
    const oldDate = new Date(Date.now() - 100000).toISOString()
    await writeFileSync(workersFile, JSON.stringify({
      version: 1,
      workers: [{
        id: 'stale-w1',
        status: 'running',
        startedAt: oldDate,
        lastHeartbeatAt: oldDate,
      }],
    }, null, 2), 'utf8')
    const workers = await listWorkers(cwd)
    const stale = workers.find(w => w.id === 'stale-w1')
    expect(stale).not.toBeUndefined()
    expect(stale!.status).toBe('stale')
  })

  test('heartbeatWorker updates currentTaskId', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await registerWorker(cwd, { id: 'w1', status: 'running' })
    const updated = await heartbeatWorker(cwd, 'w1', { currentTaskId: 't1' })
    expect(updated).not.toBeNull()
    expect(updated!.currentTaskId).toBe('t1')
  })
})
