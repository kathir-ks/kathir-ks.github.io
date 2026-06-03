/**
 * Kathir OS — MCP Server Worker
 *
 * JSON-RPC 2.0 over POST /mcp. Compatible with Claude Desktop, Claude Code,
 * and any MCP client.
 *
 * Tools:
 *   - get_status       → current focus
 *   - get_activity     → recent GitHub + HF activity
 *   - get_logs         → recent dev log entries (list with `date`; single entry without)
 *   - get_papers       → curated arXiv picks
 *   - ask_about_kathir → AI answer via the configured LLM provider
 *
 * Env: R2, LLM_PROVIDER + provider key.
 */

import { chat } from "../lib/llm.js";
import { MCP_SYSTEM_PROMPT } from "../lib/prompts.js";
import { mergedActivity } from "../lib/refresh.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/mcp" || url.pathname === "/") return handleMCP(request, env);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "kathir-os-mcp" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    return new Response("Kathir OS MCP Server", { status: 200, headers: CORS });
  },
};

async function handleMCP(request, env) {
  if (request.method !== "POST") {
    return jsonResp(MCP_MANIFEST);
  }

  let body;
  try { body = await request.json(); } catch {
    return mcpError(-32700, "Parse error");
  }

  const { method, params, id } = body;

  switch (method) {
    case "initialize":
      return mcpOk(id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "kathir-os", version: "1.1.0" },
      });
    case "tools/list":
      return mcpOk(id, { tools: TOOLS });
    case "tools/call":
      return callTool(id, params?.name, params?.arguments || {}, env);
    case "notifications/initialized":
      return new Response(null, { status: 204, headers: CORS });
    default:
      return mcpError(-32601, `Method not found: ${method}`, id);
  }
}

// ── Tool definitions ──────────────────────────────────────────
const TOOLS = [
  {
    name: "get_status",
    description: "Get what Kathir K S is currently working on — his real-time focus and latest activity.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_activity",
    description: "Get Kathir's recent GitHub commits and HuggingFace dataset/model activity.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of events to return (max 20)", default: 10 },
      },
    },
  },
  {
    name: "get_logs",
    description: "List recent dev log entries by date, or fetch a single entry by date (YYYY-MM-DD).",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD. Omit to list latest 10." },
      },
    },
  },
  {
    name: "get_papers",
    description: "Get today's curated arXiv papers relevant to Kathir's research interests.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ask_about_kathir",
    description: "Ask any question about Kathir K S — his work, research, background, projects, or opinions.",
    inputSchema: {
      type: "object",
      required: ["question"],
      properties: {
        question: { type: "string", description: "Your question about Kathir." },
      },
    },
  },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function callTool(id, name, args, env) {
  try {
    switch (name) {
      case "get_status": {
        const obj = await env.R2.get("feed/status.json");
        const status = obj ? await obj.json() : { text: "Building something.", updated: null };
        return mcpOk(id, {
          content: [{
            type: "text",
            text: `**Current focus:** ${status.text}\n**Repo:** ${status.repo || "—"}\n**Updated:** ${status.updated ? new Date(status.updated).toLocaleString() : "unknown"}`,
          }],
        });
      }

      case "get_activity": {
        const limit = Math.min(args.limit || 10, 20);
        const all = await mergedActivity(env);
        const items = all.slice(0, limit);
        const text = items.map(i =>
          `[${i.source}] ${i.message} (${i.repo || "—"}) — ${safeDate(i.ts)}`
        ).join("\n");
        return mcpOk(id, { content: [{ type: "text", text: text || "No activity found." }] });
      }

      case "get_logs": {
        if (args.date) {
          if (!DATE_RE.test(args.date)) {
            return mcpError(-32602, "Invalid date format (expected YYYY-MM-DD)", id);
          }
          // Try manual log first, then digest fallback
          const obj = await env.R2.get(`logs/${args.date}.md`)
            || await env.R2.get(`logs/digest-${args.date}.md`);
          if (!obj) return mcpOk(id, { content: [{ type: "text", text: `No log found for ${args.date}.` }] });
          return mcpOk(id, { content: [{ type: "text", text: await obj.text() }] });
        }

        // Listing only — don't dump full text
        const list = await env.R2.list({ prefix: "logs/" });
        const latest = list.objects
          .filter(o => o.key.endsWith(".md"))
          .sort((a, b) => b.key.localeCompare(a.key))
          .slice(0, 10)
          .map(o => {
            const date = o.key.replace("logs/", "").replace(".md", "");
            const kind = date.startsWith("digest-") ? "digest" : "manual";
            return `- ${date}  (${kind}, ${o.size} bytes)`;
          })
          .join("\n");

        const text = latest
          ? `Recent log entries (call get_logs with date=YYYY-MM-DD for full text):\n${latest}`
          : "No logs found.";
        return mcpOk(id, { content: [{ type: "text", text }] });
      }

      case "get_papers": {
        const obj = await env.R2.get("feed/papers.json");
        const papers = obj ? await obj.json() : [];
        if (!papers.length) {
          return mcpOk(id, { content: [{ type: "text", text: "No papers fetched yet." }] });
        }
        const text = papers.map((p, i) =>
          `${i + 1}. **${p.title}**\n   Why relevant: ${p.why}\n   URL: ${p.url}`
        ).join("\n\n");
        return mcpOk(id, { content: [{ type: "text", text }] });
      }

      case "ask_about_kathir": {
        if (!args.question) return mcpError(-32602, "Missing required argument: question", id);
        try {
          const { text } = await chat(env, {
            system: MCP_SYSTEM_PROMPT,
            messages: [{ role: "user", content: args.question }],
            maxTokens: 512,
            temperature: 0.6,
          });
          return mcpOk(id, { content: [{ type: "text", text: text || "Unable to answer." }] });
        } catch (e) {
          return mcpError(-32603, `LLM error: ${e.message}`, id);
        }
      }

      default:
        return mcpError(-32602, `Unknown tool: ${name}`, id);
    }
  } catch (e) {
    console.error(`[mcp] tool ${name} error:`, e);
    return mcpError(-32603, `Internal error: ${e.message}`, id);
  }
}

// ── helpers ───────────────────────────────────────────────────
function safeDate(ts) {
  try { return new Date(ts).toLocaleDateString(); } catch { return "unknown"; }
}

const jsonResp = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const mcpOk = (id, result) => jsonResp({ jsonrpc: "2.0", id, result });
const mcpError = (code, message, id = null) =>
  jsonResp({ jsonrpc: "2.0", id, error: { code, message } });

const MCP_MANIFEST = {
  name: "kathir-os",
  description: "Live portfolio data for Kathir K S — AI researcher from India",
  version: "1.1.0",
  tools: TOOLS.map(t => t.name),
};
