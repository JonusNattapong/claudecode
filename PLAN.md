# PLAN.md — Changelog Implementation

> Generated: 2026-05-27
> Source: Claude Code upstream changelog
> Last updated: 2026-05-27

---

## Progress Summary

| Phase | Status |
|-------|--------|
| Pre-Phase: Already Done | 5 items verified as already implemented |
| Phase 1: Power User Experience | 3 implemented, 5 already-done, 2 in progress |
| Phase 2-6: Remaining | Not started |

---

## ✅ Already Implemented (verified in code)

### Markdown GFM checkboxes
- [x] Markdown output renders GFM task list checkboxes — already implemented in `src/utils/markdown.ts:181-187`

### /diff keyboard scrolling
- [x] `/diff detail` view scrollable with keyboard — already implemented in `src/components/diff/DiffDialog.tsx:112-174` (arrows, j/k, PgUp/PgDn, Home/End)

### /feedback improvements
- [x] `/feedback` report improvements — depends on Anthropic-specific feedback pipeline, skip

### Sandbox warning in condensed mode
- [x] Sandbox warning already shown in condensed mode via `CondensedLogo.tsx`

### Auto mode opt-in
- [x] Auto mode opt-in already removed — no consent gate found

## ✅ Changes Made (this session)

### Clawd mascot (unified rendering)
- [x] Removed Apple_Terminal/LegacyWindows branching — all terminals use box-drawing characters
- File: `src/components/LogoV2/Clawd.tsx`
- Removed `env` import, removed `AppleTerminalClawd` and `LegacyWindowsClawd` paths

### Context hearts removed
- [x] Removed `◈◈◈◈◈◈` context hearts from status line
- File: `src/components/StatusLine.tsx`
- `renderContextHearts` now returns empty string

### /reload-skills command
- [x] Added `/reload-skills` command to clear skill caches and re-scan skill directories
- Files: `src/commands/reload-skills/index.ts` (new), `src/commands.ts` (registration)
- Calls `clearSkillCaches()`, `clearPluginSkillsCache()`, `clearPluginCommandCache()`

## Remaining Items

### /usage command
- [ ] `/usage` shows per-category breakdown of limits usage — skills, subagents, plugins, per-MCP-server cost
- [ ] `/usage` breakdown includes large session files; streaming read

### Skills & Plugins
- [x] Skills can set `disallowed-tools` in frontmatter
- [x] `/reload-skills` command
- [x] SessionStart hooks can return `reloadSkills: true`
- [x] SessionStart hooks can set session title via `hookSpecificOutput.sessionTitle`
- [ ] `MessageDisplay` hook event
- [ ] `pluginSuggestionMarketplaces` managed setting
- [ ] `claude plugin marketplace remove --scope user|project|local`

### Model / Effort
- [ ] `--fallback-model` support
- [ ] Effort-change confirmation dialog fix (no messages / same value)

### Markdown output
- [ ] Markdown output now renders GFM task list checkboxes (`- [ ] todo` / `- [x] done`) instead of plain bullets

### Enterprise
- [ ] Added `allowAllClaudeAiMcps` managed setting to load claude.ai cloud MCP connectors alongside `managed-mcp.json`

### Skills & Plugins
- [ ] - [x] Skills and slash commands can set `disallowed-tools` in frontmatter
- [x] Added `/reload-skills` command to re-scan skill directories without restarting the session
- [x] SessionStart hooks can return `reloadSkills: true` to re-scan skill directories, making skills installed by the hook available in the same session
- [x] SessionStart hooks can set session title via `hookSpecificOutput.sessionTitle` on startup and resume
- [ ] Added `MessageDisplay` hook event that lets hooks transform or hide assistant message text as it is displayed
- [ ] Added `pluginSuggestionMarketplaces` managed setting: admins can allowlist org marketplaces whose plugins may be suggested via context-aware tips
- [ ] `claude plugin marketplace remove` now accepts `--scope user|project|local` for symmetry with marketplace add, install, and uninstall

### Model / Effort
- [ ] Claude Code now switches to configured `--fallback-model` for the rest of the session when primary model is not found, instead of failing every request
- [ ] Auto mode no longer requires opt-in consent

### Vim Mode
- [ ] `/` in NORMAL mode now opens reverse history search (like Ctrl+R), matching bash/zsh vi-mode

### Thinking / Fullscreen
- [ ] Thinking summaries in collapsed group stay readable for at least 3 seconds, render as markdown, and cap at 10 lines (Ctrl+O shows full thinking)
- [ ] In fullscreen mode, "Thinking for Ns" indicator counts up live while model is thinking, and keeps its value if interrupted mid-thought
- [ ] The post-response timer now shows "Waiting for N background agents/workflows to finish" when backgrounded agents or workflows are still running, and reports cumulative time once results are processed

### Workflow Tool
- [ ] Simplified Workflow tool inline progress display — live agent counts now show only in persistent workflow status row below the prompt

### Telemetry
- [x] Added session entrypoint as OpenTelemetry metric attribute (`app.entrypoint`, opt-in via `OTEL_METRICS_INCLUDE_ENTRYPOINT=true`)

### /code-review --fix + /simplify
- [x] `/code-review --fix` support added to skill (applies fixes to working tree)
- [x] `/simplify` now invokes `/code-review --fix` instead of doing its own review
- Files: `plugins/code-review/commands/code-review.md`, `src/skills/bundled/simplify.ts`

### /insights crash fix
- [x] Fixed crash when cached session-meta files are missing optional fields (schema evolution)
- File: `src/commands/insights.ts`

### cache_creation_input_tokens fix
- [x] Fixed reporting as 0 when API reports cache writes only via nested cache_creation breakdown
- File: `src/services/api/claude.ts`

