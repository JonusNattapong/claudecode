# Troubleshooting

Common issues, debugging techniques, and solutions for Claude Code.

## Quick Diagnostic

Run the built-in diagnostic tool:

```
/doctor
```

Or from command line:

```bash
bun run src/main.tsx --doctor
```

This checks:
- API key validity
- Configuration syntax
- Plugin health
- MCP server connectivity
- Permission conflicts
- Disk space & file permissions

## Installation Issues

### "bun: command not found"

**Problem:** Bun runtime is not installed or not in PATH.

**Solution:**
```bash
# Install Bun (macOS/Linux)
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# Restart terminal or reload PATH
source ~/.bashrc  # or ~/.zshrc, etc.
```

Verify:
```bash
bun --version  # Should show 1.0+
```

---

### "Error: Cannot find module 'ink'"

**Problem:** Dependencies not installed.

**Solution:**
```bash
# Install dependencies
bun install

# Or with npm
npm install
```

Check `node_modules/` directory exists.

---

### Build fails with TypeScript errors

**Problem:** Type checking errors during build.

**Solution:**
```bash
# Check type errors without building
bun x tsc --noEmit

# Common fixes:
# 1. Missing type packages
bun add -d @types/some-package

# 2. Outdated tsconfig, run:
bun x tsc --init

# 3. Clear cache and rebuild
rm -rf node_modules/.cache
bun run build
```

---

### "EACCES: permission denied" on install

**Problem:** File permissions issue (Linux/macOS).

**Solution:**
```bash
# Fix ownership (replace user:group)
sudo chown -R $USER:$USER ~/.bun
sudo chown -R $USER:$USER node_modules

# Or use npm with sudo (not recommended, but works)
sudo npm install
```

Better: Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage Node versions per-user.

---

## Runtime Issues

### Claude doesn't respond / hangs

**Problem:** Assistant seems frozen, no output.

**Diagnosis:**
1. Check network connectivity: `ping api.anthropic.com`
2. Verify API key is set: `echo $ANTHROPIC_API_KEY`
3. Check for provider issues: `/status`

**Solutions:**

```bash
# 1. Restart session
/exit           # Then start new session
bun run src/main.tsx session

# 2. Clear cache
rm -rf ~/.claude/cache/

# 3. Reset provider
/provider reset

# 4. Debug mode
DEBUG=1 bun run src/main.tsx session

# 5. Check logs
tail -f ~/.claude/sessions/latest.txt
```

---

### API rate limit errors

**Problem:** "Rate limit exceeded" or "429 Too Many Requests".

**Solution:**
1. Wait for rate limit to reset (varies by provider)
2. Upgrade API plan (Anthropic/OpenAI)
3. Switch to alternative provider:
   ```
   /provider set openai gpt-4o
   ```
4. Add delay between requests (in auto mode)

---

### "Invalid API key" errors

**Problem:** Authentication fails.

**Solution:**
```bash
# 1. Verify key is set
echo $ANTHROPIC_API_KEY

# 2. Re-enter key
/provider key anthropic <your-key>

# 3. Check key format (should start with sk-ant-)
# Obtain new key from: https://console.anthropic.com/settings/keys

# 4. Clear stored credentials
rm ~/.claude/credentials.json
```

---

### Context window exceeded

**Problem:** "Context window full" or "Too many messages".

**Solution:**
```bash
# 1. Manually compact
/compact

# 2. Enable auto-compaction
/config autoCompact true

# 3. Increase context limit (if using models with larger windows)
/config maxContextTokens 400000

# 4. Start new session and use /resume to filter context
```

---

### Model not available

**Problem:** "Model not found" or "Model unavailable".

**Solution:**
```bash
# 1. List available models
/provider models anthropic

# 2. Use correct model name
/model claude-sonnet-4
/model claude-3-5-sonnet-20241022

# 3. Check model access (some models require specific account tier)
# Contact Anthropic support for model access
```

---

### Streaming stops mid-response

**Problem:** Response cuts off, incomplete output.

**Cause:** Network interruption or timeout.

**Fix:**
```bash
# Enable streaming fallback (usually automatic)
# If persistent, disable streaming:
export CLAUDE_CODE_DISABLE_STREAMING=1

# Or increase timeout:
export API_TIMEOUT_MS=300000  # 5 minutes
```

