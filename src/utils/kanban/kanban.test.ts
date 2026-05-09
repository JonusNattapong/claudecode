import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { call, parseKanbanArgs } from '../../commands/kanban/kanban.js'
import { runWithCwdOverride } from '../cwd.js'
import {
  addEvidenceToTask,
  addKanbanTask,
  archiveKanbanTask,
  assignKanbanTask,
  blockKanbanTask,
  claimKanbanTask,
  createProject,
  createWorkspace,
  deleteKanbanTask,
  detectKanbanFileConflicts,
  detectZombieTasks,
  editKanbanTask,
  ensureDefaultWorkspace,
  exportKanbanMarkdown,
  failKanbanTask,
  generateArtifact,
  getCurrentArtifact,
  generateArtifact,
  getDefaultProject,
  getKanbanTask,
  getKanbanPaths,
  getProjectBoardPath,
  getTaskArtifacts,
  getTaskEvents,
  heartbeatKanbanTask,
  initKanbanBoard,
  listKanbanFiles,
  listProjects,
  listStaleTasks,
  listWorkspaces,
  listZombieTasks,
  moveKanbanTask,
  readKanbanBoard,
  reclaimKanbanTask,
  recoverStaleClaimedTasks,
  releaseKanbanTask,
  retryKanbanTask,
  selectArtifact,
  unblockKanbanTask,
  verifyAndCompleteTask,
  verifyKanbanTask,
  writeKanbanBoard,
} from './store.js'
import { renderKanbanMarkdown } from './markdown.js'
import { validateBoard, validateRelativeSafePath } from './validation.js'
import { startKanbanServer } from './server.js'
import {
  addCommandEvidence,
  claimNextTask,
  completeWithEvidence,
  failWithEvidence,
  findClaimableTasks,
  recoverStaleTasks,
  startHeartbeatLoop,
} from './agentRuntime.js'
import { processTask, runKanbanWorker } from './worker.js'
import {
  listWorkers,
  getWorker,
  registerWorker,
  heartbeatWorker,
  markWorkerOffline,
  unregisterWorker,
  clearWorkerTask,
} from './workers.js'

const tempDirs: string[] = []

async function makeTempWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'claude-kanban-test-'))
  tempDirs.push(dir)
  return dir
}

let tempDirsBeforeTest = 0

beforeEach(() => {
  tempDirsBeforeTest = tempDirs.length
})

afterEach(async () => {
  // Only remove dirs created during this test, not dirs created by previous tests
  while (tempDirs.length > tempDirsBeforeTest) {
    const dir = tempDirs.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }
})

describe('Kanban schema validation', () => {
  test('accepts a valid empty board', () => {
    expect(validateBoard({ version: 1, tasks: [] })).toEqual({
      version: 1,
      tasks: [],
    })
  })

  test('migrates invalid status, priority, and risk to defaults', () => {
    const baseTask = {
      id: 'kb-test-abc123',
      title: 'Coordinate work',
      status: 'todo',
      owner: 'ai-orchestrator',
      priority: 'normal',
      risk: 'normal',
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
    }

    const result1 = validateBoard({ version: 1, tasks: [{ ...baseTask, status: 'Doing' }] })
    expect(result1.tasks[0].status).toBe('todo')

    const result2 = validateBoard({ version: 1, tasks: [{ ...baseTask, priority: 'Urgent' }] })
    expect(result2.tasks[0].priority).toBe('normal')

    const result3 = validateBoard({ version: 1, tasks: [{ ...baseTask, risk: 'Severe' }] })
    expect(result3.tasks[0].risk).toBe('normal')
  })

  test('accepts legacy tasks without blockers metadata', () => {
    const task = {
      id: 'kb-test-abc123',
      title: 'Legacy task',
      status: 'todo',
      owner: 'ai-orchestrator',
      assignedAgent: '',
      priority: 'normal',
      risk: 'normal',
      scope: [],
      files: [],
      validation: [],
      notes: '',
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
    }

    const result = validateBoard({ version: 1, tasks: [task] }).tasks[0]
    expect(result.id).toBe(task.id)
    expect(result.title).toBe(task.title)
    expect(result.status).toBe('todo')
    expect(result.owner).toBe('ai-orchestrator')
    expect(result.priority).toBe('normal')
  })

  test('rejects unsafe file paths', () => {
    expect(() => validateRelativeSafePath('../outside.ts')).toThrow(
      'cannot traverse',
    )
    expect(() => validateRelativeSafePath('/absolute.ts')).toThrow(
      'must be relative',
    )
    expect(() => validateRelativeSafePath('.env')).toThrow(
      'sensitive files',
    )
    expect(validateRelativeSafePath('src/utils/kanban/store.ts')).toBe(
      'src/utils/kanban/store.ts',
    )
  })
})

describe('Kanban store', () => {
  test('initializes an empty board without overwriting an existing one', async () => {
    const cwd = await makeTempWorkspace()
    const first = await initKanbanBoard(cwd)
    const second = await initKanbanBoard(cwd)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(await readKanbanBoard(cwd)).toEqual({ version: 1, tasks: [] })
  })

  test('adds, lists via store read, and moves a task', async () => {
    const cwd = await makeTempWorkspace()
    const added = await addKanbanTask(
      {
        title: 'Implement Kanban store',
        priority: 'high',
        risk: 'normal',
        files: ['src/utils/kanban/store.ts'],
        validation: ['bun test src/utils/kanban/kanban.test.ts'],
      },
      cwd,
    )

    expect(added.task.status).toBe('todo')
    expect(added.task.owner).toBe('ai-orchestrator')
    expect(added.board.tasks).toHaveLength(1)

    const moved = await moveKanbanTask(added.task.id, 'running', cwd, {
      assignedAgent: 'worker-1',
    })
    expect(moved.task.status).toBe('running')
    expect(moved.task.assignedAgent).toBe('worker-1')

    const board = await readKanbanBoard(cwd)
    expect(board.tasks[0].status).toBe('running')
  })

  test('prevents parallel in-progress edits to the same file', async () => {
    const cwd = await makeTempWorkspace()
    const first = await addKanbanTask(
      {
        title: 'First edit',
        status: 'running',
        files: ['src/shared.ts'],
      },
      cwd,
    )
    expect(first.task.status).toBe('running')

    await expect(
      addKanbanTask(
        {
          title: 'Conflicting edit',
          status: 'running',
          files: ['src/shared.ts'],
        },
        cwd,
      ),
    ).rejects.toThrow('already assigned')
  })

  test('shows an existing task and errors for a missing task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Show me' }, cwd)

    await expect(getKanbanTask(task.id, cwd)).resolves.toMatchObject({
      id: task.id,
      title: 'Show me',
    })
    await expect(getKanbanTask('kb-missing-abc123', cwd)).rejects.toThrow(
      'Kanban task not found',
    )
  })

  test('edits title, priority, risk, files, and validation', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Before' }, cwd)
    const edited = await editKanbanTask(
      task.id,
      {
        title: 'After',
        priority: 'urgent',
        risk: 'high',
        files: ['src/a.ts', 'src/b.ts'],
        validation: ['bun test'],
      },
      cwd,
    )

    expect(edited.task).toMatchObject({
      title: 'After',
      priority: 'urgent',
      risk: 'high',
      files: ['src/a.ts', 'src/b.ts'],
      validation: ['bun test'],
    })

    const cleared = await editKanbanTask(
      task.id,
      { files: [], validation: [] },
      cwd,
    )
    expect(cleared.task.files).toEqual([])
    expect(cleared.task.validation).toEqual([])
  })

  test('deletes a task by exact id', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Delete me' }, cwd)

    const deleted = await deleteKanbanTask(task.id, cwd)
    expect(deleted.task.id).toBe(task.id)
    expect((await readKanbanBoard(cwd)).tasks).toEqual([])
    await expect(deleteKanbanTask(task.id, cwd)).rejects.toThrow(
      'Kanban task not found',
    )
  })

  test('assigns and clears an agent without changing status', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask(
      { title: 'Assign me', status: 'ready' },
      cwd,
    )

    const assigned = await assignKanbanTask(task.id, 'worker-1', cwd)
    expect(assigned.task.assignedAgent).toBe('worker-1')
    expect(assigned.task.status).toBe('ready')

    const cleared = await assignKanbanTask(task.id, '', cwd)
    expect(cleared.task.assignedAgent).toBe('')
    expect(cleared.task.status).toBe('ready')
  })

  test('blocks and unblocks a task while preserving prior status', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask(
      { title: 'Wait on review', status: 'running' },
      cwd,
    )

    const blocked = await blockKanbanTask(task.id, 'Needs design answer', cwd)
    expect(blocked.task.status).toBe('blocked')
    expect(blocked.task.blockers).toEqual(['Needs design answer'])
    expect(blocked.task.blockedFromStatus).toBe('running')

    const unblocked = await unblockKanbanTask(task.id, cwd)
    expect(unblocked.task.status).toBe('running')
    expect(unblocked.task.blockers).toEqual([])
    expect(unblocked.task.blockedFromStatus).toBeUndefined()
  })

  test('detects file conflicts among in-progress tasks', async () => {
    const cwd = await makeTempWorkspace()
    const now = '2026-05-08T00:00:00.000Z'
    await writeKanbanBoard(
      {
        version: 1,
        tasks: [
          {
            id: 'kb-test-aaa111',
            title: 'First',
            status: 'running',
            owner: 'ai-orchestrator',
            assignedAgent: 'worker-1',
            priority: 'normal',
            risk: 'normal',
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
            status: 'running',
            owner: 'ai-orchestrator',
            assignedAgent: 'worker-2',
            priority: 'normal',
            risk: 'normal',
            scope: [],
            files: ['src/shared.ts'],
            validation: [],
            notes: '',
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      cwd,
    )

    const conflicts = detectKanbanFileConflicts(await readKanbanBoard(cwd))
    expect(conflicts).toEqual([
      {
        file: 'src/shared.ts',
        tasks: [
          {
            id: 'kb-test-aaa111',
            title: 'First',
            status: 'running',
            assignee: 'worker-1',
          },
          {
            id: 'kb-test-bbb222',
            title: 'Second',
            status: 'running',
            assignee: 'worker-2',
          },
        ],
      },
    ])
  })

  test('lists declared files grouped by task metadata', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask(
      {
        title: 'Files',
        status: 'running',
        assignedAgent: 'reviewer',
        files: ['src/a.ts', 'src/b.ts'],
      },
      cwd,
    )

    expect(listKanbanFiles(await readKanbanBoard(cwd))).toEqual([
      {
        file: 'src/a.ts',
        taskId: task.id,
        status: 'running',
        assignee: 'reviewer',
      },
      {
        file: 'src/b.ts',
        taskId: task.id,
        status: 'running',
        assignee: 'reviewer',
      },
    ])
  })

  test('uses atomic writes without leaving temp files behind', async () => {
    const cwd = await makeTempWorkspace()
    await addKanbanTask({ title: 'Atomic' }, cwd)
    const taskDir = join(cwd, '.claude/tasks')
    const files = await readdir(taskDir)
    expect(files).toContain('kanban.json')
    expect(files.filter(file => file.includes('.tmp.'))).toEqual([])
  })

  test('writes only the fixed board paths under the workspace', async () => {
    const cwd = await makeTempWorkspace()
    const paths = getKanbanPaths(cwd)
    expect(paths.json).toBe(join(cwd, '.claude/tasks/kanban.json'))
    expect(paths.markdown).toBe(join(cwd, '.claude/tasks/kanban.md'))
  })

  test('includes path separator between root and .claude directory', async () => {
    const cwd = await makeTempWorkspace()
    const paths = getKanbanPaths(cwd)
    // If string concatenation were used instead of join(), the path would be
    // root.claude/... (missing separator). Verify the separator is present.
    const sep = paths.root.includes('\\') ? '\\' : '/'
    expect(paths.json).toContain(`${paths.root}${sep}.claude`)
    expect(paths.markdown).toContain(`${paths.root}${sep}.claude`)
    // Also verify the subdirectory structure is intact
    expect(paths.json).toContain(`${sep}.claude${sep}tasks${sep}kanban.json`)
    expect(paths.markdown).toContain(`${sep}.claude${sep}tasks${sep}kanban.md`)
  })

  test('rejects traversal attempts that would escape the workspace', async () => {
    const cwd = await makeTempWorkspace()
    const paths = getKanbanPaths(cwd)
    // getKanbanPaths should only produce paths under root
    expect(paths.json.startsWith(paths.root)).toBe(true)
    expect(paths.markdown.startsWith(paths.root)).toBe(true)
  })
})

