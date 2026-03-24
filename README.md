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

**SpecFlow** is a fork of [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) that extends the original MCP server with a full development lifecycle, multi-project orchestration, and infrastructure-aware workflows.

> If you're looking for the original project, please visit [Pimzino's repo](https://github.com/Pimzino/spec-workflow-mcp) and give it a star -- SpecFlow wouldn't exist without it.

## What is SpecFlow?

An MCP (Model Context Protocol) server that enforces structured spec-driven development through Claude Code. Instead of letting AI agents write code ad-hoc, SpecFlow gates every change through a lifecycle:

```
Chat -> Issue -> Discover -> Spec (Requirements -> Design -> Tasks) -> Implement -> Retro
```

Each phase transition requires human approval through a real-time web dashboard. No phase can be skipped. The AI proposes, the human approves.

## What Makes This Fork Different

### 1. Infrastructure-Aware

Not just code. The system deploys containers via Portainer, manages DNS via Cloudflare, provisions VMs on Proxmox, stores secrets in Infisical, and routes traffic through NPM. The AI knows the full stack -- from `git commit` to production traffic flow.

### 2. Living Documentation

Three-tier knowledge hierarchy: DocVault (Obsidian vault) for architecture, mem0 for cross-session episodic memory, and in-repo CLAUDE.md files for gate enforcement. Documentation is read before every architectural decision and updated after every implementation.

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
| **Pimzino** (upstream) | Dashboard (blocking) | Steering docs (static) | Teams wanting audit trail |
| **SpecFlow** (this fork) | Dashboard (hard gates) + skill enforcement | DocVault + mem0 (semantic) | Multi-project, high-governance |

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

## Extensions Over Upstream

| Feature | Upstream | This Fork |
|---------|----------|-----------|
| Phases | 4 (Req -> Design -> Tasks -> Impl) | 8+ (Chat -> Discover -> ... -> Retro) |
| Memory | Steering docs (static) | DocVault + mem0 (semantic recall) |
| Issue tracking | None | Vault-based markdown issues |
| Versioning | Not addressed | Version lock protocol per project |
| Casual path | None | `/gsd`, `/chat` for quick work |
| PR gates | None | Pre-PR verification, Codacy scans |
| Infrastructure | None | Portainer, Proxmox, NPM, Fly.io |

See [FORK-CHANGELOG.md](FORK-CHANGELOG.md) for a detailed list of changes.

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

Built on [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp). The dashboard, approval system, and core MCP architecture are Pimzino's work. This fork extends it with lifecycle governance, multi-project orchestration, and infrastructure awareness.