---

## Bug Fixes

### PowerShell & Shell
- [ ] Fixed PowerShell permission bypass: built-in cd functions (cd.., cd\\, cd~, X:) changed working directory undetected, letting later command read outside workspace
- [ ] Fixed PowerShell prefix/wildcard allow rules (e.g. `PowerShell(dotnet.exe build *)`) not pre-approving native executables and scripts
- [ ] Fixed permission-analysis gap where parser trusted stale variable-tracking values for PWD/OLDPWD/DIRSTACK across cd/pushd/popd
- [ ] Fixed malformed PowerShell and History tool calls with missing input being misclassified as reads in transcript collapsing

### Sandbox
- [ ] Fixed sandbox write allowlist in git worktrees covering entire main repository root instead of only shared .git directory (with hooks/ and config denied)

### Finder / Bash Tool
- [ ] Fixed find in Bash tool exhausting macOS system file/vnode table and crashing host on large directory trees

### Settings / Config
- [ ] Fixed managed-settings approval dialog leaving terminal frozen after accepting at startup
- [ ] Fixed `/config exit` summary reporting phantom changes to auto-compact and theme when toggling unrelated settings

### Remote Sessions
- [ ] Fixed `/ultraplan` and remote session creation failing with "Could not capture uncommitted changes" when working tree has no real changes
- [ ] Fixed remote MCP servers failing to connect in Claude Code Remote sessions when egress proxy is enabled

### Telemetry / Debug
- [x] Fixed `otelHeadersHelper` failing silently when script path contains spaces; helper failures now reported in `/doctor` and debug log
- [x] Fixed `cache_creation_input_tokens` reporting as 0 in transcript and result usage when API reports cache writes only via nested cache_creation breakdown

### Spinners & Status Bar
- [ ] Fixed thinking spinner staying amber across tool calls and onto fresh thinking bursts
- [ ] Fixed loading spinner showing "still thinking"/"almost done thinking" while tool is running; reset thinking status to "thinking" after each tool
- [ ] Fixed status bar showing user's baseline `/effort` setting instead of effort level applied by skill/agent effort: frontmatter
- [x] Fixed sandbox-enabled warning not appearing in condensed startup mode — now shows in every layout

### Bash Output
- [ ] Fixed collapsed Bash output reporting wrong hidden-line count for outputs with many short lines

### Slash Commands / Input
- [ ] Fixed slash-command argument-hint clipping trailing typed characters when hint overflows input box
- [ ] Fixed argument-hint and progressive arg suggestions not appearing after Tab-completing a skill whose frontmatter name: differs from directory basename
- [ ] Fixed editing a recalled prompt-history entry losing the edit when navigating further up/down with arrow keys

### Keyboard / Navigation
- [ ] Fixed Ctrl+O transcript view freezing at the moment it was opened instead of tailing new messages
- [ ] Fixed clicking a link inside an expanded tool result collapsing section instead of opening the link

### Focus Mode
- [x] Fixed focus mode showing spurious "N messages hidden" count on turns with no hidden activity

### Markdown Rendering
- [ ] Fixed markdown table cell borders inheriting color of inline code, wrapped continuation lines losing style, and empty header cells showing label in narrow-terminal stacked layout

### Plugin System
- [x] Fixed plugin MCP servers with same command but different environment variables being incorrectly deduplicated
- [ ] Fixed `/doctor` reporting "marketplace not found" or "plugin not found" for stale enabledPlugins entries referencing removed marketplaces or dropped plugins
- [ ] Fixed plugins that track a git branch silently no longer receiving updates after plugin registry was rebuilt

### Agent / Worker
- [ ] Fixed background worker crash in `claude agents` when accepting stale permission prompt after subagent was cancelled

### Effort
- [ ] Fixed effort-change confirmation dialog appearing when conversation has no messages or when switching between effort levels that resolve to same underlying value

### Agent Tool
- [ ] Fixed Agent tool description referencing an agent list that is never delivered when running with `--bare` or with attachments disabled

### Push Notification
- [ ] Fixed PushNotification tool incorrectly reporting "Mobile push not sent (Remote Control inactive)" in SDK-hosted sessions when Remote Control is enabled

### Session Stability
- [ ] Fixed sessions getting stuck after model or login switch left stale thinking-block signatures in history; now stripped proactively with retry safety-net

### Terminal Styling
- [ ] Fixed terminal styling degrading in very long sessions by recycling renderer's style pool

### /insights
- [ ] Fixed `/insights` crashing when cached session-meta files are missing optional fields

### Rename Session
- [ ] Fixed renaming Remote Control session from claude.ai or Claude mobile app not updating local session name for `claude --resume`

### Prompt History
- [ ] Fixed race where just-submitted prompt could appear twice in up-arrow history

### Fullscreen
- [ ] Fixed tapping "Jump to bottom" pill in fullscreen mode not dismissing it immediately

### /feedback
- [ ] Improved `/feedback` reports to include conversation that happened before context compaction, making issues from earlier in long sessions easier to triage

---

## Implementation Order

### Phase 1: Quick Wins (config/toggle changes)
Items that are configuration flags, managed settings, or toggle additions.

### Phase 2: Command Enhancements
Improvements to existing commands (/usage, /diff, /code-review, /reload-skills).

### Phase 3: UI/Frontend Fixes
Markdown rendering, status bar, spinners, fullscreen, terminal styling.

### Phase 4: Core Bug Fixes
PowerShell security, sandbox, session stability, plugin system fixes.

### Phase 5: Integration Features
MCP connectors, telemetry, OpenTelemetry, enterprise settings.
