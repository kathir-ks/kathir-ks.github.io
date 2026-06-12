// Kathir OS v3 — DOM rendering: feeds, thoughts, jarvis, graph panel, modal.

import {
  esc, timeAgo, fetchFeed, fetchLogs, fetchPosts, fetchPost, fetchHistory,
  fetchJarvis, fetchGraph, fetchLearning, renderMarkdown, diffLines, diffHunks,
} from "./data.js";

const $ = (id) => document.getElementById(id);

// ── live feed ─────────────────────────────────────────────────

async function loadFeed() {
  if (document.hidden) return;
  const d = await fetchFeed();
  if (!d) {
    $("activity-feed").innerHTML = '<div class="feed-empty">backend unreachable</div>';
    return;
  }
  renderActivity(d.activity || []);
  if (d.status?.text) $("nav-status-text").textContent = d.status.text;
  renderPapers(d.papers || []);
  const logs = await fetchLogs();
  if (logs) renderLogs(logs.entries || []);
}

function renderActivity(items) {
  const el = $("activity-feed");
  if (!items.length) { el.innerHTML = '<div class="feed-empty">no activity yet</div>'; return; }
  el.innerHTML = items.slice(0, 8).map((i) => `
    <div class="feed-item">
      <div class="fi-src ${i.source === "github" ? "gh" : "hf"}">${esc(i.source)} · ${esc(i.repo || "")}</div>
      <div class="fi-msg">${esc(i.message)}</div>
      <div class="fi-time">${esc(timeAgo(i.ts))}</div>
    </div>`).join("");
}

function renderLogs(entries) {
  const el = $("logs-feed");
  if (!entries.length) { el.innerHTML = '<div class="feed-empty">no log entries yet</div>'; return; }
  el.innerHTML = entries.slice(0, 5).map((e) => `
    <div class="log-entry" data-date="${esc(e.date)}">
      <div class="log-date">${esc(e.date)}</div>
      <div class="log-preview">tap to read →</div>
    </div>`).join("");
  el.querySelectorAll(".log-entry").forEach((n) =>
    n.addEventListener("click", () => window.kosTerminal?.openLog(n.dataset.date)));
}

function renderPapers(papers) {
  const el = $("papers-feed");
  if (!papers.length) { el.innerHTML = '<div class="feed-empty">agent fetches papers at 07:00 UTC</div>'; return; }
  el.innerHTML = papers.map((p) => `
    <div class="paper-item">
      <div class="paper-title">${esc(p.title)}</div>
      <div class="paper-why">${esc(p.why)}</div>
      <a class="paper-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">arxiv →</a>
    </div>`).join("");
}

// ── thoughts ──────────────────────────────────────────────────

let postsCache = [];

async function loadThoughts() {
  const d = await fetchPosts();
  const el = $("thoughts-grid");
  postsCache = d?.posts || [];
  if (!postsCache.length) {
    el.innerHTML = '<div class="feed-empty" style="padding:2rem">nothing published yet — first thought incoming</div>';
    return;
  }
  el.innerHTML = postsCache.slice(0, 12).map((p) => `
    <article class="thought-card tilt" data-slug="${esc(p.slug)}">
      <div class="tc-meta">
        <span class="tc-kind ${p.kind === "post" ? "k-post" : "k-thought"}">${esc(p.kind)}</span>
        <span class="tc-rev">v${p.revCount}</span>
      </div>
      <h3 class="tc-title">${esc(p.title)}</h3>
      <p class="tc-preview">${esc(p.preview)}…</p>
      <div class="tc-foot">
        <span>${esc(timeAgo(p.updated))}</span>
        ${p.revCount > 1 ? '<span class="tc-changelog">changelog ↗</span>' : ""}
      </div>
    </article>`).join("");
  el.querySelectorAll(".thought-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      const tab = e.target.classList.contains("tc-changelog") ? "changelog" : "read";
      openThought(card.dataset.slug, tab);
    });
  });
  initTilt(el);
}

// ── thought modal (read + changelog tabs) ─────────────────────

export async function openThought(slug, tab = "read") {
  const post = await fetchPost(slug);
  if (!post) return;
  history.replaceState(null, "", `#/t/${slug}`);

  $("modal-title").textContent = post.title;
  $("modal-sub").textContent =
    `${post.kind} · created ${post.created.slice(0, 10)} · v${post.revisions.length} · updated ${timeAgo(post.updated)}`;
  $("modal-read").innerHTML = `<div class="md">${renderMarkdown(post.body)}</div>`;
  $("modal-log").innerHTML = '<div class="feed-empty">loading history…</div>';
  $("modal").classList.add("open");
  switchModalTab(tab);

  if (post.revisions.length > 1) {
    const h = await fetchHistory(slug);
    if (h) renderChangelog(h.revisions);
  } else {
    $("modal-log").innerHTML = '<div class="feed-empty">no edits yet — v1 is the original</div>';
  }
}

