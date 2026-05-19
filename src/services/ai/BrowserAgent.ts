import { sideQuery } from '../../utils/sideQuery.js';
import { handleBrowserAction } from '../../tools/BrowserTool/handler.js';
import type { BrowserActionInput, BrowserResult } from '../../tools/BrowserTool/types.js';
import { ProviderManager } from './ProviderManager.js';

export interface AgentTask {
  goal: string;
  maxSteps?: number;
}

export class BrowserAgent {
  private providerManager = ProviderManager.getInstance();
  private maxSteps = 15;

  constructor(options: { maxSteps?: number } = {}) {
    if (options.maxSteps) this.maxSteps = options.maxSteps;
  }

  async runTask(task: AgentTask): Promise<string> {
    let currentStep = 0;
    const history: any[] = [];
    let lastResult = "Started task: " + task.goal;

    while (currentStep < (task.maxSteps || this.maxSteps)) {
      currentStep++;
      console.log(`\n[BrowserAgent] 🤖 Step ${currentStep}/${task.maxSteps || this.maxSteps}`);

      // 1. Extract Interactive DOM & Draw Labels
      console.log(`[BrowserAgent] 🔍 Scanning page and drawing visual labels...`);
      const domData = await handleBrowserAction({ 
        action: 'evaluate', 
        expression: `
          (() => {
            // Remove existing labels if any
            document.querySelectorAll('.claude-vision-label').forEach(e => e.remove());
            
            // Only select elements that are actually visible in the current viewport.
            const allElements = Array.from(document.querySelectorAll('a, button, input, textarea, select, [role="button"]'));
            const visibleElements = allElements.filter(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth && style.visibility !== 'hidden' && style.opacity !== '0';
            });
            
            const interactive = visibleElements.map((el, index) => {
              // Inject a unique ID so the AI can target it flawlessly
              el.setAttribute('data-claude-id', index.toString());
              
              // Draw visual label for Vision AI
              const rect = el.getBoundingClientRect();
              const label = document.createElement('div');
              label.textContent = index.toString();
              label.className = 'claude-vision-label';
              Object.assign(label.style, {
                position: 'absolute',
                top: (rect.top + window.scrollY) + 'px',
                left: (rect.left + window.scrollX) + 'px',
                backgroundColor: 'rgba(255, 0, 0, 0.8)',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '2px 4px',
                borderRadius: '3px',
                zIndex: '2147483647',
                pointerEvents: 'none' // Don't block clicks
              });
              document.body.appendChild(label);
              
              const tag = el.tagName.toLowerCase();
              let text = el.textContent?.replace(/\\s+/g, ' ').trim().substring(0, 80) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
              
              // For Google search results, h3 text is important
              if (tag === 'a' && el.querySelector('h3')) {
                 text = el.querySelector('h3').textContent?.trim().substring(0, 80) || text;
              }
              
              return \`[\${index}] [data-claude-id="\${index}"] \${tag} center=(\${Math.round(rect.left + rect.width / 2)},\${Math.round(rect.top + rect.height / 2)}) box=(\${Math.round(rect.left)},\${Math.round(rect.top)},\${Math.round(rect.width)},\${Math.round(rect.height)}) - "\${text}"\`;
            }).filter(item => !item.endsWith('- ""')).slice(0, 100);
            
            return {
              interactive,
              text: document.body ? document.body.innerText.substring(0, 10000) : '',
              scroll: {
                x: window.scrollX,
                y: window.scrollY,
                maxY: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight
              }
            };
          })();
        `
      });
      
      // 2. Get state + Screenshot (WITH labels)
      console.log(`[BrowserAgent] 📸 Capturing screenshot with visual labels...`);
      let state: BrowserResult;
      try {
        state = await handleBrowserAction({ action: 'screenshot' });
      } finally {
        await handleBrowserAction({
          action: 'evaluate',
          expression: `document.querySelectorAll('.claude-vision-label').forEach(e => e.remove());`,
          timeout: 1000,
        }).catch(() => undefined);
      }
      
      let elementsList = 'No interactive elements found.';
      let pageText = 'No text content available.';
      
      if (domData.content) {
        try {
          const parsedDOM = JSON.parse(domData.content);
          if (parsedDOM.interactive?.length > 0) elementsList = parsedDOM.interactive.join('\\n');
          if (parsedDOM.text) pageText = parsedDOM.text;
        } catch (e) {}
      }

      // --- PHASE 1: CAPTCHA DETECTION ---
      if (state.title.includes('Just a moment') || state.title.includes('CAPTCHA') || pageText.includes('unusual traffic') || pageText.includes('ยืนยันว่าคุณไม่ใช่หุ่นยนต์')) {
        console.warn(`[BrowserAgent] ⚠️ CAPTCHA DETECTED! Waiting for human intervention...`);
        // We will pause and give the user 30 seconds to solve it manually (assuming headed mode)
        await new Promise(resolve => setTimeout(resolve, 30000));
        console.log(`[BrowserAgent] 🔄 Resuming after CAPTCHA wait...`);
        continue; // Skip AI thinking for this step and re-capture state
      }

      // --- PHASE 2: ANTI-LOOP DETECTION ---
      let loopWarning = "";
      if (history.length >= 3) {
        const last3 = history.slice(-3);
        if (last3[0].action === last3[1].action && last3[1].action === last3[2].action) {
          loopWarning = `\\nCRITICAL WARNING: You are stuck in a loop! You have repeated the exact same action 3 times: "${last3[0].action}". YOU MUST TRY A DIFFERENT APPROACH, USE A DIFFERENT SELECTOR, OR NAVIGATE ELSEWHERE!`;
        }
      }

      // 2. Ask AI (Vision-based planning + DOM)
      console.log(`[BrowserAgent] 🧠 Thinking...`);
      const plan = await this.askAI(task.goal, state, elementsList, pageText, history, loopWarning);
      
      console.log(`[BrowserAgent] 🧠 Thoughts: ${plan.thought}`);
      
      if (plan.action === 'done') {
        if (plan.status === 'success') {
          console.log(`[BrowserAgent] ✅ SUCCESS: ${plan.message}`);
          return plan.message;
        } else {
          console.log(`[BrowserAgent] ❌ FAILED: ${plan.message}`);
          throw new Error(plan.message);
        }
      }

      // 3. Execute action
      const selector = this.normalizeSelector(plan.selector);
      const direction = plan.direction === 'up' ? 'up' : 'down';
      const x = typeof plan.x === 'number' ? plan.x : undefined;
      const y = typeof plan.y === 'number' ? plan.y : undefined;
      const action = this.normalizeAction(plan.action, Boolean(selector), typeof plan.text === 'string', x !== undefined && y !== undefined);
      const actionDesc = action + (selector ? ` on ${selector}` : '') + (x !== undefined && y !== undefined ? ` at (${x},${y})` : '') + (plan.url ? ` to ${plan.url}` : '');
      console.log(`[BrowserAgent] ⚡ Action: ${actionDesc}`);
      
      const result = await handleBrowserAction({
        action: action as any,
        selector,
        text: plan.text,
        url: plan.url,
        direction,
        amount: typeof plan.amount === 'number' ? plan.amount : undefined,
        x,
        y,
        timeout: action === 'wait' ? (typeof plan.amount === 'number' ? plan.amount : 1500) : undefined,
      });
      
      const resultString = result.error ? `Error: ${result.error}` : `Completed. URL=${result.url} Title=${result.title}${result.content ? ` Content=${result.content.substring(0, 300)}` : ''}`;
      
      // 4. Update History
      history.push({
        step: currentStep,
        thought: plan.thought,
        action: plan.action === 'done' ? 'done' : `${action} ${selector ? 'on ' + selector : ''} ${x !== undefined && y !== undefined ? `at (${x},${y})` : ''} ${plan.text ? 'with text ' + plan.text : ''} ${plan.url ? 'to ' + plan.url : ''}`.trim(),
        scratchpad: plan.scratchpad || '',
        result: resultString
      });
      lastResult = resultString;
    }

    const fs = await import('fs');
    fs.writeFileSync('scratch/agent_history_debug.json', JSON.stringify(history, null, 2));
    throw new Error("Max steps reached without achieving goal.");
  }

