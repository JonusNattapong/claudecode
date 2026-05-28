<p align="center">
  <img src="../assets/claude-logo-long.png" alt="Clew" width="480" />
</p>

<p align="center">
  <strong>ภาษา:</strong>
  <a href="../README.md">English</a> ·
  <a href="README.zh.md">中文 (简体)</a> ·
  <a href="README.th.md"><strong>ไทย</strong></a>
</p>

<p align="center">
  <a href="#ติดตั้ง"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJonusNattapong%2Fclaudecode%2Fmain%2Fpackage.json&query=%24.version&label=version&color=%238b5cf6" alt="Version"></a>
  <a href="../LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-%238b5cf6" alt="License"></a>
</p>

**Clew** คือผู้ช่วยเขียนโค้ดด้วย AI ที่ทำงานในเทอร์มินัล รองรับผู้ให้บริการ LLM ทุกราย อ่านโค้ด แก้ไขไฟล์ รันคำสั่ง และประสานงานเวิร์กโฟลว์หลายเอเจนต์ — ทั้งหมดจากเทอร์มินัลของคุณ

> **ข้อจำกัดความรับผิดชอบ:** โปรเจ็กต์นี้ rebuild อย่างอิสระจาก Claude Code CLI ของ Anthropic เพื่อการวิจัยและการใช้งาน self-hosted ไม่เกี่ยวข้องหรือรับรองโดย Anthropic PBC ดู [LICENSE.md](../LICENSE.md)

---

## ติดตั้ง

```bash
npm install -g @jonusnattapong/claudecode
```

ต้องมี [Bun](https://bun.sh) 1.3+ ตอนรัน จากนั้นใช้ `clew` ในไดเรกทอรีโปรเจ็กต์ใดก็ได้

### จากซอร์ส

```bash
git clone https://github.com/JonusNattapong/claudecode.git
cd claudecode
bun install
bun run build
bun run start
```

## เริ่มต้นใช้งาน

```bash
export OPENAI_API_KEY=sk-...
clew
```

```text
> "อธิบายโครงสร้างโปรเจ็กต์นี้"
> /model deepseek-v4-pro
> /status
```

พิมพ์ `/` ใน CLI เพื่อดูคำสั่งทั้งหมด ดูเพิ่มเติมที่ [เริ่มต้นใช้งาน](../docs/quick-start.html)

## จุดแตกต่าง

- **27+ ผู้ให้บริการ** — Anthropic, OpenAI, Google Gemini, DeepSeek, OpenRouter, Ollama, xAI, Mistral, Groq, GitHub Copilot และอื่นๆ ที่เข้ากันได้กับ OpenAI สลับได้ทันทีด้วย `/model`
- **90+ คำสั่ง** — `/edit`, `/glob`, `/grep`, `/commit`, `/compact`, `/color`, `/task` และอื่นๆ
- **65+ เครื่องมือ** — อ่าน/เขียน/ค้นหาไฟล์, shell, ค้นหาเว็บ, LSP, MCP, orchestrate agent, งานตามเวลา
- **ระบบ Plugin** — lifecycle hooks (PreToolUse, PostToolUse, PreBash), marketplace, คำสั่งที่กำหนดเอง
- **Agent runtime** — จัดการหลายเอเจนต์, daemon mode 24/7, worktree isolation, คิวงาน autonomous
- **Research & memory** — deep research, semantic memory ข้าม session, auto-memory
- **การทำงานร่วมกันระยะไกล** — WebSocket bridge, แชร์ session, QR code pairing
- **โหมดเสียง** — ใช้งานได้ตลอดผ่าน `/voice`

## เอกสาร

| หัวข้อ | |
|---|---|
| เริ่มต้น | [Quick Start](../docs/quick-start.html) · [ติดตั้ง](../docs/installation.html) · [ตั้งค่า](../docs/configuration.html) |
| ผู้ให้บริการ | [Providers](../docs/providers.html) · [Models](../docs/models.html) |
| CLI | [คำสั่ง](../docs/commands.html) · [CLI Reference](../docs/cli-reference.html) · [Tools](../docs/tools.html) |
| Context & sessions | [Context Window](../docs/context-window.html) · [Sessions](../docs/sessions.html) |
| ขยายความสามารถ | [Plugins](../docs/plugins.html) · [Skills](../docs/skills.html) · [Hooks](../docs/hooks.html) · [MCP](../docs/mcp.html) |
| Autonomous | [Daemon](../docs/daemon.html) · [Worktrees](../docs/worktrees.html) · [Agent Teams](../docs/agent-teams.html) |
| อ้างอิง | [Keybindings](../docs/keybindings.html) · [Env Vars](../docs/env-vars.html) · [Errors](../docs/errors.html) · [แก้ปัญหา](../docs/troubleshooting.html) |

## การพัฒนา

```bash
bun run dev       # โหมด dev แบบ hot-reload
bun run start     # รันจากซอร์ส
bun run build     # build ไปที่ dist/
bun test          # รันเทสต์
bun x tsc --noEmit  # typecheck
bun run check     # biome lint + format
```

## การมีส่วนร่วม

ดู [CONTRIBUTING.md](../CONTRIBUTING.md), [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) และ [SECURITY.md](../SECURITY.md)

## ใบอนุญาต

[MIT](../LICENSE.md)