describe('Kanban Markdown export', () => {
  test('renders and exports readable Markdown', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask(
      {
        title: 'Review agent coordination',
        status: 'running',
        priority: 'urgent',
        risk: 'high',
        scope: ['orchestration'],
        files: ['src/commands/kanban/kanban.ts'],
        validation: ['manual review'],
        notes: 'Check owner-only board control.',
      },
      cwd,
    )

    const board = await readKanbanBoard(cwd)
    const markdown = renderKanbanMarkdown(board, '2026-05-08T00:00:00.000Z')
    expect(markdown).toContain('# Agent Kanban')
    expect(markdown).toContain('## Running')
    expect(markdown).toContain(task.id)
    expect(markdown).toContain('Review agent coordination')
    expect(markdown).toContain('Blockers')

    const exported = await exportKanbanMarkdown(cwd)
    const content = await readFile(exported.path, { encoding: 'utf8' })
    expect(content).toContain('Review agent coordination')
  })
})

describe('/kanban command parsing', () => {
  test('parses add with quoted title and repeated fields', () => {
    const parsed = parseKanbanArgs(
      'add "Build Kanban" --priority high --risk critical --file src/a.ts --file src/b.ts --validation "bun test"',
    )
    expect(parsed.type).toBe('add')
    if (parsed.type === 'add') {
      expect(parsed.input.title).toBe('Build Kanban')
      expect(parsed.input.priority).toBe('high')
      expect(parsed.input.risk).toBe('critical')
      expect(parsed.input.files).toEqual(['src/a.ts', 'src/b.ts'])
      expect(parsed.input.validation).toEqual(['bun test'])
    }
  })

  test('parses move', () => {
    const parsed = parseKanbanArgs(
      'move kb-test-abc123 "running" --agent worker-1',
    )
    expect(parsed).toEqual({
      type: 'move',
      id: 'kb-test-abc123',
      status: 'running',
      update: { assignedAgent: 'worker-1' },
    })
  })

  test('parses edit, assign, block, unblock, conflicts, and files', () => {
    expect(
      parseKanbanArgs(
        'edit kb-test-abc123 --title "After" --priority high --risk low --file src/a.ts,src/b.ts --validation "bun test"',
      ),
    ).toEqual({
      type: 'edit',
      id: 'kb-test-abc123',
      update: {
        title: 'After',
        priority: 'high',
        risk: 'low',
        files: ['src/a.ts', 'src/b.ts'],
        validation: ['bun test'],
      },
    })
    expect(parseKanbanArgs('assign kb-test-abc123 none')).toEqual({
      type: 'assign',
      id: 'kb-test-abc123',
      assignedAgent: '',
    })
    expect(parseKanbanArgs('block kb-test-abc123 --reason "Waiting"')).toEqual({
      type: 'block',
      id: 'kb-test-abc123',
      reason: 'Waiting',
    })
    expect(parseKanbanArgs('unblock kb-test-abc123')).toEqual({
      type: 'unblock',
      id: 'kb-test-abc123',
    })
    expect(parseKanbanArgs('conflicts')).toEqual({ type: 'conflicts' })
    expect(parseKanbanArgs('files')).toEqual({ type: 'files' })
  })

  test('shows missing task errors through the command', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const result = await runWithCwdOverride(cwd, () =>
      call('show kb-missing-abc123', {} as never),
    )
    expect(result.type).toBe('text')
    if (result.type === 'text') {
      expect(result.value).toContain('Kanban task not found')
    }
  })

  test('converts unknown status, priority, and risk to defaults via migration', () => {
    const moveParsed = parseKanbanArgs('move kb-test-abc123 UnknownStatus')
    expect(moveParsed).toEqual({
      type: 'move',
      id: 'kb-test-abc123',
      status: 'todo',
      update: {},
    })

    const addParsed = parseKanbanArgs('add Task --priority UnknownPriority')
    expect(addParsed.type).toBe('add')
    if (addParsed.type === 'add') {
      expect(addParsed.input.priority).toBe('normal')
    }

    const editParsed = parseKanbanArgs('edit kb-test-abc123 --risk UnknownRisk')
    expect(editParsed).toEqual({
      type: 'edit',
      id: 'kb-test-abc123',
      update: { risk: 'UnknownRisk' },
    })
  })

  // ─── Phase 3.1: Zombies / Reclaim ───────────────────────

  test('parses zombies command', () => {
    expect(parseKanbanArgs('zombies')).toEqual({ type: 'zombies' })
  })

  test('parses reclaim with task id only', () => {
    const parsed = parseKanbanArgs('reclaim task-abc')
    expect(parsed).toEqual({ type: 'reclaim', id: 'task-abc', workerId: undefined })
  })

  test('parses reclaim with task id and worker id', () => {
    const parsed = parseKanbanArgs('reclaim task-abc w2')
    expect(parsed).toEqual({ type: 'reclaim', id: 'task-abc', workerId: 'w2' })
  })

  test('reclaim without id throws', () => {
    expect(() => parseKanbanArgs('reclaim')).toThrow('requires')
  })
})

// ─── Phase 3: Lease / Heartbeat ───────────────────────────

