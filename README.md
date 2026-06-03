# kathir-ks.github.io

Personal site for [Kathir K S](https://kathir-ks.github.io). A live "portfolio OS":
a single-file static page on GitHub Pages, backed by three Cloudflare Workers and an
R2 bucket. An AI chat (provider-agnostic) and an MCP server expose the same data to
LLM agents.

```
kathir-ks.github.io/
├── index.html              ← served at https://kathir-ks.github.io/
├── workers/
│   ├── api/                ← REST API consumed by index.html
│   ├── agents/             ← cron-triggered data refreshers
│   ├── mcp/                ← MCP server for LLM agents
│   └── lib/                ← shared: llm.js, prompts.js, refresh.js
└── .github/workflows/      ← auto-deploy Pages + Workers on push
```

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

Take note of each worker's `*.workers.dev` URL.

### 4. Wire the frontend to the API

Open `index.html` and replace `YOUR-SUBDOMAIN` in:

```js
const API = (window.__KATHIR_OS_API__ || 'https://kathir-os-api.YOUR-SUBDOMAIN.workers.dev');
```

Push to `main`. GH Pages picks up the change via the workflow.

### 5. Hook GH Actions for auto-deploy (optional)

Add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Workers redeploy
on push to `workers/**`.

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
feed/github.json          GitHub events (refreshGitHub)
feed/hf.json              HuggingFace stats (refreshHuggingFace)
feed/status.json          Current focus
feed/papers.json          Daily arXiv picks
logs/YYYY-MM-DD.md        Manual log entries (priority)
logs/digest-YYYY-MM-DD.md Auto-generated digests
meta/visitor-questions.json  Anonymized /ask log
meta/asks-YYYY-MM-DD.json    Daily quota counter
```

## API surface

| Method | Path | Auth |
|---|---|---|
| GET | `/feed` | public |
| GET | `/status` | public |
| GET | `/logs` | public |
| GET | `/logs/:date` | public |
| GET | `/papers` | public |
| POST | `/ask` | public, daily-capped |
| POST | `/refresh` | `Authorization: Bearer <ADMIN_TOKEN>` |

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

## Free-tier headroom

| Service | Limit | Expected use |
|---|---|---|
| Cloudflare Workers | 100k req/day | ~3k/day at moderate traffic |
| R2 | 10 GB + 10M reads/mo | well under |
| Gemini Flash | ~1500 RPD | digest + papers + chat (capped via `DAILY_ASK_LIMIT`) |
| GitHub API | 5000/hr | ~200/day |
