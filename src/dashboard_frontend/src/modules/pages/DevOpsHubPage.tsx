import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../projects/ProjectProvider';

interface HubCard {
  title: string;
  desc: string;
  url: string;
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  /** Navigate to internal route instead of opening external link */
  internalRoute?: string;
}

interface HubSection {
  title: string;
  cards: HubCard[];
}

// ── Per-project hub card configuration ──────────────────────────────
// The key must match the projectName returned by the MCP server.
const projectHubSections: Record<string, HubSection[]> = {
  StakTrakr: [
    {
      title: 'Live Sites',
      cards: [
        {
          title: 'Production',
          desc: 'staktrakr.com — live site served via Cloudflare Pages from main branch.',
          url: 'https://www.staktrakr.com',
          icon: '\u{1F31F}',
          color: 'green',
        },
        {
          title: 'Dev Preview',
          desc: 'dev branch preview — latest merged work before it ships to production.',
          url: 'https://beta.staktrakr.com',
          icon: '\u{1F527}',
          color: 'yellow',
        },
        {
          title: 'API Health',
          desc: 'Market prices, spot prices, and Goldback feed status.',
          url: 'https://api.staktrakr.com/data/api/manifest.json',
          icon: '\u{2764}\u{FE0F}',
          color: 'blue',
        },
      ],
    },
    {
      title: 'Dashboards',
      cards: [
        {
          title: 'API Dashboard',
          desc: 'System stats, service status, scrape runs, and live log tail for both pollers.',
          url: 'https://polldash.lbruton.cc',
          icon: '\u{1F3E0}',
          color: 'blue',
          internalRoute: '/devops/api-dashboard',
        },
        {
          title: 'Grafana Drilldown',
          desc: 'Home poller Prometheus metrics — scrape stats, uptime, network, and poller health.',
          url: 'https://grafana.lbruton.cc/a/grafana-metricsdrilldown-app/drilldown',
          icon: '\u{1F4C8}',
          color: 'green',
        },
        {
          title: 'StakTrakr Wiki',
          desc: 'Infrastructure runbooks, frontend patterns, and pipeline docs — in-repo Docsify wiki on Cloudflare Pages.',
          url: 'https://beta.staktrakr.com/wiki/',
          icon: '\u{1F4D6}',
          color: 'yellow',
          internalRoute: '/devops/wiki',
        },
        {
          title: 'Playwright Dashboard',
          desc: 'Smoke test videos, screenshots, and run results from browserless Docker.',
          url: 'file:///Volumes/DATA/GitHub/StakTrakr/devops/playwright-dash/index.html',
          icon: '\u{1F3AD}',
          color: 'green',
        },
        {
          title: 'Claude Code Insights',
          desc: 'Weekly usage analysis — sessions, friction patterns, tool usage, and workflow recommendations.',
          url: 'file:///Users/lbruton/.claude/usage-data/report.html',
          icon: '\u{1F4CA}',
          color: 'yellow',
        },
        {
          title: 'JSDoc Reference',
          desc: 'Auto-generated API docs for all StakTrakr JavaScript modules.',
          url: 'file:///Volumes/DATA/GitHub/StakTrakr/devops/docs/index.html',
          icon: '\u{1F4DA}',
          color: 'blue',
        },
      ],
    },
    {
      title: 'Local Services',
      cards: [
        {
          title: 'Infisical',
          desc: 'Self-hosted secrets manager on Proxmox. API keys, tokens, and environment variables.',
          url: 'https://infisical.lbruton.cc',
          icon: '\u{1F510}',
          color: 'red',
        },
        {
          title: 'Playwright Live',
          desc: 'Live server with auto-refresh during test runs. Run npm run dash to start.',
          url: 'http://localhost:8766',
          icon: '\u{1F3AD}',
          color: 'green',
        },
        {
          title: 'Browserless Debugger',
          desc: 'Self-hosted Chromium DevTools — inspect live Playwright sessions.',
          url: 'http://localhost:3000/debugger/?token=local_dev_token',
          icon: '\u{1F310}',
          color: 'purple',
        },
        {
          title: 'Local App Server',
          desc: 'StakTrakr served locally for smoke tests. Run npx http-server . -p 8765 from project root.',
          url: 'http://localhost:8765',
          icon: '\u{26A1}',
          color: 'green',
        },
      ],
    },
    {
      title: 'External Tools',
      cards: [
        {
          title: 'mem0',
          desc: 'Cloud episodic memory — session insights, handoffs, and project knowledge.',
          url: 'https://app.mem0.ai/dashboard',
          icon: '\u{1F9E0}',
          color: 'purple',
        },
        {
          title: 'Fly.io Dashboard',
          desc: 'Backend app management — deployments, logs, scaling, and billing.',
          url: 'https://fly.io/dashboard',
          icon: '\u{1F680}',
          color: 'blue',
        },
        {
          title: 'Fly Metrics',
          desc: 'Grafana metrics for the staktrakr Fly.io app — CPU, memory, requests.',
          url: 'https://fly-metrics.net/d/fly-app/fly-app?orgId=1494924&var-app=staktrakr',
          icon: '\u{1F4C8}',
          color: 'yellow',
        },
        {
          title: 'GitHub Issues',
          desc: 'User-facing issue tracking for StakTrakr (vault issues synced to GitHub).',
          url: 'https://github.com/lbruton/StakTrakr/issues',
          icon: '\u{1F4CB}',
          color: 'blue',
        },
        {
          title: 'Codacy',
          desc: 'Static analysis and code quality gate for PRs.',
          url: 'https://app.codacy.com',
          icon: '\u{1F50D}',
          color: 'yellow',
        },
        {
          title: 'Browserbase',
          desc: 'Cloud Stagehand session recordings for the StakTrakr org. Paid — use sparingly.',
          url: 'https://www.browserbase.com/orgs/staktrakr/39c91942-2925-4b85-ac2c-61d35127a10a/overview',
          icon: '\u{2601}\u{FE0F}',
          color: 'green',
        },
      ],
    },
  ],
  HelloKittyFriends: [
    {
      title: 'App',
      cards: [
        {
          title: 'My Melody Chat',
          desc: 'Local Docker instance — My Melody companion chat app (HTTP).',
          url: 'http://localhost:3030',
          icon: '\u{1F430}',
          color: 'purple',
        },
        {
          title: 'My Melody Chat (HTTPS)',
          desc: 'Local Docker instance — HTTPS endpoint for PWA install testing.',
          url: 'https://localhost:3031',
          icon: '\u{1F512}',
          color: 'green',
        },
      ],
    },
    {
      title: 'Documentation',
      cards: [
        {
          title: 'HelloKittyFriends Wiki',
          desc: 'Technical docs — architecture, API reference, Gemini, mem0, character guide via Docsify.',
          url: 'http://127.0.0.1:9778',
          icon: '\u{1F4D6}',
          color: 'yellow',
          internalRoute: '/devops/hkf-wiki',
        },
      ],
    },
    {
      title: 'External Tools',
      cards: [
        {
          title: 'mem0',
          desc: 'Cloud episodic memory — dual-track (user + agent) persistent memory.',
          url: 'https://app.mem0.ai/dashboard',
          icon: '\u{1F9E0}',
          color: 'purple',
        },
        {
          title: 'GitHub Issues',
          desc: 'User-facing issue tracking for HelloKittyFriends (vault issues synced to GitHub).',
          url: 'https://github.com/lbruton/HelloKittyFriends/issues',
          icon: '\u{1F4CB}',
          color: 'blue',
        },
        {
          title: 'Codacy',
          desc: 'Static analysis and code quality gate for PRs.',
          url: 'https://app.codacy.com',
          icon: '\u{1F50D}',
          color: 'yellow',
        },
        {
          title: 'Infisical',
          desc: 'Self-hosted secrets manager — API keys for Gemini, mem0, and Brave.',
          url: 'https://infisical.lbruton.cc',
          icon: '\u{1F510}',
          color: 'red',
        },
      ],
    },
  ],
};