describe('Kanban lease and heartbeat', () => {
  test('claim a ready task moves it to running and creates lease', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Claimable', status: 'ready' }, cwd)
    expect(task.status).toBe('ready')

    const result = await claimKanbanTask(task.id, 'worker-1', 'agent-1', cwd)
    expect(result.task.status).toBe('running')
    expect(result.task.lease).toBeDefined()
    expect(result.task.lease!.workerId).toBe('worker-1')
    expect(result.task.lease!.claimedBy).toBe('agent-1')
    expect(result.task.lease!.status).toBe('active')
    expect(result.task.lease!.expiresAt).toBeDefined()
  })

  test('cannot claim a task that is not ready or todo', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Done task', status: 'done' }, cwd)
    await expect(claimKanbanTask(task.id, 'w1', 'a1', cwd)).rejects.toThrow('Cannot claim')
  })

  test('heartbeat extends lease expiry', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Heartbeat', status: 'ready' }, cwd)
    const claimed = await claimKanbanTask(task.id, 'w1', 'a1', cwd, { ttlMs: 60000 })
    const originalExpiresAt = claimed.task.lease!.expiresAt

    // Wait a tiny bit so timestamps differ
    await new Promise(r => setTimeout(r, 10))

    const hb = await heartbeatKanbanTask(task.id, 'w1', cwd)
    expect(new Date(hb.task.lease!.expiresAt).getTime()).toBeGreaterThan(
      new Date(originalExpiresAt).getTime(),
    )
    expect(hb.task.lease!.lastHeartbeatAt).toBeDefined()
    expect(hb.task.lease!.status).toBe('active')
  })

  test('heartbeat rejects wrong worker', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Wrong worker', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    await expect(heartbeatKanbanTask(task.id, 'w2', cwd)).rejects.toThrow('does not own lease')
  })

  test('release clears lease and returns to ready', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Release me', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    const released = await releaseKanbanTask(task.id, 'w1', cwd)
    expect(released.task.lease).toBeUndefined()
    expect(released.task.status).toBe('ready')
  })

  test('complete clears lease (via verifyAndComplete)', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Complete lease', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    const completed = await verifyAndCompleteTask(task.id, 'Done!', 'w1', cwd)
    expect(completed.task.status).toBe('done')
    expect(completed.task.lease).toBeUndefined()
    expect(completed.task.completedAt).toBeDefined()
  })

  test('reclaim creates new lease', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Reclaim me', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    const reclaimed = await reclaimKanbanTask(task.id, 'w2', 'a2', cwd)
    expect(reclaimed.task.lease!.workerId).toBe('w2')
    expect(reclaimed.task.lease!.claimedBy).toBe('a2')
    expect(reclaimed.task.status).toBe('running')
  })

  test('events are recorded for claim, heartbeat, release, reclaim', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Events', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    await heartbeatKanbanTask(task.id, 'w1', cwd)
    await releaseKanbanTask(task.id, 'w1', cwd)

    const board = await readKanbanBoard(cwd)
    const events = getTaskEvents(board, task.id)
    expect(events.length).toBeGreaterThanOrEqual(3)
    expect(events[0].type).toBe('claimed')
    expect(events[1].type).toBe('heartbeat')
    expect(events[2].type).toBe('released')
  })
})

// ─── Phase 3: Zombie Detection ────────────────────────────

describe('Kanban zombie detection', () => {
  test('detects stale task after lease expiry', () => {
    const now = new Date('2026-05-08T12:00:00Z')
    const past = new Date(now.getTime() - 130000).toISOString() // 130s ago, past 120s TTL
    const board = {
      version: 1 as const,
      tasks: [{
        id: 'kb-test-stale1',
        title: 'Stale task',
        status: 'running' as const,
        owner: 'test',
        createdAt: past,
        updatedAt: past,
        lease: {
          leaseId: 'kl-test1',
          workerId: 'w1',
          claimedBy: 'a1',
          claimedAt: past,
          expiresAt: past,
          heartbeatIntervalMs: 30000,
          status: 'active' as const,
        },
      }],
    }
    const stale = listStaleTasks(board, now)
    expect(stale).toHaveLength(1)

    const zombies = listZombieTasks(board, now)
    expect(zombies).toHaveLength(0) // only stale, not yet zombie
  })

  test('detects zombie task after grace period', () => {
    const now = new Date('2026-05-08T12:00:00Z')
    const veryPast = new Date(now.getTime() - 600000).toISOString() // 10min ago, past 5min grace
    const board = {
      version: 1 as const,
      tasks: [{
        id: 'kb-test-zombie1',
        title: 'Zombie task',
        status: 'running' as const,
        owner: 'test',
        createdAt: veryPast,
        updatedAt: veryPast,
        lease: {
          leaseId: 'kl-test2',
          workerId: 'w1',
          claimedBy: 'a1',
          claimedAt: veryPast,
          expiresAt: veryPast,
          heartbeatIntervalMs: 30000,
          status: 'stale' as const,
        },
      }],
    }
    const zombies = detectZombieTasks(board, now)
    expect(zombies).toHaveLength(1)
  })

  test('non-expired running task is not zombie', () => {
    const now = new Date('2026-05-08T12:00:00Z')
    const recent = new Date(now.getTime() - 10000).toISOString()
    const board = {
      version: 1 as const,
      tasks: [{
        id: 'kb-test-healthy',
        title: 'Healthy task',
        status: 'running' as const,
        owner: 'test',
        createdAt: recent,
        updatedAt: recent,
        lease: {
          leaseId: 'kl-test3',
          workerId: 'w1',
          claimedBy: 'a1',
          claimedAt: recent,
          expiresAt: new Date(now.getTime() + 60000).toISOString(),
          heartbeatIntervalMs: 30000,
          status: 'active' as const,
        },
      }],
    }
    expect(detectZombieTasks(board, now)).toHaveLength(0)
    expect(listStaleTasks(board, now)).toHaveLength(0)
  })

  test('reclaim zombie task assigns new lease', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Zombie reclaim', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    const reclaimed = await reclaimKanbanTask(task.id, 'w2', 'a2', cwd)
    expect(reclaimed.task.lease!.workerId).toBe('w2')
    expect(reclaimed.task.status).toBe('running')
  })
})

// ─── Phase 3: Retry / Fail ────────────────────────────────

describe('Kanban retry and fail', () => {
  test('fail task records error and marks done', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Fail me', status: 'running' }, cwd)
    const failed = await failKanbanTask(task.id, 'Something broke', 'w1', cwd)
    expect(failed.task.status).toBe('done')
    expect(failed.task.retry?.lastError).toBe('Something broke')
  })

  test('retry increments attempt and moves to ready', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Retry me', status: 'running' }, cwd)
    await failKanbanTask(task.id, 'First fail', 'w1', cwd)
    const retried = await retryKanbanTask(task.id, 'w1', cwd)
    expect(retried.task.retry?.attempt).toBe(2) // fail increments to 1, retry increments to 2
    expect(retried.task.status).toBe('ready')
    expect(retried.task.retry?.lastError).toBeUndefined()
  })

  test('retry blocked when maxAttempts reached', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Max retry', status: 'running' }, cwd)
    // fail increments attempt, retry also increments. With maxAttempts=3:
    // fail(1) → attempt=1, retry → attempt=2
    // fail(2) → attempt=3, retry → attempt=4 but check: 3 >= 3 => throws
    await failKanbanTask(task.id, 'Fail 1', 'w1', cwd)
    await retryKanbanTask(task.id, 'w1', cwd)
    await failKanbanTask(task.id, 'Fail 2', 'w1', cwd)
    await expect(retryKanbanTask(task.id, 'w1', cwd)).rejects.toThrow('max retry attempts')
  })

  test('retry preserves comments and events', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Preserve', status: 'running' }, cwd)
    const { commentKanbanTask } = await import('./store.js')
    await commentKanbanTask(task.id, 'user', 'Important note', cwd)
    await failKanbanTask(task.id, 'Error', 'w1', cwd)
    const retried = await retryKanbanTask(task.id, 'w1', cwd)

    expect(retried.task.comments).toHaveLength(1)
    expect(retried.task.comments![0].body).toBe('Important note')

    const board = await readKanbanBoard(cwd)
    const events = getTaskEvents(board, task.id)
    expect(events.some(e => e.type === 'commented')).toBe(true)
    expect(events.some(e => e.type === 'retried')).toBe(true)
  })
})

// ─── Phase 3: Hallucination Recovery / Verification ───────

describe('Kanban hallucination recovery and verification', () => {
  test('verify task records passed/failed', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Verify me' }, cwd)
    const v = await verifyKanbanTask(task.id, true, 'All tests pass', cwd)
    expect(v.task.verification?.passed).toBe(true)
    expect(v.task.verification?.summary).toBe('All tests pass')
  })

  test('addEvidenceToTask stores evidence', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Evidence' }, cwd)
    const e1 = await addEvidenceToTask(task.id, 'command', 'bun test', cwd, { content: '40 pass' })
    expect(e1.task.verification?.evidence).toHaveLength(1)
    expect(e1.task.verification?.evidence![0].label).toBe('bun test')
    expect(e1.task.verification?.evidence![0].type).toBe('command')

    const e2 = await addEvidenceToTask(task.id, 'file', 'src/test.ts', cwd, { path: 'src/test.ts' })
    expect(e2.task.verification?.evidence).toHaveLength(2)
  })

  test('complete without required verification moves to ready (review)', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Review needed', status: 'running' }, cwd)
    // Set required commands via hallucinationGuard
    const { editKanbanTask } = await import('./store.js')
    await editKanbanTask(task.id, {
      verification: { requiredCommands: ['bun test'] },
      hallucinationGuard: { expectedFiles: ['src/test.ts'], claimedCommands: ['bun test'], verifiedCommands: [] },
    }, cwd)

    // Try to complete - should go to ready (review) since commands are not verified
    const result = await verifyAndCompleteTask(task.id, 'Done!', 'w1', cwd)
    expect(result.task.status).toBe('ready') // moved to review
    expect(result.task.lease).toBeUndefined()
  })

  test('complete with verification passes to done', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Good task', status: 'running' }, cwd)
    await addEvidenceToTask(task.id, 'command', 'bun test', cwd, { content: '40 pass' })
    await verifyKanbanTask(task.id, true, 'All good', cwd)

    const result = await verifyAndCompleteTask(task.id, 'Done!', 'w1', cwd)
    expect(result.task.status).toBe('done')
    expect(result.task.completedAt).toBeDefined()
  })

  test('mismatch between claimed and verified commands is detected', async () => {
    const cwd = await makeTempWorkspace()
    const { editKanbanTask } = await import('./store.js')
    const { task } = await addKanbanTask({ title: 'Liar task', status: 'running' }, cwd)
    await editKanbanTask(task.id, {
      hallucinationGuard: {
        claimedCommands: ['bun test', 'bun build'],
        verifiedCommands: ['bun test'],
        expectedFiles: ['src/output.ts'],
        changedFiles: [],
      },
    }, cwd)

    const result = await verifyAndCompleteTask(task.id, 'Done!', 'w1', cwd)
    expect(result.task.status).toBe('ready') // review due to mismatch
    expect(result.task.hallucinationGuard?.mismatchDetected).toBe(true)
  })

  test('evidence events are recorded', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Evidence events' }, cwd)
    await addEvidenceToTask(task.id, 'test', 'unit tests', cwd, { content: 'pass' })
    await verifyKanbanTask(task.id, true, 'OK', cwd)

    const board = await readKanbanBoard(cwd)
    const events = getTaskEvents(board, task.id)
    expect(events.some(e => e.type === 'verification_added')).toBe(true)
    expect(events.some(e => e.type === 'verification_passed')).toBe(true)
  })

  // ─── Phase 3.1: Archive events ───────────────────────────

  test('archiveKanbanTask appends archived event', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Archive event test' }, cwd)
    await archiveKanbanTask(task.id, cwd)

    const board = await readKanbanBoard(cwd)
    const events = getTaskEvents(board, task.id)
    expect(events.some(e => e.type === 'archived')).toBe(true)
  })
})

