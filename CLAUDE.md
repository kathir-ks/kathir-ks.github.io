# CLAUDE.md

Guidance for Claude Code (and other coding agents) working in this repository.

## What this is

**Kathir OS v3** — personal site at https://kathir-ks.github.io rendered as a
scroll-driven three.js world. Static GitHub Pages frontend (no build step), three
Cloudflare Workers + an R2 bucket as the backend, and an outbound-only bridge from a
private GCP VM running [jarvis](https://github.com/kathir-ks/jarvis) and
[epistemic-feed](https://github.com/kathir-ks/epistemic-feed).

```
index.html                  single page; 8 [data-station] sections + module bootstrap
assets/js/
  scene.js                  the 3D world: camera path, 8 station builders, force graph
  ui.js                     DOM rendering: feeds, thought cards/modal, jarvis panel
  terminal.js               2D terminal overlay (thoughts/read/changelog/jarvis/learning)
  data.js                   API client, markdown renderer, LCS line diff
assets/css/main.css         translucent panels over the fixed #scene canvas
workers/
  api/                      REST API (public reads + Bearer-auth admin writes)
  agents/                   cron refreshers (GitHub, HF, digest, arXiv)
  mcp/                      MCP server for LLM agents
  lib/                      shared modules — posts.js is the thoughts/revisions store
tools/
  kos                       CLI: publish/edit thoughts, run jarvis tasks, sync epistemic
  kos-bridge.py             VM daemon: jarvis heartbeat (60s) + epistemic sync (~12h)
  kos-bridge.service        systemd user unit for the bridge
.github/workflows/          deploy-pages.yml (Pages) + worker deploy workflows
```

## Hard invariants

- **Station count must match.** The `[data-station]` sections in `index.html` and
  `STATION_POS` in `assets/js/scene.js` are parallel arrays (currently 8, in order:
  hero, live, thoughts, projects, graph, research, agents, contact). Adding/removing/
  reordering a section requires updating both.
- **No build step.** Frontend is plain ES modules; three.js 0.169.0 comes from the
  jsdelivr importmap in `index.html`. Don't introduce a bundler or npm deps.
- **Escape-first markdown.** `renderMarkdown` in `data.js` HTML-escapes input *before*
  applying formatting. Any change to it must preserve XSS safety (post bodies are
  admin-authored but rendered for all visitors).
- **No secrets in the repo.** It's public. Worker secrets go through
  `wrangler secret put` (GEMINI_KEY / GITHUB_TOKEN / ADMIN_TOKEN); the VM keeps its
  copy in `~/.kos/config.json` (chmod 600). `.env.example` is documentation only.
- **Graceful degradation paths must survive changes:** `body.no-webgl` flat fallback,
  `prefers-reduced-motion` (no autonomous motion/parallax), mobile quality factor,
  sample knowledge graph when epistemic data hasn't synced, jarvis "offline" state.

## Data model (R2 bucket `kathir-os`)

- `posts/_index.json` — list of `{slug,title,kind,created,updated,revCount,preview}`
- `posts/<slug>.json` — full post; `revisions: [{ts,note,body}]` oldest→newest; every
  edit **requires a changelog `note`**; revisions capped at 50, body at 60k chars
- `jarvis/state.json` — bridge heartbeat + task log (online = lastSeen < 3 min)
- `epistemic/graph.json` / `epistemic/learning.json` — capped at 500 nodes / 2000
  edges / 10 learning items (enforced server-side in `workers/api/index.js`)
- `feed/*`, `logs/*`, `meta/*` — v2 activity/log/ask data (agents worker)

## API surface (workers/api)

Public GET: `/feed /status /logs /logs/:date /papers /posts /posts/:slug
/posts/:slug/history /jarvis /epistemic/graph /epistemic/learning`; public POST `/ask`
(daily-capped). Admin (`Authorization: Bearer <ADMIN_TOKEN>` via `withAdmin`):
posts POST/PUT/DELETE, `/jarvis/sync`, `/epistemic/sync`, `/refresh`.

## Commands

```sh
# deploy workers (CLOUDFLARE_API_TOKEN is in ~/.bashrc on the dev VM)
(cd workers/api && wrangler deploy)        # repeat for agents/, mcp/

# syntax-check worker/frontend modules (node can't --check ESM .js directly)
cp assets/js/data.js /tmp/check.mjs && node --check /tmp/check.mjs

# publish / edit a thought (reads token from env or ~/.kos/config.json)
tools/kos post note.md --kind thought
tools/kos edit <slug> note.md --note "what changed"

# VM bridge
systemctl --user status kos-bridge
```

Pages auto-deploys on push to `main` when `index.html`, `assets/**`, or the workflow
itself changes — **if you add a new top-level static dir, add it to the `paths:` list
in `.github/workflows/deploy-pages.yml`** or it will never deploy.

## Testing

No test framework is set up. Verify changes with `node --check` (via `.mjs` copy) and
ad-hoc node scripts — `workers/lib/posts.js` is testable against a tiny in-memory R2
mock (`get/put/delete/list` returning objects with `.json()`/`.text()`). The 3D scene
can only be verified in a real browser.

## Git rules

- Never modify git config; if identity is needed, use inline flags:
  `git -c user.email=... -c user.name=... commit ...`
- Never commit, and never push, unless explicitly asked.
