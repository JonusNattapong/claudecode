/**
 * Browser Tool — Full Stealth Handler with Extended Controls
 *
 * 20+ actions for precise web control:
 * - Smart targeting: getByRole, getByLabel, getByText
 * - Form: fill, select dropdown, check/uncheck, file upload
 * - Navigation: back, forward, reload
 * - iFrame support, dialog handling
 * - Content extraction: getText, getAttribute, getLinks, evaluate JS
 */

import { logForDebugging } from "../../utils/debug.js";
import type { BrowserActionInput, BrowserResult } from "./types.js";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";
import type { BrowserContext, Page } from "playwright";

// ---------------------------------------------------------------------------
// Workaround for Bun + Playwright on Windows (oven-sh/bun#15679)
// Bun's net.Socket.connect() when given an fd sets this.connecting = true
// but never emits 'connect', causing all writes to buffer and Playwright
// to time out after 180s. This monkey-patch forces the connect event
// when an fd is passed, which matches Node.js behaviour.
// Must run BEFORE playwright is imported (first dynamic import in getBrowser).
// ---------------------------------------------------------------------------
import net from "node:net";
const _originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args: any[]) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  const hasFd =
    options &&
    typeof options === "object" &&
    "fd" in options &&
    options.fd != null;
  const result = _originalSocketConnect.apply(this, args);
  if (hasFd && this.connecting) {
    this.connecting = false;
    process.nextTick(() => {
      if (!this.destroyed && !this.connected) {
        this.connected = true;
        this.emit("connect");
      }
    });
  }
  return result;
};
// ---------------------------------------------------------------------------

let browserContext: BrowserContext | null = null;
let pageInstance: Page | null = null;

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

// Performance: humanDelay is now optional, defaults to 0 for speed
function humanDelay(min = 0, max = 0) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function shouldSelfHealNavigation(): boolean {
  return process.env.BROWSER_TOOL_SELF_HEAL === "true";
}

async function getBrowser(input?: BrowserActionInput) {
  if (!browserContext) {
    try {
      mkdirSync(SESSION_DIR, { recursive: true });
    } catch {}
    const { chromium } = await import("playwright");
    logForDebugging(
      "BrowserTool: Launching persistent context at " + SESSION_DIR,
    );
    try {
      browserContext = await chromium.launchPersistentContext(SESSION_DIR, {
        headless: shouldRunHeadless(input),
        viewport: { width: 1280, height: 800 },
        timezoneId: "Asia/Bangkok",
        locale: "th-TH",
        args: [
          "--disable-blink-features=AutomationControlled",
          "--no-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
      logForDebugging("BrowserTool: Context launched successfully");
    } catch (error: any) {
      logForDebugging(
        "BrowserTool: Failed to launch context: " + error.message,
      );
      throw error;
    }
  }

  if (!pageInstance) {
    logForDebugging("BrowserTool: Getting first page");
    const pages = browserContext.pages();
    pageInstance = pages.length > 0 ? pages[0] : await browserContext.newPage();

    logForDebugging("BrowserTool: Page acquired, adding init scripts");
    await pageInstance.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["th-TH", "th", "en-US", "en"],
      });
      const g = globalThis as any;
      delete g.cdc_adoQpoasnfa76pfcZLmcfl_;
      if (!g.chrome) g.chrome = {};
      g.chrome.runtime = {};
    });

    await pageInstance.route("**/*", (route: any) => {
      const url = route.request().url();
      if (BLOCKED_DOMAINS.some((d) => url.includes(d))) return route.abort();
      return route.continue();
    });
  }

  return { context: browserContext, page: pageInstance };
}

// ── Virtual Cursor Helpers ─────────────────────────────────────────

const VIRTUAL_CURSOR_ID = "claude-virtual-cursor";
const STOP_BUTTON_ID = "claude-stop-button";