---

### File edit failures

**Problem:** Edit/Write tool fails to modify files.

**Common causes & fixes:**

**1. File is read-only**
```bash
# Check permissions
ls -la filename.ts

# Make writable
chmod +w filename.ts

# Or disable read-only protection in Claude:
/config allowEditsReadOnly true
```

**2. File locked by another process**
- Close editor that has file open
- Kill process holding lock:
  ```bash
  lsof | grep filename.ts
  kill -9 <PID>
  ```

**3. Path outside allowed directories**
```bash
# Add directory to allowed paths
/add-dir /path/to/project --remember
# Or edit settings.json manually
```

**4. Disk full**
```bash
df -h  # Check free space
```

**5. Git conflict markers present**
Claude won't edit conflicted files. Resolve conflicts manually first.

---

### Bash tool failures

**Problem:** Bash commands fail or time out.

**Diagnostic steps:**

```bash
# 1. Run Bash with explicit timeout
# In Claude, use:
/Bash --timeout 60000 <command>

# 2. Check sandbox status
# If sandbox enabled, some commands restricted. Disable:
/config bash.sandbox false

# 3. Increase timeout in settings:
{
  "bash": {
    "timeout": 60000  # 60 seconds
  }
}

# 4. Check if command needs elevation (sudo)
# Claude cannot use sudo by default. Use:
#   /config allowSudo true  (not recommended, security risk)

# 5. Check PATH in subprocess
# Bash runs with limited PATH. Set explicitly:
export PATH="/usr/local/bin:/usr/bin:/bin"
```

---

### Permission prompts not appearing

**Problem:** Claude does actions without asking (or never prompts).

**Check:**
```bash
# 1. View current permission mode
/status

# 2. Show permission configuration
/config permissionMode

# Should be "ask-first" if you want prompts

# 3. If set to "bypass-permissions" or "auto":
/config permissionMode ask-first

# 4. Check for --dangerously-skip-permissions flag
# Remove from command line or alias
```

---

### MCP server not connecting

**Problem:** `/mcp status` shows "disconnected" or "failed".

**Fix:**

```bash
# 1. Test server manually
npx @modelcontextprotocol/server-filesystem /tmp

# 2. Check server command is correct
# In ~/.claude/claude.json:
cat ~/.claude/claude.json | grep -A 5 mcpServers

# 3. Verify dependencies installed
npx -y @modelcontextprotocol/server-filesystem --help

# 4. Check server logs
# MCP servers log to stdout/stderr. Enable debug:
DEBUG=mcp:* bun run src/main.tsx session

# 5. Reconnect
/mcp reconnect <server-name>

# 6. Remove and re-add
/mcp remove <name>
/mcp add <name> <command>
```

---

### Plugin not loading

**Problem:** Plugin fails to load or errors on startup.

**Diagnosis:**
```
/plugin list  # Check plugin status
/doctor        # May show plugin errors
```

**Fix:**

```bash
# 1. Check plugin directory
ls ~/.claude/plugins/<plugin-name>/

# 2. Verify plugin.json syntax
cat ~/.claude/plugins/<plugin-name>/.claude-plugin/plugin.json
# Validate JSON: python -m json.tool file.json

# 3. Check dependencies
# Other plugins may be required. Install missing:
/plugin install <dependency>

# 4. Clear plugin cache
rm -rf ~/.claude/cache/plugins/

# 5. Reload plugins
/reload-plugins

# 6. Enable plugin if disabled
/plugin enable <name>

# 7. Check for version conflicts
# If plugin requires specific versions:
/plugin update  # Update all
```

---

### "Unknown skill" errors

**Problem:** "Unknown skill: commit" or similar.

**Cause:** Skill not registered. Usually from missing plugin.

**Fix:**
```bash
# 1. Check if skill-providing plugin is loaded
/plugin list | grep commit

# 2. Install plugin providing the skill
/plugin install commit-commands

# 3. Reload plugins
/reload-plugins
```

---

### Git integration not working

**Problem:** Git-related commands fail.

