<p align="center">
  <img src="../assets/claude-logo-long.png" alt="Clew" width="480" />
</p>

<p align="center">
  <strong>语言：</strong>
  <a href="../README.md">English</a> ·
  <a href="README.zh.md"><strong>中文 (简体)</strong></a> ·
  <a href="README.th.md">ไทย</a>
</p>

<p align="center">
  <a href="#安装"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJonusNattapong%2Fclaudecode%2Fmain%2Fpackage.json&query=%24.version&label=version&color=%238b5cf6" alt="Version"></a>
  <a href="../LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-%238b5cf6" alt="License"></a>
</p>

**Clew** 是一款终端 AI 编程助手，支持任何 LLM 提供商。读取代码库、编辑文件、运行命令，以及编排多 Agent 工作流——全部在终端中完成。

> **免责声明：** 本项目基于 Anthropic 的 Claude Code CLI 独立重建，用于研究和自托管开发。与 Anthropic PBC 无隶属或背书关系。详见 [LICENSE.md](../LICENSE.md)。

---

## 安装

```bash
npm install -g @jonusnattapong/claudecode
```

需要 [Bun](https://bun.sh) 1.3+ 运行时。然后在任意项目目录中运行 `clew`。

### 从源码运行

```bash
git clone https://github.com/JonusNattapong/claudecode.git
cd claudecode
bun install
bun run build
bun run start
```

## 快速开始

```bash
export OPENAI_API_KEY=sk-...
clew
```

```text
> "解释这个项目的结构"
> /model deepseek-v4-pro
> /status
```

在 CLI 中按 `/` 发现所有命令。详见[快速开始](../docs/quick-start.html)。

## 与众不同

- **27+ 供应商** — Anthropic、OpenAI、Google Gemini、DeepSeek、OpenRouter、Ollama、xAI、Mistral、Groq、GitHub Copilot 及任何 OpenAI 兼容接口。使用 `/model` 即时切换。
- **90+ 命令** — `/edit`、`/glob`、`/grep`、`/commit`、`/compact`、`/color`、`/task` 等。
- **65+ 工具** — 文件读写搜索、Shell、网络搜索、LSP、MCP、Agent 编排、定时任务。
- **插件系统** — 生命周期钩子（PreToolUse、PostToolUse、PreBash）、插件市场、自定义命令。
- **Agent 运行时** — 多 Agent 编排、7x24 守护进程模式、Worktree 隔离、自主任务队列。
- **研究与记忆** — 深度研究、跨会话语义记忆、自动记忆捕获。
- **远程协作** — WebSocket 桥接、会话共享、QR 码配对。
- **语音模式** — 始终可通过 `/voice` 使用。

## 文档

| 主题 | |
|---|---|
| 入门 | [快速开始](../docs/quick-start.html) · [安装](../docs/installation.html) · [配置](../docs/configuration.html) |
| 供应商 | [Providers](../docs/providers.html) · [Models](../docs/models.html) |
| CLI | [命令](../docs/commands.html) · [CLI 参考](../docs/cli-reference.html) · [工具](../docs/tools.html) |
| 上下文与会话 | [Context Window](../docs/context-window.html) · [Sessions](../docs/sessions.html) |
| 扩展 | [Plugins](../docs/plugins.html) · [Skills](../docs/skills.html) · [Hooks](../docs/hooks.html) · [MCP](../docs/mcp.html) |
| 自主运行 | [Daemon](../docs/daemon.html) · [Worktrees](../docs/worktrees.html) · [Agent Teams](../docs/agent-teams.html) |
| 参考 | [Keybindings](../docs/keybindings.html) · [Env Vars](../docs/env-vars.html) · [Errors](../docs/errors.html) · [故障排除](../docs/troubleshooting.html) |

## 开发

```bash
bun run dev       # 开发模式（热重载）
bun run start     # 从源码运行
bun run build     # 构建到 dist/
bun test          # 运行测试
bun x tsc --noEmit  # 类型检查
bun run check     # biome lint + format
```

## 贡献

请参阅 [CONTRIBUTING.md](../CONTRIBUTING.md)、[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) 和 [SECURITY.md](../SECURITY.md)。

## 许可证

[MIT](../LICENSE.md)