  private normalizeSelector(selector?: string): string | undefined {
    if (!selector) return undefined;
    const trimmed = selector.trim();
    const labelMatch = trimmed.match(/^\[?(\d+)\]?$/);
    if (labelMatch) return `[data-claude-id="${labelMatch[1]}"]`;
    return trimmed;
  }

  private normalizeAction(action: string, hasSelector: boolean, hasText: boolean, hasPoint: boolean): string {
    if (action === 'click' && hasPoint) return 'click_at';
    if ((action === 'type' || action === 'fill') && hasPoint && hasText) return 'type_at';
    if ((action === 'click_at' || action === 'type_at') && !hasPoint) return hasSelector ? (action === 'type_at' ? 'type' : 'click') : action;
    return action;
  }

  private async askAI(goal: string, state: BrowserResult, elementsList: string, pageText: string, history: any[], loopWarning: string): Promise<any> {
    const model = this.providerManager.getModelForProvider() || 'claude-3-5-sonnet-latest';
    
    const systemPrompt = `You are an autonomous web browser agent.
You have access to a browser and can perform actions to achieve a user's goal.

You will be provided with:
1. The user's goal.
2. The current state of the browser (URL, Title).
3. A screenshot of the current page.
4. A list of interactive elements (buttons, links, inputs) with their CSS selectors and text.
5. The raw text content of the page.
6. The history of actions taken so far.

CRITICAL INSTRUCTION: You MUST respond with a JSON object describing your next action. 
Do not output markdown code blocks. Output ONLY valid JSON.

Your JSON must match this structure:
{
  "thought": "Explain your reasoning step-by-step. What do you see? What do you need to do?",
  "action": "navigate" | "click" | "click_at" | "type" | "type_at" | "scroll" | "wait" | "screenshot" | "extract_data" | "open_new_tab" | "switch_tab" | "done",
  "selector": "CSS selector from the interactive elements list (required for click, type, and extract_data)",
  "x": 640,
  "y": 400,
  "text": "Text to type (required for type)",
  "url": "URL to navigate to (required for navigate and open_new_tab)",
  "direction": "up or down (required for scroll)",
  "amount": 800,
  "scratchpad": "Use this to take notes or remember prices/data across tabs. This memory will persist in your history.",
  "status": "success" | "failed" (required for done),
  "message": "Summary of result, JSON output for extracted data, or explanation of failure"
}

Tips:
- Use this loop: OBSERVE the screenshot and current URL/title, decide ONE small action, WAIT when the page is loading or animating, then OBSERVE again. Do not chain multiple intentions in one action.
- The interactive elements list provides numbered labels and exact CSS selectors. For click/type, use either the exact selector (e.g., [data-claude-id="42"]) or the visible label number (e.g., "42" or "[42]"). Do NOT guess generic tags like 'a' or 'button'.
- If a selector click may be unreliable, use click_at with x/y from the element center shown in the list or estimated from the screenshot. Coordinates are viewport pixels.
- For form fields, prefer type_at with x/y from the input center and text when visual targeting is clearer than selectors. It clicks the field, selects existing text, then types.
- For scroll, you may provide x/y to choose the scrollable area under that point. If omitted, the page center is used.
- If the target is not visible in the screenshot or not listed in INTERACTIVE ELEMENTS, use scroll with direction="down" and amount=800 instead of trying to click it.
- Use wait with amount=1500 after navigation, open_new_tab, heavy click, or if the screenshot looks partially loaded. Use wait instead of repeating the same click/scroll.
- If researching multiple sites, collect and write important facts into scratchpad BEFORE open_new_tab. After open_new_tab, you are already on the new tab; do not switch_tab unless you intentionally need the previous tab. Use switch_tab only one tab at a time, then observe.
- If an action returns an error, try a different targeting mode: selector -> click_at/type_at, or scroll at a different x/y area. Do not repeat the same failing action.
- If you have completed the goal, use "done" and summarize the findings in "message" (format as JSON if requested).
`;

    const userMessageContent: any[] = [
      { type: 'text', text: `
GOAL: ${goal}

CURRENT BROWSER STATE:
URL: ${state.url}
Title: ${state.title}

INTERACTIVE ELEMENTS ON PAGE:
${elementsList}

RAW PAGE TEXT:
${pageText}

PREVIOUS ACTIONS:
${history.length > 0 ? history.map((h, i) => `${i + 1}. [${h.action}] ${h.result}${h.scratchpad ? ' (Memory: ' + h.scratchpad + ')' : ''}`).join('\n') : 'None'}
${loopWarning}

Analyze the current state and provide the NEXT action in pure JSON format.
` }
    ];

    if (state.screenshot) {
      userMessageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: state.screenshot
        }
      });
    }

    console.log(`[BrowserAgent] 🤖 Asking AI with ${model}...`);
    const response = await sideQuery({
      querySource: 'browser_agent' as any,
      model,
      system: systemPrompt + "\nIMPORTANT: RESPONSE MUST BE A VALID JSON OBJECT.",
      messages: [{ role: 'user', content: userMessageContent }],
      max_tokens: 1000,
      temperature: 0
    });

    console.log(`[BrowserAgent] 🤖 AI Response received.`);

    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      // Extract JSON from potential markdown blocks
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.action) {
         throw new Error("Missing required field 'action' in AI response");
      }
      return parsed;
    } catch (e) {
      console.error("[BrowserAgent] Failed to parse AI response:", e);
      return { 
        status: 'failed', 
        message: `Failed to parse AI response as JSON. Raw response: ${response.content[0].type === 'text' ? response.content[0].text.substring(0, 100) : 'Non-text content'}` 
      };
    }
  }
}