function renderChangelog(revisions) {
  // newest first; each entry diffs against the previous revision
  const blocks = [];
  for (let i = revisions.length - 1; i >= 0; i--) {
    const rev = revisions[i];
    const prev = revisions[i - 1];
    let diffHtml = "";
    if (prev) {
      const hunks = diffHunks(diffLines(prev.body, rev.body));
      diffHtml = hunks.length
        ? hunks.map((h) => `<div class="hunk">${h.map((op) =>
            `<div class="d-${op.type}">${esc(op.text) || "&nbsp;"}</div>`).join("")}</div>`).join("")
        : '<div class="feed-empty">metadata-only change</div>';
    }
    blocks.push(`
      <div class="rev">
        <div class="rev-head">
          <span class="rev-v">v${i + 1}</span>
          <span class="rev-note">${esc(rev.note)}</span>
          <span class="rev-ts">${esc(rev.ts.slice(0, 16).replace("T", " "))}</span>
        </div>
        ${diffHtml}
      </div>`);
  }
  $("modal-log").innerHTML = blocks.join("");
}

export function switchModalTab(tab) {
  $("modal-read").style.display = tab === "read" ? "" : "none";
  $("modal-log").style.display = tab === "changelog" ? "" : "none";
  $("mtab-read").classList.toggle("active", tab === "read");
  $("mtab-log").classList.toggle("active", tab === "changelog");
}

function closeModal() {
  $("modal").classList.remove("open");
  if (location.hash.startsWith("#/t/")) history.replaceState(null, "", location.pathname);
}

// ── knowledge graph panel ─────────────────────────────────────

async function loadEpistemic(sceneApi) {
  const [graph, learning] = await Promise.all([fetchGraph(), fetchLearning()]);
  if (graph?.nodes?.length) {
    sceneApi.setGraph(graph);
    $("graph-src").textContent = `live · ${graph.nodes.length} topics · synced ${timeAgo(graph.updated)}`;
  } else {
    $("graph-src").textContent = "sample data — epistemic-feed not syncing yet";
  }
  const el = $("learning-list");
  const items = learning?.items?.filter((i) => i.topic) || [];
  if (!items.length) {
    el.innerHTML = '<div class="feed-empty">currently-exploring list appears once epistemic-feed syncs</div>';
    return;
  }
  el.innerHTML = items.map((i) => `
    <div class="learn-item">
      <div class="learn-topic">${esc(i.topic)}</div>
      <div class="learn-summary">${esc(i.summary)}</div>
      ${i.url ? `<a class="paper-link" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">source →</a>` : ""}
    </div>`).join("");
}

export function graphTooltip(node, x, y) {
  const tip = $("graph-tip");
  if (!node) { tip.style.display = "none"; return; }
  tip.style.display = "block";
  tip.style.left = `${Math.min(x + 14, innerWidth - 180)}px`;
  tip.style.top = `${y + 14}px`;
  tip.innerHTML = `<strong>${esc(node.label)}</strong><span>${esc(node.kind)} · ${node.edges.length} links</span>`;
}

// ── jarvis (display-only) ─────────────────────────────────────

async function loadJarvis() {
  const d = await fetchJarvis();
  const dot = $("jarvis-dot"), label = $("jarvis-state"), tasks = $("jarvis-tasks");
  if (!d) { label.textContent = "unreachable"; return; }
  dot.classList.toggle("online", d.online);
  label.textContent = d.online
    ? `online · seen ${timeAgo(d.lastSeen)}`
    : d.lastSeen ? `offline · last seen ${timeAgo(d.lastSeen)}` : "offline · never connected";
  if (!d.tasks?.length) {
    tasks.innerHTML = '<div class="feed-empty">no tasks recorded yet — run `kos jarvis "…"` on the VM</div>';
    return;
  }
  tasks.innerHTML = d.tasks.slice(0, 6).map((t) => `
    <div class="jtask">
      <span class="jtask-status ${/done|completed/.test(t.status) ? "ok" : /fail|error/.test(t.status) ? "bad" : ""}">${esc(t.status || "?")}</span>
      <span class="jtask-text">${esc(t.task)}</span>
      <span class="jtask-meta">${t.duration ? `${t.duration}s · ` : ""}${esc(timeAgo(t.ts))}</span>
    </div>`).join("");
}

// ── card tilt (CSS 3D, fine pointers only) ────────────────────

function initTilt(scope) {
  if (matchMedia("(pointer:coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  scope.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -7;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 9;
      card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`;
    });
    card.addEventListener("mouseleave", () => { card.style.transform = ""; });
  });
}

// ── boot ──────────────────────────────────────────────────────

export function initUI(sceneApi) {
  // reveal-on-scroll
  const rvIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("vis"); rvIO.unobserve(e.target); }
  }), { threshold: 0.1 });
  document.querySelectorAll(".rv").forEach((el) => rvIO.observe(el));

  // nav active link
  const navLinks = [...document.querySelectorAll(".nav-links a")];
  const secIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
  }), { threshold: 0.4 });
  document.querySelectorAll("[data-station]").forEach((s) => secIO.observe(s));

  // modal wiring
  $("modal-close").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) closeModal(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  $("mtab-read").addEventListener("click", () => switchModalTab("read"));
  $("mtab-log").addEventListener("click", () => switchModalTab("changelog"));

  initTilt(document);

  // data
  loadFeed(); setInterval(loadFeed, 5 * 60 * 1000);
  loadThoughts(); setInterval(loadThoughts, 10 * 60 * 1000);
  loadJarvis(); setInterval(loadJarvis, 60 * 1000);
  loadEpistemic(sceneApi);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadFeed(); loadJarvis(); } });

  // deep link #/t/slug
  if (location.hash.startsWith("#/t/")) {
    const slug = location.hash.slice(4);
    if (/^[a-z0-9-]+$/.test(slug)) openThought(slug);
  }

  return { posts: () => postsCache };
}
