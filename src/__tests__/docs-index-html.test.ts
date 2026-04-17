/**
 * Tests for docs/index.html PR changes:
 * - Rebranding to SessionFlow, ContextFlow, MemFlow naming
 * - tier-4 .tier-label CSS addition
 * - Hero CTA updates
 * - "Five systems" How It Works section
 * - "Four-layer" memory section with named tier labels
 * - ContextFlow code intelligence section
 * - Lifecycle Phase 0 (/start) and Phase 6 (/wrap) additions
 * - Comparison table: removed Taskmaster/Pimzino columns, updated rows
 * - Roadmap split into Shipped / 2.0 in-progress sections
 * - Footer fork attributions
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '../../../docs/index.html');

let html: string;

beforeAll(() => {
  html = readFileSync(HTML_PATH, 'utf-8');
});

// ─── CSS Changes ───────────────────────────────────────────────────────────────

describe('CSS: tier-4 .tier-label styles', () => {
  it('defines .tier-4 .tier-label rule', () => {
    expect(html).toContain('.tier-4 .tier-label {');
  });

  it('sets background to #f59e0b15 for tier-4 label', () => {
    const tier4Block = html.match(/\.tier-4 \.tier-label \{[^}]+\}/s)?.[0] ?? '';
    expect(tier4Block).toContain('background: #f59e0b15');
  });

  it('sets color to var(--amber) for tier-4 label', () => {
    const tier4Block = html.match(/\.tier-4 \.tier-label \{[^}]+\}/s)?.[0] ?? '';
    expect(tier4Block).toContain('color: var(--amber)');
  });

  it('has --amber CSS variable defined in :root', () => {
    expect(html).toContain('--amber: #f59e0b');
  });

  it('tier-1 through tier-4 labels all have distinct colour rules', () => {
    expect(html).toContain('.tier-1 .tier-label {');
    expect(html).toContain('.tier-2 .tier-label {');
    expect(html).toContain('.tier-3 .tier-label {');
    expect(html).toContain('.tier-4 .tier-label {');
  });
});

// ─── Hero Section ──────────────────────────────────────────────────────────────

describe('Hero section', () => {
  it('h1 contains the word "framework"', () => {
    expect(html).toContain('Spec-driven development framework with');
  });

  it('includes SessionFlow CTA link pointing to correct GitHub repo', () => {
    expect(html).toContain('href="https://github.com/lbruton/SessionFlow"');
  });

  it('includes ContextFlow CTA link pointing to correct GitHub repo', () => {
    expect(html).toContain('href="https://github.com/lbruton/claude-context"');
  });

  it('includes MemFlow as a non-linked disabled span in the CTA group', () => {
    expect(html).toContain(
      '<span class="btn btn-secondary" style="opacity: 0.4; cursor: default"> MemFlow </span>'
    );
  });

  it('"See how it works" button is in its own div with margin-top style', () => {
    expect(html).toContain('<div style="margin-top: 12px">');
  });

  it('"See how it works" link still points to #how anchor', () => {
    // The link must reference #how
    expect(html).toContain('href="#how"');
  });

  it('"See how it works" button includes the down-arrow entity', () => {
    // &darr; is the HTML entity for ↓
    expect(html).toContain('See how it works &darr;');
  });
});

// ─── How It Works Section ──────────────────────────────────────────────────────

describe('How It Works section', () => {
  it('heading reads "Five systems, one workflow"', () => {
    expect(html).toContain('<h2>Five systems, one workflow</h2>');
  });

  it('SpecFlow is labelled as Orchestrator, not MCP Server', () => {
    expect(html).toContain('SpecFlow &mdash; Orchestrator');
    expect(html).not.toContain('SpecFlow &mdash; MCP Server');
  });

  it('SessionFlow feature card is present with Session Memory tag', () => {
    expect(html).toContain('SessionFlow &mdash; Session Memory');
  });

  it('SessionFlow card links to mwgreen/claude-code-session-rag', () => {
    expect(html).toContain('https://github.com/mwgreen/claude-code-session-rag');
  });

  it('DocVault card is labelled as Knowledge Base', () => {
    expect(html).toContain('DocVault &mdash; Knowledge Base');
  });

  it('ContextFlow feature card is present with Code Intelligence tag', () => {
    expect(html).toContain('ContextFlow &mdash; Code Intelligence');
  });

  it('ContextFlow card links to zilliztech/claude-context', () => {
    // At least one reference in the How It Works section
    expect(html).toContain('https://github.com/zilliztech/claude-context');
  });

  it('MemFlow feature card is present with Episodic Memory description', () => {
    expect(html).toContain('MemFlow &mdash; Episodic Memory');
  });

  it('description mentions "Five complementary systems"', () => {
    expect(html).toContain(
      'Five\n          complementary systems give AI agents persistent memory'
    );
  });

  it('does not use the old "Four systems" heading anywhere', () => {
    expect(html).not.toContain('Four systems, one workflow');
  });
});

// ─── Memory Section ────────────────────────────────────────────────────────────

describe('Memory section', () => {
  it('heading reads "Four-layer contextual memory"', () => {
    expect(html).toContain('<h2>Four-layer contextual memory</h2>');
  });

  it('does not use the old "Four-tier memory architecture" heading', () => {
    expect(html).not.toContain('Four-tier memory architecture');
  });

  it('tier-1 label is "MemFlow"', () => {
    expect(html).toMatch(/<div class="tier tier-1">[\s\S]*?<div class="tier-label">MemFlow<\/div>/);
  });

  it('tier-2 label is "SessionFlow"', () => {
    expect(html).toMatch(
      /<div class="tier tier-2">[\s\S]*?<div class="tier-label">SessionFlow<\/div>/
    );
  });

  it('tier-3 label is "DocVault"', () => {
    expect(html).toMatch(
      /<div class="tier tier-3">[\s\S]*?<div class="tier-label">DocVault<\/div>/
    );
  });

  it('tier-4 label is "Files"', () => {
    expect(html).toMatch(/<div class="tier tier-4">[\s\S]*?<div class="tier-label">Files<\/div>/);
  });

  it('old numbered tier labels are no longer used', () => {
    expect(html).not.toMatch(/<div class="tier-label">Tier [1-4]<\/div>/);
  });

  it('tier-arrow text describes no fixed hierarchy', () => {
    expect(html).toContain('no fixed hierarchy &mdash; context determines which layer is authoritative');
  });

  it('does not use old conflict-resolution tier-arrow text', () => {
    expect(html).not.toContain('conflict resolution: newest wins, highest tier breaks ties');
  });

  it('MemFlow tier-1 heading mentions curated episodic memory', () => {
    expect(html).toContain('MemFlow <span class="dim">&mdash; Curated episodic memory</span>');
  });

  it('SessionFlow tier-2 heading mentions verbatim session history', () => {
    expect(html).toContain('SessionFlow <span class="dim">&mdash; Verbatim session history</span>');
  });

  it('DocVault tier-3 heading mentions living documentation', () => {
    expect(html).toContain('DocVault <span class="dim">&mdash; Living documentation</span>');
  });

  it('tier-4 content mentions CLAUDE.md and MEMORY.md files', () => {
    expect(html).toContain('CLAUDE.md, MEMORY.md');
  });
});

// ─── Code Intelligence Section ─────────────────────────────────────────────────

describe('Code Intelligence section', () => {
  it('h2 reads "ContextFlow — code intelligence, self-hosted"', () => {
    expect(html).toContain('<h2>ContextFlow &mdash; code intelligence, self-hosted</h2>');
  });

  it('description mentions semantic search and structural analysis', () => {
    expect(html).toContain('ContextFlow combines semantic\n          search (meaning-based) and structural analysis');
  });

  it('Structural Graph — Neo4j feature card is present', () => {
    expect(html).toContain('Structural Graph &mdash; Neo4j');
  });

  it('Complexity Analysis feature card is present', () => {
    expect(html).toContain('Complexity Analysis');
  });

  it('"Unified MCP" roadmap card is present as a dashed border card', () => {
    expect(html).toContain('Roadmap &mdash; Unified MCP');
  });

  it('"Index once, search forever" card heading is present', () => {
    expect(html).toContain('Index once, search forever');
  });

  it('does not use the old "Code intelligence, self-hosted" heading without ContextFlow prefix', () => {
    expect(html).not.toContain('<h2>Code intelligence, self-hosted</h2>');
  });
});

// ─── Lifecycle / Spec Workflow Section ─────────────────────────────────────────

describe('Spec lifecycle section', () => {
  it('Phase 0 is labelled /start', () => {
    expect(html).toMatch(
      /<div class="phase-num dim">Phase 0<\/div>\s*<div class="phase-name">\/start<\/div>/
    );
  });

  it('Phase 6 is labelled /wrap', () => {
    expect(html).toMatch(
      /<div class="phase-num dim">Phase 6<\/div>\s*<div class="phase-name">\/wrap<\/div>/
    );
  });

  it('code-block header reads "Full session lifecycle"', () => {
    expect(html).toContain('Full session lifecycle');
  });

  it('lifecycle code block shows /start command boot output with SessionFlow and MemFlow', () => {
    expect(html).toContain('Boot the session with context from SessionFlow + MemFlow');
    expect(html).toContain('SessionFlow: 12 relevant turns from yesterday');
    expect(html).toContain('MemFlow: 3 retro lessons, 2 pending decisions');
  });

  it('lifecycle code block shows /wrap command with MemFlow output', () => {
    expect(html).toContain('Close session cleanly');
    expect(html).toContain('/wrap');
  });

  it('description mentions /wrap closes session and saves to MemFlow', () => {
    expect(html).toContain('/wrap</code> closes the session and saves everything to MemFlow');
  });

  it('Phase 1 sub-label includes /discover as an alternative', () => {
    // Phase 1 now shows /chat with /discover as a sub-label
    expect(html).toContain('/discover');
  });
});

// ─── Comparison Table ──────────────────────────────────────────────────────────

describe('Comparison table', () => {
  it('table header does NOT include Taskmaster column', () => {
    const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
    expect(theadMatch).not.toContain('Taskmaster');
  });

  it('table header does NOT include Pimzino column', () => {
    const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
    expect(theadMatch).not.toContain('Pimzino');
  });

  it('table header contains exactly the expected 5 tool columns', () => {
    const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
    const thMatches = theadMatch.match(/<th>/g) ?? [];
    // Dimension + SpecKit + BMAD + GSD + mex + SpecFlow = 6 <th> elements
    expect(thMatches).toHaveLength(6);
  });

  it('Memory row reads "4-layer: DocVault + SessionFlow + MemFlow + files"', () => {
    expect(html).toContain('4-layer: DocVault + SessionFlow + MemFlow + files');
  });

  it('does not contain old "4-tier" memory description in table', () => {
    expect(html).not.toContain('4-tier: DocVault');
  });

  it('Session learning row for SpecFlow reads "/start → /audit → /wrap"', () => {
    expect(html).toContain('/start &rarr; /audit &rarr; /wrap');
  });

  it('Code search row for SpecFlow reads "ContextFlow: semantic + structural"', () => {
    expect(html).toContain('ContextFlow: semantic + structural');
  });

  it('Multi-agent row header uses "Multi-agent" (not "Multi-tool")', () => {
    expect(html).toContain('<td>Multi-agent</td>');
    expect(html).not.toContain('<td>Multi-tool</td>');
  });

  it('Multi-agent SpecFlow cell lists Claude + Gemini + Codex + OpenCode', () => {
    expect(html).toContain('Claude + Gemini + Codex + OpenCode');
  });

  it('Drift detection SpecFlow cell reads "/vault-update + /audit"', () => {
    expect(html).toContain('/vault-update + /audit');
  });
});

// ─── Roadmap Section ───────────────────────────────────────────────────────────

describe('Roadmap section', () => {
  it('description mentions "SpecFlow 1.x is stable"', () => {
    expect(html).toContain('SpecFlow 1.x is stable and in daily use');
  });

  it('has a "Shipped" code block header', () => {
    expect(html).toContain('\n            Shipped\n');
  });

  it('has a "SpecFlow 2.0 — in progress" code block header', () => {
    expect(html).toContain('SpecFlow 2.0 &mdash; in progress');
  });

  it('Shipped section lists SessionFlow MCP server', () => {
    expect(html).toContain('SessionFlow MCP server &mdash; real-time session indexing + recall');
  });

  it('Shipped section lists ContextFlow (claude-context fork)', () => {
    expect(html).toContain('ContextFlow (claude-context fork) &mdash; semantic search via Milvus');
  });

  it('Shipped section lists MemFlow via mem0', () => {
    expect(html).toContain('MemFlow via mem0 &mdash; episodic memory, retro learnings');
  });

  it('Shipped section lists multi-agent verification including OpenCode', () => {
    expect(html).toContain(
      'Multi-agent verified &mdash; Claude Code, Gemini CLI, Codex CLI, OpenCode'
    );
  });

  it('2.0 section lists component rebranding as "in progress"', () => {
    expect(html).toContain(
      'Component rebranding &mdash; SessionFlow, ContextFlow, MemFlow naming'
    );
  });

  it('2.0 section lists MemFlow self-hosted fork as planned', () => {
    expect(html).toContain('MemFlow &mdash; self-hosted fork replacing mem0 cloud dependency');
  });

  it('2.0 section lists manifest-driven orchestration as planned', () => {
    expect(html).toContain('Manifest-driven orchestration');
  });

  it('end-state paragraph mentions "fully self-hosted, zero cloud dependencies"', () => {
    expect(html).toContain('fully self-hosted, zero cloud dependencies');
  });

  it('does not use old single "Consolidation roadmap" block header', () => {
    expect(html).not.toContain('Consolidation roadmap');
  });
});

// ─── Stack Section ─────────────────────────────────────────────────────────────

describe('Stack section', () => {
  it('required stack lists SpecFlow, SessionFlow, ContextFlow, DocVault, MemFlow', () => {
    const requiredBlock = html.match(
      /Required &mdash; the framework does not work without these([\s\S]*?)Recommended &mdash;/
    )?.[1] ?? '';
    expect(requiredBlock).toContain('SpecFlow');
    expect(requiredBlock).toContain('SessionFlow');
    expect(requiredBlock).toContain('ContextFlow');
    expect(requiredBlock).toContain('DocVault');
    expect(requiredBlock).toContain('MemFlow');
  });

  it('footer note mentions MemFlow uses mem0 cloud API', () => {
    expect(html).toContain(
      'MemFlow currently uses the mem0\n          cloud API &mdash; self-hosted fork planned'
    );
  });
});

// ─── CTA / Architecture Section ────────────────────────────────────────────────

describe('Architecture / What ships in the box section', () => {
  it('mentions OpenCode as a verified agent', () => {
    expect(html).toContain('OpenCode verified');
  });

  it('description mentions SessionFlow, ContextFlow, DocVault, MemFlow as required components', () => {
    expect(html).toContain(
      'SessionFlow, ContextFlow,\n          DocVault, and MemFlow are'
    );
  });
});

// ─── CTA / Final Call-to-Action Section ────────────────────────────────────────

describe('Final call-to-action section', () => {
  it('includes SessionFlow GitHub link in CTA', () => {
    // Must appear at least once in the final CTA section
    const ctaSection = html.match(/Stop re-explaining your project([\s\S]*?)<\/section>/)?.[0] ?? '';
    expect(ctaSection).toContain('https://github.com/lbruton/SessionFlow');
  });

  it('includes ContextFlow GitHub link in CTA', () => {
    const ctaSection = html.match(/Stop re-explaining your project([\s\S]*?)<\/section>/)?.[0] ?? '';
    expect(ctaSection).toContain('https://github.com/lbruton/claude-context');
  });

  it('does not include "Read the docs" link in the final CTA', () => {
    const ctaSection = html.match(/Stop re-explaining your project([\s\S]*?)<\/section>/)?.[0] ?? '';
    expect(ctaSection).not.toContain('Read the docs');
  });
});

// ─── Footer ────────────────────────────────────────────────────────────────────

describe('Footer', () => {
  it('includes Pimzino/spec-workflow-mcp fork attribution', () => {
    expect(html).toContain('https://github.com/Pimzino/spec-workflow-mcp');
  });

  it('includes zilliztech/claude-context fork attribution', () => {
    expect(html).toContain('https://github.com/zilliztech/claude-context');
  });

  it('includes mwgreen/claude-code-session-rag fork attribution (new)', () => {
    const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[0] ?? '';
    expect(footer).toContain('https://github.com/mwgreen/claude-code-session-rag');
  });

  it('footer uses "Forked from" wording listing all three sources', () => {
    const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[0] ?? '';
    expect(footer).toContain('Forked\n          from');
    expect(footer).toContain('Pimzino/spec-workflow-mcp');
    expect(footer).toContain('zilliztech/claude-context');
    expect(footer).toContain('mwgreen/claude-code-session-rag');
  });
});

// ─── Regression / Boundary Tests ───────────────────────────────────────────────

describe('Regression and boundary checks', () => {
  it('HTML file is non-empty and parses as valid UTF-8', () => {
    expect(html.length).toBeGreaterThan(10000);
    expect(html).toContain('<!doctype html>');
  });

  it('all four CSS layer-colour rules are ordered correctly (tier-1 to tier-4)', () => {
    const tier1Pos = html.indexOf('.tier-1 .tier-label {');
    const tier2Pos = html.indexOf('.tier-2 .tier-label {');
    const tier3Pos = html.indexOf('.tier-3 .tier-label {');
    const tier4Pos = html.indexOf('.tier-4 .tier-label {');
    expect(tier1Pos).toBeLessThan(tier2Pos);
    expect(tier2Pos).toBeLessThan(tier3Pos);
    expect(tier3Pos).toBeLessThan(tier4Pos);
  });

  it('tier-4 .tier-label rule is positioned immediately after tier-3 rule in the stylesheet', () => {
    const tier3End = html.indexOf('}', html.indexOf('.tier-3 .tier-label {'));
    const tier4Start = html.indexOf('.tier-4 .tier-label {');
    // tier-4 rule must come after tier-3 rule ends
    expect(tier4Start).toBeGreaterThan(tier3End);
    // And must be the very next tier rule (no other tier rules in between)
    const betweenRules = html.slice(tier3End, tier4Start);
    expect(betweenRules).not.toMatch(/\.tier-[125] \.tier-label/);
  });

  it('section id="memory" contains all four tier divs', () => {
    const memSection = html.match(/id="memory"([\s\S]*?)<\/section>/)?.[0] ?? '';
    expect(memSection).toContain('class="tier tier-1"');
    expect(memSection).toContain('class="tier tier-2"');
    expect(memSection).toContain('class="tier tier-3"');
    expect(memSection).toContain('class="tier tier-4"');
  });

  it('hero section contains exactly one MemFlow span (not a link)', () => {
    const heroSection = html.match(/<section[^>]*class="hero"[^>]*>([\s\S]*?)<\/section>/)?.[0] ??
      html.match(/<section id="hero"[^>]*>([\s\S]*?)<\/section>/)?.[0] ??
      html.match(/MCP Server Plugin([\s\S]*?)<\/section>/)?.[0] ?? '';
    // MemFlow should appear as a span, not an anchor
    const memflowSpanCount = (heroSection.match(/<span[^>]*>[\s\S]*?MemFlow[\s\S]*?<\/span>/g) ?? []).length;
    expect(memflowSpanCount).toBeGreaterThanOrEqual(1);
    // MemFlow in hero must NOT be inside an <a> tag with an href
    expect(heroSection).not.toMatch(/href="[^"]*MemFlow[^"]*"/);
  });

  it('comparison table does not reference old "session-rag + mem0" description', () => {
    const tableBlock = html.match(/<table class="compare-table">([\s\S]*?)<\/table>/)?.[0] ?? '';
    expect(tableBlock).not.toContain('session-rag');
  });
});