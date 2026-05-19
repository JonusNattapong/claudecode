/**
 * Browser Tool — Full Stealth Handler with Extended Controls
 */

import net from "node:net";
import { mkdirSync } from "fs";
import { join } from "path";
import { logForDebugging } from "../../utils/debug.js";
import type { BrowserActionInput, BrowserResult } from "./types.js";

// Monkey-patch to fix Bun + Playwright on Windows
const _originalSocketConnect = (net.Socket.prototype as any).connect;
(net.Socket.prototype as any).connect = function (...args: any[]) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  const hasFd =
    options &&
    typeof options === "object" &&
    "fd" in options &&
    options.fd != null;
  const result = _originalSocketConnect.apply(this, args);
  if (hasFd && (this as any).connecting) {
    (this as any).connecting = false;
    process.nextTick(() => {
      if (!this.destroyed && !(this as any).connected) {
        (this as any).connected = true;
        this.emit("connect");
      }
    });
  }
  return result;
};

let browserInstance: any = null;
let browserContext: any = null;
let pageInstance: any = null;

const SESSION_DIR = join(process.cwd(), "scratch");
const DEFAULT_ACTION_TIMEOUT_MS = 3_000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 10_000;
const DEFAULT_SCREENSHOT_TIMEOUT_MS = 2_500;

const BLOCKED_DOMAINS = [
  "datadome.co",
  "fingerprint.com",
  "fingerprintjs.com",
  "perimeterx.net",
  "px-cdn.net",
  "kasada.io",
];

function shouldSelfHealNavigation(): boolean {
  return process.env.BROWSER_TOOL_SELF_HEAL === "true";
}

async function getBrowser(input?: BrowserActionInput) {
  if (!browserContext) {
    const { chromium } = await import("playwright");
    browserInstance = await chromium.launch({
      headless: shouldRunHeadless(input),
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--start-maximized",
      ],
    });
    browserContext = await browserInstance.newContext({
      viewport: null,
      timezoneId: "Asia/Bangkok",
      locale: "th-TH",
    });
  }

  if (!pageInstance) {
    const pages = browserContext.pages();
    pageInstance = pages.length > 0 ? pages[0] : await browserContext.newPage();

    await pageInstance.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ['th-TH', 'th', 'en-US', 'en'] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] }); // Spoof plugins length
      const g = globalThis as any;
      if (!g.chrome) g.chrome = {};
      g.chrome.runtime = {};
      
      // Spoof WebGL vendor to bypass advanced bot detection
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.apply(this, [parameter]);
      };
    });

    await pageInstance.route("**/*", (route: any) => {
      const url = route.request().url();
      if (BLOCKED_DOMAINS.some((d) => url.includes(d))) return route.abort();
      return route.continue();
    });

    // Capture console logs
    (pageInstance as any)._browserLogs = [];
    pageInstance.on("console", (msg: any) => {
      (pageInstance as any)._browserLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    pageInstance.on("pageerror", (err: any) => {
      (pageInstance as any)._browserLogs.push(`[ERROR] ${err.message}`);
    });
  }

  return { context: browserContext, page: pageInstance };
}

const VIRTUAL_CURSOR_ID = "claude-virtual-cursor";
const STOP_BUTTON_ID = "claude-stop-button";