// ─── Phase 3: Workspace / Project ─────────────────────────

describe('Kanban workspace and project', () => {
  test('default workspace is created lazily', async () => {
    const cwd = await makeTempWorkspace()
    const ws = await ensureDefaultWorkspace(cwd)
    expect(ws.id).toBeDefined()
    expect(ws.rootDir).toBe(cwd)
    expect(ws.name).toBe('default')

    // Second call returns same workspace
    const ws2 = await ensureDefaultWorkspace(cwd)
    expect(ws2.id).toBe(ws.id)
  })

  test('default project is created with workspace', async () => {
    const cwd = await makeTempWorkspace()
    const proj = await getDefaultProject(cwd)
    expect(proj.id).toBeDefined()
    expect(proj.name).toBe('default')
    expect(proj.workspaceId).toBeDefined()
  })

  test('listWorkspaces returns created workspaces', async () => {
    const cwd = await makeTempWorkspace()
    await ensureDefaultWorkspace(cwd)
    const ws = await createWorkspace('test-ws', '/tmp/test', cwd)
    const list = await listWorkspaces(cwd)
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list.some(w => w.id === ws.id)).toBe(true)
  })

  test('createProject adds a project', async () => {
    const cwd = await makeTempWorkspace()
    const ws = await ensureDefaultWorkspace(cwd)
    const proj = await createProject(ws.id, 'test-project', cwd, cwd)
    const projects = await listProjects(undefined, cwd)
    expect(projects.some(p => p.id === proj.id)).toBe(true)
  })

  test('two temp rootDirs do not leak tasks', async () => {
    const cwd1 = await makeTempWorkspace()
    const cwd2 = await makeTempWorkspace()

    const { task: t1 } = await addKanbanTask({ title: 'Task in dir1' }, cwd1)
    await addKanbanTask({ title: 'Task in dir2' }, cwd2)

    const board1 = await readKanbanBoard(cwd1)
    expect(board1.tasks).toHaveLength(1)
    expect(board1.tasks[0].id).toBe(t1.id)
  })

  // ─── Phase 3.1: Project board isolation ──────────────────

  test('getProjectBoardPath returns .kanban/projects/<id>/board.json', async () => {
    const cwd = await makeTempWorkspace()
    const ws = await ensureDefaultWorkspace(cwd)
    const proj = await createProject(ws.id, 'iso-test', cwd, cwd)
    const path = await getProjectBoardPath(proj.id, cwd)
    expect(path).toContain('.kanban')
    expect(path).toContain('projects')
    expect(path).toContain(proj.id)
    expect(path).toContain('board.json')
  })

  test('readKanbanBoard with projectId reads project-specific board', async () => {
    const cwd = await makeTempWorkspace()
    const ws = await ensureDefaultWorkspace(cwd)
    const proj = await createProject(ws.id, 'proj-board', cwd, cwd)

    // Write a task to the project board
    const { task } = await addKanbanTask(
      { title: 'Project task', projectId: proj.id, status: 'todo' },
      cwd,
    )
    // Write board with projectId
    const board = await readKanbanBoard(cwd)
    await writeKanbanBoard(board, cwd, proj.id)

    // Read back from the project-specific board
    const projBoard = await readKanbanBoard(cwd, proj.id)
    expect(projBoard.tasks.some(t => t.id === task.id)).toBe(true)
  })

  test('writeKanbanBoard with projectId persists to isolated file', async () => {
    const cwd = await makeTempWorkspace()
    const ws = await ensureDefaultWorkspace(cwd)
    const proj = await createProject(ws.id, 'isolated-write', cwd, cwd)

    const { task } = await addKanbanTask(
      { title: 'Isolated', projectId: proj.id },
      cwd,
    )
    const board = await readKanbanBoard(cwd)
    await writeKanbanBoard(board, cwd, proj.id)

    // The default board should still have the task
    const defaultBoard = await readKanbanBoard(cwd)
    expect(defaultBoard.tasks.some(t => t.id === task.id)).toBe(true)

    // The project board should also have it
    const projBoard = await readKanbanBoard(cwd, proj.id)
    expect(projBoard.tasks.some(t => t.id === task.id)).toBe(true)
  })
})