async function ensureVirtualControls(page: Page) {
  await page
    .evaluate(
      ({ cursorId, stopId }) => {
        // Remove the old viewport frame. It was useful as an automation
        // indicator, but it visually covered real pages and made screenshots
        // look like the website was not using the full browser viewport.
        const frameClass = "claude-neon-bar";
        document.querySelectorAll("." + frameClass).forEach((bar) => bar.remove());

        // 2. Ensure Cursor
        if (!document.getElementById(cursorId)) {
          const cursor = document.createElement("div");
          cursor.id = cursorId;
          cursor.style.position = "fixed";
          cursor.style.zIndex = "2147483647";
          cursor.style.pointerEvents = "none";
          cursor.style.width = "24px";
          cursor.style.height = "24px";
          cursor.style.transition = "all 0.2s ease-out";
          cursor.style.top = "0";
          cursor.style.left = "0";
          cursor.style.display = "none"; // Hide by default
          cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill="white" stroke="black"/>
      </svg>`;
          document.body.appendChild(cursor);
        }

        // 2. Ensure Stop Button
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
          btn.style.backdropFilter = "blur(8px)";
          btn.style.color = "white";
          btn.style.padding = "12px 24px";
          btn.style.borderRadius = "30px";
          btn.style.fontWeight = "bold";
          btn.style.cursor = "pointer";
          btn.style.boxShadow = "0 8px 32px rgba(217, 119, 87, 0.4)";
          btn.style.border = "2px solid rgba(255, 255, 255, 0.2)";
          btn.style.fontFamily = "system-ui, -apple-system, sans-serif";
          btn.style.fontSize = "16px";
          btn.style.letterSpacing = "1px";
          btn.style.transition = "all 0.3s ease";
          btn.onclick = () => {
            (window as any).claudeStopped = true;
            btn.innerHTML = "⌛ STOPPING...";
            btn.style.backgroundColor = "#888";
          };
          document.body.appendChild(btn);
        }
      },
      {
        cursorId: VIRTUAL_CURSOR_ID,
        stopId: STOP_BUTTON_ID,
      },
    )
    .catch(() => {});
}

async function checkStopped(page: Page) {
  const stopped = await page
    .evaluate(() => (window as any).claudeStopped === true)
    .catch(() => false);
  if (stopped) {
    throw new Error("Action aborted by user via web STOP button");
  }
}

async function moveVirtualCursor(
  page: Page,
  x: number,
  y: number,
  mode: "pointer" | "scroll" | "text" = "pointer",
) {
  await ensureVirtualControls(page);
  await page
    .evaluate(
      ({ id, x, y, mode }) => {
        const cursor = document.getElementById(id);
        if (!cursor) return;
        cursor.style.transform = `translate(${x}px, ${y}px)`;
        cursor.style.display = "block"; // Show when moving
        cursor.style.opacity = "1";

        if (mode === "scroll") {
          cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="white" stroke="black"/>
        <path d="M12 5V19M12 5L8 9M12 5L16 9M12 19L8 15M12 19L16 15" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
        } else if (mode === "text") {
          cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4V20M8 4H16M8 20H16" stroke="black" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
        } else {
          cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill="white" stroke="black"/>
      </svg>`;
        }
      },
      { id: VIRTUAL_CURSOR_ID, x, y, mode },
    )
    .catch(() => {});
}

// ── Helper: take screenshot and return result ───────────────────
async function successResult(
  page: Page,
  opts?: { extra?: Partial<BrowserResult>; skipScreenshot?: boolean },
): Promise<BrowserResult> {
  const result: BrowserResult = {
    url: page.url(),
    title: await page.title(),
  };
  if (!opts?.skipScreenshot) {
    try {
      // Ensure visual controls are present BEFORE taking the screenshot
      await ensureVirtualControls(page);

      const screenshot = await page.screenshot({
        type: "jpeg",
        quality: 45,
        scale: "css", // Ensure it's not super-high DPI
        timeout: DEFAULT_SCREENSHOT_TIMEOUT_MS,
      });
      result.screenshot = screenshot.toString("base64");
    } catch (error: any) {
      logForDebugging(
        "BrowserTool: Screenshot failed or timed out: " + error.message,
      );
      // We don't throw here, because the action itself (click/navigate) might have succeeded
    }
  }
  if (opts?.extra) Object.assign(result, opts.extra);
  return result;
}