**Fix:**
```bash
# 1. Verify in git repository
git status

# 2. Check git is in PATH
which git

# 3. If using Windows:
# Ensure Git Bash is installed and in PATH
# Or set: CLAUDE_CODE_GIT_BASH_PATH="C:\Program Files\Git\bin\bash.exe"

# 4. Test git commands work in regular terminal
git diff
git log

# 5. Set git safe directory (if permission errors)
git config --global --add safe.directory /path/to/project
```

---

### Slow performance / high CPU

**Problem:** Claude Code is slow or uses excessive CPU.

**Fix:**

```bash
# 1. Reduce context window size
/config maxContextTokens 100000

# 2. Disable animations
/animate false

# 3. Reduce number of loaded plugins
/plugin disable <unused-plugin>

# 4. Clear session history
/clear context
/compact

# 5. Check for large files in project
# Claude indexes files. Exclude large dirs:
echo "node_modules" >> .gitignore
echo "dist" >> .gitignore
echo "*.log" >> .gitignore

# 6. Reduce terminal history buffer
# In terminal settings, decrease scrollback lines

# 7. Close other terminal tabs
```

---

### Terminal rendering glitches

**Problem:** Corrupted display, garbled text, flickering.

**Fix:**

```bash
# 1. Refresh display
Ctrl+L

# 2. Reset terminal
reset

# 3. Change TERM type
export TERM=xterm-256color
# Or:
export TERM=xterm

# 4. Disable fancy features
export NO_COLOR=1
export CLICOLOR=0

# 5. Update terminal emulator
# iTerm2, Kitty, Alacritty, WezTerm recommended

# 6. Disable kitty keyboard protocol (if problematic)
# In settings:
{
  "terminal": {
    "useKittyProtocol": false
  }
}

# 7. Use NO_FLICKER mode (if supported by terminal)
# In settings:
{
  "minimalMode": true
}
```

---

### Copy/paste issues

**Problem:** Pasting multi-line content inserts extra blank lines, or copying includes unwanted whitespace.

**Fix:**

```bash
# 1. Configure paste behavior
# In settings:
{
  "pasteMultiLine": true,
  "stripPasteWhitespace": false  # Set true to trim
}

# 2. Use Ctrl+Shift+V (SSH) for raw paste
# Or use /paste command instead of terminal paste

# 3. Configure terminal bracketed paste mode
# In .bashrc or .zshrc:
export TERM_PROGRAM_VERSION=...  # May affect

# 4. Use built-in /paste command
/paste

# 5. For Windows Terminal:
# Settings → Profiles → defaults → "Use legacy console" → OFF
```

---

### Voice mode not working

**Problem:** `/voice` command not available or transcription fails.

**Check:**
```bash
# 1. Voice mode enabled?
echo $VOICE_MODE  # Should be 1

# Set:
export VOICE_MODE=1

# 2. Audio dependencies installed (Windows)
# audio-capture-napi requires:
#   - Visual Studio Build Tools
#   - Windows SDK

# Reinstall with:
bunpm rebuild audio-capture-napi --build-from-source

# 3. Microphone permission granted
# In system settings, allow microphone access for terminal

# 4. Check default audio device
# Use system audio settings to verify

# 5. Test recording
# Use `ffmpeg` to test:
ffmpeg -f dshow -i audio="Microphone" -t 5 test.wav
```

---

### MCP OAuth failures

**Problem:** OAuth flow fails, token not saved, or "Invalid OAuth error response".

**Fix:**
```bash
# 1. Check MCP server config
cat ~/.claude/claude.json | jq '.mcpServers'

# 2. Ensure headersHelper configured correctly
# Example:
{
  "mcpServers": {
    "server": {
      "command": "mcp-server",
      "headersHelper": "./get-headers.sh"
    }
  }
}

# 3. Re-authenticate
/mcp reauth <server>

# 4. Clear stored OAuth tokens
rm ~/.claude/credentials.json

# 5. Check redirect URI
# Must match server's registered redirect URI

# 6. Verify scopes
# Token must have required scopes
```

---

### Plugin marketplace unavailable

**Problem:** `/plugin marketplace` fails to load.

