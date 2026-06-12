// Kathir OS v3 — data layer: API client, markdown mini-renderer, line diff.

export const API = window.__KATHIR_OS_API__ || "https://kathir-os-api.kathirksw.workers.dev";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const timeAgo = (ts) => {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

async function getJSON(path) {
  try {
    const r = await fetch(`${API}${path}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export const fetchFeed = () => getJSON("/feed");
export const fetchLogs = () => getJSON("/logs");
export const fetchLog = (date) => getJSON(`/logs/${date}`);
export const fetchPosts = () => getJSON("/posts");
export const fetchPost = (slug) => getJSON(`/posts/${slug}`);
export const fetchHistory = (slug) => getJSON(`/posts/${slug}/history`);
export const fetchJarvis = () => getJSON("/jarvis");
export const fetchGraph = () => getJSON("/epistemic/graph");
export const fetchLearning = () => getJSON("/epistemic/learning");

export async function ask(question, history = []) {
  const r = await fetch(`${API}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  return r.json();
}

// ── markdown mini-renderer (escape-first, no raw HTML passthrough) ──

export function renderMarkdown(md) {
  const lines = String(md ?? "").split("\n");
  const out = [];
  let inCode = false, inList = false;

  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      closeList();
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(esc(line) + "\n"); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); continue; }

    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    closeList();

    const q = line.match(/^>\s?(.*)$/);
    if (q) { out.push(`<blockquote>${inline(q[1])}</blockquote>`); continue; }

    if (line.trim() === "") out.push("");
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) out.push("</code></pre>");
  closeList();
  return out.join("\n");
}

// ── line diff (LCS) for changelog views ──────────────────────

export function diffLines(oldText, newText) {
  const a = String(oldText ?? "").split("\n");
  const b = String(newText ?? "").split("\n");
  const n = a.length, m = b.length;
  if (n * m > 1_000_000) {
    // Degenerate guard for huge posts: skip the DP, show as replace.
    return [...a.map((t) => ({ type: "del", text: t })), ...b.map((t) => ({ type: "add", text: t }))];
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: "del", text: a[i] }); i++; }
    else { ops.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < n) ops.push({ type: "del", text: a[i++] });
  while (j < m) ops.push({ type: "add", text: b[j++] });
  return ops;
}

/** Collapse a diff to changed hunks with 2 lines of context. */
export function diffHunks(ops, context = 2) {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.type !== "same") {
      for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) keep[k] = true;
    }
  });
  const hunks = [];
  let cur = null;
  ops.forEach((op, idx) => {
    if (keep[idx]) {
      if (!cur) { cur = []; hunks.push(cur); }
      cur.push(op);
    } else cur = null;
  });
  return hunks;
}