// Fallback sections when no project-specific config exists
const defaultSections: HubSection[] = [
  {
    title: 'External Tools',
    cards: [
      {
        title: 'mem0',
        desc: 'Cloud episodic memory — session insights, handoffs, and project knowledge.',
        url: 'https://app.mem0.ai/dashboard',
        icon: '\u{1F9E0}',
        color: 'purple',
      },
      {
        title: 'GitHub Issues',
        desc: 'User-facing issue tracking (vault issues synced to GitHub when scope: user-facing).',
        url: 'https://github.com',
        icon: '\u{1F4CB}',
        color: 'blue',
      },
      {
        title: 'Codacy',
        desc: 'Static analysis and code quality gate for PRs.',
        url: 'https://app.codacy.com',
        icon: '\u{1F50D}',
        color: 'yellow',
      },
      {
        title: 'Infisical',
        desc: 'Self-hosted secrets manager on Proxmox.',
        url: 'http://192.168.1.47:8080',
        icon: '\u{1F510}',
        color: 'red',
      },
    ],
  },
];

const colorMap: Record<string, string> = {
  blue: 'rgba(59,130,246,0.12)',
  green: 'rgba(34,197,94,0.12)',
  yellow: 'rgba(245,158,11,0.12)',
  red: 'rgba(239,68,68,0.12)',
  purple: 'rgba(167,139,250,0.12)',
};

