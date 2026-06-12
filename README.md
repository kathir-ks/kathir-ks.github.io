# kathir-ks.github.io

Personal site for [Kathir K S](https://kathir-ks.github.io) — **Kathir OS v3**, a live
"portfolio OS" rendered as a scroll-driven three.js world. Static GitHub Pages frontend,
backed by three Cloudflare Workers and an R2 bucket, bridged (outbound-only) to a private
GCP VM running [jarvis](https://github.com/kathir-ks/jarvis) and
[epistemic-feed](https://github.com/kathir-ks/epistemic-feed).

```
kathir-ks.github.io/
├── index.html              ← served at https://kathir-ks.github.io/
├── assets/
│   ├── css/main.css
│   └── js/                 ← scene.js (3D world), ui.js, terminal.js, data.js
├── workers/
│   ├── api/                ← REST API consumed by the frontend
│   ├── agents/             ← cron-triggered data refreshers
│   ├── mcp/                ← MCP server for LLM agents
│   └── lib/                ← shared: llm.js, prompts.js, refresh.js, posts.js
├── tools/
│   ├── kos                 ← CLI: publish thoughts, run jarvis tasks, sync epistemic
│   ├── kos-bridge.py       ← VM daemon: jarvis heartbeat + epistemic graph sync
│   └── kos-bridge.service  ← systemd user unit for the bridge
└── .github/workflows/      ← auto-deploy Pages + Workers on push
```

## v3 features

- **Scroll-driven 3D world** — one continuous three.js scene; the camera flies between
  8 "stations" (nebula → data streams → drifting thoughts → TPU pod → knowledge graph →
  research helix → jarvis radar → glyph rain). Degrades gracefully: reduced particle
  counts on mobile, autonomous motion off under `prefers-reduced-motion`, flat fallback
  without WebGL.
- **Thoughts with public changelogs** — quick notes/blogs stored in R2 with full
  revision history; every edit requires a changelog note, and visitors can read diffs
  between versions. Publish from the VM: `kos post draft.md`, revise with
  `kos edit <slug> draft.md --note "what changed"`.
- **Jarvis, display-only** — `kos-bridge` pushes a heartbeat + real task log from the
  local jarvis instance; the site shows live online/offline state and recent tasks.
  No inbound path to the VM exists; visitors cannot submit tasks.
- **Epistemic knowledge graph** — the bridge exports a curated topic graph +
  "currently exploring" list from epistemic-feed; the graph renders as the interactive
  3D centerpiece (sample data until the first sync).

## Quick deploy

### 1. R2 bucket

```sh
wrangler r2 bucket create kathir-os
```

### 2. Secrets — set once per worker dir

```sh
cd workers/api
wrangler secret put GEMINI_KEY      # or OPENAI_KEY / ANTHROPIC_KEY
wrangler secret put GITHUB_TOKEN
wrangler secret put ADMIN_TOKEN

cd ../agents
wrangler secret put GEMINI_KEY
wrangler secret put GITHUB_TOKEN

cd ../mcp
wrangler secret put GEMINI_KEY
```

### 3. Deploy

```sh
(cd workers/api    && wrangler deploy)
(cd workers/agents && wrangler deploy)
(cd workers/mcp    && wrangler deploy)
```

### 4. VM bridge (jarvis + epistemic-feed)

On the machine running jarvis / epistemic-feed:

```sh
mkdir -p ~/.kos && cat > ~/.kos/config.json <<'EOF'
{ "KATHIR_OS_ADMIN_TOKEN": "<same ADMIN_TOKEN as the api worker>",
  "JARVIS_AGENT_ID": "<agent id>" }
EOF
chmod 600 ~/.kos/config.json
mkdir -p ~/.config/systemd/user
cp tools/kos-bridge.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now kos-bridge
```

The bridge is outbound-only: it polls local services and POSTs to the Worker. Nothing
on the VM is exposed to the internet.

### 5. Publish a thought

```sh
export KATHIR_OS_ADMIN_TOKEN=...   # or rely on ~/.kos/config.json
tools/kos post note.md --kind thought
tools/kos edit <slug> note.md --note "tightened the argument"
tools/kos list
```

## LLM provider

Set `LLM_PROVIDER` in each worker's `wrangler.toml` and put the matching secret:

| `LLM_PROVIDER` | Secret needed | Optional config |
|---|---|---|
| `gemini` (default) | `GEMINI_KEY` | `GEMINI_MODEL` |
| `openai` | `OPENAI_KEY` | `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| `anthropic` | `ANTHROPIC_KEY` | `ANTHROPIC_MODEL` |

`openai` covers any OpenAI-compatible endpoint — Groq, OpenRouter, vLLM, Ollama, or a
self-hosted gateway — just set `OPENAI_BASE_URL` and `OPENAI_MODEL`.

## R2 layout

```
feed/github.json            GitHub events (refreshGitHub)
feed/hf.json                HuggingFace stats (refreshHuggingFace)
feed/status.json            Current focus
feed/papers.json            Daily arXiv picks
logs/YYYY-MM-DD.md          Manual log entries (priority)
logs/digest-YYYY-MM-DD.md   Auto-generated digests
posts/_index.json           Thoughts index
posts/<slug>.json           Thought + full revision history
jarvis/state.json           Bridge heartbeat + task log
epistemic/graph.json        Knowledge graph export (nodes/edges)
epistemic/learning.json     "Currently exploring" items
meta/visitor-questions.json Anonymized /ask log
meta/asks-YYYY-MM-DD.json   Daily quota counter
```

## API surface

| Method | Path | Auth |
|---|---|---|
| GET | `/feed`, `/status`, `/logs`, `/logs/:date`, `/papers` | public |
| POST | `/ask` | public, daily-capped |
| GET | `/posts`, `/posts/:slug`, `/posts/:slug/history` | public |
| POST/PUT/DELETE | `/posts`, `/posts/:slug` | admin |
| GET | `/jarvis` | public |
| POST | `/jarvis/sync` | admin |
| GET | `/epistemic/graph`, `/epistemic/learning` | public |
| POST | `/epistemic/sync` | admin |
| POST | `/refresh` | admin |

admin = `Authorization: Bearer <ADMIN_TOKEN>`.

## MCP server

`https://kathir-os-mcp.<your-subdomain>.workers.dev/mcp`

Add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kathir-os": {
      "url": "https://kathir-os-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

Tools: `get_status`, `get_activity`, `get_logs`, `get_papers`, `ask_about_kathir`.

## Cron schedule (agents worker)

| Cron | Job |
|---|---|
| `*/15 * * * *` | GitHub + HF activity sync |
| `0 * * * *` | Hourly GitHub-only refresh |
| `0 6 * * *` | Daily digest (yesterday → log) |
| `0 7 * * *` | arXiv paper monitor |

Plus, from the VM via `kos-bridge`: jarvis heartbeat every minute, epistemic graph sync ~12h.

## Free-tier headroom

| Service | Limit | Expected use |
|---|---|---|
| Cloudflare Workers | 100k req/day | ~5k/day at moderate traffic |
| R2 | 10 GB + 10M reads/mo | well under |
| Gemini Flash | ~1500 RPD | digest + papers + chat (capped via `DAILY_ASK_LIMIT`) |
| GitHub API | 5000/hr | ~200/day |
