import { createServer } from 'http'
import open from 'open'
import {
  addKanbanTask,
  addEvidenceToTask,
  archiveKanbanTask,
  blockKanbanTask,
  claimKanbanTask,
  commentKanbanTask,
  completeKanbanTask,
  createProject,
  createWorkspace,
  deleteKanbanTask,
  detectKanbanFileConflicts,
  editKanbanTask,
  ensureDefaultWorkspace,
  exportKanbanMarkdown,
  failKanbanTask,
  generateArtifact,
  getCurrentArtifact,
  getDefaultProject,
  getProjectBoardPath,
  getTaskArtifacts,
  getTaskEvents,
  heartbeatKanbanTask,
  kanbanBoardExists,
  listKanbanFiles,
  listKanbanTasks,
  listProjects,
  listWorkspaces,
  moveKanbanTask,
  readKanbanBoard,
  reclaimKanbanTask,
  releaseKanbanTask,
  retryKanbanTask,
  selectArtifact,
  unblockKanbanTask,
  verifyAndCompleteTask,
  verifyKanbanTask,
} from './store.js'
import { detectZombieTasks, listZombieTasks, listStaleTasks } from './store.js'
import { claimNextTask } from './agentRuntime.js'
import { runKanbanWorker } from './worker.js'
import {
  listWorkers,
  getWorker,
  registerWorker,
  heartbeatWorker,
  markWorkerOffline,
} from './workers.js'
import type { KanbanTaskInput, KanbanTaskUpdate } from './types.js'

type ApiResponse = {
  status: number
  body: unknown
}

type ServerOptions = {
  port?: number
  rootDir?: string
}

type AssistantDraft = {
  title: string
  body?: string
  status?: KanbanTaskInput['status']
  priority?: KanbanTaskInput['priority']
  assignee?: string
  owner?: string
  tags?: string[]
}

type AssistantDraftResult = {
  draft: AssistantDraft
  source: 'anthropic' | 'heuristic'
  warning?: string
}

type AssistantCommandResult = {
  ok: boolean
  action: string
  message: string
  task?: unknown
  tasks?: unknown[]
  worker?: unknown
  workers?: unknown[]
  examples?: string[]
}

const COMMAND_STATUSES = ['triage', 'todo', 'ready', 'running', 'blocked', 'done', 'archived'] as const
const COMMAND_EXAMPLES = [
  'list tasks',
  'create task fix Kanban drag drop high @worker-a #dashboard',
  'สร้างงานแก้ dashboard high @worker-a #ui',
  'move KB-xxx ready',
  'claim KB-xxx for worker-a',
  'claim next for worker-a',
  'complete KB-xxx finished dashboard fix',
  'block KB-xxx waiting for API key',
  'retry KB-xxx',
  'archive KB-xxx',
  'register worker worker-a',
  'run worker worker-a llm',
  'list workers',
]

