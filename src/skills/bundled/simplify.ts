import { AGENT_TOOL_NAME } from '../../tools/AgentTool/constants.js';
import { registerBundledSkill } from '../bundledSkills.js';

const SIMPLIFY_PROMPT = `# Simplify: Cleanup-Only Code Review

This is a **cleanup-only** review. Focus exclusively on code quality, reuse, efficiency, and abstraction level alignment. Do NOT hunt for correctness bugs — that is the job of \`/code-review\`.

Fix any issues found directly — apply changes to the working tree.

## Phase 1: Identify Changes

Run \`git diff\` (or \`git diff HEAD\` if there are staged changes) to see what changed. If there are no git changes, review the most recently modified files that the user mentioned or that you edited earlier in this conversation.

## Phase 2: Launch Review Agents in Parallel

Use the ${AGENT_TOOL_NAME} tool to launch all three agents concurrently in a single message. Pass each agent the full diff so it has the complete context.

### Agent 1: Code Reuse Review

For each change:

1. **Search for existing utilities and helpers** that could replace newly written code. Look for similar patterns elsewhere in the codebase — common locations are utility directories, shared modules, and files adjacent to the changed ones.
2. **Flag any new function that duplicates existing functionality.** Suggest the existing function to use instead.
3. **Flag any inline logic that could use an existing utility** — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns are common candidates.

### Agent 2: Code Quality Review

Review the same changes for hacky patterns:

1. **Redundant state**: state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls
2. **Parameter sprawl**: adding new parameters to a function instead of generalizing or restructuring existing ones
3. **Copy-paste with slight variation**: near-duplicate code blocks that should be unified with a shared abstraction
4. **Leaky abstractions**: exposing internal details that should be encapsulated, or breaking existing abstraction boundaries
5. **Stringly-typed code**: using raw strings where constants, enums (string unions), or branded types already exist in the codebase
6. **Unnecessary JSX nesting**: wrapper Boxes/elements that add no layout value — check if inner component props (flexShrink, alignItems, etc.) already provide the needed behavior
7. **Unnecessary comments**: comments explaining WHAT the code does (well-named identifiers already do that), narrating the change, or referencing the task/caller — delete; keep only non-obvious WHY (hidden constraints, subtle invariants, workarounds)

### Agent 3: Efficiency Review

Review the same changes for efficiency:

1. **Unnecessary work**: redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns
2. **Missed concurrency**: independent operations run sequentially when they could run in parallel
3. **Hot-path bloat**: new blocking work added to startup or per-request/per-render hot paths
4. **Recurring no-op updates**: state/store updates inside polling loops, intervals, or event handlers that fire unconditionally — add a change-detection guard so downstream consumers aren't notified when nothing changed
5. **Unnecessary existence checks**: pre-checking file/resource existence before operating (TOCTOU anti-pattern) — operate directly and handle the error
6. **Memory**: unbounded data structures, missing cleanup, event listener leaks
7. **Overly broad operations**: reading entire files when only a portion is needed, loading all items when filtering for one

### Agent 4: Altitude (Abstraction Level Alignment)

Review the same changes for over-engineering and misaligned abstraction:

1. **Over-engineering**: abstractions that add complexity without proportional benefit — generic interfaces with a single implementation, elaborate type hierarchies for simple data, premature configuration/hook systems
2. **Wrong abstraction level**: code that operates at a different level of abstraction than its surroundings — inlining framework internals alongside business logic, or wrapping trivial operations in unnecessary indirection
3. **Scope creep**: a change that addresses future concerns instead of the current requirement, adding unused parameters, conditional branches, or extension points
4. **Inconsistency with codebase conventions**: deviating from established patterns in the surrounding code without justification — different error handling style, different naming convention, different module structure

## Phase 3: Fix Issues

Wait for all agents to complete. Aggregate their findings and fix each issue directly. If a finding is a false positive or not worth addressing, note it and move on — do not argue with the finding, just skip it.

When done, briefly summarize what was fixed (or confirm the code was already clean).
`;

export function registerSimplifySkill(): void {
  registerBundledSkill({
    name: 'simplify',
    description: 'Review changed code for reuse, quality, and efficiency, then fix any issues found.',
    userInvocable: true,
    async getPromptForCommand(args) {
      let prompt = SIMPLIFY_PROMPT;
      if (args) {
        prompt += `\n\n## Additional Focus\n\n${args}`;
      }
      return [{ type: 'text', text: prompt }];
    },
  });
}