// ── Main Handler ────────────────────────────────────────────────
export async function handleBrowserAction(
  input: BrowserActionInput,
): Promise<BrowserResult> {
  let page: Page | undefined;
  let context: BrowserContext | undefined;
  const timeout = input.timeout || DEFAULT_ACTION_TIMEOUT_MS;

  try {
    logForDebugging(`BrowserTool: Handling action "${input.action}"`);
    ({ page, context } = await getBrowser(input));

    if (!page) {
      logForDebugging("BrowserTool: No page available!");
      throw new Error("Browser page could not be initialized");
    }

    // Check if the page is closed/crashed
    if (page.isClosed()) {
      logForDebugging("BrowserTool: Page is closed, creating new one");
      page = await context.newPage();
      pageInstance = page;
    }
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(input.timeout || DEFAULT_NAVIGATION_TIMEOUT_MS);

    switch (input.action) {
      // ═══════════════════════════════════════════════════════════
      // NAVIGATION
      // ═══════════════════════════════════════════════════════════
      case "navigate": {
        if (!input.url) throw new Error("URL required");
        logForDebugging(`BrowserTool: Navigating to ${input.url}`);
        
        try {
          const response = await page.goto(input.url, {
            waitUntil: "domcontentloaded",
            timeout: input.timeout || DEFAULT_NAVIGATION_TIMEOUT_MS,
          });
          
          // If the response is an error (4xx/5xx) or null (DNS error, etc.)
          if (!response || !response.ok()) {
            throw new Error(`Failed to load ${input.url} (Status: ${response?.status() || 'Unknown'})`);
          }
          
          return successResult(page, { skipScreenshot: true });
          
        } catch (error: any) {
          if (!shouldSelfHealNavigation()) {
            throw error;
          }

          logForDebugging(`BrowserTool: Navigation failed: ${error.message}. Attempting Self-Healing...`);
          
          // --- SELF-HEALING LOGIC ---
          const domain = new URL(input.url).hostname || input.url;
          const searchQuery = `official website of ${domain} working link`;
          
          logForDebugging(`BrowserTool: Searching Google for a working link: "${searchQuery}"`);
          
          // 1. Go to Google
          await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, { waitUntil: "domcontentloaded", timeout: input.timeout || DEFAULT_NAVIGATION_TIMEOUT_MS });
          
          // 2. Extract the first official-looking link (skipping ads)
          const healedUrl = await page.evaluate(() => {
            const results = document.querySelectorAll('.g a[href^="http"]');
            for (const link of Array.from(results)) {
              const url = (link as HTMLAnchorElement).href;
              // Skip common junk/social media unless it's the target
              if (!url.includes('google.com') && !url.includes('youtube.com')) return url;
            }
            return null;
          });
          
          if (healedUrl && healedUrl !== input.url) {
            logForDebugging(`BrowserTool: Found potential working URL: ${healedUrl}. Attempting recovery...`);
            await page.goto(healedUrl, { waitUntil: "domcontentloaded", timeout: input.timeout || DEFAULT_NAVIGATION_TIMEOUT_MS });
            return successResult(page, { skipScreenshot: true, extra: { content: `Healed: Original URL was broken, recovered via Google search to ${healedUrl}` } });
          }
          
          // If healing failed, throw the original error
          throw error;
        }
      }

      case "go_back": {
        await page.goBack({ waitUntil: "domcontentloaded" });
        return successResult(page, { skipScreenshot: true });
      }

      case "go_forward": {
        await page.goForward({ waitUntil: "domcontentloaded" });
        return successResult(page, { skipScreenshot: true });
      }

      case "reload": {
        await page.reload({ waitUntil: "domcontentloaded" });
        return successResult(page, { skipScreenshot: true });
      }

      // ═══════════════════════════════════════════════════════════
      // CLICKING — 3 strategies
      // ═══════════════════════════════════════════════════════════
      case "click": {
        if (!input.selector) throw new Error("Selector required");
        
        let selector = input.selector;
        // Check if selector is a vision label like "[16]" or "16"
        const labelMatch = selector.match(/^\[?(\d+)\]?$/);
        if (labelMatch) {
          selector = `[data-vision-id="${labelMatch[1]}"]`;
        }

        await page.click(selector, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "click_text": {
        // Click by visible text content — most human-like
        if (!input.text) throw new Error("text required for click_text");
        await page.getByText(input.text, { exact: false }).first().click({ timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "click_role": {
        // Click by ARIA role — most reliable for buttons/links
        if (!input.role) throw new Error("role required for click_role");
        const opts: any = {};
        if (input.name) opts.name = input.name;
        await page.getByRole(input.role as any, opts).first().click({ timeout });
        return successResult(page, { skipScreenshot: true });
      }

      // ═══════════════════════════════════════════════════════════
      // TYPING & FORM FILLING
      // ═══════════════════════════════════════════════════════════
      case "type": {
        // Type character-by-character with jitter (human-like)
        if (!input.selector || !input.text)
          throw new Error("selector + text required");
        await page.waitForSelector(input.selector, {
          state: "visible",
          timeout,
        });

        await page.click(input.selector, { timeout });

        for (const char of input.text) {
          await checkStopped(page);
          await page.keyboard.type(char);
        }
        return successResult(page, { skipScreenshot: true });
      }

      case "fill": {
        if (!input.selector || !input.text)
          throw new Error("selector + text required");
        await page.waitForSelector(input.selector, {
          state: "visible",
          timeout,
        });
        await page.fill(input.selector, input.text, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "fill_label": {
        if (!input.label || !input.text)
          throw new Error("label + text required");
        await page.getByLabel(input.label).first().fill(input.text, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "clear": {
        if (!input.selector) throw new Error("selector required");
        await page.fill(input.selector, "", { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "press": {
        if (!input.key) throw new Error("key required");
        if (input.selector) {
          await page.waitForSelector(input.selector, {
            state: "visible",
            timeout,
          });
          await page.focus(input.selector, { timeout });
        }
        await page.keyboard.press(input.key);
        return successResult(page, { skipScreenshot: true });
      }

      // ═══════════════════════════════════════════════════════════
      // FORM CONTROLS
      // ═══════════════════════════════════════════════════════════
      case "select": {
        if (!input.selector || !input.value)
          throw new Error("selector + value required");
        await page.selectOption(input.selector, input.value, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "check": {
        if (!input.selector) throw new Error("selector required");
        await page.check(input.selector, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "uncheck": {
        if (!input.selector) throw new Error("selector required");
        await page.uncheck(input.selector, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "upload": {
        if (!input.selector || !input.filePath)
          throw new Error("selector + filePath required");
        await page.setInputFiles(input.selector, input.filePath, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      // ═══════════════════════════════════════════════════════════
      // SCROLL, HOVER, FOCUS
      // ═══════════════════════════════════════════════════════════
      case "scroll": {
        const amount = input.amount || 500;
        const delta = input.direction === "up" ? -amount : amount;

        // Multi-strategy scroll: Mouse wheel + JS scroll fallback
        try {
          await checkStopped(page);
          await page.mouse.wheel(0, delta);
        } catch (e) {
          if (e.message?.includes("aborted")) throw e;
          // Fallback to JS scroll if mouse wheel fails
          await page.evaluate((d) => window.scrollBy(0, d), delta);
        }
        return successResult(page, { skipScreenshot: true });
      }

      case "hover": {
        if (!input.selector) throw new Error("selector required");
        await page.hover(input.selector, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "focus": {
        if (!input.selector) throw new Error("selector required");
        await page.focus(input.selector, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      // ═══════════════════════════════════════════════════════════
      // WAITING
      // ═══════════════════════════════════════════════════════════
      case "wait_for": {
        if (!input.selector) throw new Error("selector required");
        await page.waitForSelector(input.selector, {
          state: "visible",
          timeout,
        });
        return successResult(page, { skipScreenshot: true });
      }

      case "wait_for_url": {
        if (!input.url) throw new Error("url pattern required");
        await page.waitForURL(input.url, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      // ═══════════════════════════════════════════════════════════
      // IFRAME & DIALOG
      // ═══════════════════════════════════════════════════════════
      case "frame_click": {
        if (!input.frameSelector || !input.selector)
          throw new Error("frameSelector + selector required");
        const frame = page.frameLocator(input.frameSelector);
        await frame.locator(input.selector).first().click({ timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "frame_fill": {
        if (!input.frameSelector || !input.selector || !input.text)
          throw new Error("frameSelector + selector + text required");
        const frame2 = page.frameLocator(input.frameSelector);
        await frame2.locator(input.selector).first().fill(input.text, { timeout });
        return successResult(page, { skipScreenshot: true });
      }

      case "handle_dialog": {
        const action = input.dialogAction || "accept";
        // Use on+self-remove instead of once so it catches dialogs that are
        // already open at the time this handler is registered.
        const onDialog = async (dialog: any) => {
          page.removeListener("dialog", onDialog);
          if (action === "accept") {
            await dialog.accept(input.dialogText || "");
          } else {
            await dialog.dismiss();
          }
        };
        page.on("dialog", onDialog);
        return {
          url: page.url(),
          title: await page.title(),
          content: `Dialog handler set: ${action}`,
        };
      }

      // ═══════════════════════════════════════════════════════════
      // CONTENT EXTRACTION
      // ═══════════════════════════════════════════════════════════
      case "screenshot":
        return successResult(page);

      case "extract":
        return {
          url: page.url(),
          title: await page.title(),
          content: await page.content(),
        };

      case "status":
        return { url: page.url(), title: await page.title() };

      case "get_text": {
        if (!input.selector) throw new Error("selector required");
        const locator = page.locator(input.selector);
        await locator.first().waitFor({ state: "attached", timeout });
        const text = (await locator.allInnerTexts()).slice(0, 20).join("\n\n");
        return { url: page.url(), title: await page.title(), content: text };
      }

      case "get_attribute": {
        if (!input.selector || !input.attribute)
          throw new Error("selector + attribute required");
        const val = await page.getAttribute(input.selector, input.attribute, { timeout });
        return {
          url: page.url(),
          title: await page.title(),
          content: val || "",
        };
      }

      case "get_value": {
        if (!input.selector) throw new Error("selector required");
        const v = await page.inputValue(input.selector, { timeout });
        return { url: page.url(), title: await page.title(), content: v };
      }

      case "get_links": {
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]"))
            .filter(a => {
              const rect = a.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0; // Only visible links
            })
            .slice(0, 25) // Reduced from 50 to 25
            .map((a) => ({
              text: (a as HTMLElement).innerText.trim().slice(0, 50), // Shorter text
              href: (a as HTMLAnchorElement).href,
            }));
        });
        return successResult(page, {
          skipScreenshot: true,
          extra: { content: JSON.stringify(links, null, 2) },
        });
      }

      case "get_inputs": {
        const inputs = await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll("input, textarea, select, button"),
          )
            .filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0; // Only visible inputs
            })
            .slice(0, 20) // Reduced from 50 to 20
            .map((el) => {
              const element = el as any;
              return {
                tag: element.tagName.toLowerCase(),
                type: element.type || "",
                name: element.name || "",
                id: element.id || "",
                value: element.value || "",
                placeholder: element.placeholder || "",
                label: element.labels?.[0]?.innerText?.trim() || "",
              };
            });
        });
        return successResult(page, {
          skipScreenshot: true,
          extra: { content: JSON.stringify(inputs, null, 2) },
        });
      }

      case "evaluate": {
        if (!input.expression) throw new Error("expression required");
        const result = await page.evaluate(input.expression);
        return {
          url: page.url(),
          title: await page.title(),
          content: JSON.stringify(result),
        };
      }

      case "close": {
        try {
          await context.storageState({ path: join(SESSION_DIR, "state.json") });
        } catch {}
        await browserContext?.close();
        browserContext = null;
        pageInstance = null;
        return { url: "", title: "Closed (session saved)" };
      }

      case "search": {
        if (!input.query) throw new Error("query required for search");
        const engine = input.engine || "google";
        const query = input.query;

        const searchUrls: Record<string, (q: string) => string> = {
          google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en`,
          bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
          duckduckgo: (q) => `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`,
          twitter: (q) => `https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query`,
          reddit: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
          github: (q) => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`,
          youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
          wikipedia: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
          amazon: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
          stackoverflow: (q) => `https://stackoverflow.com/search?q=${encodeURIComponent(q)}`,
        };

        let searchUrl: string;

        // 1. Check if query is already a URL
        if (query.startsWith('http://') || query.startsWith('https://')) {
          searchUrl = query;
        } 
        // 2. Check if engine is a custom template (e.g., "https://example.com?q={q}")
        else if (engine.includes('{q}')) {
          searchUrl = engine.replace('{q}', encodeURIComponent(query));
        }
        // 3. Use predefined engine or fallback to google
        else {
          const urlBuilder = searchUrls[engine.toLowerCase()] || searchUrls.google;
          searchUrl = urlBuilder(query);
        }

        logForDebugging(`BrowserTool: Searching ${engine} for "${query}"`);
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: input.timeout || DEFAULT_NAVIGATION_TIMEOUT_MS,
        });

        // Extract results using evaluate with multi-strategy fallback selectors.
        // Each engine tries its known selectors first, falls back to generic link+h3 extraction.
        const results = await page.evaluate((engineKey: string) => {
          interface Result {
            title: string;
            link: string;
            snippet: string;
          }
          const items: Result[] = [];

          // ── Multi-strategy extraction by engine ──
          const strategies: Record<string, Array<() => Result[]>> = {
            google: [
              // Strategy 1: Google layout
              () => {
                return Array.from(document.querySelectorAll(".g, .tF2Cxc"))
                  .map((c) => {
                    const link = c.querySelector(
                      'a[href^="http"]',
                    ) as HTMLAnchorElement;
                    const heading = c.querySelector("h3");
                    if (link && heading) {
                      return {
                        title: heading.innerText.trim(),
                        link: link.href,
                        snippet:
                          c
                            .querySelector(
                              '.VwiC3b, span.aCOpRe, div[data-sncf], div[role="heading"] + div',
                            )
                            ?.textContent?.trim() || "",
                      };
                    }
                    return null;
                  })
                  .filter((r) => r !== null) as Result[];
              },
            ],
            bing: [
              () => {
                return Array.from(document.querySelectorAll(".b_algo"))
                  .map((el) => {
                    const link = el.querySelector(
                      'a[href^="http"]',
                    ) as HTMLAnchorElement;
                    const heading = el.querySelector("h2");
                    if (link && heading) {
                      return {
                        title: heading.innerText.trim(),
                        link: link.href,
                        snippet:
                          el
                            .querySelector(".b_caption p, .b_algo p")
                            ?.textContent?.trim() || "",
                      };
                    }
                    return null;
                  })
                  .filter((r) => r !== null) as Result[];
              },
            ],
            duckduckgo: [
              // Lite version — simple table rows
              () => {
                const out: Result[] = [];
                const rows = Array.from(document.querySelectorAll("table tr"));
                for (const row of rows) {
                  const link = row.querySelector(
                    'a[rel="nofollow"]',
                  ) as HTMLAnchorElement;
                  if (link && link.href && link.innerText.trim()) {
                    const snippetTd = row.querySelectorAll("td");
                    const snippet =
                      snippetTd.length >= 3
                        ? snippetTd[snippetTd.length - 1]?.innerText?.trim()
                        : "";
                    out.push({
                      title: link.innerText.trim(),
                      link: link.href,
                      snippet: snippet || "",
                    });
                  }
                }
                return out;
              },
              // Fallback: regular DDG
              () => {
                return Array.from(document.querySelectorAll("article"))
                  .map((art) => {
                    const link =
                      art.querySelector('a[data-testid="result-title-a"]') ||
                      art.querySelector('a[href^="http"]');
                    const heading = art.querySelector("h2");
                    if (link && heading) {
                      return {
                        title: heading.innerText.trim(),
                        link: (link as HTMLAnchorElement).href,
                        snippet:
                          art
                            .querySelector('div[data-testid="result-snippet"]')
                            ?.textContent?.trim() || "",
                      };
                    }
                    return null;
                  })
                  .filter((r) => r !== null) as Result[];
              },
            ],
            twitter: [
              () => {
                return Array.from(
                  document.querySelectorAll('div[data-testid="cellInnerDiv"]'),
                )
                  .map((t) => {
                    const link = t.querySelector(
                      'a[href*="/status/"]',
                    ) as HTMLAnchorElement;
                    const text = t.querySelector(
                      'div[data-testid="tweetText"]',
                    ) as HTMLElement;
                    if (link && text) {
                      return {
                        title: text.innerText.substring(0, 80),
                        link: link.href,
                        snippet: text.innerText,
                      };
                    }
                    return null;
                  })
                  .filter((r) => r !== null) as Result[];
              },
            ],
            reddit: [
              () => {
                const out: Result[] = [];
                const posts = Array.from(
                  document.querySelectorAll(
                    'faceplate-tracker[source="search_results"]',
                  ),
                );
                for (const p of posts) {
                  const link =
                    p.querySelector('a[slot="full-post-link"]') ||
                    p.querySelector('a[slot="title"]') ||
                    p.querySelector('a[href^="http"]');
                  const title =
                    p.querySelector('a[slot="title"]') || p.querySelector("h3");
                  if (link && (title as HTMLElement)) {
                    out.push({
                      title: (title as HTMLElement).innerText.trim(),
                      link: (link as HTMLAnchorElement).href,
                      snippet:
                        p
                          .querySelector('div[slot="text-body"]')
                          ?.textContent?.trim() || "",
                    });
                  }
                }
                return out;
              },
            ],
            github: [
              () => {
                const out: Result[] = [];
                const titles = Array.from(
                  document.querySelectorAll("div.search-title"),
                );
                for (const t of titles) {
                  const link = t.querySelector("a") as HTMLAnchorElement;
                  if (link) {
                    out.push({
                      title: (t as HTMLElement).innerText.trim(),
                      link: link.href,
                      snippet: "",
                    });
                  }
                }
                return out;
              },
            ],
          };

          // ── Run engine-specific strategies ──
          const engineStrategies =
            strategies[engineKey] || strategies.google || [];
          for (const strategy of engineStrategies) {
            const stratResults = strategy();
            if (stratResults.length > 0) {
              items.push(...stratResults);
              break; // Stop at first successful strategy
            }
          }

          // ── Generic fallback: find any link+h3 pairs ──
          if (items.length === 0) {
            const seen = new Set<string>();
            const h3s = Array.from(document.querySelectorAll("h3"));
            for (const h3 of h3s) {
              const link = h3.closest("a") as HTMLAnchorElement;
              if (
                link &&
                link.href &&
                link.href.startsWith("http") &&
                !seen.has(link.href)
              ) {
                const parent = link.closest("div");
                seen.add(link.href);
                items.push({
                  title: h3.innerText.trim(),
                  link: link.href,
                  snippet:
                    parent
                      ?.querySelector(
                        'p, span, div[class*="snippet"], div[class*="desc"]',
                      )
                      ?.textContent?.trim() || "",
                });
              }
            }
          }

          return items.slice(0, 10).filter((r) => r.title && r.link);
        }, engine);

        logForDebugging(`BrowserTool: Search found ${results.length} results`);
        return successResult(page, {
          skipScreenshot: true,
          extra: { content: JSON.stringify(results, null, 2) },
        });
      }

      case "vision_map": {
        logForDebugging("BrowserTool: Generating Vision Map (Set-of-Mark)...");
        
        // 1. Inject labels into the page
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.id = 'claude-vision-styles';
          style.innerHTML = `
            .claude-vision-label {
              position: absolute;
              background: rgba(217, 119, 87, 0.9); /* Claude Amber */
              color: white;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              z-index: 2147483647;
              pointer-events: none;
              border: 1px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              font-family: sans-serif;
            }
            .claude-vision-highlight {
              outline: 2px dashed #d97757 !important;
              outline-offset: 2px !important;
            }
          `;
          document.head.appendChild(style);

          const interactives = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick]'));
          let count = 1;
          interactives.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0) {
              // Add highlight
              el.classList.add('claude-vision-highlight');
              el.setAttribute('data-vision-id', count.toString());
              
              // Add label
              const label = document.createElement('div');
              label.className = 'claude-vision-label';
              label.innerText = `[${count++}]`;
              label.style.top = `${window.scrollY + rect.top}px`;
              label.style.left = `${window.scrollX + rect.left}px`;
              document.body.appendChild(label);
            }
          });
        });

        // 2. Take the annotated screenshot
        const result = await successResult(page);

        // 3. Cleanup labels
        await page.evaluate(() => {
          document.querySelectorAll('.claude-vision-label').forEach(l => l.remove());
          document.querySelectorAll('.claude-vision-highlight').forEach(el => el.classList.remove('claude-vision-highlight'));
          document.getElementById('claude-vision-styles')?.remove();
        });

        return { ...result, content: "Vision Map generated. Use the labels [n] to target elements visually." };
      }

      case "request_help": {
        const message = input.text || "Help me !";
        logForDebugging(`BrowserTool: Requesting human help: ${message}`);

        await page.evaluate(
          ({ msg }) => {
            try {
              console.log("Claude Help: Injecting overlay...");
              // 1. Trigger Alarm (No shaking)
              document
                .querySelectorAll(".claude-neon-bar")
                .forEach((b) => b.classList.add("alarm"));

              // 2. Inject Help Overlay
              const overlay = document.createElement("div");
              overlay.id = "claude-help-overlay";
              overlay.style.position = "fixed";
              overlay.style.top = "50%";
              overlay.style.left = "50%";
              overlay.style.transform = "translate(-50%, -50%)";
              overlay.style.zIndex = "2147483647";
              overlay.style.backgroundColor = "rgba(0,0,0,0.95)";
              overlay.style.color = "white";
              overlay.style.padding = "40px";
              overlay.style.borderRadius = "20px";
              overlay.style.textAlign = "center";
              overlay.style.boxShadow = "0 0 100px rgba(255,0,0,0.8)";
              overlay.style.border = "4px solid #ff0000";
              overlay.style.fontFamily = "system-ui, sans-serif";
              overlay.style.minWidth = "400px";

              overlay.innerHTML = `
              <h1 style="margin:0 0 20px 0; color:#ff4444; font-size:32px;">🤝 ขอความช่วยเหลือ!</h1>
              <p style="font-size:20px; margin-bottom:30px; line-height:1.5;">${msg}</p>
              <button id="claude-resolved-btn" style="
                background:#d97757; color:white; border:none; 
                padding:15px 40px; border-radius:30px; font-size:18px; 
                font-weight:bold; cursor:pointer; box-shadow: 0 4px 15px rgba(217,119,87,0.4)
              ">Done! (RESOLVED)</button>
            `;
              document.body.appendChild(overlay);

              document.getElementById("claude-resolved-btn")!.onclick = () => {
                console.log("Claude Help: Resolved by user!");
                const el = document.getElementById("claude-help-overlay");
                if (el) el.remove();
                document
                  .querySelectorAll(".claude-neon-bar")
                  .forEach((b) => b.classList.remove("alarm"));
              };
              console.log("Claude Help: Overlay injected successfully!");
            } catch (e) {
              console.error("Claude Help Error:", e);
            }
          },
          { msg: message },
        );

        // Wait a bit for the DOM to settle
        await new Promise((r) => setTimeout(r, 2000));

        // Block the agent until the user clicks RESOLVED
        console.log("🛑 Agent is waiting for your help...");

        // Take a screenshot of the help screen so the user knows what's happening if headless
        await successResult(page);

        let helpActive = true;
        while (helpActive) {
          try {
            // Check if the help overlay STILL exists in the DOM
            const overlayExists = await page.evaluate(() => {
              return !!document.getElementById("claude-help-overlay");
            });
            if (!overlayExists) {
              helpActive = false;
              break;
            }
          } catch (e) {
            break;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }

        return successResult(page, {
          extra: { content: "Human helped successfully!" },
        });
      }

      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  } catch (error: any) {
    return { url: page?.url?.() || "", title: "", error: error.message };
  }
}

function shouldRunHeadless(input?: BrowserActionInput): boolean {
  if (input?.headless !== undefined) return input.headless;
  const value =
    process.env.BROWSER_TOOL_HEADLESS ?? process.env.PLAYWRIGHT_HEADLESS;
  if (value === undefined) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
