import { registerBundledSkill } from '../bundledSkills.js';

const SKILL_BODY = `Create a clear, concise git commit that captures the intent of the changes.

1. Stage relevant changes with \`git add\` (let the user review first)
2. Commit with a conventional commit message: \`type(scope): description\`
   - Types: feat, fix, docs, style, refactor, test, chore
   - Keep the first line under 72 characters
   - Include a body for non-obvious changes
3. Push if the user asks

Do NOT commit if the user hasn't reviewed the changes. Ask first.`;

export function registerCommitSkill(): void {
  registerBundledSkill({
    name: 'commit',
    description: 'Stage, commit, and push git changes with a conventional commit message.',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: SKILL_BODY }];
    },
  });
}