function parseJsonBody(body: string | null): unknown {
  if (!body) return undefined
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

function createJsonResponse(status: number, body: unknown): ApiResponse {
  return { status, body }
}

function inferAssistantPriority(text: string): KanbanTaskInput['priority'] {
  const v = text.toLowerCase()
  if (/\b(urgent|critical|blocker|p0|ด่วนมาก|วิกฤต)\b/u.test(v)) return 'urgent'
  if (/\b(high|p1|important|ด่วน|สำคัญ|สูง)\b/u.test(v)) return 'high'
  if (/\b(low|p3|later|ต่ำ|ไม่รีบ)\b/u.test(v)) return 'low'
  return 'normal'
}

function inferAssistantStatus(text: string): KanbanTaskInput['status'] {
  const v = text.toLowerCase()
  if (/\b(triage|investigate|สำรวจ|ตรวจสอบ)\b/u.test(v)) return 'triage'
  if (/\b(ready|พร้อม)\b/u.test(v)) return 'ready'
  if (/\b(running|in progress|กำลังทำ)\b/u.test(v)) return 'running'
  if (/\b(blocked|ติด|รอ)\b/u.test(v)) return 'blocked'
  if (/\b(done|complete|เสร็จ)\b/u.test(v)) return 'done'
  return 'todo'
}

function cleanAssistantTitle(line: string): string {
  return line
    .replace(/^\s*(please|todo|task|create task|add task|ช่วย|ทำ|เพิ่ม)[:\- ]+/iu, '')
    .replace(/[@#][\p{L}\p{N}_.-]+/gu, '')
    .replace(/\b(urgent|critical|blocker|high|low|normal|priority|p[0-3])\b/giu, '')
    .replace(/[,;:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function heuristicDraft(prompt: string): AssistantDraft {
  const lines = prompt.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const first = cleanAssistantTitle(lines[0] ?? prompt)
  const assignee = prompt.match(/@([\p{L}\p{N}_.-]+)/u)?.[1]
  const tags = [...prompt.matchAll(/#([\p{L}\p{N}_.-]+)/gu)].map(match => match[1])

  return {
    title: (first || prompt).slice(0, 96),
    body: prompt,
    status: inferAssistantStatus(prompt),
    priority: inferAssistantPriority(prompt),
    assignee,
    tags: tags.length > 0 ? tags : undefined,
    owner: 'ai-orchestrator',
  }
}

function normalizeAssistantDraft(draft: Partial<AssistantDraft>, prompt: string): AssistantDraft {
  const fallback = heuristicDraft(prompt)
  const status = draft.status && ['triage', 'todo', 'ready', 'running', 'blocked', 'done', 'archived'].includes(draft.status)
    ? draft.status
    : fallback.status
  const priority = draft.priority && ['low', 'normal', 'high', 'urgent'].includes(draft.priority)
    ? draft.priority
    : fallback.priority

  return {
    title: typeof draft.title === 'string' && draft.title.trim() ? draft.title.trim().slice(0, 120) : fallback.title,
    body: typeof draft.body === 'string' && draft.body.trim() ? draft.body.trim() : fallback.body,
    status,
    priority,
    assignee: typeof draft.assignee === 'string' && draft.assignee.trim() ? draft.assignee.trim().replace(/^@/, '') : fallback.assignee,
    owner: typeof draft.owner === 'string' && draft.owner.trim() ? draft.owner.trim() : fallback.owner,
    tags: Array.isArray(draft.tags)
      ? draft.tags.map(tag => String(tag).trim().replace(/^#/, '')).filter(Boolean).slice(0, 8)
      : fallback.tags,
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractCommandTaskId(text: string): string | undefined {
  return text.match(/\b(KB-[A-Z0-9-]+)\b/i)?.[1]
}

function extractCommandWorkerId(text: string, fallback?: string): string | undefined {
  const patterns = [
    /\b(?:for|to|by|worker|agent|ให้)\s+@?([A-Za-z0-9_.-]+)\b/i,
    /@([A-Za-z0-9_.-]+)/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const workerId = match?.[1]?.trim()
    if (workerId && !/^KB-/i.test(workerId) && !COMMAND_STATUSES.includes(workerId as any)) {
      return workerId
    }
  }
  return fallback
}

function extractCommandStatus(text: string): KanbanTaskInput['status'] | undefined {
  const lower = text.toLowerCase()
  const aliases: Array<[KanbanTaskInput['status'], RegExp]> = [
    ['triage', /\b(triage|investigate|สำรวจ|ตรวจสอบ)\b/u],
    ['todo', /\b(todo|to-do|backlog|ต้องทำ)\b/u],
    ['ready', /\b(ready|พร้อม)\b/u],
    ['running', /\b(running|in progress|doing|กำลังทำ)\b/u],
    ['blocked', /\b(blocked|block|ติด|บล็อก|รอ)\b/u],
    ['done', /\b(done|complete|completed|finished|เสร็จ|จบ)\b/u],
    ['archived', /\b(archived|archive|เก็บ)\b/u],
  ]
  return aliases.find(([, pattern]) => pattern.test(lower))?.[0]
}

function stripCommandPrefix(text: string, words: string[]): string {
  let output = text
  for (const word of words) {
    output = output.replace(new RegExp(`\\b${word}\\b`, 'iu'), '')
  }
  output = output
    .replace(/\bKB-[A-Z0-9-]+\b/iu, '')
    .replace(/\b(?:worker|agent|ให้)\s+@?[A-Za-z0-9_.-]+\b/iu, '')
    .replace(/\b(?:triage|todo|to-do|ready|running|in progress|doing|blocked|block|done|complete|completed|finished|archived|archive)\b/iu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return output
}

async function draftTaskWithAnthropic(prompt: string): Promise<AssistantDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const model = process.env.KANBAN_ASSISTANT_MODEL || 'claude-3-5-haiku-latest'
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      temperature: 0,
      system: [
        'You convert a user request into one Kanban task.',
        'Return only JSON with keys: title, body, status, priority, assignee, owner, tags.',
        'status must be one of triage,todo,ready,running,blocked,done.',
        'priority must be one of low,normal,high,urgent.',
        'tags must be an array of short strings without #.',
      ].join(' '),
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(`Anthropic draft failed: ${response.status} ${errorText.slice(0, 240)}`)
  }

  const data = await response.json() as {
    content?: Array<{ type?: string; text?: string }>
  }
  const text = data.content?.map(part => part.text ?? '').join('\n') ?? ''
  const parsed = extractJsonObject(text)
  return parsed ? normalizeAssistantDraft(parsed as Partial<AssistantDraft>, prompt) : null
}

async function draftTaskFromAssistant(prompt: string): Promise<AssistantDraftResult> {
  try {
    const llmDraft = await draftTaskWithAnthropic(prompt)
    if (llmDraft) return { draft: llmDraft, source: 'anthropic' }
  } catch (error) {
    return {
      draft: heuristicDraft(prompt),
      source: 'heuristic',
      warning: error instanceof Error ? error.message : String(error),
    }
  }

  return { draft: heuristicDraft(prompt), source: 'heuristic' }
}

function createServerHandlers(rootDir: string) {
  return {
    async handleBoard(): Promise<ApiResponse> {
      if (!(await kanbanBoardExists(rootDir))) {
        return createJsonResponse(404, { error: 'No Kanban board found' })
      }
      const board = await readKanbanBoard(rootDir)
      return createJsonResponse(200, board)
    },

    async handleAddTask(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const input = body as KanbanTaskInput
      if (!input.title || typeof input.title !== 'string') {
        return createJsonResponse(400, { error: 'Title is required' })
      }
      try {
        const { task } = await addKanbanTask(input, rootDir)
        return createJsonResponse(201, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleAssistantDraft(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { prompt } = body as { prompt?: string }
      if (!prompt || typeof prompt !== 'string') {
        return createJsonResponse(400, { error: 'prompt is required' })
      }
      const result = await draftTaskFromAssistant(prompt)
      return createJsonResponse(200, result)
    },

    async handleAssistantCreate(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const {
        prompt,
        draft,
        dispatch,
        workerId,
        claimedBy,
        projectId,
      } = body as {
        prompt?: string
        draft?: AssistantDraft
        dispatch?: boolean
        workerId?: string
        claimedBy?: string
        projectId?: string
      }

      const finalDraft = draft
        ? normalizeAssistantDraft(draft, prompt || draft.body || draft.title || '')
        : prompt
          ? (await draftTaskFromAssistant(prompt)).draft
          : null

      if (!finalDraft?.title) {
        return createJsonResponse(400, { error: 'draft.title or prompt is required' })
      }

      const input: KanbanTaskInput = {
        title: finalDraft.title,
        body: finalDraft.body,
        status: finalDraft.status,
        priority: finalDraft.priority,
        assignee: finalDraft.assignee,
        owner: finalDraft.owner,
        tags: finalDraft.tags,
        projectId,
      }

      try {
        const { task } = await addKanbanTask(input, rootDir)
        if (dispatch && workerId) {
          const claimed = await claimKanbanTask(task.id, workerId, claimedBy || workerId, rootDir)
          return createJsonResponse(201, { task: claimed.task, dispatched: true })
        }
        return createJsonResponse(201, { task, dispatched: false })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleAssistantCommand(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { prompt, workerId: bodyWorkerId, projectId } = body as {
        prompt?: string
        workerId?: string
        projectId?: string
      }
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return createJsonResponse(400, { error: 'prompt is required' })
      }

      const text = prompt.trim()
      const lower = text.toLowerCase()
      const taskId = extractCommandTaskId(text)
      const workerId = extractCommandWorkerId(text, bodyWorkerId)
      const status = extractCommandStatus(text)

      try {
        let result: AssistantCommandResult

        if (/\b(help|examples|คำสั่ง|ช่วย)\b/u.test(lower)) {
          result = {
            ok: true,
            action: 'help',
            message: 'Supported Kanban chat commands are listed in examples.',
            examples: COMMAND_EXAMPLES,
          }
        } else if (/\b(workers?|agents?)\b/i.test(text) && /\b(list|show|ดู|รายการ)\b/u.test(lower)) {
          const workers = await listWorkers(rootDir)
          result = {
            ok: true,
            action: 'list_workers',
            message: workers.length ? `Found ${workers.length} worker(s).` : 'No workers registered yet.',
            workers,
          }
        } else if (/\b(run|start|process|ทำงาน|เริ่ม)\b/u.test(lower) && /\b(worker|agent)\b/i.test(text) && /\b(llm|ai)\b/i.test(text)) {
          if (!workerId) {
            return createJsonResponse(400, { error: 'worker id is required', examples: ['run worker worker-a llm'] })
          }
          if (!process.env.KANBAN_LLM_ENDPOINT && !process.env.ANTHROPIC_API_KEY) {
            return createJsonResponse(400, { error: 'LLM worker requires KANBAN_LLM_ENDPOINT or ANTHROPIC_API_KEY before it can claim a task' })
          }
          const results = []
          for await (const workerResult of runKanbanWorker(rootDir, {
            workerId,
            projectId,
            llm: true,
            maxTasks: 1,
            pollMs: undefined,
            quiet: true,
            timeoutMs: 120000,
          })) {
            results.push(workerResult)
          }
          result = {
            ok: true,
            action: 'run_worker_llm',
            message: results[0]?.taskId
              ? `LLM worker ${workerId} processed ${results[0].taskId}: ${results[0].status}.`
              : `LLM worker ${workerId} found no claimable task.`,
            tasks: results,
          }
        } else if (/\b(register|add|เพิ่ม|ลงทะเบียน)\b/u.test(lower) && /\b(worker|agent)\b/i.test(text)) {
          const registerId = workerId || text.match(/\b(?:worker|agent)\s+@?([A-Za-z0-9_.-]+)\b/i)?.[1]
          if (!registerId) {
            return createJsonResponse(400, { error: 'worker id is required', examples: ['register worker worker-a'] })
          }
          const worker = await registerWorker(rootDir, {
            id: registerId,
            name: registerId,
            status: 'idle',
            projectId,
            metadata: { source: 'assistant-command' },
          })
          result = {
            ok: true,
            action: 'register_worker',
            message: `Registered worker ${registerId}.`,
            worker,
          }
        } else if (/\b(claim|จอง|รับงาน)\b/u.test(lower) && /\bnext\b/i.test(text)) {
          if (!workerId) {
            return createJsonResponse(400, { error: 'worker id is required', examples: ['claim next for worker-a'] })
          }
          const claimed = await claimNextTask(rootDir, workerId, {
            claimedBy: workerId,
            projectId,
            allowBlocked: /\bblocked|ติด|รอ\b/u.test(lower),
          })
          result = claimed
            ? {
                ok: true,
                action: 'claim_next',
                message: `Claimed next task ${claimed.task.id} for ${workerId}.`,
                task: claimed.task,
              }
            : {
                ok: true,
                action: 'claim_next',
                message: 'No claimable task found.',
                task: null,
              }
        } else if (/\b(list|show|ดู|รายการ)\b/u.test(lower) && /\b(tasks?|งาน)\b/u.test(lower)) {
          const tasks = (await listKanbanTasks(rootDir))
            .filter(task => !projectId || task.projectId === projectId || !task.projectId)
            .filter(task => !status || task.status === status)
          result = {
            ok: true,
            action: 'list_tasks',
            message: tasks.length ? `Found ${tasks.length} task(s).` : 'No matching tasks.',
            tasks,
          }
        } else if (
          !taskId &&
          (
            /\b(create|add|new)\s+(task|todo|work|card)\b/i.test(text) ||
            /\b(task|todo|work|card)\s*[:\-]/i.test(text) ||
            /\b(สร้างงาน|เพิ่มงาน|งานใหม่|ทำการ์ด|เพิ่มการ์ด)\b/u.test(lower)
          )
        ) {
          const promptForTask = text
            .replace(/\b(create|add|new)\s+(task|todo|work|card)\b[:\- ]*/iu, '')
            .replace(/\b(task|todo|work|card)\s*[:\-]\s*/iu, '')
            .replace(/\b(สร้างงาน|เพิ่มงาน|งานใหม่|ทำการ์ด|เพิ่มการ์ด)\b[:\- ]*/u, '')
            .trim() || text
          const draftResult = await draftTaskFromAssistant(promptForTask)
          const draft = draftResult.draft
          const input: KanbanTaskInput = {
            title: draft.title,
            body: draft.body,
            status: draft.status,
            priority: draft.priority,
            assignee: draft.assignee,
            owner: draft.owner,
            tags: draft.tags,
            projectId,
          }
          const { task } = await addKanbanTask(input, rootDir)
          let finalTask = task
          const dispatchWorker = workerId || draft.assignee
          if (dispatchWorker && /\b(claim|dispatch|assign|ส่งให้|จองให้|ให้ worker|ให้ agent)\b/iu.test(text)) {
            finalTask = (await claimKanbanTask(task.id, dispatchWorker, dispatchWorker, rootDir)).task
          }
          result = {
            ok: true,
            action: 'create_task',
            message: `Created ${finalTask.id}: ${finalTask.title}`,
            task: finalTask,
          }
        } else if (/\b(move|ย้าย)\b/u.test(lower) && taskId && status) {
          const { task } = status === 'blocked'
            ? await blockKanbanTask(taskId, stripCommandPrefix(text, ['move', 'ย้าย']) || 'Blocked by assistant command', rootDir)
            : await moveKanbanTask(taskId, status as any, rootDir)
          result = {
            ok: true,
            action: 'move_task',
            message: `Moved ${task.id} to ${task.status}.`,
            task,
          }
        } else if (/\b(claim|จอง|รับงาน)\b/u.test(lower) && taskId) {
          if (!workerId) {
            return createJsonResponse(400, { error: 'worker id is required', examples: ['claim KB-xxx for worker-a'] })
          }
          const { task } = await claimKanbanTask(taskId, workerId, workerId, rootDir)
          result = {
            ok: true,
            action: 'claim_task',
            message: `Claimed ${task.id} for ${workerId}.`,
            task,
          }
        } else if (/\b(release|ปล่อย)\b/u.test(lower) && taskId) {
          let releaseWorker = workerId
          if (!releaseWorker) {
            const board = await readKanbanBoard(rootDir)
            releaseWorker = board.tasks.find(task => task.id === taskId)?.lease?.workerId
          }
          if (!releaseWorker) {
            return createJsonResponse(400, { error: 'worker id is required or task must have an active lease' })
          }
          const { task } = await releaseKanbanTask(taskId, releaseWorker, rootDir)
          result = {
            ok: true,
            action: 'release_task',
            message: `Released ${task.id} from ${releaseWorker}.`,
            task,
          }
        } else if (/\b(complete|done|finish|finished|ปิดงาน|เสร็จ|จบ)\b/u.test(lower) && taskId) {
          const summary = stripCommandPrefix(text, ['complete', 'done', 'finish', 'finished', 'ปิดงาน', 'เสร็จ', 'จบ'])
          const { task } = await completeKanbanTask(taskId, summary || 'Completed by assistant command', {
            source: 'assistant-command',
          }, rootDir)
          result = {
            ok: true,
            action: 'complete_task',
            message: `Completed ${task.id}.`,
            task,
          }
        } else if (/\b(unblock|ปลดบล็อก|แก้บล็อก)\b/u.test(lower) && taskId) {
          const { task } = await unblockKanbanTask(taskId, rootDir)
          result = {
            ok: true,
            action: 'unblock_task',
            message: `Unblocked ${task.id}.`,
            task,
          }
        } else if (/\b(block|blocked|ติด|บล็อก)\b/u.test(lower) && taskId) {
          const reason = stripCommandPrefix(text, ['block', 'blocked', 'ติด', 'บล็อก']) || 'Blocked by assistant command'
          const { task } = await blockKanbanTask(taskId, reason, rootDir)
          result = {
            ok: true,
            action: 'block_task',
            message: `Blocked ${task.id}: ${reason}`,
            task,
          }
        } else if (/\b(fail|failed|พัง|ล้มเหลว)\b/u.test(lower) && taskId) {
          const reason = stripCommandPrefix(text, ['fail', 'failed', 'พัง', 'ล้มเหลว']) || 'Failed by assistant command'
          const { task } = await failKanbanTask(taskId, reason, workerId, rootDir)
          result = {
            ok: true,
            action: 'fail_task',
            message: `Failed ${task.id}: ${reason}`,
            task,
          }
        } else if (/\b(retry|ลองใหม่|ทำใหม่)\b/u.test(lower) && taskId) {
          const { task } = await retryKanbanTask(taskId, workerId, rootDir)
          result = {
            ok: true,
            action: 'retry_task',
            message: `Retried ${task.id}.`,
            task,
          }
        } else if (/\b(archive|archived|เก็บ)\b/u.test(lower) && taskId) {
          const { task } = await archiveKanbanTask(taskId, rootDir, workerId || 'assistant-command')
          result = {
            ok: true,
            action: 'archive_task',
            message: `Archived ${task.id}.`,
            task,
          }
        } else {
          result = {
            ok: false,
            action: 'unsupported',
            message: 'I can only run whitelisted Kanban commands from chat.',
            examples: COMMAND_EXAMPLES,
          }
        }

        return createJsonResponse(result.ok ? 200 : 422, result)
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handlePatchTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const update = body as KanbanTaskUpdate
      try {
        const { task } = await editKanbanTask(id, update, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleDeleteTask(id: string): Promise<ApiResponse> {
      try {
        const { task } = await deleteKanbanTask(id, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleMoveTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { status, assignedAgent, owner, notes } = body as {
        status: string
        assignedAgent?: string
        owner?: string
        notes?: string
      }
      if (!status) {
        return createJsonResponse(400, { error: 'Status is required' })
      }
      try {
        const updateData: { assignedAgent?: string; owner?: string; notes?: string } = {}
        if (assignedAgent !== undefined) updateData.assignedAgent = assignedAgent
        if (owner !== undefined) updateData.owner = owner
        if (notes !== undefined) updateData.notes = notes

        const { task } = await moveKanbanTask(id, status as any, rootDir, updateData)
        return createJsonResponse(200, { task })
      } catch (error) {
        console.error('DEBUG handleMoveTask error:', error)
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleBlockTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { reason } = body as { reason: string }
      if (!reason) {
        return createJsonResponse(400, { error: 'Reason is required' })
      }
      try {
        const { task } = await blockKanbanTask(id, reason, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleUnblockTask(id: string): Promise<ApiResponse> {
      try {
        const { task } = await unblockKanbanTask(id, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleFiles(): Promise<ApiResponse> {
      if (!(await kanbanBoardExists(rootDir))) {
        return createJsonResponse(404, { error: 'No Kanban board found' })
      }
      const board = await readKanbanBoard(rootDir)
      const files = listKanbanFiles(board)
      return createJsonResponse(200, { files })
    },

    async handleConflicts(): Promise<ApiResponse> {
      if (!(await kanbanBoardExists(rootDir))) {
        return createJsonResponse(404, { error: 'No Kanban board found' })
      }
      const board = await readKanbanBoard(rootDir)
      const conflicts = detectKanbanFileConflicts(board)
      return createJsonResponse(200, { conflicts })
    },

    async handleExport(): Promise<ApiResponse> {
      try {
        const { path } = await exportKanbanMarkdown(rootDir)
        return createJsonResponse(200, { path })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleListTasks(): Promise<ApiResponse> {
      if (!(await kanbanBoardExists(rootDir))) {
        return createJsonResponse(404, { error: 'No Kanban board found' })
      }
      const tasks = await listKanbanTasks(rootDir)
      return createJsonResponse(200, { tasks })
    },

    async handleGetTask(id: string): Promise<ApiResponse> {
      try {
        const board = await readKanbanBoard(rootDir)
        const task = board.tasks.find(t => t.id === id)
        if (!task) {
          return createJsonResponse(404, { error: 'Task not found' })
        }
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleCompleteTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { summary, metadata } = body as { summary?: string; metadata?: Record<string, unknown> }
      try {
        const { task } = await completeKanbanTask(id, summary, metadata, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleCommentTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { author, body: commentBody } = body as { author?: string; body: string }
      if (!commentBody) {
        return createJsonResponse(400, { error: 'Comment body is required' })
      }
      try {
        const { task } = await commentKanbanTask(id, author || 'user', commentBody, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleArchiveTask(id: string): Promise<ApiResponse> {
      try {
        const { task } = await archiveKanbanTask(id, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 3: Lease ────────────────────────────────────

    async handleClaimTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { workerId, claimedBy } = body as { workerId: string; claimedBy: string }
      if (!workerId) {
        return createJsonResponse(400, { error: 'workerId is required' })
      }
      try {
        const { task } = await claimKanbanTask(id, workerId, claimedBy || workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleHeartbeat(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { workerId } = body as { workerId: string }
      if (!workerId) {
        return createJsonResponse(400, { error: 'workerId is required' })
      }
      try {
        const { task } = await heartbeatKanbanTask(id, workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleReleaseTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { workerId } = body as { workerId: string }
      if (!workerId) {
        return createJsonResponse(400, { error: 'workerId is required' })
      }
      try {
        const { task } = await releaseKanbanTask(id, workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleReclaimTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { workerId, claimedBy } = body as { workerId: string; claimedBy: string }
      if (!workerId) {
        return createJsonResponse(400, { error: 'workerId is required' })
      }
      try {
        const { task } = await reclaimKanbanTask(id, workerId, claimedBy || workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 3: Retry / Fail ──────────────────────────────

    async handleRetryTask(id: string, body: unknown): Promise<ApiResponse> {
      const workerId = body && typeof body === 'object' ? (body as { workerId?: string }).workerId : undefined
      try {
        const { task } = await retryKanbanTask(id, workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleFailTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { reason, workerId } = body as { reason: string; workerId?: string }
      if (!reason) {
        return createJsonResponse(400, { error: 'reason is required' })
      }
      try {
        const { task } = await failKanbanTask(id, reason, workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 3: Verification ────────────────────────────

    async handleVerifyTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { passed, summary } = body as { passed: boolean; summary?: string }
      try {
        const { task } = await verifyKanbanTask(id, passed, summary, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleEvidenceTask(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { type, label, content, path } = body as { type: string; label: string; content?: string; path?: string }
      if (!type || !label) {
        return createJsonResponse(400, { error: 'type and label are required' })
      }
      try {
        const { task } = await addEvidenceToTask(id, type as any, label, rootDir, { content, path })
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleVerifyAndComplete(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { summary, workerId } = body as { summary?: string; workerId?: string }
      try {
        const { task } = await verifyAndCompleteTask(id, summary, workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 3: Events ──────────────────────────────────

    async handleGetEvents(id: string): Promise<ApiResponse> {
      try {
        const board = await readKanbanBoard(rootDir)
        const events = getTaskEvents(board, id)
        return createJsonResponse(200, { events })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 3: Zombies ────────────────────────────────

    async handleListZombies(): Promise<ApiResponse> {
      try {
        const board = await readKanbanBoard(rootDir)
        const zombies = detectZombieTasks(board)
        return createJsonResponse(200, { zombies })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleReclaimZombie(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { taskId, workerId, claimedBy } = body as { taskId: string; workerId: string; claimedBy?: string }
      if (!taskId || !workerId) {
        return createJsonResponse(400, { error: 'taskId and workerId are required' })
      }
      try {
        const { task } = await reclaimKanbanTask(taskId, workerId, claimedBy || workerId, rootDir)
        return createJsonResponse(200, { task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 8: Workers ────────────────────────────────

    async handleListWorkers(): Promise<ApiResponse> {
      try {
        const workers = await listWorkers(rootDir)
        return createJsonResponse(200, { workers })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleGetWorker(id: string): Promise<ApiResponse> {
      try {
        const worker = await getWorker(rootDir, id)
        if (!worker) {
          return createJsonResponse(404, { error: 'Worker not found' })
        }
        return createJsonResponse(200, { worker })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleRegisterWorker(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const worker = body as {
        id: string
        name?: string
        status?: string
        currentTaskId?: string
        projectId?: string
        workspaceId?: string
        tasksCompleted?: number
        metadata?: Record<string, unknown>
      }
      if (!worker.id) {
        return createJsonResponse(400, { error: 'id is required' })
      }
      try {
        const record = await registerWorker(rootDir, worker)
        return createJsonResponse(200, { worker: record })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleWorkerHeartbeat(id: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { status, currentTaskId, tasksCompleted, metadata } = body as {
        status?: string
        currentTaskId?: string
        tasksCompleted?: number
        metadata?: Record<string, unknown>
      }
      try {
        const worker = await heartbeatWorker(rootDir, id, {
          status: status as any,
          currentTaskId,
          tasksCompleted,
          metadata,
        })
        if (!worker) {
          return createJsonResponse(404, { error: 'Worker not found' })
        }
        return createJsonResponse(200, { worker })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleWorkerOffline(id: string): Promise<ApiResponse> {
      try {
        const worker = await markWorkerOffline(rootDir, id)
        if (!worker) {
          return createJsonResponse(404, { error: 'Worker not found' })
        }
        return createJsonResponse(200, { worker })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 3: Workspace / Project ─────────────────────

    async handleListWorkspaces(): Promise<ApiResponse> {
      try {
        await ensureDefaultWorkspace(rootDir)
        const workspaces = await listWorkspaces(rootDir)
        return createJsonResponse(200, { workspaces })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleCreateWorkspace(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { name, rootDir: wsRootDir } = body as { name: string; rootDir?: string }
      if (!name) {
        return createJsonResponse(400, { error: 'name is required' })
      }
      try {
        const ws = await createWorkspace(name, wsRootDir || rootDir, rootDir)
        return createJsonResponse(201, { workspace: ws })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleListProjects(): Promise<ApiResponse> {
      try {
        await ensureDefaultWorkspace(rootDir)
        const projects = await listProjects(undefined, rootDir)
        return createJsonResponse(200, { projects })
      } catch (error) {
        return createJsonResponse(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleCreateProject(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { workspaceId, name, projectRootDir } = body as { workspaceId: string; name: string; projectRootDir?: string }
      if (!workspaceId || !name) {
        return createJsonResponse(400, { error: 'workspaceId and name are required' })
      }
      try {
        const proj = await createProject(workspaceId, name, projectRootDir, rootDir)
        return createJsonResponse(201, { project: proj })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleProjectTasks(projectId: string): Promise<ApiResponse> {
      try {
        // Try reading from the project-specific board; fall back to filtering the default board
        let board
        try {
          board = await readKanbanBoard(rootDir, projectId)
        } catch {
          board = await readKanbanBoard(rootDir)
          board = { ...board, tasks: board.tasks.filter(t => t.projectId === projectId || !t.projectId) }
        }
        return createJsonResponse(200, { tasks: board.tasks })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 6: Agent Runtime ──────────────────────────

    async handleClaimNext(body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { workerId, claimedBy, projectId, allowBlocked } = body as {
        workerId: string
        claimedBy?: string
        projectId?: string
        allowBlocked?: boolean
      }
      if (!workerId) {
        return createJsonResponse(400, { error: 'workerId is required' })
      }
      try {
        const result = await claimNextTask(rootDir, workerId, {
          claimedBy: claimedBy ?? workerId,
          projectId,
          allowBlocked: allowBlocked === true,
        })
        if (!result) {
          return createJsonResponse(200, { task: null })
        }
        return createJsonResponse(200, { task: result.task })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    // ─── Phase 13: Artifacts ───────────────────────────

    async handleGenerateArtifact(taskId: string, body: unknown): Promise<ApiResponse> {
      if (!body || typeof body !== 'object') {
        return createJsonResponse(400, { error: 'Invalid request body' })
      }
      const { label, content, path, type, createdBy } = body as {
        label: string
        content?: string
        path?: string
        type?: string
        createdBy?: string
      }
      if (!label) {
        return createJsonResponse(400, { error: 'label is required' })
      }
      try {
        const result = await generateArtifact(taskId, label, rootDir, { content, path, type: type as any, createdBy })
        return createJsonResponse(201, { task: result.task, artifact: result.artifact })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleGetArtifacts(taskId: string): Promise<ApiResponse> {
      try {
        const artifacts = await getTaskArtifacts(taskId, rootDir)
        return createJsonResponse(200, { artifacts })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleGetCurrentArtifact(taskId: string): Promise<ApiResponse> {
      try {
        const artifact = await getCurrentArtifact(taskId, rootDir)
        return createJsonResponse(200, { artifact: artifact ?? null })
      } catch (error) {
        return createJsonResponse(404, { error: error instanceof Error ? error.message : String(error) })
      }
    },

    async handleSelectArtifact(taskId: string, artifactId: string): Promise<ApiResponse> {
      try {
        const result = await selectArtifact(taskId, artifactId, rootDir)
        return createJsonResponse(200, { task: result.task, artifact: result.task.artifacts?.find(a => a.id === artifactId) ?? result.artifact })
      } catch (error) {
        return createJsonResponse(400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}

// ─── SSE infrastructure ──────────────────────────────────
const sseClients: Array<{ id: number; res: import('http').ServerResponse }> = []
let sseIdCounter = 0

function notifySSE(): void {
  const msg = JSON.stringify({ type: 'tasks_updated', createdAt: new Date().toISOString() })
  for (const client of sseClients) {
    try {
      client.res.write(`data: ${msg}\n\n`)
    } catch {
      // client disconnected
    }
  }
}

function parseUrl(url: string): { path: string; id?: string; subPath?: string; projectId?: string } {
  const pathname = url.split('?')[0]
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) {
    return { path: '', parts }
  }
  if (parts[0] === 'api') {
    if (parts.length === 1) {
      return { path: 'api', parts }
    }
    if (parts[1] === 'board') {
      return { path: 'api/board', parts }
    }
    if (parts[1] === 'assistant') {
      if (parts[2] === 'draft') return { path: 'api/assistant/draft', parts }
      if (parts[2] === 'create') return { path: 'api/assistant/create', parts }
      if (parts[2] === 'command') return { path: 'api/assistant/command', parts }
      return { path: 'api/assistant', parts }
    }
    if (parts[1] === 'zombies') {
      if (parts.length >= 3 && parts[2] === 'reclaim') {
        return { path: 'api/zombies/reclaim', parts }
      }
      return { path: 'api/zombies', parts }
    }
    if (parts[1] === 'workspaces') {
      if (parts.length === 2) return { path: 'api/workspaces', parts }
      return { path: 'api/workspaces', parts }
    }
    if (parts[1] === 'projects') {
      if (parts.length === 2) return { path: 'api/projects', parts }
      if (parts.length >= 3) {
        const projectId = parts[2]
        if (parts.length >= 4 && parts[3] === 'tasks') {
          return { path: 'api/projects/:projectId/tasks', projectId, parts }
        }
        return { path: 'api/projects/:projectId/tasks', projectId, parts }
      }
    }
    if (parts[1] === 'tasks') {
      if (parts.length === 2) {
        return { path: 'api/tasks', parts }
      }
      if (parts.length >= 3 && parts[2] === 'claim-next') {
        return { path: 'api/tasks/claim-next', parts }
      }
      if (parts.length >= 3) {
        const id = parts[2]
        if (parts.length === 3) {
          return { path: 'api/tasks/:id', id, parts }
        }
        if (parts.length >= 4) {
          const subPath = parts[3]
          if (parts.length >= 5) {
            // Check for /api/tasks/:id/artifacts/current before generic artifactId route
            if (parts[4] === 'current') {
              return { path: 'api/tasks/:id/artifacts/current', id, subPath: 'artifacts/current', parts }
            }
            // /api/tasks/:id/artifacts/:artifactId
            const artifactId = parts[4]
            return { path: 'api/tasks/:id/artifacts/:artifactId', id, subPath: 'artifacts', artifactId, parts }
          }
          return { path: 'api/tasks/:id/' + subPath, id, subPath, parts }
        }
      }
    }
    if (parts[1] === 'workers') {
      // POST /api/workers → register
      // GET /api/workers → list
      if (parts.length === 2) {
        return { path: 'api/workers', parts }
      }
      if (parts.length >= 3) {
        const id = parts[2]
        if (parts.length === 3) {
          return { path: 'api/workers/:id', id, parts }
        }
        if (parts.length >= 4) {
          const subPath = parts[3]
          return { path: 'api/workers/:id/' + subPath, id, subPath, parts }
        }
      }
    }
    if (parts[1] === 'files') {
      return { path: 'api/files', parts }
    }
    if (parts[1] === 'conflicts') {
      return { path: 'api/conflicts', parts }
    }
    if (parts[1] === 'export') {
      return { path: 'api/export', parts }
    }
  }
  return { path: parts.join('/') }
}

function renderDashboard(): string {
  return /*template*/ `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kanban Dashboard — OpenFinch</title>
<style>
:root{--bg:#050608;--panel:#111319;--panel-2:#181b24;--card-bg:#080a0e;--text:#f4f1e8;--text-muted:#8e98a7;--col-bg:#080a0f;--col-title:#c7d2e5;--border:#222838;--border-strong:#3a4358;--tab-bg:#111319;--tab-active:#1b202b;--accent:#ffb21a;--accent-soft:#2d2110;--accent-rgb:255,178,26;--blue:#1b5cff;--blue-soft:#0e1c45;--danger:#ff6d2d;--success:#ffd36a;--warning:#ff9f1a;--info:#2d78ff;--shadow:rgba(0,0,0,0.5);--mono:"SFMono-Regular","Cascadia Code","Liberation Mono",Consolas,monospace}
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);padding:0;margin:0;min-height:100vh}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(var(--accent-rgb),0.055),transparent 190px),linear-gradient(90deg,rgba(45,120,255,0.045),transparent 38%,rgba(255,178,26,0.035)),radial-gradient(circle at 20% 0%,rgba(255,255,255,0.035),transparent 320px)}
.app-shell{position:relative;min-height:100vh;padding:18px 20px 22px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px}
.brand{display:flex;align-items:center;gap:10px;min-width:230px}
.brand-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;border:1px solid var(--border-strong);background:var(--panel-2);color:var(--accent);font-family:var(--mono);font-size:15px;font-weight:700}
.brand-copy{display:flex;flex-direction:column;gap:1px}
.brand-kicker{font-family:var(--mono);font-size:10px;line-height:1;color:var(--text-muted);text-transform:uppercase}
h1{font-size:18px;line-height:1.2;margin:0;font-weight:650;letter-spacing:0}
.status-pill{display:flex;align-items:center;gap:7px;color:var(--text-muted);font-family:var(--mono);font-size:11px;white-space:nowrap}

/* Toolbar & Filter Bar */
#toolbar{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;font-size:12px}
#toolbar label{color:var(--text-muted)}
#toolbar select,#toolbar input{height:30px;padding:4px 9px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--text);font-size:12px;outline:none}
#toolbar select:focus,#toolbar input:focus,#filterBar input:focus,#filterBar select:focus,.modal-box input:focus,.modal-box select:focus,.modal-box textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(var(--accent-rgb),0.18)}
.command-strip{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
#filterBar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px}
#filterBar input,#filterBar select{height:30px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--text);font-size:11px;outline:none}
#filterBar label{color:var(--text-muted);font-size:11px}
.newTaskBtn{height:30px;padding:4px 12px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#171512;cursor:pointer;font-size:12px;font-weight:700}
.newTaskBtn:hover{filter:brightness(1.07)}
button{font-family:inherit}

/* Tabs */
#navTabs{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:8px}
#navTabs button{padding:6px 11px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;white-space:nowrap}
#navTabs button.active{background:var(--tab-active);border-color:var(--border-strong);color:var(--text);font-weight:650}
#navTabs button:hover{background:var(--panel);color:var(--text)}

/* View containers */
.view{display:none}
.view.active{display:block}
#statusView{position:relative}
.link-layer{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:visible}
.link-layer path{fill:none;stroke:var(--accent);stroke-width:1.25;stroke-linecap:round;filter:drop-shadow(0 0 5px rgba(var(--accent-rgb),0.75));opacity:0.72}

/* Columns */
.columns{position:relative;z-index:2;display:grid;grid-template-columns:repeat(6,minmax(220px,1fr));gap:10px;overflow-x:auto;padding-bottom:10px;align-items:start}
.column{background:linear-gradient(180deg,rgba(255,255,255,0.025),transparent 36px),var(--col-bg);border:1px solid var(--border);border-radius:2px;padding:8px;min-width:220px;min-height:calc(100vh - 250px);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.02),0 16px 30px var(--shadow)}
.column h2{font-family:var(--mono);font-size:10px;margin:-2px -4px 9px;padding:4px 6px;color:var(--col-title);text-transform:uppercase;font-weight:700;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);letter-spacing:0}
.task-card{position:relative;background:linear-gradient(180deg,rgba(255,255,255,0.025),transparent 38px),var(--card-bg);border:1px solid var(--border);border-radius:2px;padding:8px;margin-bottom:8px;box-shadow:0 0 0 1px rgba(255,255,255,0.025),0 0 14px rgba(255,178,26,0.08);font-family:var(--mono);font-size:11px;border-left:3px solid transparent}
.task-card:after{content:"";position:absolute;left:8px;right:8px;bottom:6px;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:0.45}
.task-card.status-running{border-color:rgba(45,120,255,0.75);border-left-color:var(--blue);box-shadow:0 0 0 1px rgba(45,120,255,0.18),0 0 18px rgba(45,120,255,0.36)}
.task-card.status-done{border-color:rgba(var(--accent-rgb),0.72);border-left-color:var(--accent);box-shadow:0 0 0 1px rgba(var(--accent-rgb),0.16),0 0 18px rgba(var(--accent-rgb),0.32)}
.task-card.status-blocked{border-color:rgba(255,109,45,0.72);border-left-color:var(--danger);box-shadow:0 0 0 1px rgba(255,109,45,0.16),0 0 18px rgba(255,109,45,0.32)}
.task-card.status-ready{border-color:rgba(244,241,232,0.68);border-left-color:#f4f1e8;box-shadow:0 0 0 1px rgba(244,241,232,0.12),0 0 14px rgba(244,241,232,0.16)}
.task-card.dragging{opacity:0.45}
.column.drag-over{border-color:var(--accent);box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb),0.45),0 0 24px rgba(var(--accent-rgb),0.18)}
.task-card.prio-urgent{border-left-color:var(--danger)}
.task-card.prio-high{border-left-color:var(--warning)}
.task-card.prio-normal{border-left-color:var(--accent)}
.task-card.blocked{opacity:0.85}
.task-card.done{opacity:0.55}
.task-card .ttl{font-weight:700;margin-bottom:5px;cursor:pointer;color:var(--text);text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.task-card .ttl:hover{color:var(--accent)}
.task-card .meta{color:var(--text-muted);font-size:11px;line-height:1.5}
.task-card .meta .tag{display:inline-block;background:var(--panel-2);border:1px solid var(--border);padding:1px 5px;border-radius:4px;margin:1px 2px 1px 0;font-size:10px}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-8px -8px 7px;padding:3px 7px;background:linear-gradient(90deg,var(--accent),rgba(var(--accent-rgb),0.58));color:#050608;font-size:9px;font-weight:800;text-transform:uppercase}
.status-running .card-head{background:linear-gradient(90deg,var(--blue),#2f7bff);color:#dfeaff}
.status-ready .card-head{background:linear-gradient(90deg,#f4f1e8,#aeb8c6);color:#050608}
.status-blocked .card-head{background:linear-gradient(90deg,#b84912,var(--danger));color:#050608}
.card-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-status{letter-spacing:0}
.signal{height:34px;margin:6px 0 7px;border:1px solid rgba(255,255,255,0.08);background:#030405;display:grid;grid-template-columns:repeat(8,1fr);align-items:end;gap:2px;padding:4px 6px;position:relative;overflow:hidden}
.signal:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,0.045) 1px,transparent 1px),linear-gradient(180deg,rgba(255,255,255,0.045) 1px,transparent 1px);background-size:25% 50%;opacity:0.7}
.bar{position:relative;z-index:1;min-height:3px;background:linear-gradient(180deg,#fff7b3,var(--accent));box-shadow:0 0 8px rgba(var(--accent-rgb),0.7)}
.status-running .bar{background:linear-gradient(180deg,#7fb0ff,var(--blue));box-shadow:0 0 8px rgba(45,120,255,0.75)}
.dot{position:absolute;width:4px;height:4px;border-radius:50%;background:#fff7b3;box-shadow:0 0 8px rgba(var(--accent-rgb),0.9);z-index:2}
.status-running .dot{background:#dce9ff;box-shadow:0 0 8px rgba(45,120,255,0.9)}
.task-card .actions{margin-top:7px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px}
.task-card .actions button,.zombie-card .actions button,.verify-card .actions button{padding:3px 5px;font-size:10px;border:1px solid var(--border);border-radius:4px;background:var(--panel);color:var(--text-muted);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.task-card .actions button:hover,.zombie-card .actions button:hover,.verify-card .actions button:hover{border-color:var(--border-strong);color:var(--text);background:var(--panel-2)}
.task-card .actions .editBtn{border-color:rgba(var(--accent-rgb),0.45);color:var(--accent)}

/* Agent Board */
.agent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.agent-card,.dep-group{background:var(--col-bg);border:1px solid var(--border);border-radius:8px;padding:12px}
.agent-card h3{font-size:14px;margin:0 0 4px 0;color:var(--col-title)}
.agent-card .stats{font-size:11px;color:var(--text-muted);margin-bottom:8px}
.agent-card .a-task{background:var(--card-bg);border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:4px;font-size:12px}
.agent-card .a-task .status-badge{display:inline-block;padding:1px 5px;border-radius:4px;font-size:10px;margin-right:4px}
.agent-card .a-task .status-badge.running{background:#1e2d46;color:#94bfff}
.agent-card .a-task .status-badge.stale{background:#3b2f0f;color:#d8a657}
.agent-card .a-task .status-badge.zombie{background:#3d1515;color:#ff8f8f}

/* Zombie Monitor */
.zombie-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:10px}
.zombie-card{background:var(--card-bg);border:1px solid var(--border);border-radius:7px;padding:12px;border-left:3px solid var(--danger);box-shadow:0 1px 3px var(--shadow)}
.zombie-card h4{margin:0 0 4px 0;font-size:13px}
.zombie-card .z-meta{font-size:11px;color:var(--text-muted);line-height:1.5}
.zombie-card .actions{margin-top:6px;display:flex;gap:4px;flex-wrap:wrap}

/* Verification Review */
.verify-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:10px}
.verify-card{background:var(--card-bg);border:1px solid var(--border);border-radius:7px;padding:12px;border-left:3px solid var(--warning);box-shadow:0 1px 3px var(--shadow)}
.verify-card.passed{border-left-color:var(--success)}
.verify-card.failed{border-left-color:var(--danger)}
.verify-card h4{margin:0 0 4px 0;font-size:13px}
.verify-card .v-meta{font-size:11px;color:var(--text-muted);line-height:1.5}
.verify-card .v-evi{font-size:10px;color:var(--text-muted);padding-left:10px;margin:4px 0}
.verify-card .actions{margin-top:6px;display:flex;gap:4px;flex-wrap:wrap}

/* Event Timeline Modal */
#eventModal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);z-index:100}
#eventModal.open{display:flex;align-items:center;justify-content:center}
#eventModal .modal-content{background:var(--card-bg);border:1px solid var(--border-strong);border-radius:8px;padding:20px;max-width:700px;width:90%;max-height:80vh;overflow-y:auto}
#eventModal .modal-content h3{margin:0 0 10px 0}
#eventModal .close-btn{float:right;cursor:pointer;font-size:18px;color:var(--text-muted)}
#artifactModal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);z-index:100}
#artifactModal.open{display:flex;align-items:center;justify-content:center}
#artifactModal .modal-content{background:var(--card-bg);border:1px solid var(--border-strong);border-radius:8px;padding:20px;max-width:800px;width:90%;max-height:80vh;overflow-y:auto}
#artifactModal .modal-content h3{margin:0 0 10px 0}
#artifactModal .artifact-card{padding:8px;margin:4px 0;border:1px solid var(--border);border-radius:4px}
#artifactModal .artifact-card.current{border-color:var(--accent);background:rgba(var(--accent-rgb),0.08)}
#artifactModal .artifact-ver{font-weight:bold;min-width:40px;display:inline-block}
#artifactModal .artifact-label{color:var(--text)}
#artifactModal .artifact-meta{font-size:11px;color:var(--text-muted)}
#artifactModal .artifact-actions{margin-top:4px}

.event-item{padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;line-height:1.5}
.event-item .e-type{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-right:6px}
.event-item .e-time{color:var(--text-muted);font-size:10px;margin-left:4px}
.event-item .e-meta{font-size:10px;color:var(--text-muted);padding-left:4px}
.event-item.archive .e-type{background:#f8d7da;color:#721c24}
.event-item.claim .e-type{background:#cce5ff;color:#004085}
.event-item.heartbeat .e-type{background:#d4edda;color:#155724}
.event-item.release .e-type{background:#fff3cd;color:#856404}
.event-item.reclaim .e-type{background:#e8daef;color:#6c3483}
.event-item.retry .e-type{background:#fdebd0;color:#935e38}
.event-item.fail .e-type{background:#fadbd8;color:#922b21}
.event-item.verify .e-type{background:#d5f5e3;color:#1e8449}
.event-item.comment .e-type{background:#d6eaf8;color:#1a5276}
.event-item.worker_started .e-type,
.event-item.worker_completed .e-type,
.event-item.worker_failed .e-type,
.event-item.command_started .e-type,
.event-item.command_completed .e-type,
.event-item.command_failed .e-type,
.event-item.verify_started .e-type,
.event-item.verify_completed .e-type,
.event-item.verify_failed .e-type{background:#d2b4de;color:#6c3483}
.event-item.artifact_generated .e-type{background:#e6fffa;color:#065f46}
.event-item.artifact_selected .e-type{background:#fef3c7;color:#92400e}
.event-item.stale_recovered .e-type{background:#fadbd8;color:#922b21}
@media(prefers-color-scheme:dark){
  .event-item.archive .e-type{background:#3d1111;color:#f85149}
  .event-item.claim .e-type{background:#0d3b66;color:#58a6ff}
  .event-item.heartbeat .e-type{background:#0b3b1e;color:#3fb950}
  .event-item.release .e-type{background:#3b2f0f;color:#d29922}
  .event-item.reclaim .e-type{background:#2d1b3d;color:#bc8cff}
  .event-item.retry .e-type{background:#3d2610;color:#d29922}
  .event-item.fail .e-type{background:#3d1111;color:#f85149}
  .event-item.verify .e-type{background:#0b3b1e;color:#3fb950}
  .event-item.comment .e-type{background:#0d3b66;color:#58a6ff}
.event-item.worker_started .e-type,
.event-item.worker_completed .e-type,
.event-item.worker_failed .e-type,
.event-item.command_started .e-type,
.event-item.command_completed .e-type,
.event-item.command_failed .e-type,
.event-item.verify_started .e-type,
.event-item.verify_completed .e-type,
.event-item.verify_failed .e-type{background:#2d1b3d;color:#bc8cff}
.event-item.stale_recovered .e-type{background:#3d1111;color:#f85149}
}

/* Dependency View */
.dep-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px}
.dep-card{background:var(--card-bg);border:1px solid var(--border);border-radius:7px;padding:12px;box-shadow:0 1px 3px var(--shadow);font-size:12px}
.dep-card h4{margin:0 0 4px 0;font-size:13px}
.dep-card .dep-row{margin:3px 0;font-size:11px;color:var(--text-muted)}
.dep-card .dep-row .dep-done{color:var(--success)}
.dep-card .dep-row .dep-pending{color:var(--warning)}
.dep-card .dep-row .dep-missing{color:var(--danger)}
.dep-card .dep-row .dep-blocked{color:var(--danger)}
.dep-group{margin-bottom:12px}
.dep-group h3{font-size:13px;margin:0 0 6px 0;color:var(--col-title)}

/* Priority badges */
.badge-priority{display:inline-block;padding:1px 5px;border-radius:4px;font-size:10px;margin-right:3px;font-weight:650}
.badge-urgent{background:#4c1717;color:#ff9b9b}
.badge-high{background:#453417;color:#ffd38d}
.badge-normal{background:var(--accent-soft);color:#ffb088}
.badge-low{background:#30343a;color:#b7c0ce}

/* Modals */
.modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);z-index:200}
.modal-overlay.open{display:flex;align-items:center;justify-content:center}
.modal-box{background:var(--card-bg);border:1px solid var(--border-strong);border-radius:8px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 16px 36px var(--shadow)}
.modal-box h3{margin:0 0 12px 0}
.modal-box .close-btn{float:right;cursor:pointer;font-size:18px;color:var(--text-muted)}
.modal-box label{display:block;font-size:12px;color:var(--text-muted);margin:8px 0 2px}
.modal-box input,.modal-box select,.modal-box textarea{width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--text);font-size:12px;box-sizing:border-box;outline:none}
.new-task-dialog{max-width:720px;padding:0;overflow:hidden}
.chat-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:14px 16px}
.chat-title{display:flex;align-items:center;gap:10px}
.chat-avatar{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--border-strong);background:var(--panel-2);color:var(--accent);font-family:var(--mono);font-weight:700;font-size:13px}
.chat-title h3{margin:0;font-size:14px}
.chat-body{display:grid;gap:10px;padding:14px 16px}
.chat-msg{max-width:92%;border:1px solid var(--border);border-radius:8px;padding:10px 11px;font-size:13px;line-height:1.45}
.chat-msg.assistant{background:var(--panel);color:var(--text)}
.chat-msg.user{justify-self:end;background:var(--accent-soft);border-color:rgba(var(--accent-rgb),0.35)}
.chat-composer{display:flex;gap:8px;align-items:flex-end}
.chat-composer textarea{min-height:96px;line-height:1.45;font-size:13px}
.chat-composer button{height:34px;padding:0 12px;border-radius:6px;border:1px solid var(--border-strong);background:var(--panel-2);color:var(--text);cursor:pointer;font-weight:650}
.chat-composer button:hover{border-color:var(--accent);color:var(--accent)}
.task-draft{display:grid;grid-template-columns:1.2fr 0.8fr 0.8fr;gap:8px}
.task-draft .wide{grid-column:1/-1}
.task-draft label{margin-top:0}
.task-draft input,.task-draft select{height:32px}
.task-create-row{display:flex;justify-content:flex-end;padding:0 16px 16px}
.nt-hidden{display:none}
@media(max-width:760px){.task-draft{grid-template-columns:1fr}.chat-composer{flex-direction:column;align-items:stretch}.chat-composer button{width:100%}}

/* Worker Monitor */
.worker-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px}
.worker-card{background:var(--card-bg);border:1px solid var(--border);border-radius:7px;padding:14px;box-shadow:0 1px 3px var(--shadow);font-size:12px}
.worker-card h4{margin:0 0 8px 0;font-size:14px}
.worker-card .w-meta{font-size:11px;color:var(--text-muted);line-height:1.7}
.worker-card .w-status{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase}
.worker-card .w-status.idle{background:#173421;color:#80d99a}
.worker-card .w-status.running{background:#1e2d46;color:#94bfff}
.worker-card .w-status.stale{background:#3b2f0f;color:#d8a657}
.worker-card .w-status.offline{background:#3d1515;color:#ff8f8f}
.worker-card .actions{margin-top:8px;display:flex;gap:4px;flex-wrap:wrap}
.worker-card .actions button{padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:var(--panel);color:var(--text-muted);cursor:pointer;font-size:11px}
.worker-card .actions button:hover{background:var(--panel-2);color:var(--text)}
.worker-card.stale-card{border-left:3px solid var(--warning)}
.worker-card.offline-card{border-left:3px solid var(--danger)}
.modal-box textarea{min-height:60px;resize:vertical}
.modal-box button.submit{padding:7px 16px;border:none;border-radius:6px;background:var(--accent);color:#171512;cursor:pointer;font-size:12px;font-weight:700;margin-top:10px}
.modal-box button.submit:hover{opacity:0.9}

/* Empty state */
.empty-state{padding:30px;text-align:center;color:var(--text-muted);font-size:13px;border:1px dashed var(--border);border-radius:8px;background:rgba(255,255,255,0.015)}

/* SSE indicator */
#sseStatus{display:inline-block;width:8px;height:8px;border-radius:50%;vertical-align:middle;box-shadow:0 0 12px currentColor}
#sseStatus.connected{background:var(--success)}
#sseStatus.disconnected{background:var(--danger)}
@media(max-width:1300px){.columns{grid-template-columns:repeat(6,220px)}}
@media(max-width:760px){.app-shell{padding:14px}.topbar{align-items:flex-start;flex-direction:column}.command-strip{align-items:flex-start;flex-direction:column}.columns{grid-template-columns:repeat(6,220px);gap:8px}.column{min-width:220px}}
</style>
</head>
<body>
<div class="app-shell">
<div class="topbar">
  <div class="brand"><div class="brand-mark">cc</div><div class="brand-copy"><span class="brand-kicker">Claude Code</span><h1>Kanban Dashboard</h1></div></div>
  <div class="status-pill"><span id="sseStatus" class="disconnected" title="Real-time status"></span><span>live board</span></div>
</div>
<div class="command-strip">
  <div id="filterBar"></div>
  <div id="toolbar"></div>
</div>
<div id="navTabs">
  <button class="active" onclick="switchView('status')">Status Board</button>
  <button onclick="switchView('agent')">Agent Board</button>
  <button onclick="switchView('zombie')">Zombie Monitor</button>
  <button onclick="switchView('worker')">Worker Monitor</button>
  <button onclick="switchView('verify')">Verification Review</button>
  <button onclick="switchView('dep')">Dependencies</button>
</div>
<div id="statusView" class="view active"><svg class="link-layer" id="dependencyLinks"></svg><div class="columns" id="columns"></div></div>
<div id="agentView" class="view"><div id="agentBoardContent"></div></div>
<div id="zombieView" class="view"><div id="zombieBoardContent"></div></div>
<div id="workerView" class="view"><div id="workerBoardContent"></div></div>
<div id="verifyView" class="view"><div id="verifyBoardContent"></div></div>
<div id="depView" class="view"><div id="depBoardContent"></div></div>
</div>

<!-- Event Timeline Modal -->
<div id="eventModal"><div class="modal-content"><span class="close-btn" onclick="closeEventModal()">&times;</span><h3 id="eventModalTitle">Event Timeline</h3><div id="eventTimelineContent"></div></div></div>

<!-- Artifact Viewer Modal -->
<div id="artifactModal"><div class="modal-content"><span class="close-btn" onclick="closeArtifactModal()">&times;</span><h3 id="artifactModalTitle">Artifacts</h3><div id="artifactViewerContent"></div></div></div>

<!-- New Task Modal -->
<div id="newTaskModal" class="modal-overlay"><div class="modal-box new-task-dialog">
<div class="chat-head"><div class="chat-title"><div class="chat-avatar">cc</div><h3>Claude Code</h3></div><span class="close-btn" onclick="closeNewTaskModal()">&times;</span></div>
<div class="chat-body">
<div class="chat-msg assistant" id="ntAssistantMsg">What should we track next?</div>
<div class="chat-composer"><textarea id="ntPrompt" placeholder="Fix Kanban drag and drop, high priority, @agent-a, #dashboard"></textarea><button onclick="draftTaskFromChat()">Draft</button><button onclick="runKanbanCommandFromChat()">Run</button></div>
<div class="task-draft">
<label class="wide">Title<input id="ntTitle" placeholder="Task title" required></label>
<label class="wide">Description<textarea id="ntBody" placeholder="Notes / description"></textarea></label>
<label>Status<select id="ntStatus"><option value="triage">Triage</option><option value="todo" selected>Todo</option><option value="ready">Ready</option><option value="running">Running</option><option value="blocked">Blocked</option><option value="done">Done</option></select></label>
<label>Priority<select id="ntPriority"><option value="">--</option><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
<label>Assignee<input id="ntAssignee" placeholder="@agent"></label>
<label class="wide">Tags<input id="ntTags" placeholder="dashboard, bug"></label>
<label class="wide"><input type="checkbox" id="ntDispatch"> Claim task for assignee/worker immediately</label>
<input class="nt-hidden" id="ntOwner" placeholder="Owner name">
</div>
</div>
<div class="task-create-row"><button class="submit" onclick="submitNewTask()">Create Task</button></div>
</div></div>

<!-- Edit Task Modal -->
<div id="editTaskModal" class="modal-overlay"><div class="modal-box"><span class="close-btn" onclick="closeEditTaskModal()">&times;</span><h3>Edit Task</h3>
<input type="hidden" id="etId">
<label>Title</label><input id="etTitle" required>
<label>Description</label><textarea id="etBody"></textarea>
<label>Status</label><select id="etStatus"><option value="triage">Triage</option><option value="todo">Todo</option><option value="ready">Ready</option><option value="running">Running</option><option value="blocked">Blocked</option><option value="done">Done</option></select>
<label>Priority</label><select id="etPriority"><option value="">--</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
<label>Owner</label><input id="etOwner" placeholder="Owner">
<label>Assignee</label><input id="etAssignee" placeholder="Assignee">
<label>Tags (comma separated)</label><input id="etTags" placeholder="tag1, tag2, tag3">
<label>Blocked Reason</label><input id="etBlockedReason" placeholder="Reason if blocked">
<button class="submit" onclick="submitEditTask()">Save Changes</button>
</div></div>

<script>
// ─── State ──────────────────────────────────────────────
const WS_KEY='kanban:workspaceId',PROJ_KEY='kanban:projectId',FILTER_KEY='kanban:filters';
let savedWs=localStorage.getItem(WS_KEY)||'',savedProj=localStorage.getItem(PROJ_KEY)||'';
let currentView='status';
let filters=JSON.parse(localStorage.getItem(FILTER_KEY)||'{}');
window.__tasks={};
if(!filters.hideArchived&&filters.hideArchived!==false)filters.hideArchived=true;

// ─── SSE ────────────────────────────────────────────────
if(typeof EventSource!=='undefined'){
  const es=new EventSource('/api/events');
  es.onopen=()=>{document.getElementById('sseStatus').className='connected'};
  es.onerror=()=>{document.getElementById('sseStatus').className='disconnected'};
  es.onmessage=(e)=>{try{const d=JSON.parse(e.data);if(d.type==='tasks_updated')renderView()}catch{}}
}

// ─── Fetch helpers ──────────────────────────────────────
async function fetchWorkspaces(){try{const r=await fetch('/api/workspaces');if(!r.ok)return[];const d=await r.json();return d.workspaces||[]}catch{return[]}}
async function fetchProjects(){try{const r=await fetch('/api/projects');if(!r.ok)return[];const d=await r.json();return d.projects||[]}catch{return[]}}
async function fetchBoard(){const r=await fetch("/api/tasks");if(!r.ok){alert("No board found. Create one with /kanban init");return null}const d=await r.json();return d.tasks||[]}
async function fetchZombies(){try{const r=await fetch("/api/zombies");if(!r.ok)return[];const d=await r.json();return d.zombies||[]}catch{return[]}}
async function fetchTaskEvents(id){try{const r=await fetch("/api/tasks/"+id+"/events");if(!r.ok)return[];const d=await r.json();return d.events||[]}catch{return[]}}
async function apiPost(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});if(!r.ok){let msg=r.statusText;try{const e=await r.json();msg=e.error||msg}catch{}throw new Error(msg)}return r}
async function apiPatch(url,body){const r=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});if(!r.ok){let msg=r.statusText;try{const e=await r.json();msg=e.error||msg}catch{}throw new Error(msg)}return r}

// ─── Utility ────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function age(ts){if(!ts)return'';const s=Math.floor((Date.now()-new Date(ts).getTime())/1000);if(s<60)return s+"s";const m=Math.floor(s/60);if(m<60)return m+"m "+s%60+"s";const h=Math.floor(m/60);return h+"h "+m%60+"m"}
function prioBadge(p){if(p==='urgent')return'<span class="badge-priority badge-urgent">urgent</span>';if(p==='high')return'<span class="badge-priority badge-high">high</span>';if(p==='normal')return'<span class="badge-priority badge-normal">normal</span>';if(p==='low')return'<span class="badge-priority badge-low">low</span>';return''}
function taskRef(id){return 'window.__tasks[\\''+String(id).replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'")+'\\']'}
function q(s){return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'")}
function dataTaskSelector(id){return '[data-task-id="'+(window.CSS&&CSS.escape?CSS.escape(id):String(id).replace(/"/g,'\\\\\\"'))+'"]'}

// ─── Filters ────────────────────────────────────────────
function saveFilters(){localStorage.setItem(FILTER_KEY,JSON.stringify(filters))}
function applyFilters(tasks){
  return tasks.filter(t=>{
    if(filters.search){const q=filters.search.toLowerCase();if(!t.title.toLowerCase().includes(q)&&!(t.body||'').toLowerCase().includes(q)&&!t.id.toLowerCase().includes(q))return false}
    if(filters.status&&t.status!==filters.status)return false;
    if(filters.priority&&t.priority!==filters.priority)return false;
    if(filters.agent){const a=filters.agent.toLowerCase();const ag=t.assignee||'';const ow=t.owner||'';const aa=t.assignedAgent||'';const cb=(t.lease&&t.lease.claimedBy)||'';if(!ag.toLowerCase().includes(a)&&!ow.toLowerCase().includes(a)&&!aa.toLowerCase().includes(a)&&!cb.toLowerCase().includes(a))return false}
    if(filters.tag&&(!t.tags||!t.tags.some(tg=>tg.toLowerCase().includes(filters.tag.toLowerCase()))))return false;
    if(filters.lease==='active'&&!t.lease)return false;
    if(filters.lease==='none'&&t.lease)return false;
    if(filters.lease==='expired'&&(!t.lease||new Date(t.lease.expiresAt)>new Date()))return false;
    if(filters.hideArchived&&t.status==='archived')return false;
    return true
  })
}
function renderFilterBar(){
  const el=document.getElementById('filterBar');
  el.innerHTML='\
<button class="newTaskBtn" onclick="showNewTaskModal()">+ New Task</button>\
<input id="fSearch" placeholder="Search..." style="width:140px" value="'+esc(filters.search||'')+'" oninput="onFilterChange()">\
<select id="fStatus" onchange="onFilterChange()"><option value="">Status</option><option value="triage"'+(filters.status==='triage'?' selected':'')+'>Triage</option><option value="todo"'+(filters.status==='todo'?' selected':'')+'>Todo</option><option value="ready"'+(filters.status==='ready'?' selected':'')+'>Ready</option><option value="running"'+(filters.status==='running'?' selected':'')+'>Running</option><option value="blocked"'+(filters.status==='blocked'?' selected':'')+'>Blocked</option><option value="done"'+(filters.status==='done'?' selected':'')+'>Done</option><option value="archived"'+(filters.status==='archived'?' selected':'')+'>Archived</option></select>\
<select id="fPriority" onchange="onFilterChange()"><option value="">Priority</option><option value="low"'+(filters.priority==='low'?' selected':'')+'>Low</option><option value="normal"'+(filters.priority==='normal'?' selected':'')+'>Normal</option><option value="high"'+(filters.priority==='high'?' selected':'')+'>High</option><option value="urgent"'+(filters.priority==='urgent'?' selected':'')+'>Urgent</option></select>\
<input id="fAgent" placeholder="Agent/owner" style="width:120px" value="'+esc(filters.agent||'')+'" oninput="onFilterChange()">\
<input id="fTag" placeholder="Tag" style="width:80px" value="'+esc(filters.tag||'')+'" oninput="onFilterChange()">\
<select id="fLease" onchange="onFilterChange()"><option value="">Lease</option><option value="active"'+(filters.lease==='active'?' selected':'')+'>Active</option><option value="none"'+(filters.lease==='none'?' selected':'')+'>None</option><option value="expired"'+(filters.lease==='expired'?' selected':'')+'>Expired</option></select>\
<label><input type="checkbox" id="fHideArchived" onchange="onFilterChange()"'+(filters.hideArchived?' checked':'')+'> Hide archived</label>';
}
function onFilterChange(){
  filters.search=document.getElementById('fSearch').value||undefined;
  filters.status=document.getElementById('fStatus').value||undefined;
  filters.priority=document.getElementById('fPriority').value||undefined;
  filters.agent=document.getElementById('fAgent').value||undefined;
  filters.tag=document.getElementById('fTag').value||undefined;
  filters.lease=document.getElementById('fLease').value||undefined;
  filters.hideArchived=document.getElementById('fHideArchived').checked;
  saveFilters();renderView()
}

// ─── View switching ─────────────────────────────────────
function switchView(view){
  currentView=view;
  document.querySelectorAll('#navTabs button').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick').includes(view)));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id.startsWith(view)));
  if(view==='status')renderStatusBoard();
  else if(view==='agent')renderAgentBoard();
  else if(view==='zombie')renderZombieMonitor();
  else if(view==='worker')renderWorkerMonitor();
  else if(view==='verify')renderVerificationReview();
  else if(view==='dep')renderDependencyView();
}

// ─── Toolbar ────────────────────────────────────────────
async function renderToolbar(){
  const[workspaces,projects]=await Promise.all([fetchWorkspaces(),fetchProjects()]);
  const el=document.getElementById('toolbar');
  let h='<label>Workspace: <select id="wsSelect" onchange="onWsChange()">';
  h+='<option value="">-- all --</option>';
  for(const w of workspaces)h+='<option value="'+esc(w.id)+'"'+(savedWs===w.id?' selected':'')+'>'+esc(w.name)+'</option>';
  h+='</select></label> <label>Project: <select id="projSelect" onchange="onProjChange()">';
  h+='<option value="">-- all --</option>';
  for(const p of projects)h+='<option value="'+esc(p.id)+'"'+(savedProj===p.id?' selected':'')+'>'+esc(p.name)+'</option>';
  h+='</select></label><span id="noProject">'+(savedProj?' (filtered)':'')+'</span>';
  el.innerHTML=h;
}
function onWsChange(){savedWs=document.getElementById('wsSelect').value;savedProj='';document.getElementById('projSelect').value='';localStorage.setItem(WS_KEY,savedWs);localStorage.setItem(PROJ_KEY,'');renderAll()}
function onProjChange(){savedProj=document.getElementById('projSelect').value;localStorage.setItem(PROJ_KEY,savedProj);renderAll()}

// ─── New Task Modal ─────────────────────────────────────
function showNewTaskModal(){document.getElementById('newTaskModal').classList.add('open');if(savedProj)document.getElementById('ntProjectId')&&(document.getElementById('ntProjectId').value=savedProj);setTimeout(()=>document.getElementById('ntPrompt').focus(),0)}
function closeNewTaskModal(){document.getElementById('newTaskModal').classList.remove('open')}
function inferPriority(text){
  const v=text.toLowerCase();
  if(/\\b(urgent|critical|blocker|p0|ด่วนมาก|วิกฤต)\\b/.test(v))return'urgent';
  if(/\\b(high|p1|important|ด่วน|สำคัญ|สูง)\\b/.test(v))return'high';
  if(/\\b(low|p3|later|ต่ำ|ไม่รีบ)\\b/.test(v))return'low';
  return'normal'
}
function inferStatus(text){
  const v=text.toLowerCase();
  if(/\\b(triage|investigate|สำรวจ|ตรวจสอบ)\\b/.test(v))return'triage';
  if(/\\b(ready|พร้อม)\\b/.test(v))return'ready';
  if(/\\b(running|in progress|กำลังทำ)\\b/.test(v))return'running';
  if(/\\b(blocked|ติด|รอ)\\b/.test(v))return'blocked';
  if(/\\b(done|complete|เสร็จ)\\b/.test(v))return'done';
  return'todo'
}
function cleanTitle(line){
  return line
    .replace(/^\\s*(please|todo|task|create task|add task|ช่วย|ทำ|เพิ่ม)[:\\- ]+/i,'')
    .replace(/[@#][\\p{L}\\p{N}_.-]+/gu,'')
    .replace(/\\b(urgent|critical|blocker|high|low|normal|priority|p[0-3])\\b/gi,'')
    .replace(/[,;:|]+/g,' ')
    .replace(/\\s+/g,' ')
    .trim()
}
async function draftTaskFromChat(){
  const prompt=document.getElementById('ntPrompt').value.trim();
  if(!prompt)return;
  document.getElementById('ntAssistantMsg').textContent='Drafting with Kanban assistant...';
  let draft=null,source='local',warning='';
  try{
    const r=await apiPost('/api/assistant/draft',{prompt});
    const d=await r.json();
    draft=d.draft;source=d.source||source;warning=d.warning||'';
  }catch(e){
    warning=e.message||String(e);
  }
  if(!draft){
    const lines=prompt.split(/\\r?\\n/).map(l=>l.trim()).filter(Boolean);
    const first=cleanTitle(lines[0]||prompt);
    const assignee=(prompt.match(/@([\\p{L}\\p{N}_.-]+)/u)||[])[1]||'';
    const tags=[...prompt.matchAll(/#([\\p{L}\\p{N}_.-]+)/gu)].map(m=>m[1]);
    draft={title:(first||prompt).slice(0,96),body:prompt,status:inferStatus(prompt),priority:inferPriority(prompt),assignee,tags};
  }
  document.getElementById('ntTitle').value=draft.title||'';
  document.getElementById('ntBody').value=draft.body||prompt;
  document.getElementById('ntStatus').value=draft.status||'todo';
  document.getElementById('ntPriority').value=draft.priority||'normal';
  document.getElementById('ntAssignee').value=(draft.assignee||'').replace(/^@/,'');
  document.getElementById('ntOwner').value=draft.owner||'ai-orchestrator';
  document.getElementById('ntTags').value=(draft.tags||[]).join(', ');
  document.getElementById('ntAssistantMsg').textContent='Draft ready via '+source+': '+(draft.title||'Untitled')+(warning?' (fallback: '+warning.slice(0,90)+')':'');
}
async function runKanbanCommandFromChat(){
  const prompt=document.getElementById('ntPrompt').value.trim();
  if(!prompt)return;
  const assignee=document.getElementById('ntAssignee').value.trim()||undefined;
  const msg=document.getElementById('ntAssistantMsg');
  msg.textContent='Running Kanban command...';
  try{
    const r=await fetch('/api/assistant/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,workerId:assignee,projectId:savedProj||undefined})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||d.message||r.statusText);
    let extra='';
    if(d.task)extra=' ['+(d.task.id||'task')+']';
    else if(d.tasks)extra=' ('+d.tasks.length+' tasks)';
    else if(d.workers)extra=' ('+d.workers.length+' workers)';
    if(d.examples&&d.examples.length)extra+=' Examples: '+d.examples.slice(0,3).join(' | ');
    msg.textContent=(d.message||'Command completed')+extra;
    renderAll();
  }catch(e){
    msg.textContent='Command failed: '+(e.message||String(e));
  }
}
async function submitNewTask(){
  if(!document.getElementById('ntTitle').value.trim()&&document.getElementById('ntPrompt').value.trim())await draftTaskFromChat();
  const title=document.getElementById('ntTitle').value.trim();if(!title)return alert('Title is required');
  const body=document.getElementById('ntBody').value.trim()||undefined;
  const status=document.getElementById('ntStatus').value;
  const priority=document.getElementById('ntPriority').value||undefined;
  const owner=document.getElementById('ntOwner').value.trim()||undefined;
  const assignee=document.getElementById('ntAssignee').value.trim()||undefined;
  const tagsStr=document.getElementById('ntTags').value.trim();
  const tags=tagsStr?tagsStr.split(',').map(t=>t.trim()).filter(Boolean):undefined;
  const draft={title,body,status,priority,owner,assignee,tags};
  const dispatch=document.getElementById('ntDispatch').checked;
  try{await apiPost('/api/assistant/create',{draft,dispatch,workerId:assignee,claimedBy:assignee,projectId:savedProj||undefined});closeNewTaskModal();document.getElementById('ntPrompt').value='';document.getElementById('ntTitle').value='';document.getElementById('ntBody').value='';document.getElementById('ntOwner').value='';document.getElementById('ntAssignee').value='';document.getElementById('ntTags').value='';document.getElementById('ntDispatch').checked=false;document.getElementById('ntAssistantMsg').textContent='What should we track next?';renderAll()}
  catch(e){alert('Failed to create task: '+e.message)}
}

// ─── Edit Task Modal ────────────────────────────────────
function showEditTaskModal(t){
  document.getElementById('etId').value=t.id;
  document.getElementById('etTitle').value=t.title;
  document.getElementById('etBody').value=t.body||'';
  document.getElementById('etStatus').value=t.status;
  document.getElementById('etPriority').value=t.priority||'';
  document.getElementById('etOwner').value=t.owner||'';
  document.getElementById('etAssignee').value=t.assignee||'';
  document.getElementById('etTags').value=(t.tags||[]).join(', ');
  document.getElementById('etBlockedReason').value=t.blockedReason||'';
  document.getElementById('etStatus').dataset.originalStatus=t.status;
  document.getElementById('editTaskModal').classList.add('open');
}
function closeEditTaskModal(){document.getElementById('editTaskModal').classList.remove('open')}
async function submitEditTask(){
  const id=document.getElementById('etId').value;
  const title=document.getElementById('etTitle').value.trim();if(!title)return alert('Title is required');
  const body=document.getElementById('etBody').value.trim()||undefined;
  const status=document.getElementById('etStatus').value;
  const priority=document.getElementById('etPriority').value||undefined;
  const owner=document.getElementById('etOwner').value.trim()||undefined;
  const assignee=document.getElementById('etAssignee').value.trim()||undefined;
  const tagsStr=document.getElementById('etTags').value.trim();
  const tags=tagsStr?tagsStr.split(',').map(t=>t.trim()).filter(Boolean):undefined;
  const blockedReason=document.getElementById('etBlockedReason').value.trim()||undefined;
  const update={title,body,priority,owner,assignee,tags,blockedReason};
  try{
    if(status!==document.getElementById('etStatus').dataset.originalStatus){await apiPost('/api/tasks/'+id+'/move',{status});}
    await apiPatch('/api/tasks/'+id,update);closeEditTaskModal();renderAll()
  }catch(e){alert('Failed to save: '+e.message)}
}

// ─── Status Board ───────────────────────────────────────
const COLUMNS=["triage","todo","ready","running","blocked","done"];
function taskActions(t){
  let b='<div class="actions">';
  b+='<button class="editBtn" onclick="showEditTaskModal('+taskRef(t.id)+')">Edit</button>';
  b+='<button onclick="moveTaskPrompt(\\''+q(t.id)+'\\')">Move</button>';
  if(t.status!=='blocked')b+='<button onclick="blockTask(\\''+q(t.id)+'\\')">Block</button>';
  if(t.status==='ready'||t.status==='todo')b+='<button onclick="claimTask(\\''+q(t.id)+'\\')">Claim</button>';
  if(t.lease){b+='<button onclick="releaseTask(\\''+q(t.id)+'\\')">Release</button>';b+='<button onclick="reclaimTask(\\''+q(t.id)+'\\')">Reclaim</button>'}
  if(t.retry&&t.retry.lastError)b+='<button onclick="retryBtn(\\''+q(t.id)+'\\')">Retry</button>';
  if(t.status==='running'||t.status==='blocked')b+='<button onclick="failTask(\\''+q(t.id)+'\\')">Fail</button>';
  if(t.status!=='done'&&t.status!=='archived')b+='<button onclick="completeTask(\\''+q(t.id)+'\\')">Done</button>';
  b+='<button onclick="archiveTask(\\''+q(t.id)+'\\')">Archive</button>';
  b+='<button onclick="showEventTimeline(\\''+q(t.id)+'\\')">Events</button>';
  if(t.artifacts&&t.artifacts.length>0)b+='<button onclick="viewArtifacts(\\''+q(t.id)+'\\')">Art '+t.artifacts.length+'</button>';
  b+='</div>';
  return b;
}
function taskMeta(t){
  let m='';
  if(t.assignee)m+='<span><b>@</b>'+esc(t.assignee)+'</span>';
  if(t.owner)m+=' <span><b>~</b>'+esc(t.owner)+'</span>';
  if(t.priority)m+=' '+prioBadge(t.priority);
  if(t.tags&&t.tags.length)m+=' '+t.tags.map(tg=>'<span class="tag">'+esc(tg)+'</span>').join('');
  if(t.body&&t.body.length>58)m+='<br>'+esc(t.body.slice(0,58))+'...';
  else if(t.body)m+='<br>'+esc(t.body);
  if(t.blockedReason)m+='<br><b>Blocked:</b> '+esc(t.blockedReason);
  if(t.lease)m+='<br><b>Lease:</b> '+esc(t.lease.workerId)+' age:'+age(t.lease.lastHeartbeatAt||t.lease.claimedAt)+' ['+t.lease.status+']';
  if(t.lease&&new Date(t.lease.expiresAt)<new Date())m+=' <span style="color:var(--danger);font-weight:bold">LEASE EXPIRED</span>';
  if(t.retry)m+='<br><b>Retry:</b> '+t.retry.attempt+'/'+t.retry.maxAttempts+(t.retry.lastError?' err:'+esc(t.retry.lastError):'');
  if(t.verification){
    if(t.verification.passed!==undefined)m+='<br><b>Verify:</b> '+(t.verification.passed?'PASS':'FAIL');
    if(t.verification.summary)m+=' '+esc(t.verification.summary);
  }
  if(t.hallucinationGuard&&t.hallucinationGuard.mismatchDetected)m+='<br><b>Hallucination mismatch detected</b>';
  if(t.artifacts&&t.artifacts.length>0){const cur=t.artifacts.find(a=>a.isCurrent);if(cur)m+='<br><b>Artifact:</b> v'+cur.version+' '+esc(cur.label)+(cur.content?' <span style="color:var(--text-muted)">('+esc(cur.content.slice(0,50))+')</span>':'');else m+='<br><b>Artifacts:</b> '+t.artifacts.length+' total'}
  return m;
}
function hashTask(t){
  const s=(t.id||'')+'|'+(t.title||'')+'|'+(t.status||'');
  let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return h
}
function taskSignal(t){
  let h=hashTask(t),bars='',dots='';
  for(let i=0;i<8;i++){
    h=(h*1664525+1013904223)>>>0;
    const height=18+(h%76);
    bars+='<span class="bar" style="height:'+height+'%"></span>';
  }
  h=hashTask(t)^0x9e3779b9;
  for(let i=0;i<5;i++){
    h=(h*1103515245+12345)>>>0;
    const left=8+(h%84);
    h=(h*1103515245+12345)>>>0;
    const top=12+(h%66);
    dots+='<span class="dot" style="left:'+left+'%;top:'+top+'%"></span>';
  }
  return '<div class="signal">'+bars+dots+'</div>'
}
async function renderStatusBoard(){
  const allTasks=await fetchBoard();if(!allTasks)return;
  const ptasks=savedProj?allTasks.filter(t=>t.projectId===savedProj||!t.projectId):allTasks;
  const tasks=applyFilters(ptasks);
  const links=document.getElementById('dependencyLinks');if(links)links.innerHTML='';
  const c=document.getElementById("columns");c.innerHTML=COLUMNS.map(x=>'<div class="column" data-status="'+x+'" ondragover="onColumnDragOver(event)" ondragleave="onColumnDragLeave(event)" ondrop="onColumnDrop(event,\\''+x+'\\')"><h2>'+x.toUpperCase()+' ('+tasks.filter(t=>t.status===x).length+')</h2><div id="cards-'+x+'"></div></div>').join('');
  for(const t of tasks){
    const d=document.createElement('div');
    window.__tasks[t.id]=t;
    const cls='task-card status-'+t.status+(t.status==='blocked'?' blocked':'')+(t.status==='done'?' done':'')+(t.priority==='urgent'?' prio-urgent':t.priority==='high'?' prio-high':t.priority==='normal'?' prio-normal':'');
    d.className=cls;
    d.draggable=true;
    d.dataset.taskId=t.id;
    d.addEventListener('dragstart',onTaskDragStart);
    d.addEventListener('dragend',onTaskDragEnd);
    d.innerHTML='<div class="card-head"><span class="card-id">'+esc(t.id)+'</span><span class="card-status">'+esc(t.status)+'</span></div><div class="ttl" onclick="showEditTaskModal('+taskRef(t.id)+')">'+esc(t.title)+'</div>'+taskSignal(t)+'<div class="meta">'+taskMeta(t)+'</div>'+taskActions(t);
    const col=document.getElementById('cards-'+t.status);
    if(col)col.appendChild(d);
  }
  setTimeout(()=>renderDependencyLinks(tasks),0);
}
function onTaskDragStart(e){e.currentTarget.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',e.currentTarget.dataset.taskId)}
function onTaskDragEnd(e){e.currentTarget.classList.remove('dragging');document.querySelectorAll('.column.drag-over').forEach(c=>c.classList.remove('drag-over'))}
function onColumnDragOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over')}
function onColumnDragLeave(e){e.currentTarget.classList.remove('drag-over')}
async function onColumnDrop(e,status){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');
  const id=e.dataTransfer.getData('text/plain');if(!id)return;
  const task=window.__tasks[id];if(!task||task.status===status)return;
  try{await apiPost('/api/tasks/'+id+'/move',{status});renderAll()}catch(err){alert('Move failed: '+err.message)}
}
function renderDependencyLinks(tasks){
  const svg=document.getElementById('dependencyLinks');const root=document.getElementById('statusView');
  if(!svg||!root||!root.getBoundingClientRect)return;
  svg.innerHTML='';
  const rootRect=root.getBoundingClientRect();if(!rootRect.width||!rootRect.height)return;
  svg.setAttribute('width',rootRect.width);svg.setAttribute('height',rootRect.height);
  const taskMap={};for(const t of tasks)taskMap[t.id]=t;
  const pairs=[];
  for(const t of tasks){
    for(const dep of (t.blockedBy||[]))pairs.push([dep,t.id]);
    for(const target of (t.blockers||[]))pairs.push([t.id,target]);
  }
  const seen=new Set();
  for(const [fromId,toId] of pairs){
    const key=fromId+'>'+toId;if(seen.has(key))continue;seen.add(key);
    const from=document.querySelector(dataTaskSelector(fromId));
    const to=document.querySelector(dataTaskSelector(toId));
    if(!from||!to)continue;
    const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
    const x1=a.right-rootRect.left,y1=a.top+a.height/2-rootRect.top;
    const x2=b.left-rootRect.left,y2=b.top+b.height/2-rootRect.top;
    const dx=Math.max(40,Math.abs(x2-x1)*0.45);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M '+x1+' '+y1+' C '+(x1+dx)+' '+y1+', '+(x2-dx)+' '+y2+', '+x2+' '+y2);
    svg.appendChild(path);
  }
}
if(window.addEventListener)window.addEventListener('resize',()=>{if(currentView==='status')renderDependencyLinks(Object.values(window.__tasks))});

// ─── Agent Board ────────────────────────────────────────
async function renderAgentBoard(){
  const allTasks=await fetchBoard();if(!allTasks)return;
  const ptasks=savedProj?allTasks.filter(t=>t.projectId===savedProj||!t.projectId):allTasks;
  const tasks=applyFilters(ptasks);const groups={};
  for(const t of tasks){
    const key=t.lease?t.lease.claimedBy||'Unassigned':t.assignedAgent||t.assignee||t.owner||'Unassigned';
    if(!groups[key])groups[key]=[];
    groups[key].push(t);
  }
  const sorted=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b));
  let h='<div class="agent-grid">';
  for(const[agent,tasks]of sorted){
    const running=tasks.filter(t=>t.status==='running').length;
    const stale=tasks.filter(t=>t.status==='running'&&t.lease&&new Date(t.lease.expiresAt)<new Date()).length;
    const zombie=tasks.filter(t=>t.status==='running'&&t.lease&&new Date(t.lease.expiresAt)<new Date(Date.now()-300000)).length;
    h+='<div class="agent-card"><h3>'+esc(agent)+'</h3><div class="stats">'+tasks.length+' tasks | '+running+' running | '+stale+' stale | '+zombie+' zombie</div>';
    for(const t of tasks.slice(0,10)){
      const badgeClass=t.status==='running'?'running':stale>0&&zombie>0?'zombie':'running';
      h+='<div class="a-task"><span class="status-badge '+badgeClass+'">'+t.status+'</span><b>'+esc(t.title)+'</b> '+esc(t.id);
      if(t.lease)h+=' <span style="font-size:10px;color:var(--text-muted)">HB:'+age(t.lease.lastHeartbeatAt||t.lease.claimedAt)+'</span>';
      if(t.retry&&t.retry.attempt>0)h+=' <span style="font-size:10px;color:var(--text-muted)">retry:'+t.retry.attempt+'/'+t.retry.maxAttempts+'</span>';
      h+=' <button style="font-size:10px" onclick="showEventTimeline(\\''+t.id+'\\')">E</button></div>';
    }
    if(tasks.length>10)h+='<div style="font-size:10px;color:var(--text-muted)">+'+(tasks.length-10)+' more</div>';
    h+='</div>';
  }
  h+='</div>';
  if(sorted.length===0)h='<div class="empty-state">No tasks found.</div>';
  document.getElementById('agentBoardContent').innerHTML=h;
}

// ─── Zombie Monitor ─────────────────────────────────────
async function renderZombieMonitor(){
  const zombies=await fetchZombies();
  const el=document.getElementById('zombieBoardContent');
  if(zombies.length===0){el.innerHTML='<div class="empty-state">No zombie tasks. Everything looks healthy.</div>';return}
  let h='<div class="zombie-list">';
  for(const t of zombies){
    h+='<div class="zombie-card"><h4>'+esc(t.title)+'</h4><div class="z-meta">';
    h+='<b>ID:</b> '+esc(t.id)+'<br>';
    if(t.lease){
      h+='<b>Worker:</b> '+esc(t.lease.workerId)+'<br>';
      h+='<b>Claimed By:</b> '+esc(t.lease.claimedBy)+'<br>';
      h+='<b>Expires:</b> '+t.lease.expiresAt+' ('+age(t.lease.expiresAt)+' ago)<br>';
      h+='<b>Last HB:</b> '+(t.lease.lastHeartbeatAt?t.lease.lastHeartbeatAt+' ('+age(t.lease.lastHeartbeatAt)+' ago)':'never')+'<br>';
      h+='<b>HB Age:</b> '+age(t.lease.lastHeartbeatAt||t.lease.claimedAt);
    }
    h+='</div><div class="actions">';
    h+='<button onclick="reclaimZombie(\\''+t.id+'\\')">Reclaim</button>';
    h+='<button onclick="releaseZombie(\\''+t.id+'\\')">Release</button>';
    if(t.retry&&t.retry.lastError)h+='<button onclick="retryBtn(\\''+t.id+'\\')">Retry</button>';
    h+='<button onclick="failTask(\\''+t.id+'\\')">Fail</button>';
    h+='</div></div>';
  }
  h+='</div>';
  el.innerHTML=h;
}
async function reclaimZombie(id){const w=prompt('Worker ID:');if(!w)return;await apiPost('/api/zombies/reclaim',{taskId:id,workerId:w,claimedBy:w});renderView()}
async function releaseZombie(id){const w=prompt('Worker ID:');if(!w)return;await apiPost('/api/tasks/'+id+'/release',{workerId:w});renderView()}

// ─── Worker Monitor ─────────────────────────────────────
async function fetchWorkers(){try{const r=await fetch('/api/workers');if(!r.ok)return[];const d=await r.json();return d.workers||[]}catch{return[]}}
async function renderWorkerMonitor(){
  const workers=await fetchWorkers();
  const el=document.getElementById('workerBoardContent');
  if(workers.length===0){el.innerHTML='<div class="empty-state">No registered workers. Start a worker with /kanban worker --worker &lt;id&gt; --loop</div>';return}
  let h='<div class="worker-list">';
  for(const w of workers){
    const cardClass=w.status==='offline'?'offline-card':w.status==='stale'?'stale-card':'';
    h+='<div class="worker-card '+cardClass+'"><h4>'+esc(w.name||w.id)+' <span class="w-status '+esc(w.status||'idle')+'">'+esc(w.status||'idle')+'</span></h4>';
    h+='<div class="w-meta">';
    h+='<b>ID:</b> '+esc(w.id)+'<br>';
    if(w.projectId)h+='<b>Project:</b> '+esc(w.projectId)+'<br>';
    if(w.workspaceId)h+='<b>Workspace:</b> '+esc(w.workspaceId)+'<br>';
    if(w.currentTaskId)h+='<b>Task:</b> '+esc(w.currentTaskId)+'<br>';
    h+='<b>Started:</b> '+w.startedAt+' ('+age(w.startedAt)+' ago)<br>';
    h+='<b>Heartbeat:</b> '+(w.lastHeartbeatAt?w.lastHeartbeatAt+' ('+age(w.lastHeartbeatAt)+' ago)':'never')+'<br>';
    if(w.tasksCompleted!==undefined)h+='<b>Tasks done:</b> '+w.tasksCompleted+'<br>';
    h+='</div>';
    h+='<div class="actions">';
    if(w.currentTaskId)h+='<button onclick="viewWorkerTask(\\''+esc(w.currentTaskId)+'\\')">View Task</button>';
    if(w.status!=='offline')h+='<button onclick="markWorkerOffline(\\''+esc(w.id)+'\\')">Mark Offline</button>';
    if(w.status==='stale'&&w.currentTaskId)h+='<button onclick="reclaimWorkerTask(\\''+esc(w.id)+'\\')">Reclaim Task</button>';
    h+='</div></div>';
  }
  h+='</div>';
  el.innerHTML=h;
}
async function markWorkerOffline(id){await apiPost('/api/workers/'+id+'/offline',{});renderView()}
async function viewWorkerTask(id){showEventTimeline(id)}
async function reclaimWorkerTask(id){const w=prompt("Worker ID for reclaim:")||'dashboard';await apiPost('/api/tasks/'+id+'/reclaim',{workerId:w,claimedBy:w});renderView()}

// ─── Verification Review ─────────────────────────────────
async function renderVerificationReview(){
  const allTasks=await fetchBoard();if(!allTasks)return;
  const ptasks=savedProj?allTasks.filter(t=>t.projectId===savedProj||!t.projectId):allTasks;
  const tasks=applyFilters(ptasks);
  const reviewTasks=tasks.filter(t=>t.verification||t.hallucinationGuard);
  const el=document.getElementById('verifyBoardContent');
  if(reviewTasks.length===0){el.innerHTML='<div class="empty-state">No tasks with verification data.</div>';return}
  let h='<div class="verify-list">';
  for(const t of reviewTasks){
    const passClass=t.verification&&t.verification.passed===true?'passed':t.verification&&t.verification.passed===false?'failed':'';
    h+='<div class="verify-card '+passClass+'"><h4>'+esc(t.title)+' <span style="font-size:11px;color:var(--text-muted)">'+esc(t.id)+' ['+t.status+']</span></h4><div class="v-meta">';
    if(t.verification){
      if(t.verification.passed!==undefined)h+='<b>Result:</b> '+(t.verification.passed?'PASSED':'FAILED')+'<br>';
      if(t.verification.summary)h+='<b>Summary:</b> '+esc(t.verification.summary)+'<br>';
      if(t.verification.requiredCommands&&t.verification.requiredCommands.length)h+='<b>Required cmds:</b> '+esc(t.verification.requiredCommands.join(', '))+'<br>';
      if(t.verification.evidence&&t.verification.evidence.length){
        h+='<b>Evidence:</b><div class="v-evi">';
        for(const e of t.verification.evidence)h+='&mdash; ['+esc(e.type)+'] '+esc(e.label)+(e.content?' <span style="color:var(--text-muted)">('+esc(e.content)+')</span>':'')+'<br>';
        h+='</div>';
      }
    }
    if(t.hallucinationGuard){
      if(t.hallucinationGuard.mismatchDetected)h+='<b style="color:var(--danger)">Hallucination mismatch detected!</b><br>';
      if(t.hallucinationGuard.claimedCommands&&t.hallucinationGuard.claimedCommands.length)h+='<b>Claimed cmds:</b> '+esc(t.hallucinationGuard.claimedCommands.join(', '))+'<br>';
      if(t.hallucinationGuard.verifiedCommands&&t.hallucinationGuard.verifiedCommands.length)h+='<b>Verified cmds:</b> '+esc(t.hallucinationGuard.verifiedCommands.join(', '))+'<br>';
      if(t.hallucinationGuard.recoveryAction)h+='<b>Recovery:</b> '+esc(t.hallucinationGuard.recoveryAction)+'<br>';
    }
    h+='</div><div class="actions">';
    h+='<button onclick="verifyPass(\\''+t.id+'\\')">Pass</button>';
    h+='<button onclick="verifyFail(\\''+t.id+'\\')">Fail</button>';
    if(t.status==='running')h+='<button onclick="releaseTask(\\''+t.id+'\\')">Release</button>';
    if(t.retry&&t.retry.lastError)h+='<button onclick="retryBtn(\\''+t.id+'\\')">Retry</button>';
    h+='<button onclick="showEventTimeline(\\''+t.id+'\\')">Events</button>';
    h+='</div></div>';
  }
  h+='</div>';
  el.innerHTML=h;
}
async function verifyPass(id){const s=prompt('Summary (optional):')||'Verified';await apiPost('/api/tasks/'+id+'/verify',{passed:true,summary:s});renderView()}
async function verifyFail(id){const r=prompt('Failure reason:');if(!r)return;await apiPost('/api/tasks/'+id+'/verify',{passed:false,summary:r});renderView()}

// ─── Event Timeline ─────────────────────────────────────
async function showEventTimeline(id){
  document.getElementById('eventModal').classList.add('open');
  document.getElementById('eventModalTitle').textContent='Event Timeline — '+id;
  const el=document.getElementById('eventTimelineContent');
  el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>';
  const events=await fetchTaskEvents(id);
  if(events.length===0){el.innerHTML='<div class="empty-state">No events for this task.</div>';return}
  let h='';
  for(const e of events){
    const cls='event-item '+(e.type||'');
    h+='<div class="'+cls+'"><span class="e-type">'+esc(e.type)+'</span><b>'+esc(e.actor)+'</b>: '+esc(e.message)+'<span class="e-time">'+e.createdAt+'</span>';
    if(e.metadata)h+='<div class="e-meta">'+esc(JSON.stringify(e.metadata))+'</div>';
    h+='</div>';
  }
  el.innerHTML=h;
}
function closeEventModal(){document.getElementById('eventModal').classList.remove('open')}

// ─── Artifact Viewer ────────────────────────────────────
async function viewArtifacts(taskId){
  document.getElementById('artifactModal').classList.add('open');
  document.getElementById('artifactModalTitle').textContent='Artifacts — '+taskId;
  const el=document.getElementById('artifactViewerContent');
  el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>';
  try{
    const r=await fetch('/api/tasks/'+taskId+'/artifacts');
    if(!r.ok){el.innerHTML='<div class="empty-state">Failed to load artifacts.</div>';return}
    const d=await r.json();const artifacts=d.artifacts||d||[];
    if(artifacts.length===0){el.innerHTML='<div class="empty-state">No artifacts for this task.</div>';return}
    let h='<div style="margin-bottom:8px;font-size:12px;color:var(--text-muted)">'+artifacts.length+' artifact(s) — sorted by version (newest first)</div>';
    for(const a of artifacts){
      const cls='artifact-card'+(a.isCurrent?' current':'');
      h+='<div class="'+cls+'">';
      h+='<span class="artifact-ver">v'+a.version+'</span>';
      if(a.isCurrent)h+=' <span style="font-size:10px;background:var(--accent);color:var(--card-bg);padding:1px 5px;border-radius:3px">CURRENT</span>';
      h+=' <span class="artifact-label">'+esc(a.type)+' &mdash; '+esc(a.label)+'</span>';
      h+='<div class="artifact-meta">by '+esc(a.createdBy)+' at '+a.createdAt;
      if(a.content)h+=' &middot; '+esc(a.content.slice(0,80))+(a.content.length>80?'...':'');
      h+='</div>';
      if(!a.isCurrent)h+='<div class="artifact-actions"><button onclick="selectArtifactDashboard(\\''+taskId+'\\',\\''+a.id+'\\')">Select as current</button></div>';
      h+='</div>';
    }
    el.innerHTML=h;
  }catch(e){el.innerHTML='<div class="empty-state">Error loading artifacts: '+e.message+'</div>'}
}
function closeArtifactModal(){document.getElementById('artifactModal').classList.remove('open')}
async function selectArtifactDashboard(taskId,artifactId){
  try{
    const r=await fetch('/api/tasks/'+taskId+'/artifacts/'+artifactId,{method:'POST'});
    if(!r.ok){const e=await r.json();alert('Failed: '+(e.error||r.statusText));return}
    viewArtifacts(taskId);
  }catch(e){alert('Failed: '+e.message)}
}

// ─── Dependency View ────────────────────────────────────
async function renderDependencyView(){
  const allTasks=await fetchBoard();if(!allTasks)return;
  const ptasks=savedProj?allTasks.filter(t=>t.projectId===savedProj||!t.projectId):allTasks;
  const tasks=applyFilters(ptasks);
  const el=document.getElementById('depBoardContent');
  const taskMap={};for(const t of tasks)taskMap[t.id]=t;

  // Collect all dependencies
  const depTasks=tasks.filter(t=>t.blockers||t.blockedBy||t.blockedReason);
  if(depTasks.length===0){el.innerHTML='<div class="empty-state">No dependency relationships found.</div>';return}

  // Group by resolved/unresolved
  let unresolved=[],resolved=[];
  for(const t of depTasks){
    const blockedBy=t.blockedBy||[];
    const allResolved=blockedBy.length===0||blockedBy.every(b=>{const bt=taskMap[b];return bt&&(bt.status==='done'||bt.status==='archived')});
    if(allResolved)resolved.push(t);else unresolved.push(t);
  }

  let h='<div class="dep-group"><h3>Unresolved Dependencies ('+unresolved.length+')</h3></div><div class="dep-list">';
  for(const t of unresolved){
    const blockers=t.blockers||[];const blockedBy=t.blockedBy||[];
    h+='<div class="dep-card" style="border-left:3px solid var(--danger)"><h4>'+esc(t.title)+' <span style="font-size:11px;color:var(--text-muted)">'+esc(t.id)+' ['+t.status+']</span></h4>';
    if(blockedBy.length>0){
      h+='<div class="dep-row"><b>Blocked by:</b> ';
      h+=blockedBy.map(b=>{
        const bt=taskMap[b];const done=bt&&(bt.status==='done'||bt.status==='archived');
        return '<span class="'+(done?'dep-done':'dep-blocked')+'">'+(bt?esc(bt.title):esc(b))+(done?' ✓':' ✗')+'</span>';
      }).join(', ');
      h+='</div>';
    }
    if(blockers.length>0){
      h+='<div class="dep-row"><b>Blocks:</b> ';
      h+=blockers.map(b=>{
        const bt=taskMap[b];
        return '<span class="'+(bt?'dep-pending':'dep-missing')+'">'+(bt?esc(bt.title):esc(b))+'</span>';
      }).join(', ');
      h+='</div>';
    }
    if(t.blockedReason)h+='<div class="dep-row dep-blocked"><b>Blocked:</b> '+esc(t.blockedReason)+'</div>';
    if(blockedBy.some(b=>!taskMap[b]))h+='<div class="dep-row dep-missing"><b>Warning:</b> Some dependency tasks not found</div>';
    h+='</div>';
  }
  h+='</div>';

  if(resolved.length>0){
    h+='<div class="dep-group"><h3>Resolved Dependencies ('+resolved.length+')</h3></div><div class="dep-list">';
    for(const t of resolved.slice(0,20)){
      const blockers=t.blockers||[];const blockedBy=t.blockedBy||[];
      h+='<div class="dep-card" style="border-left:3px solid var(--success)"><h4>'+esc(t.title)+' <span style="font-size:11px;color:var(--text-muted)">'+esc(t.id)+' ['+t.status+']</span></h4>';
      if(blockedBy.length>0){
        h+='<div class="dep-row"><b>Blocked by:</b> ';
        h+=blockedBy.map(b=>{
          const bt=taskMap[b];const done=bt&&(bt.status==='done'||bt.status==='archived');
          return '<span class="'+(done?'dep-done':'dep-blocked')+'">'+(bt?esc(bt.title):esc(b))+(done?' ✓':' ✗')+'</span>';
        }).join(', ');
        h+='</div>';
      }
      if(blockers.length>0)h+='<div class="dep-row"><b>Blocks:</b> '+blockers.map(b=>esc(b)).join(', ')+'</div>';
      h+='</div>';
    }
    if(resolved.length>20)h+='<div style="font-size:11px;color:var(--text-muted);text-align:center">+'+(resolved.length-20)+' more resolved</div>';
    h+='</div>';
  }

  el.innerHTML=h;
}

// ─── Actions ────────────────────────────────────────────
async function moveTaskPrompt(id){const s=prompt('Status:');if(!s)return;await apiPost('/api/tasks/'+id+'/move',{status:s});renderView()}
async function blockTask(id){const r=prompt('Block reason:');if(!r)return;await apiPost('/api/tasks/'+id+'/block',{reason:r});renderView()}
async function claimTask(id){const w=prompt('Worker ID:');if(!w)return;await apiPost('/api/tasks/'+id+'/claim',{workerId:w,claimedBy:w});renderView()}
async function heartbeatTask(id){const w=prompt('Worker ID:');if(!w)return;await apiPost('/api/tasks/'+id+'/heartbeat',{workerId:w});renderView()}
async function releaseTask(id){const w=prompt('Worker ID:');if(!w)return;await apiPost('/api/tasks/'+id+'/release',{workerId:w});renderView()}
async function reclaimTask(id){const w=prompt('Worker ID:');if(!w)return;await apiPost('/api/tasks/'+id+'/reclaim',{workerId:w,claimedBy:w});renderView()}
async function completeTask(id){const s=prompt('Summary (optional):')||'';await apiPost('/api/tasks/'+id+'/complete',{summary:s});renderView()}
async function failTask(id){const r=prompt('Failure reason:');if(!r)return;await apiPost('/api/tasks/'+id+'/fail',{reason:r});renderView()}
async function retryBtn(id){await apiPost('/api/tasks/'+id+'/retry');renderView()}
async function archiveTask(id){if(!confirm('Archive this task?'))return;await apiPost('/api/tasks/'+id+'/archive');renderView()}

// ─── Render current view ────────────────────────────────
function renderView(){switchView(currentView)}
function renderAll(){renderFilterBar();renderToolbar();renderView()}

// ─── Init ───────────────────────────────────────────────
renderFilterBar();
renderToolbar();
renderStatusBoard();
</script>
</body>
</html>`
}

export function startKanbanServer(options: ServerOptions = {}): Promise<{ url: string; close: () => void }> {
  const { port, rootDir } = options
  const handlers = createServerHandlers(rootDir)

  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = req.url || '/'
        const { path, id, subPath, projectId, parts } = parseUrl(url)
        let response: ApiResponse

        let bodyStr = ''
        await new Promise<void>((resolvePromise) => {
          req.on('data', (chunk) => { bodyStr += chunk })
          req.on('end', resolvePromise)
        })
        const body = parseJsonBody(bodyStr)

        if (url === '/' || url.startsWith('/?')) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(renderDashboard())
          return
        }

        if (path === 'api/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          })
          res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
          const clientId = ++sseIdCounter
          sseClients.push({ id: clientId, res })
          req.on('close', () => {
            const idx = sseClients.findIndex(c => c.id === clientId)
            if (idx >= 0) sseClients.splice(idx, 1)
          })
          return
        }

        if (path === 'api/board') {
          response = await handlers.handleBoard()
        } else if (path === 'api/assistant/draft') {
          if (req.method === 'POST') {
            response = await handlers.handleAssistantDraft(body)
          } else {
            response = createJsonResponse(405, { error: 'Method not allowed' })
          }
        } else if (path === 'api/assistant/create') {
          if (req.method === 'POST') {
            response = await handlers.handleAssistantCreate(body)
          } else {
            response = createJsonResponse(405, { error: 'Method not allowed' })
          }
        } else if (path === 'api/assistant/command') {
          if (req.method === 'POST') {
            response = await handlers.handleAssistantCommand(body)
          } else {
            response = createJsonResponse(405, { error: 'Method not allowed' })
          }
        } else if (path === 'api/tasks/claim-next') {
          if (req.method === 'POST') {
            response = await handlers.handleClaimNext(body)
          } else {
            response = createJsonResponse(404, { error: 'Not found' })
          }
        } else if (path === 'api/tasks') {
          if (req.method === 'GET') {
            response = await handlers.handleListTasks()
          } else if (req.method === 'POST') {
            response = await handlers.handleAddTask(body)
          } else {
            response = createJsonResponse(404, { error: 'Not found' })
          }
        } else if (path === 'api/files') {
          response = await handlers.handleFiles()
        } else if (path === 'api/conflicts') {
          response = await handlers.handleConflicts()
        } else if (path === 'api/export' && req.method === 'POST') {
          response = await handlers.handleExport()
        } else if (path === 'api/zombies') {
          response = await handlers.handleListZombies()
        } else if (path === 'api/zombies/reclaim' && req.method === 'POST') {
          response = await handlers.handleReclaimZombie(body)
        } else if (path === 'api/workspaces') {
          if (req.method === 'GET') {
            response = await handlers.handleListWorkspaces()
          } else if (req.method === 'POST') {
            response = await handlers.handleCreateWorkspace(body)
          } else {
            response = createJsonResponse(404, { error: 'Not found' })
          }
        } else if (path === 'api/projects') {
          if (req.method === 'GET') {
            response = await handlers.handleListProjects()
          } else if (req.method === 'POST') {
            response = await handlers.handleCreateProject(body)
          } else {
            response = createJsonResponse(404, { error: 'Not found' })
          }
        } else if (path.startsWith('api/projects') && projectId) {
          if (subPath === 'tasks' && req.method === 'GET') {
            response = await handlers.handleProjectTasks(projectId)
          } else {
            response = createJsonResponse(404, { error: 'Not found' })
          }
        } else if (path.startsWith('api/tasks/:id')) {
          if (!id) {
            response = createJsonResponse(400, { error: 'Task id required' })
          } else if (subPath === 'events' && req.method === 'GET') {
            response = await handlers.handleGetEvents(id)
          } else if (req.method === 'GET' && !subPath) {
            response = await handlers.handleGetTask(id)
          } else if (req.method === 'PATCH') {
            response = await handlers.handlePatchTask(id, body)
          } else if (req.method === 'DELETE') {
            response = await handlers.handleDeleteTask(id)
          } else if (subPath === 'move' && req.method === 'POST') {
            response = await handlers.handleMoveTask(id, body)
          } else if (subPath === 'block' && req.method === 'POST') {
            response = await handlers.handleBlockTask(id, body)
          } else if (subPath === 'unblock' && req.method === 'POST') {
            response = await handlers.handleUnblockTask(id)
          } else if (subPath === 'complete' && req.method === 'POST') {
            response = await handlers.handleVerifyAndComplete(id, body)
          } else if (subPath === 'comment' && req.method === 'POST') {
            response = await handlers.handleCommentTask(id, body)
          } else if (subPath === 'archive' && req.method === 'POST') {
            response = await handlers.handleArchiveTask(id)
          } else if (subPath === 'claim' && req.method === 'POST') {
            response = await handlers.handleClaimTask(id, body)
          } else if (subPath === 'heartbeat' && req.method === 'POST') {
            response = await handlers.handleHeartbeat(id, body)
          } else if (subPath === 'release' && req.method === 'POST') {
            response = await handlers.handleReleaseTask(id, body)
          } else if (subPath === 'reclaim' && req.method === 'POST') {
            response = await handlers.handleReclaimTask(id, body)
          } else if (subPath === 'retry' && req.method === 'POST') {
            response = await handlers.handleRetryTask(id, body)
          } else if (subPath === 'fail' && req.method === 'POST') {
            response = await handlers.handleFailTask(id, body)
          } else if (subPath === 'verify' && req.method === 'POST') {
            response = await handlers.handleVerifyTask(id, body)
          } else if (subPath === 'evidence' && req.method === 'POST') {
            response = await handlers.handleEvidenceTask(id, body)
          } else if (subPath === 'artifacts' && req.method === 'GET' && !parts[4]) {
            response = await handlers.handleGetArtifacts(id)
          } else if (subPath === 'artifacts/current' && req.method === 'GET') {
            response = await handlers.handleGetCurrentArtifact(id)
          } else if (subPath === 'artifacts' && req.method === 'POST' && !parts[4]) {
            response = await handlers.handleGenerateArtifact(id, body)
          } else if (subPath === 'artifacts' && parts[4] && req.method === 'POST') {
            const artifactId = parts[4]
            response = await handlers.handleSelectArtifact(id, artifactId)
          } else {
            response = createJsonResponse(404, { error: 'Not found' })
          }
        } else if (path === 'api/workers') {
          if (req.method === 'GET') {
            response = await handlers.handleListWorkers()
          } else if (req.method === 'POST') {
            response = await handlers.handleRegisterWorker(body)
          } else {
            response = createJsonResponse(405, { error: 'Method not allowed' })
          }
        } else if (path === 'api/workers/:id' && id) {
          if (req.method === 'GET') {
            response = await handlers.handleGetWorker(id)
          } else {
            response = createJsonResponse(405, { error: 'Method not allowed' })
          }
        } else if (path === 'api/workers/:id/heartbeat' && id) {
          if (req.method === 'POST') {
            response = await handlers.handleWorkerHeartbeat(id, body)
          } else {
            response = createJsonResponse(405, { error: 'Method not allowed' })
          }
        } else if (path === 'api/workers/:id/offline' && id) {
          if (req.method === 'POST') {
            response = await handlers.handleWorkerOffline(id)
          } else {
            response = createJsonResponse(405, { error: 'Method not allowed' })
          }
        } else {
          response = createJsonResponse(404, { error: 'Not found' })
        }

        res.writeHead(response.status, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '127.0.0.1'
        })
        res.end(JSON.stringify(response.body))

        // Notify SSE clients after mutations (POST, PATCH, DELETE)
        if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
          notifySSE()
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
    })

    const listenPort = port || 0
    server.listen(listenPort, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        const serverUrl = 'http://127.0.0.1:' + addr.port
        resolve({ url: serverUrl, close: () => { server.close() } })
      }
    })
  })
}

export async function openKanbanDashboard(port?: number, rootDir?: string): Promise<string> {
  const { url } = await startKanbanServer({ port, rootDir })
  await open(url)
  return url
}
