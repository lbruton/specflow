<p align="center">
  <img src="assets/logo-wide.svg" alt="SpecFlow" height="48">
</p>

<p align="center">
  Spec-driven development with persistent project memory and semantic code intelligence.
</p>

<p align="center">
  <a href="https://github.com/lbruton/specflow"><img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP_Server-Plugin-6366f1" alt="MCP Server Plugin">
  <img src="https://img.shields.io/badge/self--hosted-zero_cloud_deps-22c55e" alt="Self-hosted">
</p>

<p align="center">
  <a href="launch/index.html"><strong>View the full interactive about page</strong></a> &bull;
  <a href="docs/CASE-STUDY-FORGE.md">Case Study: Forge</a> &bull;
  <a href="FORK-CHANGELOG.md">Changelog</a>
</p>

---

AI agents forget everything between sessions. They lose decisions, repeat mistakes, and drift from reality. **SpecFlow** gives them a structured lifecycle, persistent cross-project memory, and semantic code intelligence -- all self-hosted.

Built on [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp)'s core engine (sequential spec workflow, real-time dashboard, blocking approval gates). This fork layers extended lifecycle phases, multi-project orchestration, three-tier knowledge architecture, and semantic code search on top.

## Four Systems, One Workflow

| System | What It Does |
|--------|-------------|
| **SpecFlow** (MCP Server) | Spec-driven lifecycle: Requirements → Design → Tasks → Implementation with dashboard approvals at every gate. 6 tools, 7 prompts. |
| **DocVault** (Obsidian Vault) | Cross-project knowledge base. One vault serves 8+ repos -- architecture, infrastructure, decisions, issues. Graph visualization + wikilinks. |
| **Code Context** (Milvus) | Semantic code search via self-hosted vector database. Search by meaning, not keywords. Forked from [Zilliz/claude-context](https://github.com/zilliztech/mcp-server-milvus), hardened with timeouts and pinned versions. |
| **Skill System** (60+ Skills) | CLAUDE.md stays tiny -- a routing table to skills. Each skill encodes a full workflow: debugging, deployment, PR resolution, infrastructure management. |

## Three-Tier Memory Architecture

Not everything belongs in one file. Each tier has a purpose and a source of truth ranking.

| Tier | System | Role |
|------|--------|------|
| **1** | DocVault | Ground truth. Human-curated Obsidian vault. Wins all conflicts. |
| **2** | File Memory | Session context. Project-scoped markdown at `~/.claude/projects/*/memory/`. |
| **3** | mem0 | Episodic recall. Semantic retrieval from session digests. Never authoritative. |

## Continuous Learning Loop

Every session learns from the previous. This is the single biggest differentiator.

```
/prime (morning)              /goodnight (end of day)
  ├─ Index codebase             ├─ /retro
  ├─ Read recent digests        │   └─ Extract prescriptive lessons → mem0
  ├─ Pull mem0 memories         └─ /digest-session
  ├─ Check issues + git             ├─ Read JSONL transcripts
  └─ "Here's where you left off"    ├─ Summarize via local Ollama
                                     ├─ Write to DocVault/Daily Digests/
                                     └─ Save key facts to mem0

  Tomorrow's /prime reads today's digest + retro lessons
```

## Spec Workflow Lifecycle

Every non-trivial feature follows the same path. Approvals required at each gate.

```
Phase 0      Phase 1       Phase 2      Phase 3     Phase 4       Phase 5
/chat    →   /discover  →  /spec    →   Design  →   Implement  →  /retro

Bug fast path: /systematic-debugging → issue → fix (skip Phases 0-2)
Casual path:   /gsd — no issue, no spec, chore: PR
```

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
| 2 | Code Context (Milvus) | Semantic: "find code related to payment processing" |
| 3 | Grep / Glob | Literal: exact strings, filenames, identifiers |
| 4 | Code Oracle Agent | Deep analysis: combines all sources + AI reasoning |

Code Context is a [hardened fork](https://github.com/lbruton/claude-context) of Zilliz's MCP server -- self-hosted Milvus, 30s timeouts, pinned npm versions. No collection limits, full data sovereignty.

## Comparison

| Dimension | SpecKit | BMAD | GSD | Taskmaster | mex | Pimzino | **SpecFlow** |
|-----------|---------|------|-----|------------|-----|---------|------------|
| Approval gates | None | Advisory | UAT | None | None | Dashboard | **Dashboard + skills** |
| Memory | constitution.md | Git docs | STATE.md | tasks.json | Scaffold | Steering docs | **3-tier** |
| Session learning | None | None | None | None | GROW loop | None | **/prime → /goodnight** |
| Code search | None | None | None | None | None | None | **Semantic + structural** |
| Multi-project | Per-repo | Per-repo | Per-repo | Per-repo | Per-repo | Per-repo | **One vault, all repos** |
| Infrastructure | Code only | Code only | Code only | Code only | Code only | Code only | **Docker, DNS, VMs** |
| Drift detection | None | None | None | None | 8 checkers | None | /vault-update gate |
| Self-hosted | Files | Files | Files | Files | Files | Node.js | **Milvus, Neo4j, Ollama** |
| Best for | Quick adoption | Enterprise teams | Solo context eng. | PRD pipelines | Per-repo memory | Structured workflow | **Multi-project governance** |

## Quick Start

### As a Claude Code Plugin (recommended)

```bash
git clone https://github.com/lbruton/specflow.git
cd spec-workflow-mcp
npm install && npm run build

# Symlink into Claude Code plugins
ln -s "$(pwd)" ~/.claude/plugins/marketplaces/specflow-marketplace
```

### As an MCP Server

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

| Prompt | Description |
|--------|-------------|
| `create-spec` | Create a new spec from requirements |
| `implement-task` | Generate implementation plan for a task |
| `create-steering-doc` | Create project steering documentation |
| `refresh-tasks` | Re-sync task state from spec files |
| + 3 injection prompts | Context injection for guides |

## Prerequisites

The core spec workflow works out of the box with Node.js. Extended features use:

| Component | Purpose | Link |
|-----------|---------|------|
| [Obsidian](https://obsidian.md) | DocVault knowledge base | [obsidian.md](https://obsidian.md) |
| [mem0](https://github.com/mem0ai/mem0) | Cross-session episodic memory | [mem0.ai](https://mem0.ai) |
| [Milvus](https://milvus.io) | Self-hosted vector DB for Code Context | [milvus.io](https://milvus.io) |
| [Claude Code](https://claude.ai/claude-code) | CLI agent that consumes MCP servers | [docs](https://docs.anthropic.com/en/docs/claude-code) |

## Architecture

```
src/
  tools/               # MCP tool definitions (6 tools)
  prompts/             # MCP prompt definitions (7 prompts)
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
- [x] Code Context -- semantic search (Milvus, self-hosted)
- [x] Code Graph Context -- structural search (Neo4j, local)
- [x] 60+ skills -- procedural knowledge routing
- [x] Memory pipeline -- session digests via local Ollama
- [ ] Rebrand Code Context -- merge into SpecFlow plugin
- [ ] Self-host mem0 -- fork + local deployment
- [ ] Self-host CGC -- fork + local Neo4j bundle
- [ ] Unified Docker container -- all services in one stack
- [ ] One-command install for any project

## Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript + build dashboard frontend
npm run dev        # Development mode with hot reload
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

**[Zilliz/claude-context](https://github.com/zilliztech/mcp-server-milvus)** provides the semantic code search engine that Code Context is forked from.

## License

GPL-3.0 -- same as upstream.