async function ensureVirtualControls(page: any) {
  await page
    .evaluate(
      ({ cursorId, stopId }: any) => {
        if (!document.getElementById(cursorId)) {
          const cursor = document.createElement("div");
          cursor.id = cursorId;
          cursor.style.position = "fixed";
          cursor.style.zIndex = "2147483647";
          cursor.style.pointerEvents = "none";
          cursor.style.width = "24px";
          cursor.style.height = "24px";
          cursor.style.transition = "all 0.2s ease-out";
          cursor.style.display = "none";
          cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill="white" stroke="black"/></svg>`;
          document.body.appendChild(cursor);
        }
        if (!document.getElementById(stopId)) {
          const btn = document.createElement("div");
          btn.id = stopId;
          btn.innerHTML = "🛑 STOP AGENT";
          btn.style.position = "fixed";
          btn.style.bottom = "30px";
          btn.style.left = "50%";
          btn.style.transform = "translateX(-50%)";
          btn.style.zIndex = "2147483647";
          btn.style.backgroundColor = "rgba(255, 68, 68, 0.9)";
          btn.style.color = "white";
          btn.style.padding = "12px 24px";
          btn.style.borderRadius = "30px";
          btn.style.cursor = "pointer";
          btn.onclick = () => {
            (window as any).claudeStopped = true;
            btn.innerHTML = "⌛ STOPPING...";
          };
          document.body.appendChild(btn);
        }
      },
      { cursorId: VIRTUAL_CURSOR_ID, stopId: STOP_BUTTON_ID },
    )
    .catch(() => {});
}

async function checkStopped(page: any) {
  const stopped = await page
    .evaluate(() => (window as any).claudeStopped === true)
    .catch(() => false);
  if (stopped) throw new Error("Action aborted by user");
}

async function successResult(
  page: any,
  opts?: { extra?: Partial<BrowserResult>; skipScreenshot?: boolean },
): Promise<BrowserResult> {
  const result: BrowserResult = { url: page.url(), title: await page.title() };
  if (!opts?.skipScreenshot) {
    try {
      await ensureVirtualControls(page);
      const screenshot = await page.screenshot({
        type: "jpeg",
        quality: 45,
        scale: "css",
        timeout: DEFAULT_SCREENSHOT_TIMEOUT_MS,
      });
      result.screenshot = screenshot.toString("base64");
    } catch {}
  }
  if ((page as any)._browserLogs?.length > 0) {
    result.content =
      (result.content || "") +
      "\n\n--- BROWSER CONSOLE ---\n" +
      (page as any)._browserLogs.join("\n");
    (page as any)._browserLogs = [];
  }
  if (opts?.extra) Object.assign(result, opts.extra);
  return result;
}

export async function handleBrowserAction(
  input: BrowserActionInput,
): Promise<BrowserResult> {
  let { page, context } = await getBrowser(input);
  const timeout = input.timeout || DEFAULT_ACTION_TIMEOUT_MS;
  page.setDefaultTimeout(timeout);

  try {
    switch (input.action) {
      case "navigate":
        if (!input.url) throw new Error("URL required");
        await page.goto(input.url, { waitUntil: "networkidle", timeout: input.timeout || DEFAULT_NAVIGATION_TIMEOUT_MS });
        return successResult(page);
        
      case "search":
        if (!input.query) throw new Error("Query required for search");
        const engine = input.engine || 'google';
        if (engine === 'google') await page.goto(`https://www.google.com/search?q=${encodeURIComponent(input.query)}`);
        else if (engine === 'bing') await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(input.query)}`);
        else if (engine === 'duckduckgo') await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(input.query)}`);
        else if (engine === 'github') await page.goto(`https://github.com/search?q=${encodeURIComponent(input.query)}`);
        else await page.goto(`https://www.google.com/search?q=${encodeURIComponent(input.query)}`);
        return successResult(page);
        
      case "click":
        if (!input.selector) throw new Error("Selector required");
        await page.locator(input.selector).first().scrollIntoViewIfNeeded({ timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS }).catch(() => undefined);
        await page.click(input.selector, { timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS }).catch(async () => {
          await page.locator(input.selector).first().evaluate((el: HTMLElement) => el.click());
        });
        // Wait briefly for any potential network requests to settle after a click
        await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
        return successResult(page);

      case "click_at": {
        if (typeof input.x !== 'number' || typeof input.y !== 'number') throw new Error("x + y required");
        await page.mouse.click(input.x, input.y, { timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS }).catch(async () => {
          await page.evaluate(({ x, y }: { x: number; y: number }) => {
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            el?.click();
          }, { x: input.x!, y: input.y! });
        });
        await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
        return successResult(page);
      }
        
      case "click_text":
        if (!input.text) throw new Error("Text required");
        await page.getByText(input.text, { exact: false }).first().click({ timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS });
        await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
        return successResult(page);
        
      case "click_at":
        if (typeof input.x !== 'number' || typeof input.y !== 'number') throw new Error("x and y required for click_at");
        await page.mouse.click(input.x, input.y);
        await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
        return successResult(page);

      case "type_at":
        if (typeof input.x !== 'number' || typeof input.y !== 'number' || !input.text) throw new Error("x, y, and text required for type_at");
        await page.mouse.click(input.x, input.y, { clickCount: 3 }); // Select all existing text
        await page.keyboard.press('Backspace');
        await page.keyboard.type(input.text, { delay: 50 });
        return successResult(page);

      case "type":
        if (!input.selector || !input.text) throw new Error("Selector + text required");
        await page.locator(input.selector).first().scrollIntoViewIfNeeded({ timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS }).catch(() => undefined);
        await page.click(input.selector, { timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS }).catch(async () => {
          await page.locator(input.selector).first().focus();
        });
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => undefined);
        await page.keyboard.type(input.text, { delay: 50 });
        return successResult(page);

      case "type_at":
        if (typeof input.x !== 'number' || typeof input.y !== 'number' || !input.text) throw new Error("x + y + text required");
        await page.mouse.click(input.x, input.y, { timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS });
        await page.evaluate(({ x, y }: { x: number; y: number }) => {
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          el?.focus();
        }, { x: input.x, y: input.y }).catch(() => undefined);
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => undefined);
        await page.keyboard.type(input.text, { delay: 50 });
        return successResult(page);
        
      case "fill":
        if (!input.selector || !input.text) throw new Error("Selector + text required");
        await page.fill(input.selector, input.text);
        return successResult(page);
        
      case "fill_label":
        if (!input.label || !input.text) throw new Error("Label + text required");
        await page.getByLabel(input.label).fill(input.text);
        return successResult(page);
        
      case "press":
        if (!input.key) throw new Error("Key required (e.g., 'Enter')");
        if (input.selector) await page.press(input.selector, input.key);
        else await page.keyboard.press(input.key);
        return successResult(page);
        
      case "scroll": {
        const delta = input.direction === 'up' ? -(input.amount || 500) : (input.amount || 500);
        await page.evaluate(({ d, x, y }: { d: number; x?: number; y?: number }) => {
          const scrollElement = (el: HTMLElement | null) => {
            while (el && el !== document.body) {
              const style = window.getComputedStyle(el);
              const canScroll = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
              if (canScroll) {
                const before = el.scrollTop;
                el.scrollBy(0, d);
                return el.scrollTop !== before;
              }
              el = el.parentElement;
            }
            return false;
          };

          const targetX = typeof x === 'number' ? x : window.innerWidth / 2;
          const targetY = typeof y === 'number' ? y : window.innerHeight / 2;
          const center = document.elementFromPoint(targetX, targetY);
          if (scrollElement(center?.closest('*') as HTMLElement | null)) return;

          const scrollables = Array.from(document.querySelectorAll('*')).filter((node): node is HTMLElement => {
            const el = node as HTMLElement;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
          });
          scrollables.sort((a, b) => {
            const ar = a.getBoundingClientRect();
            const br = b.getBoundingClientRect();
            return (br.width * br.height) - (ar.width * ar.height);
          });
          if (scrollElement(scrollables[0] ?? null)) return;

          const before = window.scrollY;
          window.scrollBy(0, d);
          if (window.scrollY !== before) return;

          const root = document.scrollingElement as HTMLElement | null;
          if (root) {
            root.scrollBy(0, d);
          }
        }, { d: delta, x: input.x, y: input.y });
        return successResult(page);
      }
        
      case "extract":
        return { url: page.url(), title: await page.title(), content: await page.content() };
        
      case "extract_data":
      case "get_text":
        if (input.selector) {
           const text = await page.locator(input.selector).first().innerText();
           return { url: page.url(), title: await page.title(), content: text };
        }
        return { url: page.url(), title: await page.title(), content: await page.evaluate(() => document.body.innerText) };
        
      case "switch_tab":
        if (browserContext) {
          const pages = browserContext.pages();
          if (pages.length > 1) {
            const currentIndex = pages.indexOf(pageInstance);
            const nextIndex = (currentIndex + 1) % pages.length;
            pageInstance = pages[nextIndex];
            await pageInstance.bringToFront();
          }
        }
        return successResult(pageInstance);

      case "open_new_tab":
        if (browserContext) {
          pageInstance = await browserContext.newPage();
          if (input.url) {
            await pageInstance.goto(input.url, { waitUntil: "networkidle", timeout: input.timeout || DEFAULT_NAVIGATION_TIMEOUT_MS });
          }
        }
        return successResult(pageInstance);
        
      case "upload":
        if (!input.selector || !input.filePath) throw new Error("Selector + filePath required for upload");
        await page.locator(input.selector).setInputFiles(input.filePath);
        return successResult(pageInstance);
        
      case "drag_and_drop":
        if (!input.selector || !input.text) throw new Error("Source selector (selector) and target selector (text) required");
        await page.dragAndDrop(input.selector, input.text);
        return successResult(pageInstance);

      case "wait_for":
        if (!input.selector) throw new Error("Selector required");
        await page.waitForSelector(input.selector, { state: 'visible', timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS });
        return successResult(page);
        
      case "wait_for_url":
        if (!input.url) throw new Error("URL pattern required");
        await page.waitForURL(new RegExp(input.url, 'i'), { timeout: input.timeout || DEFAULT_ACTION_TIMEOUT_MS });
        return successResult(page);

      case "wait":
        await page.waitForTimeout(Math.min(input.timeout || 1500, 10000));
        await page.waitForLoadState('domcontentloaded', { timeout: 1000 }).catch(() => undefined);
        await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => undefined);
        return successResult(page);

      case "screenshot":
        return successResult(page);
        
      case "status":
        return successResult(page, { skipScreenshot: true });

      case "evaluate":
        if (!input.expression) throw new Error("Expression required");
        const res = await page.evaluate(input.expression);
        return {
          url: page.url(),
          title: await page.title(),
          content: JSON.stringify(res),
        };
        
      case "close":
        await page.evaluate(() => {
          document.querySelectorAll('.claude-vision-label').forEach((el) => el.remove());
        }).catch(() => undefined);
        await browserContext?.close();
        await browserInstance?.close();
        browserInstance = null; browserContext = null; pageInstance = null;
        return { url: "", title: "Closed" };
        
      default:
        // Try to gracefully handle unknown actions to not break the AI
        console.warn(`[BrowserTool] Unsupported action: ${input.action}, falling back to status`);
        return successResult(page);
    }
  } catch (error: any) {
    return { url: page.url(), title: "", error: error.message };
  }
}

function shouldRunHeadless(input?: BrowserActionInput): boolean {
  if (input?.headless !== undefined) return input.headless;
  return ["1", "true"].includes(
    (process.env.BROWSER_TOOL_HEADLESS || "").toLowerCase(),
  );
}
