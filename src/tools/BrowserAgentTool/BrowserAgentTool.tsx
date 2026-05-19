/**
 * Browser Agent Tool — Autonomous Web Automation
 */

import * as React from 'react';
import { z } from 'zod/v4';
import { Text } from '../../ink.js';
import { buildTool } from '../../Tool.js';
import { lazySchema } from '../../utils/lazySchema.js';
import { BrowserAgent } from '../../services/ai/BrowserAgent.js';

export const BROWSER_AGENT_TOOL_NAME = 'browser_agent' as const;

const inputSchema = lazySchema(() =>
  z.object({
    goal: z.string().describe('The goal for the autonomous agent to achieve on the web'),
    maxSteps: z.number().optional().describe('Maximum number of steps to take (default: 15)'),
  }),
);

const outputSchema = lazySchema(() =>
  z.object({
    result: z.string(),
  }),
);

export const BrowserAgentTool = buildTool({
  name: BROWSER_AGENT_TOOL_NAME,
  aliases: ['web_agent', 'autonomous_browser'],
  searchHint: 'autonomous web browsing agent vision automation',

  get inputSchema() {
    return inputSchema();
  },

  get outputSchema() {
    return outputSchema();
  },

  async description(): Promise<string> {
    return 'Run an autonomous web agent that uses vision and reasoning to achieve a goal. Best for complex multi-step tasks like research, booking, or form filling where simple automation fails.';
  },

  async prompt(): Promise<string> {
    return `Use this tool to delegate complex web tasks to an autonomous agent. The agent will analyze screenshots of the page and take actions until it reaches your goal.
    
    Example Goals:
    - "Find the cheapest flight from BKK to NRT next Monday"
    - "Go to github.com/JonusNattapong and summarize the latest project"
    - "Sign up for a newsletter on example.com with email test@example.com"`;
  },

  isEnabled(): boolean {
    return true;
  },

  async call(input: any): Promise<{ data: any }> {
    const agent = new BrowserAgent({ maxSteps: input.maxSteps });
    try {
      const result = await agent.runTask({ goal: input.goal, maxSteps: input.maxSteps });
      return { data: { result } };
    } catch (error: any) {
      return { data: { result: `Agent failed: ${error.message}` } };
    }
  },

  renderToolUseMessage(input: any): React.ReactNode {
    return React.createElement(Text, null, `🤖 Autonomous Agent: "${input.goal}"`);
  },
});