describe('Kanban Phase 13: Artifacts', () => {
  test('generateArtifact creates first artifact with version 1 and isCurrent true', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact Test', status: 'ready' }, cwd)
    const { artifact } = await generateArtifact(task.id, 'Initial build', cwd, {
      content: 'build output here',
      type: 'build',
      createdBy: 'worker-1',
    })
    expect(artifact.version).toBe(1)
    expect(artifact.isCurrent).toBe(true)
    expect(artifact.label).toBe('Initial build')
    expect(artifact.content).toBe('build output here')
    expect(artifact.type).toBe('build')
    expect(artifact.createdBy).toBe('worker-1')

    // Verify on board
    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    expect(t.artifacts).toHaveLength(1)
    expect(t.artifacts![0].isCurrent).toBe(true)
  })

  test('second generateArtifact increments version and sets as current', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact Test', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(task.id, 'First version', cwd, { createdBy: 'w1' })
    const { artifact: a2 } = await generateArtifact(task.id, 'Second version', cwd, { createdBy: 'w1' })

    expect(a1.version).toBe(1)
    // a1 was current at time of generation; re-read board to verify current state
    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    const boardA1 = t.artifacts!.find(a => a.id === a1.id)!
    expect(boardA1.isCurrent).toBe(false)
    expect(a2.version).toBe(2)
    expect(a2.isCurrent).toBe(true)

    // Verify on board — only one is current
    expect(t.artifacts).toHaveLength(2)
    expect(t.artifacts!.filter(a => a.isCurrent)).toHaveLength(1)
    expect(t.artifacts!.find(a => a.isCurrent)!.version).toBe(2)
  })

  test('getTaskArtifacts returns sorted by version DESC', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v3', cwd, { createdBy: 'w1' })

    const artifacts = await getTaskArtifacts(task.id, cwd)
    expect(artifacts).toHaveLength(3)
    expect(artifacts[0].version).toBe(3)
    expect(artifacts[1].version).toBe(2)
    expect(artifacts[2].version).toBe(1)
  })

  test('getCurrentArtifact returns the current artifact', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    const { artifact: current } = await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const found = await getCurrentArtifact(task.id, cwd)
    expect(found).toBeDefined()
    expect(found!.version).toBe(2)
    expect(found!.label).toBe('v2')
  })

  test('getCurrentArtifact returns undefined when no artifacts', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'No artifacts' }, cwd)
    const found = await getCurrentArtifact(task.id, cwd)
    expect(found).toBeUndefined()
  })

  test('selectArtifact makes selected artifact current and others non-current', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact Test', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })
    const { artifact: a3 } = await generateArtifact(task.id, 'v3', cwd, { createdBy: 'w1' })

    // Select v1 as current
    const result = await selectArtifact(task.id, a1.id, cwd)
    // re-read board to verify current state (result.artifact is the original)
    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    const boardA1 = t.artifacts!.find(a => a.id === a1.id)!
    expect(boardA1.isCurrent).toBe(true)
    expect(boardA1.version).toBe(1)

    // Verify on board — only one is current
    expect(t.artifacts!.filter(a => a.isCurrent)).toHaveLength(1)
    expect(t.artifacts!.find(a => a.isCurrent)!.id).toBe(a1.id)

    // v3 should no longer be current
    const v3 = t.artifacts!.find(a => a.version === 3)!
    expect(v3.isCurrent).toBe(false)
  })

  test('selectArtifact throws for invalid artifactId', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await expect(selectArtifact(task.id, 'invalid-artifact-id', cwd)).rejects.toThrow('not found')
  })

  test('generateArtifact throws for invalid taskId', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await expect(generateArtifact('nonexistent-task', 'label', cwd)).rejects.toThrow('not found')
  })

  test('artifact events are recorded', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Artifact Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'worker-1' })
    const board2 = await readKanbanBoard(cwd)
    const t = board2.tasks.find(x => x.id === task.id)!
    await selectArtifact(task.id, t.artifacts![0].id, cwd)

    const board3 = await readKanbanBoard(cwd)
    const events = getTaskEvents(board3, task.id)
    expect(events.some(e => e.type === 'artifact_generated')).toBe(true)
    expect(events.some(e => e.type === 'artifact_selected')).toBe(true)
  })

  // Worker + artifact integration
  test('worker completion generates an artifact', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Worker artifact', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'w1', cwd)

    const result = await processTask(cwd, { ...task, status: 'running' }, { workerId: 'w1', commandArgv: ['echo', 'hello'] })
    expect(result.status).toBe('completed')

    const board = await readKanbanBoard(cwd)
    const updated = board.tasks.find(t => t.id === task.id)!
    expect(updated.artifacts).toHaveLength(1)
    expect(updated.artifacts![0].isCurrent).toBe(true)
    expect(updated.artifacts![0].version).toBe(1)
    expect(updated.artifacts![0].type).toBe('output')
  })

  test('parseKanbanArgs artifact list', () => {
    const cmd = parseKanbanArgs('artifact list kb-test-123')
    expect(cmd.type).toBe('artifact')
    expect((cmd as any).action).toBe('list')
    expect((cmd as any).taskId).toBe('kb-test-123')
  })

  test('parseKanbanArgs artifact current', () => {
    const cmd = parseKanbanArgs('artifact current kb-test-456')
    expect(cmd.type).toBe('artifact')
    expect((cmd as any).action).toBe('current')
    expect((cmd as any).taskId).toBe('kb-test-456')
  })

  test('parseKanbanArgs artifact select', () => {
    const cmd = parseKanbanArgs('artifact select kb-test-789 ka-artifact-abc')
    expect(cmd.type).toBe('artifact')
    expect((cmd as any).action).toBe('select')
    expect((cmd as any).taskId).toBe('kb-test-789')
    expect((cmd as any).artifactId).toBe('ka-artifact-abc')
  })

  test('parseKanbanArgs artifact requires taskId', () => {
    expect(() => parseKanbanArgs('artifact list')).toThrow('requires')
    expect(() => parseKanbanArgs('artifact current')).toThrow('requires')
    expect(() => parseKanbanArgs('artifact select kb-123')).toThrow('requires')
  })

  // ─── Phase 14: CLI smoke tests ──────────────────────────

  test('call artifact list — output is concise and readable', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Smoke Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact list ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('v2') // newest first
    expect(result.value).toContain('v1')
    expect(result.value).toContain('*')  // current marker
  })

  test('call artifact list — empty state is clear', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'No Artifacts', status: 'ready' }, cwd)

    const result = await call('artifact list ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('No artifacts')
    expect(result.value).toContain(task.id)
  })

  test('call artifact current — shows current artifact', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Current Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact current ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('v2')
    expect(result.value).toContain('Current artifact')
  })

  test('call artifact current — empty state is clear', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'No Artifacts', status: 'ready' }, cwd)

    const result = await call('artifact current ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('No current artifact')
  })

  test('call artifact select — switches current and prints confirmation', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Select Test', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact select ' + task.id + ' ' + a1.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('v1')
    expect(result.value).toContain('current')

    // Verify board state
    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    expect(t.artifacts!.find(a => a.id === a1.id)!.isCurrent).toBe(true)
    expect(t.artifacts!.find(a => a.version === 2)!.isCurrent).toBe(false)
  })

  test('call artifact — invalid taskId produces clean error', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const result = await call('artifact list kb-nonexistent-000', {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('not found')
  })

  test('call artifact select — invalid artifactId produces clean error', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Bad Artifact', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })

    const result = await call('artifact select ' + task.id + ' ka-invalid-000', {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('not found')
  })

  test('call artifact — artifactId belongs to another task', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t1 } = await addKanbanTask({ title: 'Task 1', status: 'ready' }, cwd)
    const { task: t2 } = await addKanbanTask({ title: 'Task 2', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(t1.id, 'v1', cwd, { createdBy: 'w1' })

    // Try to select t1's artifact on t2
    const result = await call('artifact select ' + t2.id + ' ' + a1.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('not found')
  })

  test('owner and notes are preserved after artifact generation', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Owner Test', status: 'ready', owner: 'alice', notes: 'some notes' }, cwd)

    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })

    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    expect(t.owner).toBe('alice')
    expect(t.notes).toBe('some notes')
  })

  test('call artifact select — success message is concise', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Msg Test', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact select ' + task.id + ' ' + a1.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    // Single-line confirmation, no stack trace
    expect(result.value).toContain('Selected artifact v1 as current')
    const lines = result.value.split('\n')
    expect(lines.length).toBeLessThanOrEqual(3) // confirmation + help hint
  })
})

// ─── Phase 14: CLI smoke tests ──────────────────────────

describe('Kanban Phase 14: CLI smoke tests', () => {
  test('artifact list output is concise and readable', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Smoke Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact list ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('v2') // newest first
    expect(result.value).toContain('v1')
    expect(result.value).toContain('*')  // current marker
  })

  test('artifact list empty state is clear', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'No Artifacts', status: 'ready' }, cwd)

    const result = await call('artifact list ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('No artifacts')
    expect(result.value).toContain(task.id)
  })

  test('artifact current shows current artifact', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Current Test', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact current ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('v2')
    expect(result.value).toContain('Current artifact')
  })

  test('artifact current empty state is clear', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'No Artifacts', status: 'ready' }, cwd)

    const result = await call('artifact current ' + task.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('No current artifact')
  })

  test('artifact select switches current and prints confirmation', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Select Test', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact select ' + task.id + ' ' + a1.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('v1')
    expect(result.value).toContain('current')

    // Verify board state
    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    expect(t.artifacts!.find(a => a.id === a1.id)!.isCurrent).toBe(true)
    expect(t.artifacts!.find(a => a.version === 2)!.isCurrent).toBe(false)
  })

  test('artifact invalid taskId produces clean error', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)

    const result = await call('artifact list kb-nonexistent-000', {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('not found')
  })

  test('artifact select invalid artifactId produces clean error', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Bad Artifact', status: 'ready' }, cwd)
    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })

    const result = await call('artifact select ' + task.id + ' ka-invalid-000', {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('not found')
  })

  test('artifact cross-task artifactId produces clean error', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t1 } = await addKanbanTask({ title: 'Task 1', status: 'ready' }, cwd)
    const { task: t2 } = await addKanbanTask({ title: 'Task 2', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(t1.id, 'v1', cwd, { createdBy: 'w1' })

    // Try to select t1's artifact on t2
    const result = await call('artifact select ' + t2.id + ' ' + a1.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('not found')
  })

  test('owner and notes preserved after artifact generation', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Owner Test', status: 'ready', owner: 'alice', notes: 'some notes' }, cwd)

    await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })

    const board = await readKanbanBoard(cwd)
    const t = board.tasks.find(x => x.id === task.id)!
    expect(t.owner).toBe('alice')
    expect(t.notes).toBe('some notes')
  })

  test('artifact select success message is concise', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task } = await addKanbanTask({ title: 'Msg Test', status: 'ready' }, cwd)
    const { artifact: a1 } = await generateArtifact(task.id, 'v1', cwd, { createdBy: 'w1' })
    await generateArtifact(task.id, 'v2', cwd, { createdBy: 'w1' })

    const result = await call('artifact select ' + task.id + ' ' + a1.id, {} as any, { cwd })
    expect(result.type).toBe('text')
    expect(result.value).toContain('Selected artifact v1 as current')
    const lines = result.value.split('\n')
    expect(lines.length).toBeLessThanOrEqual(3) // confirmation + help hint
  })
})

// ─── Phase 3: Server Endpoints ────────────────────────────

