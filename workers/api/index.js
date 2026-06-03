/**
 * Kathir OS — API Worker
 *
 * Routes:
 *   GET  /feed              → { activity, status, papers, ts }
 *   GET  /status            → { text, repo, updated, source }
 *   GET  /logs              → { entries: [{key, date, size, modified}] }
 *   GET  /logs/:date        → { date, content }   (date = YYYY-MM-DD)
 *   GET  /papers            → { papers }
 *   POST /ask               → { answer }
 *   POST /refresh           → { ok, refreshed }    (Authorization: Bearer <ADMIN_TOKEN>)
 *
 * Env bindings (set in wrangler.toml / `wrangler secret put`):
 *   R2             — R2 bucket binding "kathir-os"
 *   GITHUB_TOKEN   — for refreshGitHub
 *   ADMIN_TOKEN    — gate on /refresh
 *   LLM_PROVIDER   — "gemini" (default) | "openai" | "anthropic"
 *   GEMINI_KEY / OPENAI_KEY / ANTHROPIC_KEY  — for the chosen provider
 *   GH_USERNAME / HF_USERNAME                — public usernames
 *   DAILY_ASK_LIMIT — optional integer (default 800) — global cap to protect AI quota
 */

import { chat } from "../lib/llm.js";
import { WEBSITE_SYSTEM_PROMPT } from "../lib/prompts.js";
import { refreshGitHub, refreshHuggingFace, mergedActivity } from "../lib/refresh.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const err = (msg, status = 400) => json({ error: msg }, status);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { headers: CORS });

    if (path === "/feed" && method === "GET") return handleFeed(env);
    if (path === "/status" && method === "GET") return handleStatus(env);
    if (path === "/logs" && method === "GET") return handleLogList(env);
    if (path.startsWith("/logs/") && method === "GET") return handleLog(env, path);
    if (path === "/papers" && method === "GET") return handlePapers(env);
    if (path === "/ask" && method === "POST") return handleAsk(request, env, ctx);
    if (path === "/refresh" && method === "POST") return handleRefresh(request, env);

    return err("Not found", 404);
  },
};

// ── /feed ─────────────────────────────────────────────────────
async function handleFeed(env) {
  try {
    const [activity, status, papers] = await Promise.all([
      mergedActivity(env),
      readJson(env.R2, "feed/status.json"),
      readJson(env.R2, "feed/papers.json"),
    ]);
    return json({ activity, status, papers: papers || [], ts: Date.now() });
  } catch {
    return json({ activity: [], status: null, papers: [], ts: Date.now() });
  }
}

// ── /status ───────────────────────────────────────────────────
async function handleStatus(env) {
  const status = await readJson(env.R2, "feed/status.json");
  return json(status || { text: "Building something.", updated: null });
}

// ── /logs (list) ──────────────────────────────────────────────
async function handleLogList(env) {
  try {
    const list = await env.R2.list({ prefix: "logs/" });
    const entries = list.objects
      .filter(o => o.key.endsWith(".md"))
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 30)
      .map(o => ({
        key: o.key,
        date: o.key.replace("logs/", "").replace(".md", ""),
        size: o.size,
        modified: o.uploaded,
      }));
    return json({ entries });
  } catch {
    return json({ entries: [] });
  }
}

// ── /logs/:date ───────────────────────────────────────────────
async function handleLog(env, path) {
  const date = path.slice("/logs/".length);
  // Accept "2026-06-03" or "digest-2026-06-03" to match writer keys.
  const bare = date.startsWith("digest-") ? date.slice(7) : date;
  if (!DATE_RE.test(bare)) return err("Invalid date format (expected YYYY-MM-DD)", 400);

  const obj = await env.R2.get(`logs/${date}.md`);
  if (!obj) return err("Log not found", 404);
  const text = await obj.text();
  return json({ date, content: text });
}

// ── /papers ───────────────────────────────────────────────────
async function handlePapers(env) {
  const papers = await readJson(env.R2, "feed/papers.json");
  return json({ papers: papers || [] });
}

// ── /ask ──────────────────────────────────────────────────────
async function handleAsk(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return err("Invalid JSON"); }
  const { question, history = [] } = body;
  if (!question || typeof question !== "string") return err("Missing question");
  if (question.length > 1000) return err("Question too long");

  // Global daily cap (protects free-tier LLM quota; race-prone by design — cheap).
  const cap = parseInt(env.DAILY_ASK_LIMIT || "800", 10);
  const over = await incrementAndCheck(env.R2, cap);
  if (over) return err("Daily AI budget reached — try again tomorrow", 429);

  // Fire-and-forget visitor log (now actually fire-and-forget).
  if (ctx?.waitUntil) ctx.waitUntil(logVisitorQuestion(env.R2, question));

  const messages = [
    ...history.slice(-6).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : "",
    })),
    { role: "user", content: question },
  ];

  try {
    const { text } = await chat(env, {
      system: WEBSITE_SYSTEM_PROMPT,
      messages,
      maxTokens: 512,
      temperature: 0.7,
    });
    return json({ answer: text || "I couldn't generate a response. Try again." });
  } catch (e) {
    console.error("[/ask] LLM error:", e);
    return err("AI unavailable right now", 503);
  }
}

// ── /refresh ──────────────────────────────────────────────────
async function handleRefresh(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return err("Unauthorized", 401);
  await Promise.all([refreshGitHub(env), refreshHuggingFace(env)]);
  return json({ ok: true, refreshed: new Date().toISOString() });
}

// ── Helpers ───────────────────────────────────────────────────

async function readJson(bucket, key) {
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return await obj.json();
  } catch { return null; }
}

async function logVisitorQuestion(bucket, question) {
  try {
    const existing = await bucket.get("meta/visitor-questions.json");
    const log = existing ? await existing.json() : [];
    log.unshift({ q: question.slice(0, 200), ts: Date.now() });
    await bucket.put("meta/visitor-questions.json", JSON.stringify(log.slice(0, 500)), {
      httpMetadata: { contentType: "application/json" },
    });
  } catch (e) {
    console.error("[logVisitorQuestion]", e);
  }
}

// Returns true if today's counter is already over `cap` (do NOT serve the request).
// Race-prone read-modify-write — under contention we may serve a few extra requests.
async function incrementAndCheck(bucket, cap) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `meta/asks-${day}.json`;
  try {
    const existing = await bucket.get(key);
    const count = existing ? ((await existing.json()).count || 0) : 0;
    if (count >= cap) return true;
    await bucket.put(key, JSON.stringify({ count: count + 1 }), {
      httpMetadata: { contentType: "application/json" },
    });
    return false;
  } catch {
    return false;
  }
}