**Check:**
```bash
# 1. Network connectivity to marketplace
curl https://claude.ai/api/plugins/marketplace

# 2. Check authentication
# Must be logged in:
/status  # Should show "authenticated"

# 3. Login if needed
/provider login anthropic

# 4. Retry
/plugin refresh

# 5. Offline mode?
# Use local plugins only:
{
  "plugins": {
    "allowNetwork": false
  }
}
```

---

### Session won't resume

**Problem:** `/resume` doesn't show expected session or fails to load.

**Fix:**
```bash
# 1. Check session directory
ls ~/.claude/sessions/

# 2. Verify session file exists and readable
cat ~/.claude/sessions/<id>.json | head

# 3. Check session size
du -h ~/.claude/sessions/<id>.json

# If too large (>50MB), may be corrupted. Try:
#   /resume --no-compact  (if available)

# 4. Clear session index (forces rebuild)
rm ~/.claude/cache/session-index.json

# 5. Check permissions on files
ls -la ~/.claude/sessions/

# 6. Restore from backup
# Sessions auto-backup to ~/.claude/backups/
ls ~/.claude/backups/
```

---

### Bridge mode connection fails

**Problem:** Cannot connect to bridge session.

**Check:**
```bash
# 1. Bridge mode enabled?
echo $BRIDGE_MODE  # Should be 1

# 2. JWT token valid
# Bridge requires auth token. Set:
export CLAUDE_CODE_OAUTH_TOKEN=<token>

# Get token from: https://claude.ai/settings?token

# 3. WebSocket connectivity
# Bridge uses WebSocket. Check firewall:
nc -zv wss://bridge.claude.ai 443

# 4. Try reconnect
/bridge disconnect
/bridge connect

# 5. Check bridge logs
tail -f ~/.claude/bridge.log
```

---

### High token usage / cost

**Problem:** Sessions consume too many tokens, bills high.

**Mitigation:**

```bash
# 1. Enable auto-compaction
/config autoCompact true

# 2. Use more compact models for certain tasks
/model claude-3-haiku-20240307  # Cheaper

# 3. Use `/context` to monitor usage regularly
# Set threshold alert:
/context --warn-threshold 0.8

# 4. Enable prompt caching (if available)
export ENABLE_PROMPT_CACHING_1H=1

# 5. Start new sessions periodically
/compact  # Force compaction
```

---

### "No space left on device"

**Problem:** Disk space exhausted.

**Fix:**
```bash
# 1. Check disk usage
df -h

# 2. Clean Claude Code caches
rm -rf ~/.claude/cache/*
rm -rf ~/.claude/sessions/*  # Old sessions
rm -rf ~/.claude/backups/*   # Old backups

# 3. Keep only recent sessions
# Configure auto-cleanup in settings:
{
  "cleanup": {
    "sessionRetentionDays": 30,
    "backupRetentionDays": 7
  }
}

# 4. Clean npm/bun cache
bun pm cache rm
```

---

### Permission mode stuck

**Problem:** `/config permissionMode` won't change.

**Cause:** Managed settings from enterprise policy overriding.

**Fix:**
```bash
# 1. Check if managed settings active:
/doctor  # Look for "Managed" indicators

# 2. View managed settings source:
cat ~/.claude/managed-settings.json

# 3. Cannot override managed policy - contact admin

# 4. For local-only installs, ensure not set:
unset CLAUDE_MANAGED_SETTINGS_PATH
```

---

### Vim mode not working

**Problem:** Vim keybindings don't activate.

**Check:**
```bash
# 1. Verify editorMode setting
cat ~/.claude/settings.json | grep editorMode

# Should show: "editorMode": "vim"

# 2. Enable Vim mode
/config editorMode vim

# 3. Restart session (mode applies at startup)

# 4. Verify terminal sends proper keys
# In vim, press Esc — should switch to normal mode indicator

# 5. Known terminal issues:
# - iTerm2: Disable "Show incremental search" in advanced settings
# - Kitty: Ensure kitty keyboard protocol enabled
# - VS Code: Use integrated terminal (not raw)
```

**Vim mode shortcuts:**
- `i` — Insert mode
- `Esc` — Normal mode
- `:` — Command mode (type slash commands)
- `h/j/k/l` — Navigation
- `w`/`b` — Word forward/backward
- `0`/`$` — Line start/end
- `Ctrl+[` — Alternative Esc

---