describe('Kanban Phase 3 server endpoints', () => {
  test('POST /api/tasks/:id/claim claims a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Claim via API', status: 'ready' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'w1', claimedBy: 'a1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.status).toBe('running')
    expect(data.task.lease.workerId).toBe('w1')

    close()
  })

  test('POST /api/tasks/:id/heartbeat extends lease', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'HB via API', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'w1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.lease.status).toBe('active')

    close()
  })

  test('POST /api/tasks/:id/release releases lease', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Release via API', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'w1' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.lease).toBeUndefined()

    close()
  })

  test('POST /api/tasks/:id/retry retries a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Retry via API', status: 'running' }, cwd)
    await failKanbanTask(task.id, 'Error', 'w1', cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.status).toBe('ready')

    close()
  })

  test('POST /api/tasks/:id/fail fails a task', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Fail via API', status: 'running' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'API error' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.status).toBe('done')

    close()
  })

  test('POST /api/tasks/:id/verify records verification', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Verify via API' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passed: true, summary: 'API test pass' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.verification.passed).toBe(true)

    close()
  })

  test('POST /api/tasks/:id/evidence adds evidence', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Evidence via API' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'command', label: 'bun test', content: 'pass' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.verification.evidence).toHaveLength(1)
    expect(data.task.verification.evidence[0].label).toBe('bun test')

    close()
  })

  test('GET /api/tasks/:id/events returns task events', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Events via API' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/tasks/${task.id}/events`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('events')
    expect(Array.isArray(data.events)).toBe(true)

    close()
  })

  test('GET /api/zombies returns zombie tasks', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/zombies`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.zombies)).toBe(true)

    close()
  })

  test('POST /api/zombies/reclaim reclaims a zombie', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'Zombie reclaim API', status: 'ready' }, cwd)
    await claimKanbanTask(task.id, 'w1', 'a1', cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/zombies/reclaim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, workerId: 'w2', claimedBy: 'a2' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.task.lease.workerId).toBe('w2')

    close()
  })

  test('GET /api/workspaces returns workspaces', async () => {
    const cwd = await makeTempWorkspace()
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/workspaces`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.workspaces)).toBe(true)

    close()
  })

  test('POST /api/workspaces creates a workspace', async () => {
    const cwd = await makeTempWorkspace()
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'api-ws', rootDir: '/tmp/api-test' }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.workspace.name).toBe('api-ws')

    close()
  })

  test('GET /api/projects returns projects', async () => {
    const cwd = await makeTempWorkspace()
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/projects`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.projects)).toBe(true)

    close()
  })

  test('POST /api/projects creates a project', async () => {
    const cwd = await makeTempWorkspace()
    const ws = await ensureDefaultWorkspace(cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    const res = await fetch(`${url}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: ws.id, name: 'api-proj' }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.project.name).toBe('api-proj')

    close()
  })

  test('all endpoints use provided rootDir', async () => {
    const cwd = await makeTempWorkspace()
    const { task } = await addKanbanTask({ title: 'RootDir isolation', status: 'ready' }, cwd)
    const { url, close } = await startKanbanServer({ rootDir: cwd })

    // These should not throw 500
    const r1 = await fetch(`${url}/api/zombies`)
    expect(r1.status).toBe(200)

    const r2 = await fetch(`${url}/api/workspaces`)
    expect(r2.status).toBe(200)

    const r3 = await fetch(`${url}/api/tasks/${task.id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: 'w1', claimedBy: 'a1' }),
    })
    expect(r3.status).toBe(200)

    close()
  })

  // ─── Phase 6: Agent Runtime ────────────────────────────

  describe('findClaimableTasks', () => {
    test('prioritizes urgent > high > normal > low, then oldest', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      await addKanbanTask({ title: 'Normal', priority: 'normal', status: 'ready' }, cwd)
      await addKanbanTask({ title: 'Urgent', priority: 'urgent', status: 'ready' }, cwd)
      await addKanbanTask({ title: 'Low', priority: 'low', status: 'ready' }, cwd)

      const tasks = await findClaimableTasks(cwd)
      expect(tasks).toHaveLength(3)
      expect(tasks[0].title).toBe('Urgent')
      expect(tasks[1].title).toBe('Normal')
      expect(tasks[2].title).toBe('Low')
    })

    test('skips tasks with unmet dependencies by default', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      // dep with non-claimable status so blockedBy is unmet
      const { task: dep } = await addKanbanTask({ title: 'Dep', status: 'running' }, cwd)
      const now = new Date().toISOString()
      await writeKanbanBoard({
        version: 1,
        tasks: [
          { id: dep.id, title: 'Dep', status: 'running', createdAt: now, updatedAt: now },
          { id: `kb-${Date.now().toString(36)}-b1`, title: 'Blocked', status: 'ready',
            blockedBy: [dep.id], createdAt: now, updatedAt: now },
        ],
      }, cwd)
      await addKanbanTask({ title: 'Free', status: 'ready' }, cwd)

      const tasks = await findClaimableTasks(cwd)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Free')
    })

    test('includes blocked tasks when allowBlocked is true', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task: dep } = await addKanbanTask({ title: 'Dep', status: 'running' }, cwd)
      const now = new Date().toISOString()
      await writeKanbanBoard({
        version: 1,
        tasks: [
          { id: dep.id, title: 'Dep', status: 'running', createdAt: now, updatedAt: now },
          { id: `kb-${Date.now().toString(36)}-b2`, title: 'Blocked', status: 'ready',
            blockedBy: [dep.id], createdAt: now, updatedAt: now },
        ],
      }, cwd)

      const tasks = await findClaimableTasks(cwd, { allowBlocked: true })
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Blocked')
    })

    test('does not include blocked/done/archived tasks', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      await addKanbanTask({ title: 'Blocked', status: 'blocked' }, cwd)
      await addKanbanTask({ title: 'Done', status: 'done' }, cwd)
      await addKanbanTask({ title: 'Archived', status: 'archived' }, cwd)
      await addKanbanTask({ title: 'Ready', status: 'ready' }, cwd)

      const tasks = await findClaimableTasks(cwd)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Ready')
    })
  })

  describe('claimNextTask', () => {
    test('claims highest priority task', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      await addKanbanTask({ title: 'Low', priority: 'low', status: 'ready' }, cwd)
      await addKanbanTask({ title: 'High', priority: 'high', status: 'ready' }, cwd)

      const result = await claimNextTask(cwd, 'agent-1')
      expect(result).not.toBeNull()
      expect(result!.task.title).toBe('High')
      expect(result!.task.status).toBe('running')
      expect(result!.task.lease!.workerId).toBe('agent-1')
    })

    test('returns null when no tasks', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const result = await claimNextTask(cwd, 'agent-1')
      expect(result).toBeNull()
    })
  })

  describe('startHeartbeatLoop', () => {
    test('starts and stops cleanly', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'HB Test', status: 'ready' }, cwd)
      await claimKanbanTask(task.id, 'agent-1', 'agent-1', cwd)

      const hb = startHeartbeatLoop(cwd, task.id, 'agent-1', { intervalMs: 50000 })
      expect(hb.running).toBe(true)

      // Should heartbeat immediately, check lease
      await new Promise(r => setTimeout(r, 100))

      // Stop cleanly
      hb.stop()
      expect(hb.running).toBe(false)

      // Calling stop twice should not throw
      hb.stop()
    })

    test('calls onError on failed heartbeat', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const errors: Error[] = []
      const hb = startHeartbeatLoop(cwd, 'nonexistent', 'agent-1', {
        intervalMs: 50000,
        onError: (err) => { errors.push(err) },
      })

      await new Promise(r => setTimeout(r, 200))
      hb.stop()
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('addCommandEvidence', () => {
    test('adds command evidence to task', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Evid Test' }, cwd)

      await addCommandEvidence(cwd, task.id, 'npm test', '✓ 42 passed', true)

      const board = await readKanbanBoard(cwd)
      const updated = board.tasks[0]
      expect(updated.verification).toBeDefined()
      expect(updated.verification!.evidence).toHaveLength(1)
      expect(updated.verification!.evidence[0].type).toBe('command')
      expect(updated.verification!.evidence[0].label).toBe('npm test')
    })
  })

  describe('completeWithEvidence', () => {
    test('completes task when all evidence passes', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Complete Test', status: 'running' }, cwd)

      const { task: completed } = await completeWithEvidence(cwd, task.id, 'All good', [
        { command: 'npm test', output: '✓ 42 passed', passed: true },
        { command: 'npm build', output: '✓ built', passed: true },
      ])

      expect(completed.status).toBe('done')
      expect(completed.verification!.passed).toBe(true)
      expect(completed.verification!.evidence).toHaveLength(2)
    })

    test('fails task when evidence fails', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Fail Test', status: 'running' }, cwd)

      const { task: failed } = await completeWithEvidence(cwd, task.id, 'Some failed', [
        { command: 'npm test', output: '✓ 42 passed', passed: true },
        { command: 'npm lint', output: '3 errors', passed: false },
      ])

      expect(failed.status).toBe('done')
      expect(failed.verification!.passed).toBe(false)
      expect(failed.retry).toBeDefined()
      expect(failed.retry!.lastError).toContain('Evidence check failed')
    })
  })

  describe('failWithEvidence', () => {
    test('fails task and attaches evidence', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Fail Evid', status: 'running' }, cwd)

      const { task: failed } = await failWithEvidence(cwd, task.id, 'Implementation broken', [
        { command: 'npm test', output: '10 failures', passed: false },
      ])

      expect(failed.status).toBe('done')
      expect(failed.retry!.lastError).toContain('Implementation broken')
      expect(failed.verification!.evidence).toHaveLength(1)
    })
  })

  describe('recoverStaleTasks', () => {
    test('detects zombie tasks', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Zombie', status: 'ready' }, cwd)
      // Claim and wait for zombie
      const now = new Date()
      await claimKanbanTask(task.id, 'dead-worker', 'dead-worker', cwd)
      // Manually set lease to expired zombie time
      const past = new Date(now.getTime() - 600000).toISOString()
      const board = await readKanbanBoard(cwd)
      const t = board.tasks[0]
      t.lease!.claimedAt = past
      t.lease!.expiresAt = past
      t.lease!.lastHeartbeatAt = past
      await writeKanbanBoard(board, cwd)

      const summary = await recoverStaleTasks(cwd)
      expect(summary.stale).toBeGreaterThanOrEqual(1)
      expect(summary.zombies).toBeGreaterThanOrEqual(1)
    })

    test('reclaim mode reclaims zombie tasks', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Reclaimable Zombie', status: 'ready' }, cwd)
      await claimKanbanTask(task.id, 'dead-worker', 'dead-worker', cwd)

      // Force zombie state
      const past = new Date(Date.now() - 600000).toISOString()
      const board = await readKanbanBoard(cwd)
      board.tasks[0].lease!.claimedAt = past
      board.tasks[0].lease!.expiresAt = past
      board.tasks[0].lease!.lastHeartbeatAt = past
      await writeKanbanBoard(board, cwd)

      const summary = await recoverStaleTasks(cwd, {
        reclaim: true,
        workerId: 'savior',
        claimedBy: 'savior',
      })
      expect(summary.reclaimed).toBeGreaterThanOrEqual(1)

      const board2 = await readKanbanBoard(cwd)
      expect(board2.tasks[0].lease!.workerId).toBe('savior')
    })
  })

  // ─── Worker tests ──────────────────────────────────

  describe('worker', () => {
    test('processTask dry-run claims nothing', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      // No tasks added — claim returns nothing
      const gen = runKanbanWorker(cwd, { workerId: 'w1', dryRun: true })
      const result = await gen.next()
      expect(result.done).toBe(false)
      expect(result.value.status).toBe('skipped')
      expect(result.value.summary).toContain('no claimable tasks')
    })

    test('processTask --once claims highest priority', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      // Add two tasks: low priority (older) and urgent priority (newer)
      const { task: lowTask } = await addKanbanTask(
        { title: 'Low priority', status: 'ready', priority: 'low' },
        cwd,
      )
      const { task: urgentTask } = await addKanbanTask(
        { title: 'Urgent priority', status: 'ready', priority: 'urgent' },
        cwd,
      )

      // Run worker with --once (default)
      const gen = runKanbanWorker(cwd, { workerId: 'w1', cmd: 'echo done' })
      const result = await gen.next()
      expect(result.done).toBe(false)
      expect(result.value.taskId).toBe(urgentTask.id)
      expect(result.value.status).toBe('completed')

      // Verify urgent task is done, low task is still running/claimable
      const board = await readKanbanBoard(cwd)
      const urgent = board.tasks.find(t => t.id === urgentTask.id)
      const low = board.tasks.find(t => t.id === lowTask.id)
      expect(urgent?.status).toBe('done')
      expect(low?.status).toBe('ready')
    })

    test('worker command success adds evidence and completes', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask(
        { title: 'Worker success', status: 'ready' },
        cwd,
      )
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      const result = await processTask(cwd, { ...task, status: 'running' }, { workerId: 'w1', cmd: 'echo hello' })
      expect(result.status).toBe('completed')
      expect(result.taskId).toBe(task.id)
      expect(result.evidenceCount).toBeGreaterThanOrEqual(1)

      // Verify on the board
      const board = await readKanbanBoard(cwd)
      const updated = board.tasks[0]
      expect(updated.status).toBe('done')
      expect(updated.verification?.evidence).toHaveLength(1)
    })

    test('worker command failure fails task', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask(
        { title: 'Worker fail', status: 'ready' },
        cwd,
      )
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      const result = await processTask(cwd, { ...task, status: 'running' }, { workerId: 'w1', cmd: 'exit 1' })
      expect(result.status).toBe('failed')
      expect(result.summary).toContain('exit code 1')

      const board = await readKanbanBoard(cwd)
      const updated = board.tasks[0]
      expect(updated.status).toBe('done')
      expect(updated.retry?.lastError).toContain('Command exited with code')
    })

    test('verify failure fails task', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask(
        { title: 'Verify fail', status: 'ready' },
        cwd,
      )
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      const result = await processTask(
        cwd,
        { ...task, status: 'running' },
        { workerId: 'w1', cmd: 'echo ok', verifyCmd: 'exit 1' },
      )
      expect(result.status).toBe('failed')
      expect(result.summary).toContain('verify exit code 1')

      const board = await readKanbanBoard(cwd)
      const updated = board.tasks[0]
      expect(updated.verification?.evidence).toHaveLength(2)
    })

    test('heartbeat stops after task completes', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask(
        { title: 'HB complete', status: 'ready' },
        cwd,
      )
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      const result = await processTask(cwd, { ...task, status: 'running' }, { workerId: 'w1', cmd: 'echo done' })
      expect(result.status).toBe('completed')

      // Heartbeat should have been stopped — verify no active lease heartbeat
      const board = await readKanbanBoard(cwd)
      const updated = board.tasks[0]
      // Task should be done with no active lease
      expect(updated.status).toBe('done')
      expect(updated.lease).toBeUndefined()
    })

    test('output is capped', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask(
        { title: 'Output cap', status: 'ready' },
        cwd,
      )
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      // Generate output > 5000 chars
      const result = await processTask(
        cwd,
        { ...task, status: 'running' },
        { workerId: 'w1', cmd: 'python -c "print(\'x\'*6000)"' },
      )
      expect(result.status).toBe('completed')

      const board = await readKanbanBoard(cwd)
      const updated = board.tasks[0]
      const evidence = updated.verification?.evidence ?? []
      // At least one evidence item with truncated content
      expect(evidence.length).toBeGreaterThanOrEqual(1)
      const content = evidence[0].content ?? ''
      expect(content.length).toBeLessThanOrEqual(5100) // 5000 + "\n... (truncated)"
    })

    test('metadata command is used if no CLI command provided', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      // Use writeKanbanBoard to create a task with metadata (addKanbanTask doesn't support metadata in input)
      const taskId = 'kb-meta-' + Date.now().toString(36)
      await writeKanbanBoard({
        version: 1,
        tasks: [{
          id: taskId,
          title: 'Meta cmd',
          status: 'ready',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { command: 'echo metadata-command-ran' },
        }],
      }, cwd)
      await claimKanbanTask(taskId, 'w1', 'w1', cwd)

      // Read back the task with metadata
      const board = await readKanbanBoard(cwd)
      const task = board.tasks[0]

      // No --cmd provided, should use task.metadata.command
      const result = await processTask(cwd, task, { workerId: 'w1' })
      expect(result.status).toBe('completed')
      expect(result.evidenceCount).toBeGreaterThanOrEqual(1)
    })

    test('commandArgv safe execution', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Argv test', status: 'ready' }, cwd)
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      const result = await processTask(cwd, { ...task, status: 'running' }, { workerId: 'w1', commandArgv: ['echo', 'argv-success'] })
      expect(result.status).toBe('completed')
      expect(result.evidenceCount).toBeGreaterThanOrEqual(1)
    })

    test('timeout option overrides', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Timeout test', status: 'ready' }, cwd)
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      // 100ms timeout for a command that takes 5 seconds — should timeout
      const result = await processTask(cwd, { ...task, status: 'running' }, { workerId: 'w1', commandArgv: ['sleep', '5'], timeoutMs: 100 })
      expect(result.status).toBe('failed')
    })

    test('output limit option', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Output limit', status: 'ready' }, cwd)
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      // Python to generate >1000 chars of output with 200 char limit
      const result = await processTask(
        cwd,
        { ...task, status: 'running' },
        { workerId: 'w1', commandArgv: ['python', '-c', 'print("x"*6000)'], outputLimit: 200 },
      )
      expect(result.status).toBe('completed')
      const board = await readKanbanBoard(cwd)
      const evidence = board.tasks[0].verification?.evidence ?? []
      // Output should be truncated
      expect(evidence[0].content?.length).toBeLessThanOrEqual(220)
    })

    test('expectedFiles success — all files exist', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)

      // Create expected files
      const testFile = join(cwd, 'output.txt')
      writeFileSync(testFile, 'hello world')

      const { task } = await addKanbanTask(
        {
          title: 'Expected files test',
          status: 'ready',
          metadata: { command: 'echo done', expectedFiles: ['output.txt'] },
        } as any,
        cwd,
      )
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      const result = await processTask(cwd, task, { workerId: 'w1', cmd: 'echo done' })
      expect(result.status).toBe('completed')
    })

    test('expectedFiles missing causes not-done', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)

      // Use writeKanbanBoard to create task with expectedFiles metadata
      const taskId = 'kb-efile-' + Date.now().toString(36)
      await writeKanbanBoard({
        version: 1,
        tasks: [{
          id: taskId,
          title: 'Missing files test',
          status: 'ready',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { command: 'echo done', expectedFiles: ['nonexistent.txt'] },
        }],
      }, cwd)
      await claimKanbanTask(taskId, 'w1', 'w1', cwd)

      const board = await readKanbanBoard(cwd)
      const task = board.tasks[0]

      const result = await processTask(cwd, task, { workerId: 'w1', cmd: 'echo done' })
      expect(result.status).toBe('failed')
      expect(result.summary).toContain('expectedFiles missing')

      const board2 = await readKanbanBoard(cwd)
      expect(board2.tasks[0].status).toBe('done')
      expect(board2.tasks[0].retry?.lastError).toContain('Expected files missing')
    })

    test('worker event append', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Event test', status: 'ready' }, cwd)
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      await processTask(cwd, { ...task, status: 'running' }, { workerId: 'w1', cmd: 'echo ok' })

      const board = await readKanbanBoard(cwd)
      const events = board.tasks[0].events ?? []
      const eventTypes = events.map(e => e.type)
      expect(eventTypes).toContain('worker_started')
      expect(eventTypes).toContain('command_completed')
      expect(eventTypes).toContain('worker_completed')
    })

    test('releaseActiveTaskOnInterrupt releases lease', async () => {
      const cwd = await makeTempWorkspace()
      await initKanbanBoard(cwd)
      const { task } = await addKanbanTask({ title: 'Interrupt release', status: 'ready' }, cwd)
      await claimKanbanTask(task.id, 'w1', 'w1', cwd)

      // Verify lease exists
      let board = await readKanbanBoard(cwd)
      expect(board.tasks[0].lease?.workerId).toBe('w1')

      // Release via interrupt helper
      const { releaseActiveTaskOnInterrupt } = await import('./worker.js')
      await releaseActiveTaskOnInterrupt(cwd, task.id, 'w1')

      // Lease should be cleared (task marked done with failed event)
      board = await readKanbanBoard(cwd)
      expect(board.tasks[0].lease).toBeUndefined()
      expect(board.tasks[0].status).toBe('done')
      expect(board.tasks[0].events?.some(e => e.type === 'failed')).toBe(true)
    })

    // ─── CLI parser tests ───────────────────────────

    test('parseKanbanArgs worker --verbose', () => {
      const cmd = parseKanbanArgs('worker --worker w1 --verbose')
      expect(cmd.type).toBe('worker')
      expect((cmd as any).workerId).toBe('w1')
      expect((cmd as any).options.verbose).toBe(true)
    })

    test('parseKanbanArgs worker --quiet', () => {
      const cmd = parseKanbanArgs('worker --worker w1 --quiet')
      expect(cmd.type).toBe('worker')
      expect((cmd as any).options.quiet).toBe(true)
    })

    test('parseKanbanArgs worker --statuses', () => {
      const cmd = parseKanbanArgs('worker --worker w1 --statuses ready,todo')
      expect(cmd.type).toBe('worker')
      expect((cmd as any).options.statuses).toEqual(['ready', 'todo'])
    })

    test('parseKanbanArgs worker --allowBlocked', () => {
      const cmd = parseKanbanArgs('worker --worker w1 --allowBlocked')
      expect(cmd.type).toBe('worker')
      expect((cmd as any).options.allowBlocked).toBe(true)
    })

    test('parseKanbanArgs worker combined options', () => {
      const cmd = parseKanbanArgs('worker --worker w1 --once --statuses ready,todo --allowBlocked --verbose')
      expect(cmd.type).toBe('worker')
      expect((cmd as any).workerId).toBe('w1')
      expect((cmd as any).options.verbose).toBe(true)
      expect((cmd as any).options.allowBlocked).toBe(true)
      expect((cmd as any).options.statuses).toEqual(['ready', 'todo'])
    })
  })
})

describe('Kanban Phase 15: Multi-agent safety', () => {
  test('claim records claimedBy', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task } = await claimKanbanTask(t.id, 'w1', 'user-1', cwd)
    expect(task.lease?.claimedBy).toBe('user-1')
    expect(task.lease?.workerId).toBe('w1')
  })

  test('active lease blocks other workers', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    await claimKanbanTask(t.id, 'w1', 'user-1', cwd)
    await expect(
      claimKanbanTask(t.id, 'w2', 'user-2', cwd)
    ).rejects.toThrow(/already claimed/)
  })

  test('same worker can re-claim non-stale lease', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    await claimKanbanTask(t.id, 'w1', 'user-1', cwd)
    const { task } = await claimKanbanTask(t.id, 'w1', 'user-1', cwd)
    expect(task.lease?.workerId).toBe('w1')
    expect(task.lease?.status).toBe('active')
  })

  test('expired lease allows reclaim', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task: claimed } = await claimKanbanTask(t.id, 'w1', 'user-1', cwd, { ttlMs: 1 })
    await new Promise(r => setTimeout(r, 10))
    const { task } = await claimKanbanTask(t.id, 'w2', 'user-2', cwd)
    expect(task.lease?.workerId).toBe('w2')
  })

  test('leaseMinutes override', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task } = await claimKanbanTask(t.id, 'w1', 'user-1', cwd, { ttlMs: 10 * 60 * 1000 })
    const expiresAt = new Date(task.lease!.expiresAt).getTime()
    const claimedAt = new Date(task.lease!.claimedAt).getTime()
    const diffMs = expiresAt - claimedAt
    expect(diffMs).toBeGreaterThanOrEqual(9.5 * 60 * 1000)
  })

  test('cannot claim done task', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'done' }, cwd)
    await expect(
      claimKanbanTask(t.id, 'w1', 'u1', cwd)
    ).rejects.toThrow(/Cannot claim/)
  })

  test('heartbeat updates lastHeartbeatAt', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task: claimed } = await claimKanbanTask(t.id, 'w1', 'u1', cwd, { ttlMs: 60000 })
    await new Promise(r => setTimeout(r, 5))
    const { task } = await heartbeatKanbanTask(t.id, 'w1', cwd)
    expect(task.lease?.lastHeartbeatAt).toBeDefined()
    const hbTime = new Date(task.lease!.lastHeartbeatAt!).getTime()
    const claimTime = new Date(claimed.lease!.claimedAt).getTime()
    expect(hbTime).toBeGreaterThan(claimTime)
  })

  test('wrong worker heartbeat fails', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    await claimKanbanTask(t.id, 'w1', 'u1', cwd)
    await expect(
      heartbeatKanbanTask(t.id, 'w2', cwd)
    ).rejects.toThrow()
  })

  test('nonexistent task heartbeat fails', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    await expect(
      heartbeatKanbanTask('nonexistent-id', 'w1', cwd)
    ).rejects.toThrow()
  })

  test('recoverStaleClaimedTasks clears expired leases', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task: claimed } = await claimKanbanTask(t.id, 'w1', 'u1', cwd, { ttlMs: 1 })
    await new Promise(r => setTimeout(r, 10))
    const result = await recoverStaleClaimedTasks(cwd)
    expect(result.recovered).toBe(1)
    const board = await readKanbanBoard(cwd)
    const bt = board.tasks.find(x => x.id === t.id)
    expect(bt?.lease).toBeUndefined()
    expect(bt?.status).toBe('ready')
  })

  test('recoverStaleClaimedTasks leaves active leases', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    await claimKanbanTask(t.id, 'w1', 'u1', cwd, { ttlMs: 60000 })
    const result = await recoverStaleClaimedTasks(cwd)
    expect(result.recovered).toBe(0)
  })

  test('recoverStaleClaimedTasks is idempotent', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    await claimKanbanTask(t.id, 'w1', 'u1', cwd, { ttlMs: 1 })
    await new Promise(r => setTimeout(r, 10))
    const r1 = await recoverStaleClaimedTasks(cwd)
    expect(r1.recovered).toBe(1)
    const r2 = await recoverStaleClaimedTasks(cwd)
    expect(r2.recovered).toBe(0)
  })

  test('recoverStaleClaimedTasks writes stale_recovered event', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    await claimKanbanTask(t.id, 'w1', 'u1', cwd, { ttlMs: 1 })
    await new Promise(r => setTimeout(r, 10))
    await recoverStaleClaimedTasks(cwd)
    const board = await readKanbanBoard(cwd)
    const bt = board.tasks.find(x => x.id === t.id)
    expect(bt?.events?.some(e => e.type === 'stale_recovered')).toBe(true)
  })

  test('recoverStaleClaimedTasks empty board', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const result = await recoverStaleClaimedTasks(cwd)
    expect(result.recovered).toBe(0)
    expect(result.tasks).toEqual([])
  })

  test('failKanbanTask increments attempt', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task: claimed } = await claimKanbanTask(t.id, 'w1', 'u1', cwd)
    const { task } = await failKanbanTask(claimed.id, 'test failure', 'w1', cwd)
    expect(task.retry?.attempt).toBe(1)
  })

  test('failKanbanTask clears lease', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task: claimed } = await claimKanbanTask(t.id, 'w1', 'u1', cwd)
    const { task } = await failKanbanTask(claimed.id, 'test failure', 'w1', cwd)
    expect(task.lease).toBeUndefined()
  })

  test('failKanbanTask repeated failures increment', async () => {
    const cwd = await makeTempWorkspace()
    await initKanbanBoard(cwd)
    const { task: t1 } = await addKanbanTask({ title: 'T1', status: 'ready' }, cwd)
    const { task: c1 } = await claimKanbanTask(t1.id, 'w1', 'u1', cwd)
    let { task } = await failKanbanTask(c1.id, 'fail 1', 'w1', cwd)
    expect(task.retry?.attempt).toBe(1)
    const { task: t2 } = await addKanbanTask({ title: 'T2', status: 'ready' }, cwd)
    const { task: c2 } = await claimKanbanTask(t2.id, 'w1', 'u1', cwd)
    ;({ task } = await failKanbanTask(c2.id, 'fail 2', 'w1', cwd))
    expect(task.retry?.attempt).toBe(1) // new task, fresh retry counter
  })

  test('parseKanbanArgs worker heartbeat', () => {
    const cmd = parseKanbanArgs('worker heartbeat task-123 w1')
    expect(cmd.type).toBe('worker-heartbeat')
    expect((cmd as any).taskId).toBe('task-123')
    expect((cmd as any).workerId).toBe('w1')
  })

  test('parseKanbanArgs worker recover-stale', () => {
    const cmd = parseKanbanArgs('worker recover-stale')
    expect(cmd.type).toBe('worker-recover-stale')
  })

  test('parseKanbanArgs worker fail', () => {
    const cmd = parseKanbanArgs('worker fail task-123 --reason "something broke" w1')
    expect(cmd.type).toBe('worker-fail')
    expect((cmd as any).taskId).toBe('task-123')
    expect((cmd as any).reason).toBe('something broke')
    expect((cmd as any).workerId).toBe('w1')
  })

  test('parseKanbanArgs worker --lease-minutes', () => {
    const cmd = parseKanbanArgs('worker --worker w1 --once --lease-minutes 5')
    expect(cmd.type).toBe('worker')
    expect((cmd as any).options.leaseMinutes).toBe(5)
  })
})

