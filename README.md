<p align="center">
  <img src="assets/logo-wide.svg" alt="SpecFlow" height="48">
</p>

<p align="center">
  Spec-driven development with persistent project memory and semantic code intelligence.
</p>

<p align="center">
  <a href="https://github.com/lbruton/specflow"><img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP_Server-Plugin-6366f1" alt="MCP Server Plugin">
  <img src="https://img.shields.io/badge/self--hosted-cloud_optional-22c55e" alt="Self-hosted, cloud optional">
</p>

<p align="center">
  <a href="https://lbruton.github.io/specflow/"><strong>View the full interactive about page</strong></a> &bull;
  <a href="docs/CASE-STUDY-FORGE.md">Case Study: Forge</a> &bull;
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

AI agents forget everything between sessions. They lose decisions, repeat mistakes, and drift from reality. **SpecFlow** gives them a structured lifecycle, persistent cross-project memory, and semantic code intelligence -- self-hosted core with optional cloud integrations.

Built on [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp)'s core engine (sequential spec workflow, real-time dashboard, blocking approval gates). This fork layers extended lifecycle phases, multi-project orchestration, three-tier knowledge architecture, and semantic code search on top.

## Four Systems, One Workflow

| System | What It Does |
|--------|-------------|
| **SpecFlow** (MCP Server) | Spec-driven lifecycle: Requirements → Design → Tasks → Implementation with dashboard approvals at every gate. 6 tools, 10 prompts. |
| **DocVault** (Obsidian Vault) | Cross-project knowledge base. One vault serves 8+ repos -- architecture, infrastructure, decisions, issues. Graph visualization + wikilinks. |
| **Claude Context** (Milvus) | Semantic code search via self-hosted vector database. Search by meaning, not keywords. Forked from [zilliztech/claude-context](https://github.com/zilliztech/claude-context), hardened with timeouts and pinned versions. Requires a running Milvus instance (Docker or otherwise). |
| **Skill System** (60+ Skills) | CLAUDE.md stays tiny -- a routing table to skills. Each skill encodes a full workflow: debugging, deployment, PR resolution, infrastructure management. |

## Three-Tier Memory Architecture

Not everything belongs in one file. Each tier has a purpose and a source of truth ranking.

| Tier | System | Role |
|------|--------|------|
| **1** | DocVault | Ground truth. Human-curated Obsidian vault. Wins all conflicts. |
| **2** | File Memory | Session context. Project-scoped markdown at `~/.claude/projects/*/memory/`. |
| **3** | mem0 | Episodic recall. Semantic retrieval from session digests. Never authoritative. Cloud API by default; self-hosted fork planned. |

## Continuous Learning Loop

Every session learns from the previous. This is the single biggest differentiator.

```
/start (quick resume)          End-of-session flow:
  ├─ Read last session digest
  ├─ Git log + status          [/pr-cleanup] (if PR merged)
  └─ 5 most recent issues        ├─ Prune remote refs
                                 ├─ Remove merged worktrees
/prime (full boot)               └─ Pull main fast-forward
  ├─ Index codebase (~15s)
  ├─ Read recent digests       /retro
  ├─ Pull mem0 memories          └─ Prescriptive lessons → mem0
  ├─ Check issues + git
  └─ "Here's where you left off" /wrap
                                 ├─ Retro check (skip if /retro already ran)
/audit (on-demand health)        ├─ Session digest → DocVault
  ├─ Code quality + security     └─ Summary → mem0
  ├─ Documentation drift
  └─ Actionable report
```

## Spec Workflow Lifecycle

Every non-trivial feature follows the same path. Approvals required at each gate.

```
/prime (start) → [/chat → /discover]* → /spec → Design → Implement → /audit (health) → /wrap (close)
```

The plugin ships `/prime`, `/start`, `/wrap`, `/pr-cleanup`, `/retro`, `/audit`, `/issue`, `/spec`, `/publish-templates`, and `/migrate-skill`. Phases 0–1 (`/chat`, `/discover`) are marked `*` because they are work in progress — being ported from the author's personal skill library. `/systematic-debugging` (bug fast path) and `/gsd` (casual fixes) also live in the author's personal library and are not shipped yet.

### Parallel Subagent Dispatch

Tasks don't execute sequentially. Each runs through an isolated three-stage pipeline:

```
Orchestrator reads task
  → Implementer Agent      (fresh context, writes code, tests, commits)
  → Compliance Reviewer    (reads actual code vs requirements)
  → Quality Reviewer       (architecture, error handling, readiness)
  → log-implementation     (record artifacts)
  → mark complete

Tasks with zero file overlap execute concurrently in batches.
```

**[Case Study: Forge](docs/CASE-STUDY-FORGE.md)** -- empty repo to deployed production app in 3 hours, 23 tasks across 30 parallel subagents, 8 dashboard approval gates, zero file conflicts.

## Code Intelligence

Agents shouldn't grep blindly through your codebase. Four search tiers, cheapest first:

| Tier | Engine | Query Style |
|------|--------|-------------|
| 1 | Code Graph Context (Neo4j) | Structural: "what calls this function?" |
| 2 | Claude Context (Milvus) | Semantic: "find code related to payment processing" |
| 3 | Grep / Glob | Literal: exact strings, filenames, identifiers |
| 4 | Code Oracle Agent | Deep analysis: combines all sources + AI reasoning |

Claude Context is a [hardened fork](https://github.com/lbruton/claude-context) of Zilliz's [zilliztech/claude-context](https://github.com/zilliztech/claude-context) -- self-hosted Milvus, 30s timeouts, pinned npm versions. No collection limits, full data sovereignty. Embedding generation requires a cloud API (OpenAI or compatible) or a local model via Ollama. Requires a running Milvus instance alongside (Docker recommended).

## Comparison

| Dimension | SpecKit | BMAD | GSD | Taskmaster | mex | Pimzino | **SpecFlow** |
|-----------|---------|------|-----|------------|-----|---------|------------|
| Approval gates | None | Advisory | UAT | None | None | Dashboard | **Dashboard + skills** |
| Memory | constitution.md | Git docs | STATE.md | tasks.json | Scaffold | Steering docs | **3-tier** |
| Session learning | None | None | None | None | GROW loop | None | **/prime → /wrap** |
| Code search | None | None | None | None | None | None | **Semantic + structural** |
| Multi-project | Per-repo | Per-repo | Per-repo | Per-repo | Per-repo | Per-repo | **One vault, all repos** |
| Infrastructure | Code only | Code only | Code only | Code only | Code only | Code only | **Docker, DNS, VMs** |
| Drift detection | None | None | None | None | 8 checkers | None | /vault-update gate |
| Self-hosted | Files | Files | Files | Files | Files | Node.js | **Milvus, Neo4j + cloud optional** |
| Best for | Quick adoption | Enterprise teams | Solo context eng. | PRD pipelines | Per-repo memory | Structured workflow | **Multi-project governance** |

## Multi-Agent Support

SpecFlow works as an MCP server, which means any agent that speaks the MCP protocol can use it. Verified with all three major coding agents:

| Agent | MCP Loading | Spec Lifecycle | Skills |
|-------|------------|----------------|--------|
| **Claude Code** | MCP via npm, plugin via git clone | Full | 60+ skills via SKILL.md |
| **Gemini CLI** | Manual MCP config | Full | Via GEMINI.md instructions |
| **Codex CLI** | Manual MCP config | Full | Via CODEX.md instructions |

All three agents share the same MCP tools, DocVault knowledge base, and spec workflow. Agent-specific instruction files (CLAUDE.md, GEMINI.md, CODEX.md) tailor behavior to each agent's capabilities.

### Cross-Agent Spec Handoff

Spec state lives on disk in DocVault (`DocVault/specflow/{project}/specs/`) — not in any agent's memory. Each project has a thin `.specflow/config.json` pointer. This means you can start a spec in one agent and continue in another:

```
Claude Code                    Codex CLI                      Gemini CLI
────────────                   ─────────                      ──────────
/issue create                  @spec resume                   @spec resume
  → creates SWF-65               → reads spec from disk         → reads spec from disk
/spec SWF-65                     → runs Phase 3 (Tasks)          → runs Phase 4 (Implement)
  → Phase 1 (Requirements)       → generates task list            → implements tasks
  → Phase 2 (Design)             → writes tasks.md                → commits code
  → awaits approval              → awaits approval                → logs implementation
```

Each agent reads the current spec state, advances the workflow, and writes the result back to disk. The dashboard shows progress regardless of which agent is driving. Use whichever agent is best suited for each phase — Claude for discovery and design, Codex for implementation, Gemini for review.

## Quick Start

### Claude Code

**Step 1 — Install the MCP server** (provides tools, prompts, and templates):

Add to your user-level settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "specflow": {
      "command": "npx",
      "args": ["-y", "@lbruton/specflow@latest", "."]
    }
  }
}
```

The npm package contains the MCP server, dashboard, and the 9 spec templates (requirements, design, tasks, implementer-prompt, spec-reviewer, code-quality-reviewer, product, tech, structure). Templates auto-populate `DocVault/specflow/templates/` on first run.

**Step 2 — Install the skills and slash commands** (recommended — provides `/spec`, `/prime`, `/wrap`, etc.):

```bash
git clone https://github.com/lbruton/specflow.git ~/specflow-source
cp -r ~/specflow-source/skills/* ~/.claude/skills/
cp -r ~/specflow-source/commands/* ~/.claude/commands/
cp -r ~/specflow-source/agents/* ~/.claude/agents/
```

Or, if you prefer not to clone the repo, [download the latest ZIP](https://github.com/lbruton/specflow/archive/refs/heads/main.zip), unpack it, and copy the `skills/`, `commands/`, and `agents/` directories into your `~/.claude/` directory.


After restarting Claude Code, the shipped skills (`/prime`, `/wrap`, `/audit`, `/spec`, `/chat`, `/discover`, `/codacy-resolve`, `/retro`, `/publish-templates`, `/migrate-skill`), their slash commands, and the background subagents they dispatch (`prime-status`, `session-digest`, `code-oracle`, `session-oracle`) will all be available.

> **Path convention:** The shipped skills and agents assume **DocVault sits as a sibling directory next to the project** (i.e. they reference `../DocVault/...` from the project root). If your vault lives elsewhere, set `docvault` in `.claude/project.json` to override.

> **Architecture:** The two install steps are independent and serve different purposes:
> - **The npm package** (`@lbruton/specflow`) ships the MCP server, dashboard, and bundled spec templates. It is the engine.
> - **The GitHub repo** (`specflow/skills/`, `specflow/commands/`, and `specflow/agents/`) ships the markdown skills, slash commands, and background subagent definitions that Claude reads directly. They are the user-facing workflows.
>
> Skills, commands, and agents are NEVER bundled into the npm package — they are plain markdown installed by copying. See [`CLAUDE.md`](./CLAUDE.md) § "Architecture & Distribution Model" for the full pipeline diagram.

### Gemini CLI — Manual Install

```bash
git clone https://github.com/lbruton/specflow.git
cd specflow
npm install && npm run build
```

Add to your Gemini MCP config (`~/.gemini/settings.json` or project-level):

```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "node",
      "args": ["/path/to/specflow/dist/index.js", "/path/to/your/project"]
    }
  }
}
```

Copy `GEMINI.md` from the specflow repo root into your project root for agent-specific instructions.

### Codex CLI — Manual Install

```bash
git clone https://github.com/lbruton/specflow.git
cd specflow
npm install && npm run build
```

Add to your Codex MCP config (`.codex/config.toml` or user-level):

```toml
[mcp.specflow]
command = "node"
args = ["/path/to/specflow/dist/index.js", "/path/to/your/project"]
```

Copy `CODEX.md` from the specflow repo root into your project root for agent-specific instructions.

### Any MCP-Compatible Agent — Via npx

```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@lbruton/specflow@latest", "/path/to/your/project"]
    }
  }
}
```

### Dashboard

Real-time web UI for spec tracking, approvals, and implementation logs. Port 5051 by default.

```bash
npx @lbruton/specflow@latest --dashboard --port 5051
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `spec-status` | Get detailed status of a spec |
| `spec-list` | List all specs across projects |
| `approvals` | Manage phase approval workflow |
| `log-implementation` | Record implementation artifacts |
| `spec-workflow-guide` | Get workflow guidance |
| `steering-guide` | Access project steering documents |

## MCP Prompts

Five workflow prompts plus two injection prompts (seven total):

| Prompt | Description |
|--------|-------------|
| `create-spec` | Create a new spec from requirements |
| `create-steering-doc` | Create project steering documentation |
| `implement-task` | Generate implementation plan for a task |
| `refresh-tasks` | Re-sync task state from spec files |
| `spec-status` | Phase and completion summary for a spec |
| `inject-spec-workflow-guide` | Inject the spec workflow guide into the session |
| `inject-steering-guide` | Inject the steering doc guide into the session |

**Note:** `/wrap`, `/prime`, and `/audit` are lifecycle **skills** (shipped as markdown in `skills/`), not MCP prompts. They run in the agent's context without crossing the MCP boundary. See the skills directory for their full definitions.

> **v3.1.0 note:** `/wrap` replaces the standalone `/goodnight` and `/digest-session` skills, which are now deprecated.
> **v3.6.0 note:** End-of-session flow decomposed into `/pr-cleanup` → `/retro` → `/wrap`. Added `/start` as a lightweight alternative to `/prime` for same-day resume. Added `/issue` for vault-based issue management.

## Prerequisites

The core spec workflow works out of the box with Node.js. Extended features use additional services -- some self-hosted, some cloud-based. Local LLM support exists via Ollama but results vary significantly by model size and hardware (a capable GPU is recommended; smaller models may produce lower-quality output):

| Component | Purpose | Link |
|-----------|---------|------|
| [Obsidian](https://obsidian.md) | DocVault knowledge base | [obsidian.md](https://obsidian.md) |
| [mem0](https://github.com/mem0ai/mem0) | Cross-session episodic memory (cloud API; self-hosted fork planned) | [mem0.ai](https://mem0.ai) |
| [Milvus](https://milvus.io) | Self-hosted vector DB for Claude Context | [milvus.io](https://milvus.io) |
| [Claude Code](https://claude.ai/claude-code) | CLI agent that consumes MCP servers | [docs](https://docs.anthropic.com/en/docs/claude-code) |

## Architecture

```
src/
  tools/               # MCP tool definitions (6 tools)
  prompts/             # MCP prompt definitions (10 prompts)
  core/                # Shared logic (parser, task-parser, path-utils)
  dashboard/           # Dashboard backend (multi-server, approval-storage)
  dashboard_frontend/  # React 18 frontend (Vite + Tailwind)
  markdown/            # Document and review templates
  types.ts             # Shared TypeScript types
  index.ts             # CLI entry point
```

## Roadmap

- [x] SpecFlow MCP server -- spec lifecycle + dashboard
- [x] DocVault -- cross-project knowledge vault
- [x] Claude Context -- semantic search (Milvus, self-hosted)
- [x] Code Graph Context -- structural search (Neo4j, local)
- [x] 60+ skills -- procedural knowledge routing
- [x] Memory pipeline -- session digests (configurable: local Ollama or cloud models like Haiku/Sonnet/Opus)
- [ ] Merge Claude Context fork into SpecFlow plugin distribution
- [ ] Self-host mem0 -- fork + local deployment
- [ ] Self-host CGC -- fork + local Neo4j bundle
- [ ] Unified Docker container -- all services in one stack
- [ ] One-command install for any project

## Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript + build dashboard frontend
npm run dev        # Development mode with hot reload
pre-commit install # Install git hooks (includes gitleaks)
pre-commit run --all-files # Run hooks manually across repo
```

## Upstream Documentation

Core functionality docs from Pimzino's project:

- [Configuration Guide](docs/CONFIGURATION.md)
- [User Guide](docs/USER-GUIDE.md)
- [Workflow Process](docs/WORKFLOW.md)
- [Prompting Guide](docs/PROMPTING-GUIDE.md)
- [Tools Reference](docs/TOOLS-REFERENCE.md)

## Credits

**[Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp)** is the foundation. Pimzino designed and built the core architecture: the MCP server, sequential spec workflow, real-time dashboard with blocking approval gates, approval storage, markdown parser, implementation logging, template engine, multi-language support, VSCode extension, Docker deployment, and security hardening. SpecFlow adds workflow extensions, knowledge architecture, and code intelligence on top of that substantial foundation.

**[theDakshJaitly/mex](https://github.com/theDakshJaitly/mex)** inspired several planned features: documentation drift detection with a scoring system, deterministic pattern files promoted from session learnings, and post-commit staleness hooks. mex's per-repo memory scaffold and GROW learning loop showed what disciplined context engineering looks like -- SpecFlow's multi-project approach builds on those ideas.

**[zilliztech/claude-context](https://github.com/zilliztech/claude-context)** provides the semantic code search engine that the Claude Context fork is built from. Zilliz's upstream is designed for their cloud Milvus; the fork adds self-hosting support, hardening, and runs against a local Milvus instance.

## License

GPL-3.0 -- same as upstream.