### Color/theme issues

**Problem:** Colors look wrong, garbled, or missing.

**Fix:**
```bash
# 1. Set terminal to 256-color mode
export TERM=xterm-256color

# 2. Enable true color (24-bit) if supported
export COLORTERM=truecolor

# 3. Test color support
# Run this in terminal:
echo -e "\e[38;2;255;0;0mRed text\e[0m"

# Should display bright red.

# 4. Force color mode
export FORCE_COLOR=3

# 5. Disable color (as last resort)
export NO_COLOR=1
```

---

### Windows-specific issues

**PowerShell tool missing:**
```powershell
# Install PowerShell 7+
winget install Microsoft.PowerShell --source winget

# Ensure pwsh in PATH
where.exe pwsh

# Enable PowerShell tool:
$env:CLAUDE_CODE_USE_POWERSHELL_TOOL=1
```

**Path issues:**
```powershell
# Windows paths in settings use forward slashes or double backslashes:
{
  "permissions": {
    "scope": {
      "additionalDirectories": ["C:\\Projects\\myapp"]
    }
  }
}
```

**Antivirus false positives:**
- Add exclusion for `~\.claude\` directory
- Exclude `claude-code` process

---

### macOS-specific issues

**Keychain access denied:**
```bash
# Allow Claude Code to access keychain:
# System Preferences → Security & Privacy → Privacy → Keychain
# Add "Claude" or terminal app to allowed list
```

**Apple Silicon (M1/M2) performance:**
```bash
# Ensure running native arm64 build
# If using Rosetta, performance degraded:
arch -arm64 bun run src/main.tsx session
```

**App translocation:**
If downloaded from internet, macOS may quarantine. Remove quarantine:
```bash
xattr -dr com.apple.quarantine /path/to/claude-code
```

---

### Linux-specific issues

**Missing shared libraries:**
```bash
# audio-capture-napi may require:
sudo apt-get install libasound2-dev  # Debian/Ubuntu
sudo yum install alsa-lib-devel      # RHEL/CentOS

# Reinstall:
bun install
```

**Wayland vs X11:**
```bash
# For clipboard on Wayland, may need:
export WAYLAND_DISPLAY=wayland-0
# Or use wl-copy:
bun add wl-clipboard
```

**SELinux/AppArmor:**
May block sandboxing. Add policy exception or disable:
```bash
# Temporarily disable (not recommended):
setenforce 0
```

---

## Debugging

### Enable Verbose Logging

```bash
# All debug logs
DEBUG=* bun run src/main.tsx session

# Specific modules
DEBUG=provider:* bun run src/main.tsx session
DEBUG=mcp:* bun run src/main.tsx session
DEBUG=permissions:* bun run src/main.tsx session
DEBUG=plugin:* bun run src/main.tsx session

#LOG LEVEL
export LOG_LEVEL=debug
```

### Capture Session Transcript

All sessions automatically logged to:
```
~/.claude/sessions/{session-id}.txt
```

Also view in real-time:
```bash
tail -f ~/.claude/sessions/latest.txt
```

### OpenTelemetry Traces

If `OTEL_EXPORTER_OTLP_ENDPOINT` configured, traces sent to observability platform.

View local traces:
```bash
# Export to console
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# Then use Jaeger or similar to view
```

### Heap Dump

Generate heap snapshot for memory leak investigation:

```
/heapdump
```

Creates `~/.claude/heapdump-<timestamp>.heapprofile`.

Analyze with:
- Chrome DevTools (Memory tab → Load profile)
- `cloverage` or `pprof`

---

## Crash Recovery

### Session Recovery on Crash

If Claude Code crashes:
1. Sessions are saved automatically on each turn
2. Resume with `/resume` and select the session
3. Sessions have autosave every message

### Corrupted Session

If session cannot be loaded:

```bash
# Restore from backup
ls ~/.claude/backups/
# Copy backup to sessions/
cp ~/.claude/backups/{id}.json ~/.claude/sessions/