interface ApiHealthStatus {
  marketOk: boolean | null;
  spotOk: boolean | null;
  goldbackOk: boolean | null;
  marketAge: string;
  spotAge: string;
  goldbackAge: string;
}

function timeAgo(timestamp: string): string {
  if (!timestamp) return 'unknown';
  const ageMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(ageMs / (1000 * 60));
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function useApiHealth(): ApiHealthStatus {
  const [status, setStatus] = useState<ApiHealthStatus>({
    marketOk: null, spotOk: null, goldbackOk: null,
    marketAge: 'checking...', spotAge: 'checking...', goldbackAge: 'checking...',
  });

  useEffect(() => {
    const base = 'https://api.staktrakr.com/data';
    const MARKET_STALE = 30;
    const SPOT_STALE = 20;
    const GOLDBACK_STALE = 25 * 60;

    function hourlyUrl(offset: number) {
      const d = new Date(Date.now() - offset * 3600000);
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dy = String(d.getUTCDate()).padStart(2, '0');
      const hr = String(d.getUTCHours()).padStart(2, '0');
      return `${base}/hourly/${y}/${mo}/${dy}/${hr}.json`;
    }

    (async () => {
      const next: ApiHealthStatus = { ...status };

      // Market prices
      try {
        const res = await fetch(`${base}/api/manifest.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const ageMin = Math.floor((Date.now() - new Date(data.generated_at).getTime()) / 60000);
        next.marketOk = ageMin <= MARKET_STALE;
        next.marketAge = timeAgo(data.generated_at);
      } catch {
        next.marketOk = false;
        next.marketAge = 'unreachable';
      }

      // Spot prices
      try {
        let spotRes = await fetch(hourlyUrl(0), { cache: 'no-store' });
        if (!spotRes.ok) spotRes = await fetch(hourlyUrl(1), { cache: 'no-store' });
        if (!spotRes.ok) throw new Error(`HTTP ${spotRes.status}`);
        const entries = await spotRes.json();
        const last = entries[entries.length - 1];
        const ageMin = Math.floor((Date.now() - new Date(last?.timestamp).getTime()) / 60000);
        next.spotOk = ageMin <= SPOT_STALE;
        next.spotAge = timeAgo(last?.timestamp);
      } catch {
        next.spotOk = false;
        next.spotAge = 'unreachable';
      }

      // Goldback
      try {
        const res = await fetch(`${base}/api/goldback-spot.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const ageMin = Math.floor((Date.now() - new Date(data.scraped_at).getTime()) / 60000);
        next.goldbackOk = ageMin <= GOLDBACK_STALE;
        next.goldbackAge = timeAgo(data.scraped_at);
      } catch {
        next.goldbackOk = false;
        next.goldbackAge = 'unreachable';
      }

      setStatus(next);
    })();
  }, []);

  return status;
}

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="inline-block w-2 h-2 rounded-full bg-gray-500 animate-pulse" />;
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-amber-500'}`} />;
}

export function DevOpsHubPage() {
  const navigate = useNavigate();
  const health = useApiHealth();
  const { currentProject } = useProjects();

  const handleCardClick = (card: HubCard) => {
    if (card.internalRoute) {
      navigate(card.internalRoute);
    } else {
      window.open(card.url, '_blank', 'noopener,noreferrer');
    }
  };

  const projectName = currentProject?.projectName || 'Project';
  const sections = (currentProject?.projectName && projectHubSections[currentProject.projectName]) || defaultSections;

  return (
    <div className="-mx-6 -my-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-default)] bg-[var(--surface-inset)]">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">{projectName} DevOps Hub</h1>
            <p className="text-xs text-[var(--text-muted)]">Tools, dashboards, and services for {projectName}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {section.cards.map((card) => {
                const isApiHealth = card.title === 'API Health' && currentProject?.projectName === 'StakTrakr';
                return (
                  <button
                    key={card.title}
                    onClick={() => handleCardClick(card)}
                    className="text-left bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-sky-500/50 hover:-translate-y-0.5 hover:bg-[var(--surface-hover)] group"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: colorMap[card.color] }}
                    >
                      {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[var(--text-primary)]">{card.title}</span>
                        {card.internalRoute && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">embed</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{card.desc}</p>
                      {isApiHealth && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <StatusDot ok={health.marketOk} /> Market: {health.marketAge}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <StatusDot ok={health.spotOk} /> Spot: {health.spotAge}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <StatusDot ok={health.goldbackOk} /> Goldback: {health.goldbackAge}
                          </div>
                        </div>
                      )}
                      <div className="text-[11px] text-sky-400/70 mt-1.5 font-mono truncate">
                        {card.internalRoute ? 'Embedded' : card.url.startsWith('file://') ? 'Local file' : (() => { try { return new URL(card.url).host; } catch { return card.url; } })()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
