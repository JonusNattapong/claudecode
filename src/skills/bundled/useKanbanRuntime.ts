import { registerBundledSkill } from '../bundledSkills.js'

const SKILL_MD = `# Use Kanban Runtime

Follow these rules when working with Kanban tasks through the agent runtime protocol.

## Rules

1. **Always claim before working.** Never modify a task without holding its lease. Use \`claimNextTask()\` or \`POST /api/tasks/claim-next\`.

2. **Heartbeat while working.** After claiming, start a heartbeat loop. Heartbeat every 30s to keep the lease alive. Stop the heartbeat when done.

3. **Never mark done without evidence.** Every completion must include attached evidence: test output, build logs, or verification results. Attach evidence via \`addCommandEvidence()\` or \`POST /api/tasks/:id/evidence\`.

4. **Attach test/build output.** Evidence must include actual output, not just summaries. This enables hallucination guard checks.

5. **If blocked, use block/fail with reason.** Do not abandon a task silently. Call \`blockKanbanTask()\` with a clear reason, or \`failKanbanTask()\` if the task cannot proceed.

6. **If context is uncertain, comment instead of hallucinating.** Use \`commentKanbanTask()\` to ask questions rather than making assumptions.

7. **Use complete only after verification.** Call \`completeWithEvidence()\` which adds evidence, verifies, then completes. It will move to review instead if evidence is missing.

8. **Prefer small tasks.** Break large work into multiple claimable tasks. Small tasks are easier to verify and less likely to become zombies.

9. **Release task if stopping.** If you must stop mid-work, call \`releaseKanbanTask()\` to free the lease so others can pick it up.

## Command Examples

\`\`\`
/kanban claim-next --worker agent-1
/kanban next
/kanban show kb-xxx
/kanban block kb-xxx --reason "Waiting for API"
/kanban complete kb-xxx "Implemented login page"
/kanban fail kb-xxx "Tests fail: 3/42"
/kanban comment kb-xxx "What approach should I use?"
/kanban evidence kb-xxx --type command --label "npm test"
\`\`\`

## HTTP Examples

\`\`\`
POST /api/tasks/claim-next
{"workerId":"agent-1"}

POST /api/tasks/kb-xxx/heartbeat
{"workerId":"agent-1"}

POST /api/tasks/kb-xxx/evidence
{"type":"command","label":"npm test","content":"✓ 42 tests passed"}

POST /api/tasks/kb-xxx/complete
{"summary":"Done","workerId":"agent-1"}
\`\`\`

## Learn More

See docs/kanban-agent-runtime.md for the full protocol specification.
`

export function registerUseKanbanRuntimeSkill(): void {
  registerBundledSkill({
    name: 'use-kanban-runtime',
    description: 'Follow the Kanban agent runtime protocol: claim tasks, heartbeat, attach evidence, complete safely.',
    userInvocable: false,
    files: [],
    async getPromptForCommand() {
      return [{ type: 'text', text: SKILL_MD.trimStart() }]
    },
  })
}
