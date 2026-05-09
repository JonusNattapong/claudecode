import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  initKanbanBoard,
  addKanbanTask,
  getKanbanPaths,
  readKanbanBoard,
  writeKanbanBoard,
  generateArtifact,
  selectArtifact,
} from './store.js'
import { startKanbanServer } from './server.js'

const tempDirs: string[] = []

async function makeTempWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'claude-kanban-server-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }
})

describe('Kanban Server', () => {
  test('starts server on 127.0.0.1 only', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    close()
  })

  test('returns 404 for board when no board exists', async () => {
    const cwd = await makeTempWorkspace()

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/board`)
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('No Kanban board found')

    close()
  })

  test('serves dashboard HTML on root path', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')

    const html = await res.text()
    expect(html).toContain('Kanban Dashboard')
    expect(html).toContain('triage')
    expect(html).toContain('todo')

    close()
  })

  // ─── Phase 4: Dashboard content ──────────────────────────

  test('dashboard HTML includes view mode tabs', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    expect(html).toContain('Status Board')
    expect(html).toContain('Agent Board')
    expect(html).toContain('Zombie Monitor')
    expect(html).toContain('Verification Review')
    expect(html).toContain('Dependencies')
    expect(html).toContain('switchView')
    close()
  })

  test('dashboard HTML includes workspace/project selectors', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    expect(html).toContain('wsSelect')
    expect(html).toContain('projSelect')
    expect(html).toContain('kanban:workspaceId')
    expect(html).toContain('kanban:projectId')
    close()
  })

  test('dashboard HTML references zombie endpoint', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    expect(html).toContain('/api/zombies')
    close()
  })

  test('dashboard HTML references event endpoint', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    expect(html).toContain('/events')
    close()
  })

  test('dashboard HTML references reclaim and retry actions', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    expect(html).toContain('reclaim')
    expect(html).toContain('retry')
    close()
  })

  test('GET /api/board returns board data', async () => {
    const cwd = await makeTempWorkspace()
    await addKanbanTask({ title: 'Test Task' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/board`)
    expect(res.status).toBe(200)
    const board = await res.json()
    expect(board.version).toBe(1)
    expect(board.tasks).toHaveLength(1)
    expect(board.tasks[0].title).toBe('Test Task')

    close()
  })

  test('POST /api/tasks creates a new task', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Task', priority: 'high' }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.task.title).toBe('New Task')
    expect(data.task.priority).toBe('high')

    const board = await readKanbanBoard(cwd)
    expect(board.tasks).toHaveLength(1)

    close()
  })

  test('POST /api/tasks validates required title', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'High' }),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Title is required')

    close()
  })

  test('DELETE /api/tasks/:id removes a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'To Delete' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)

    const board = await readKanbanBoard(cwd)
    expect(board.tasks).toHaveLength(0)

    close()
  })

  test('PATCH /api/tasks/:id updates a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Original' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated', priority: 'urgent' }),
    })
    expect(res.status).toBe(200)

    const board = await readKanbanBoard(cwd)
    expect(board.tasks[0].title).toBe('Updated')
    expect(board.tasks[0].priority).toBe('urgent')

    close()
  })

  test('POST /api/tasks/:id/block blocks a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Block Me' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Waiting for review' }),
    })
    expect(res.status).toBe(200)

    const board = await readKanbanBoard(cwd)
    expect(board.tasks[0].status).toBe('blocked')
    expect(board.tasks[0].blockers).toContain('Waiting for review')

    close()
  })

  test('POST /api/tasks/:id/unblock unblocks a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Unblock Me' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    await fetch(`${url}/api/tasks/${task.id}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Delayed' }),
    })

    const res = await fetch(`${url}/api/tasks/${task.id}/unblock`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)

    const board = await readKanbanBoard(cwd)
    expect(board.tasks[0].status).toBe('todo')
    expect(board.tasks[0].blockers).toEqual([])

    close()
  })

  test('GET /api/files returns declared files', async () => {
    const cwd = await makeTempWorkspace()
    await addKanbanTask({ title: 'Files Task', files: ['src/a.ts', 'src/b.ts'] }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/files`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.files).toHaveLength(2)
    expect(data.files[0].file).toBe('src/a.ts')

    close()
  })

  test('GET /api/conflicts returns file conflicts', async () => {
    const cwd = await makeTempWorkspace()
    const now = '2026-05-08T00:00:00.000Z'
    const { writeKanbanBoard } = await import('./store.js')
      await writeKanbanBoard({
        version: 1,
        tasks: [
          {
            id: 'kb-test-aaa111',
            title: 'First',
            status: 'In Progress',
            owner: 'ai-orchestrator',
            assignedAgent: 'worker-1',
            priority: 'Medium',
            risk: 'Medium',
            scope: [],
            files: ['src/shared.ts'],
            validation: [],
            notes: '',
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'kb-test-bbb222',
            title: 'Second',
            status: 'In Progress',
            owner: 'ai-orchestrator',
            assignedAgent: 'worker-2',
            priority: 'Medium',
            risk: 'Medium',
            scope: [],
            files: ['src/shared.ts'],
            validation: [],
            notes: '',
            createdAt: now,
            updatedAt: now,
          },
        ],
      }, cwd)

      const { url, close } = await startKanbanServer({ rootDir: cwd })

      const res = await fetch(`${url}/api/conflicts`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.conflicts).toHaveLength(1)
      expect(data.conflicts[0].file).toBe('src/shared.ts')

      close()
  })

  test('POST /api/tasks/:id/move moves a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Move Me' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'running', assignedAgent: 'worker-1' }),
    })
    expect(res.status).toBe(200)

    const board = await readKanbanBoard(cwd)
    expect(board.tasks[0].status).toBe('running')
    expect(board.tasks[0].assignedAgent).toBe('worker-1')

    close()
  })

  test('POST /api/export exports markdown', async () => {
    const cwd = await makeTempWorkspace()
    await addKanbanTask({ title: 'Export Test' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/export`, { method: 'POST' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toContain('kanban.md')

    close()
  })

  test('returns 404 for unknown routes', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/unknown`)
    expect(res.status).toBe(404)

    close()
  })

  test('validates move status is required', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Task' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Status is required')

    close()
  })

  // ─── Phase 5: Dashboard Usability & Real-time ────────────────────

  test('dashboard HTML includes search/filter controls', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    // Search input
    expect(html).toContain('id="fSearch"')
    expect(html).toContain('placeholder="Search..."')
    // Status filter select
    expect(html).toContain('id="fStatus"')
    // Priority filter select
    expect(html).toContain('id="fPriority"')
    // Agent/owner filter
    expect(html).toContain('id="fAgent"')
    expect(html).toContain('placeholder="Agent/owner"')
    // Tag filter
    expect(html).toContain('id="fTag"')
    // Lease filter
    expect(html).toContain('id="fLease"')
    // Hide archived checkbox
    expect(html).toContain('id="fHideArchived"')
    expect(html).toContain('Hide archived')
    // Filter state persistence
    expect(html).toContain('FILTER_KEY')
    expect(html).toContain('saveFilters')
    expect(html).toContain('applyFilters')
    close()
  })

  test('dashboard HTML includes new task form modal', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    // Modal overlay
    expect(html).toContain('id="newTaskModal"')
    // Form fields
    expect(html).toContain('id="ntTitle"')
    expect(html).toContain('id="ntBody"')
    expect(html).toContain('id="ntStatus"')
    expect(html).toContain('id="ntPriority"')
    expect(html).toContain('id="ntOwner"')
    expect(html).toContain('id="ntAssignee"')
    expect(html).toContain('id="ntTags"')
    // Submit function
    expect(html).toContain('submitNewTask')
    // Close function
    expect(html).toContain('closeNewTaskModal')
    close()
  })

  test('dashboard HTML includes edit task modal', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    // Modal overlay
    expect(html).toContain('id="editTaskModal"')
    // Hidden id field
    expect(html).toContain('id="etId"')
    // Form fields
    expect(html).toContain('id="etTitle"')
    expect(html).toContain('id="etBody"')
    expect(html).toContain('id="etStatus"')
    expect(html).toContain('id="etPriority"')
    expect(html).toContain('id="etOwner"')
    expect(html).toContain('id="etAssignee"')
    expect(html).toContain('id="etTags"')
    expect(html).toContain('id="etBlockedReason"')
    // Functions
    expect(html).toContain('showEditTaskModal')
    expect(html).toContain('submitEditTask')
    expect(html).toContain('closeEditTaskModal')
    // Window task reference pattern for onclick data passing
    expect(html).toContain('__task_')
    close()
  })

  test('dashboard JavaScript references EventSource', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(url)
    const html = await res.text()
    expect(html).toContain('EventSource')
    expect(html).toContain('/api/events')
    expect(html).toContain('sseStatus')
    expect(html).toContain('tasks_updated')
    close()
  })

  test('GET /api/events returns SSE stream', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })
    const res = await fetch(`${url}/api/events`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('cache-control')).toContain('no-cache')
    // Should receive a connected event
    const reader = res.body?.getReader()
    if (reader) {
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      expect(text).toContain('connected')
      reader.cancel()
    }
    close()
  })

  test('POST /api/tasks accepts dashboard fields', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Dashboard Task',
        body: 'Task body text',
        status: 'ready',
        priority: 'high',
        owner: 'alice',
        assignee: 'bob',
        tags: ['frontend', 'urgent'],
      }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.task.title).toBe('Dashboard Task')
    expect(data.task.body).toBe('Task body text')
    expect(data.task.status).toBe('ready')
    expect(data.task.priority).toBe('high')
    expect(data.task.owner).toBe('alice')
    expect(data.task.assignee).toBe('bob')
    expect(data.task.tags).toEqual(['frontend', 'urgent'])

    close()
  })

  test('PATCH /api/tasks/:id updates editable fields', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({
      title: 'Original',
      tags: ['old'],
      blockedReason: 'Initial block',
    }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated Title',
        body: 'Updated body text',
        priority: 'urgent',
        owner: 'carol',
        assignee: 'dave',
        tags: ['updated', 'critical'],
        blockedReason: 'Still blocked',
      }),
    })
    expect(res.status).toBe(200)

    const board = await readKanbanBoard(cwd)
    expect(board.tasks[0].title).toBe('Updated Title')
    expect(board.tasks[0].body).toBe('Updated body text')
    expect(board.tasks[0].priority).toBe('urgent')
    expect(board.tasks[0].owner).toBe('carol')
    expect(board.tasks[0].assignee).toBe('dave')
    expect(board.tasks[0].tags).toEqual(['updated', 'critical'])
    expect(board.tasks[0].blockedReason).toBe('Still blocked')

    close()
  })

  test('SSE endpoint returns event-stream headers', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    // Use abort controller to close after first read
    const controller = new AbortController()
    const res = await fetch(`${url}/api/events`, {
      signal: controller.signal,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('cache-control')).toContain('no-cache')

    // Read the connected event
    const reader = res.body?.getReader()
    if (reader) {
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      expect(text).toContain('connected')
      reader.cancel()
    }
    controller.abort()
    close()
  })

  // ─── Phase 6: Agent Runtime ────────────────────────────

  test('POST /api/tasks/claim-next claims highest priority task', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    // Add tasks with different priorities
    const { task: lowTask } = await addKanbanTask({ title: 'Low Priority', priority: 'low', status: 'ready' }, cwd)
    const { task: highTask } = await addKanbanTask({ title: 'High Priority', priority: 'high', status: 'ready' }, cwd)
    const { task: urgentTask } = await addKanbanTask({ title: 'Urgent Priority', priority: 'urgent', status: 'ready' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    // Should claim urgent first (highest priority)
    const res = await fetch(`${url}/api/tasks/claim-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'agent-1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task).not.toBeNull()
    expect(data.task.id).toBe(urgentTask.id)
    expect(data.task.priority).toBe('urgent')
    expect(data.task.lease.workerId).toBe('agent-1')

    close()
  })

  test('POST /api/tasks/claim-next returns null when no claimable tasks', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    // Only add a done task — not claimable
    await addKanbanTask({ title: 'Done Task', status: 'done' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/claim-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'agent-1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task).toBeNull()

    close()
  })

  test('POST /api/tasks/claim-next validates workerId', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/claim-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('workerId is required')

    close()
  })

  test('POST /api/tasks/claim-next skips tasks with unmet dependencies', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    // Create dep with a non-claimable status so blockedBy is unmet
    const { task: depTask } = await addKanbanTask({ title: 'Dependency', status: 'running' }, cwd)
    // Create a blocked task with blockedBy pointing to dep
    const blockedId = `kb-${Date.now().toString(36)}-testid`
    const now = new Date().toISOString()
    await writeKanbanBoard({
      version: 1,
      tasks: [
        {
          id: depTask.id, title: 'Dependency', status: 'running',
          createdAt: now, updatedAt: now,
        },
        {
          id: blockedId, title: 'Blocked By Dep', status: 'ready',
          blockedBy: [depTask.id],
          createdAt: now, updatedAt: now,
        },
      ],
    }, cwd)

    // Add an independent claimable task
    const { task: freeTask } = await addKanbanTask({ title: 'Free Task', status: 'ready' }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    // Should claim the free task, not the blocked one
    const res = await fetch(`${url}/api/tasks/claim-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'agent-1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.id).toBe(freeTask.id)

    close()
  })

  test('POST /api/tasks/claim-next with allowBlocked claims blocked task', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: depTask } = await addKanbanTask({ title: 'Dep', status: 'running' }, cwd)
    const blockedId = `kb-${Date.now().toString(36)}-testbd`
    const now = new Date().toISOString()
    await writeKanbanBoard({
      version: 1,
      tasks: [
        {
          id: depTask.id, title: 'Dep', status: 'running',
          createdAt: now, updatedAt: now,
        },
        {
          id: blockedId, title: 'Blocked Task', status: 'ready',
          blockedBy: [depTask.id],
          createdAt: now, updatedAt: now,
        },
      ],
    }, cwd)

    const { url, close } = await startKanbanServer({ rootDir: cwd })

    // With allowBlocked, should claim the blocked task
    const res = await fetch(`${url}/api/tasks/claim-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'agent-1', allowBlocked: true }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task).not.toBeNull()
    expect(Array.isArray(data.task.blockedBy)).toBe(true)
    expect(data.task.blockedBy).toContain(depTask.id)

    close()
  })

  // ─── Phase 13: Artifact Endpoints ─────────────────────────

  test('POST /api/tasks/:id/artifacts generates an artifact', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact API', status: 'ready' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Build output', content: 'success', type: 'build', createdBy: 'worker-1' }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.artifact.version).toBe(1)
    expect(data.artifact.isCurrent).toBe(true)
    expect(data.artifact.label).toBe('Build output')

    close()
  })

  test('GET /api/tasks/:id/artifacts returns sorted by version DESC', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact List API', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v3', cwd, { createdBy: 'w1' })
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/artifacts`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.artifacts).toHaveLength(3)
    expect(data.artifacts[0].version).toBe(3)
    expect(data.artifacts[1].version).toBe(2)
    expect(data.artifacts[2].version).toBe(1)

    close()
  })

  test('GET /api/tasks/:id/artifacts returns 404 for unknown task', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/unknown-task-id/artifacts`)
    expect(res.status).toBe(404)

    close()
  })

  test('GET /api/tasks/:id/artifacts/current returns current artifact', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Current Artifact', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    const { artifact: current } = await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/artifacts/current`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.artifact).not.toBeNull()
    expect(data.artifact.version).toBe(2)
    expect(data.artifact.isCurrent).toBe(true)

    close()
  })

  test('GET /api/tasks/:id/artifacts/current returns null when no artifacts', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'No Artifacts', status: 'ready' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/artifacts/current`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.artifact).toBeNull()

    close()
  })

  test('POST /api/tasks/:id/artifacts/:artifactId/select switches current artifact', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Select Artifact', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v3', cwd, { createdBy: 'w1' })
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    // Select v1 as current
    const res = await fetch(`${url}/api/tasks/${task.id}/artifacts/${a1.id}`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.artifact.version).toBe(1)
    expect(data.artifact.isCurrent).toBe(true)

    // Verify on board
    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    expect(t.artifacts!.filter(a => a.isCurrent)).toHaveLength(1)
    expect(t.artifacts!.find(a => a.isCurrent)!.id).toBe(a1.id)

    close()
  })

  test('POST /api/tasks/:id/artifacts/:artifactId/select returns 400 for invalid artifact', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Invalid Select', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/artifacts/invalid-art-id`, {
      method: 'POST',
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('not found')

    close()
  })

  test('artifact endpoints respect rootDir isolation', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'RootDir Artifact', status: 'ready' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'isolated artifact', createdBy: 'w1' }),
    })
    expect(res.status).toBe(201)

    close()
  })
})