# Or extract just text transcript:
cat ~/.claude/backups/{id}.txt
```

### Recover Lost Work

If you lose work:
1. Check session transcript for reproduced changes
2. Check git history (`git reflog`, `git fsck --lost-found`)
3. Check editor local history (VS Code, etc.)

---

## Getting Help

### Self-Help

1. Run `/doctor`
2. Check [FAQ](README.md#faq)
3. Search [GitHub Issues](https://github.com/JonusNattapong/ClaudeCode/issues)
4. Review [this troubleshooting guide](#)

### Reporting Bugs

```
/feedback --bug
```

Or on GitHub:
1. Search existing issues
2. Include:
   - Claude Code version (`claude --version`)
   - OS and terminal
   - Steps to reproduce
   - Debug log (with `DEBUG=*`)
   - Screenshot if UI issue

### Community Support

- **GitHub Discussions** — https://github.com/JonusNattapong/ClaudeCode/discussions
- **Discord** — (invite in README)
- **Twitter/X** — @ClaudeCode

## Common Error Messages

### "Please run /login"

**Cause:** OAuth token expired or missing.

**Fix:**
```bash
# Re-authenticate
/login

# Or set token manually:
export CLAUDE_CODE_OAUTH_TOKEN=<token>
```

---

### "Tool not available in current context"

**Cause:** Tool disabled by permissions or sandbox.

**Fix:**
```bash
# Check tool availability:
/status  # Shows disabled tools

# Enable in settings:
/config tools.<tool-name>.enabled true

# Or adjust permissions:
/config permissionMode auto  # Less restrictive
```

---

### "Context window exceeded"

**Cause:** Too many messages or large files.

**Fix:** See ["Context window exceeded"](#context-window-exceeded) above.

---

### "Model overloaded"

**Cause:** API provider experiencing high load.

**Fix:**
- Wait and retry
- Switch to alternative provider
- Use lighter model

---

### "Network error"

**Cause:** Connectivity issue or timeout.

**Fix:**
```bash
# Test connectivity:
ping api.anthropic.com

# Check proxy settings (if using proxy):
echo $HTTPS_PROXY

# Disable proxy temporarily:
unset HTTPS_PROXY HTTP_PROXY NO_PROXY

# Increase timeout:
export API_TIMEOUT_MS=300000
```

---

### "Permission denied" on file operations

**Cause:** File system permissions or sandbox restrictions.

**Fix:**
```bash
# Check file permissions:
ls -la <file>

# Check if path blocked by settings:
cat ~/.claude/settings.json | grep blockedPaths

# Add to allowed directories:
/add-dir /path/to/dir --remember
```

---

### "Unknown slash command"

**Cause:** Typo or disabled plugin.

**Fix:**
```bash
# List all available commands:
/help

# Search:
/help <keyword>

# Reload plugins if command from plugin:
/reload-plugins
```

---

## Performance Tuning

### Reduce Memory Usage

```bash
# 1. Lower context limit
bun run src/main.tsx --max-tokens 100000

# 2. Disable telemetry
DISABLE_TELEMETRY=1 bun run src/main.tsx session

# 3. Reduce plugin count
/plugin disable <plugin-name>

# 4. Clear session history periodically
/clear context
```

### Speed Up Startup

```bash
# 1. Disable unnecessary plugins
# 2. Reduce auto-run hooks
# 3. Use bun (faster than npm)
# 4. Clear cache periodically
```

### Improve Streaming

```bash
# SSE streaming is default. If glitchy:
export CLAUDE_CODE_PREFER_SSE=1

# Or disable streaming (fallback to non-streaming):
export CLAUDE_CODE_DISABLE_STREAMING=1
```

---

## Still Stuck?

If none of these solutions work:

1. **Gather information:**
   - `claude --version`
   - OS: `uname -a` (Linux/macOS) or `systeminfo` (Windows)
   - Terminal: `echo $TERM`
   - Full error message + debug log

2. **Create minimal reproduction:**
   - New empty directory
   - Start fresh session
   - Try minimal command

3. **Open an issue:**
   https://github.com/JonusNattapong/ClaudeCode/issues

Include all gathered info and steps to reproduce.

---

## Support Matrix

| Issue Type | Support Channel |
|------------|-----------------|
| Bug reports | GitHub Issues |
| Feature requests | GitHub Discussions |
| Usage questions | GitHub Discussions / Discord |
| Security issues | security@anthropic.com (private) |
| Enterprise support | Account team |
