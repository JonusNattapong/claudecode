import { registerBundledSkill } from '../bundledSkills.js';

const SIMPLIFY_PROMPT = `# Simplify: Code Review and Auto-Fix

Run \`/code-review --fix\` to review changed files and apply fixes automatically.

## Steps

1. Run \`git diff HEAD\` (or \`git diff\` if no staged changes) to identify changed files
2. Run \`/code-review --fix\` to review and apply fixes
3. Briefly summarize what was fixed or confirm the code was already clean

If \`/code-review --fix\` is not available, fall back to manual review with focus on reuse, quality, and efficiency.
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
