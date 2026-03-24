<p align="center">
  <img src="assets/logo-wide.svg" alt="SpecFlow" height="48">
</p>

<p align="center">
  Spec-driven development framework with structured lifecycle, governance gates, and real-time dashboard.
</p>

<p align="center">
  <a href="https://github.com/lbruton/spec-workflow-mcp"><img src="https://img.shields.io/badge/fork_of-Pimzino/spec--workflow--mcp-blue" alt="Fork of Pimzino"></a>
  <img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License">
</p>

---

**SpecFlow** is a fork of [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) -- a full-featured MCP server for structured spec-driven development. Pimzino's project provides the core engine: a sequential workflow (Requirements -> Design -> Tasks -> Implementation), a real-time web dashboard with blocking approval gates, implementation logging, multi-language support, a VSCode extension, and Docker deployment with enterprise security controls.

This fork layers additional patterns on top of that foundation: extended lifecycle phases, multi-project orchestration, infrastructure-aware workflows, and a three-tier knowledge architecture.

> If you're looking for the original project, please visit [Pimzino's repo](https://github.com/Pimzino/spec-workflow-mcp) and give it a star -- SpecFlow wouldn't exist without it.

**See it in action:** [Case Study -- Forge Build Session](docs/CASE-STUDY-FORGE.md) -- empty repo to deployed production app in 3 hours, 23 tasks across 30 parallel subagents, 8 dashboard approval gates.

## How It Works

Pimzino's upstream provides the core spec-driven workflow that powers everything:

```
Requirements -> Design -> Tasks -> Implementation
        (each transition gated by dashboard approval)
```

SpecFlow wraps additional phases around this core:

```
Chat -> Issue -> Discover -> [Pimzino core workflow] -> Retro
```

The AI proposes, the human approves -- that fundamental pattern is Pimzino's design. This fork adds pre-workflow discovery, issue tracking, and post-workflow retrospectives.

## What Makes This Fork Different

### 1. Infrastructure-Aware

Not just code. The workflow extends beyond source files to container deployments, DNS management, secret storage, and reverse proxy configuration. The AI knows the full stack -- from `git commit` to production traffic flow. Skills and agents can be written for any infrastructure tooling.

### 2. Living Documentation

Three-tier knowledge hierarchy: DocVault ([Obsidian](https://github.com/obsidianmd/obsidian-releases) vault) for architecture, [mem0](https://github.com/mem0ai/mem0) for cross-session episodic memory, and in-repo CLAUDE.md files for gate enforcement. Documentation is read before every architectural decision and updated after every implementation.

### 3. Multi-Project Orchestration

Eight repositories with shared skills, a unified branching model, and cross-project infrastructure. Issue prefixes, worktree conventions, and documentation all work across project boundaries.

### 4. Verification is Cultural

Nine mandatory gates, systematic debugging before fixes, evidence before assertions. The system does not trust the AI's claim that something works; it requires proof.

### 5. Evolved, Not Designed

Born from rEngine (August 2025), a 2688-file "agentic OS." Seven months of daily production use refined every gate, every skill, and every agent pattern through real pressure.

## Comparison

| Framework | Approval Gates | Memory | Best For |
|-----------|----------------|--------|----------|
| **SpecKit** (GitHub) | None | constitution.md (static) | Quick adoption, any AI tool |
| **BMAD** | Advisory (PO reports) | Document-based (git) | Enterprise, team simulation |
| **GSD** | UAT phase | STATE.md (single file) | Solo devs, context engineering |
| **Taskmaster** | None | tasks.json (static) | PRD-to-tasks pipeline |
| **Pimzino** (upstream) | Dashboard (blocking) | Steering docs | Teams wanting structured workflow + audit trail |
| **SpecFlow** (this fork) | Dashboard (hard gates) + skill enforcement | Steering docs + DocVault + mem0 | Multi-project, high-governance |

## Prerequisites

The core spec workflow (upstream functionality) works out of the box with just Node.js. The fork's extended features use additional tools:

| Component | Required For | Link |
|-----------|-------------|------|
| [Obsidian](https://github.com/obsidianmd/obsidian-releases) | DocVault knowledge base (living documentation tier) | [obsidian.md](https://obsidian.md) |
| [mem0](https://github.com/mem0ai/mem0) | Cross-session episodic memory (MCP server) | [mem0.ai](https://mem0.ai) |
| [Claude Code](https://claude.ai/claude-code) | CLI agent that consumes the MCP server | [docs](https://docs.anthropic.com/en/docs/claude-code) |

These are optional -- the upstream spec workflow, dashboard, and approval system work without them.

## Quick Start

### As a Claude Code Plugin (recommended)

Clone and symlink:

```bash
git clone https://github.com/lbruton/spec-workflow-mcp.git
cd spec-workflow-mcp
npm install && npm run build

# Symlink into Claude Code plugins
ln -s "$(pwd)" ~/.claude/plugins/marketplaces/specflow-marketplace
```

### As an MCP Server

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@lbruton/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```

### Dashboard

The dashboard runs on port 5051 by default and provides real-time spec tracking, approval workflows, and implementation logs.

```bash
# Start dashboard
npx @lbruton/spec-workflow-mcp@latest --dashboard --port 5051
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
| `review-spec` | Review and provide feedback on a spec |
| `create-steering-doc` | Create project steering documentation |
| `spec-workflow-overview` | Get lifecycle and usage overview |
| `troubleshoot-spec` | Diagnose spec workflow issues |
| `configure-workflow` | Configure workflow settings |

## Architecture

```
src/
  tools/           # MCP tool definitions
  prompts/         # MCP prompt definitions
  core/            # Shared logic (parser, task-parser, path-utils)
  dashboard/       # Dashboard UI server
  types.ts         # Shared TypeScript types
  index.ts         # Server entry point
```

## What This Fork Adds

Pimzino's upstream is a complete, production-ready spec-driven workflow. This fork extends it for a specific use case: a solo developer managing multiple repositories with shared infrastructure. These additions are opinionated and may not suit every setup.

| Area | Upstream Provides | This Fork Adds |
|------|-------------------|----------------|
| Lifecycle | 4-phase workflow with dashboard approvals | Pre-workflow discovery + post-workflow retros |
| Core workflow | Approval gates per phase | Additional validation gates and guard rails |
| Dashboard UI | Real-time dashboard with spec/approval views | UI refinements, collapsible panels, branding, cleanup of project-specific content |
| Knowledge | Steering docs for project context | Keeps steering docs + adds DocVault (Obsidian) and mem0 for cross-session recall |
| Issue tracking | Spec-based task tracking | Vault-based markdown issues with prefixed IDs |
| Versioning | Flexible (user-managed) | Version lock protocol per project type |
| Quick work | Full workflow for all changes | `/gsd`, `/chat` bypass paths for small fixes |
| PR pipeline | Implementation logging | Pre-PR verification + Codacy quality scans |
| Infrastructure | Code-focused | Extensible to container, DNS, and deployment tooling |

This fork is under active development -- more dashboard UI improvements and workflow enhancements are in progress. See [FORK-CHANGELOG.md](FORK-CHANGELOG.md) for a detailed list of changes.

## Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript + build dashboard frontend
npm run dev        # Development mode with hot reload
```

## Upstream Documentation

The original project's documentation remains applicable for core functionality:

- [Configuration Guide](docs/CONFIGURATION.md)
- [User Guide](docs/USER-GUIDE.md)
- [Workflow Process](docs/WORKFLOW.md)
- [Prompting Guide](docs/PROMPTING-GUIDE.md)
- [Tools Reference](docs/TOOLS-REFERENCE.md)

## License

GPL-3.0 -- same as upstream.

## Credits

**[Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp)** is the foundation this fork is built on. Pimzino designed and built the core architecture: the MCP server, the sequential spec workflow, the real-time dashboard with blocking approval gates, the approval storage system, the markdown spec parser, implementation logging, the template engine, multi-language support (11 languages), the VSCode extension, Docker deployment, and the security hardening. This fork adds workflow extensions and integrations on top of that substantial foundation.
