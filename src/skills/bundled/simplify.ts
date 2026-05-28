import { registerBundledSkill } from '../bundledSkills.js';

const SIMPLIFY_PROMPT = `# Simplify: Code Review and Auto-Fix

Run \`/code-review --fix\` to review changed files and apply reuse, simplification, and efficiency improvements.

If no changes are detected, state that the working tree is clean.
`;

export function registerSimplifySkill(): void {
  registerBundledSkill({
    name: 'simplify',
    description:
      'Review changed code for reuse, quality, and efficiency, then apply fixes directly. Invokes /code-review --fix.',
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
