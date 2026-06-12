// Kathir OS v3 — terminal overlay (bash tab + ask-AI tab).

import { API, timeAgo, fetchLog, fetchPosts, fetchPost, fetchHistory, fetchJarvis, fetchLearning, ask } from "./data.js";
import { openThought } from "./ui.js";

const $ = (id) => document.getElementById(id);

export function initTerminal() {
  const termWrap = $("term-wrap"), termBody = $("term-body"), termInput = $("term-input");
  let collapsed = false, cmdHistory = [], histIdx = -1;

  const showTerm = () => termWrap.classList.remove("hidden");
  const closeTerm = () => termWrap.classList.add("hidden");
  const collapseTerm = () => { collapsed = true; termWrap.classList.add("collapsed"); };
  const expandTerm = () => { collapsed = false; termWrap.classList.remove("collapsed"); termInput.focus(); };

  $("td-r").onclick = closeTerm;
  $("td-y").onclick = collapseTerm;
  $("td-g").onclick = expandTerm;
  $("term-clear").onclick = () => clearTerm();
  $("term-help").onclick = () => helpCmd();
  $("term-toggle").onclick = () => {
    termWrap.classList.toggle("hidden");
    if (!termWrap.classList.contains("hidden")) { switchTab("bash"); termInput.focus(); }
  };

  // drag
  let drag = false, dox = 0, doy = 0;
  $("term-bar").addEventListener("mousedown", (e) => {
    if (e.target.closest(".t-dot,.term-btn,.term-tab")) return;
    drag = true;
    const r = termWrap.getBoundingClientRect();
    dox = e.clientX - r.left; doy = e.clientY - r.top;
    termWrap.style.transition = "none";
  });
  addEventListener("mousemove", (e) => {
    if (!drag) return;
    const nx = Math.max(0, Math.min(e.clientX - dox, innerWidth - termWrap.offsetWidth));
    const ny = Math.max(0, Math.min(e.clientY - doy, innerHeight - termWrap.offsetHeight));
    Object.assign(termWrap.style, { right: "auto", bottom: "auto", left: nx + "px", top: ny + "px" });
  });
  addEventListener("mouseup", () => { drag = false; termWrap.style.transition = ""; });

  function switchTab(tab) {
    $("pane-terminal").classList.toggle("hidden", tab !== "bash");
    $("ai-pane").classList.toggle("visible", tab === "ai");
    $("tab-bash").classList.toggle("active", tab === "bash");
    $("tab-ai").classList.toggle("active", tab === "ai");
    if (tab === "bash") termInput.focus(); else $("ai-input").focus();
  }
  $("tab-bash").onclick = () => switchTab("bash");
  $("tab-ai").onclick = () => switchTab("ai");

  const print = (text, cls = "t-out", pre = false) => {
    const d = document.createElement("div");
    d.className = cls + (pre ? " pre" : "");
    d.textContent = text;
    termBody.appendChild(d);
    termBody.scrollTop = termBody.scrollHeight;
  };
  const printLine = () => print("");
  const printCmd = (cmd) => print(`kathir@portfolio:~$ ${cmd}`, "t-out w");
  const clearTerm = () => { termBody.innerHTML = ""; };

  // boot banner
  [["", ""],
   ["  ██╗  ██╗██╗  ██╗███████╗", "t-out g"], ["  ██║ ██╔╝██║ ██╔╝██╔════╝", "t-out g"],
   ["  █████╔╝ █████╔╝ ███████╗", "t-out g"], ["  ██╔═██╗ ██╔═██╗ ╚════██║", "t-out g"],
   ["  ██║  ██╗██║  ██╗███████║", "t-out g"], ["  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝", "t-out g"],
   ["", ""],
   ["  kathir-os v3.0 — live portfolio system", "t-out w"],
   ["  GH Pages + Workers + R2 · three.js world · jarvis bridged", "t-out"],
   ["", ""],
   ["  Type \"help\" for commands. \"ask\" tab → AI chat.", "t-out b"], ["", ""],
  ].forEach(([t, c], i) => setTimeout(() => print(t, c || "t-out", true), i * 50));

  function helpCmd() {
    printLine(); print("  Available commands:", "t-out w"); printLine();
    [["status", "Current focus (live)"], ["feed", "GitHub + HF activity"],
     ["thoughts", "List published thoughts"], ["read <slug>", "Open a thought"],
     ["changelog <slug>", "A thought's edit history"],
     ["jarvis", "Jarvis agent status + recent tasks"], ["learning", "What I'm studying now"],
     ["logs / papers", "Research log · arXiv picks"], ["ask <q>", "Quick AI question"],
     ["goto <section>", "Fly to a section"], ["theme <name>", "matrix/ocean/fire/default"],
     ["neofetch", "System info"], ["matrix", "🥚"], ["sudo hire kathir", "🥚"], ["clear", "Clear"],
    ].forEach(([c, d]) => {
      const el = document.createElement("div");
      el.className = "t-out";
      el.innerHTML = `  <span style="color:var(--accent);display:inline-block;min-width:170px">${c}</span><span style="color:var(--muted)">${d}</span>`;
      termBody.appendChild(el);
    });
    printLine(); termBody.scrollTop = termBody.scrollHeight;
  }

  async function liveCmd(endpoint, label) {
    print(`  Fetching ${label}...`, "t-out");
    try {
      const r = await fetch(`${API}${endpoint}`);
      const d = await r.json();
      printLine();
      if (endpoint === "/status") {
        print(`  Focus : ${d.text || "—"}`, "t-out g", true);
        print(`  Repo  : ${d.repo || "—"}`, "t-out", true);
        print(`  Age   : ${d.updated ? timeAgo(d.updated) : "—"}`, "t-out", true);
      } else if (endpoint === "/feed") {
        (d.activity || []).slice(0, 5).forEach((i) => {
          print(`  [${i.source}] ${i.message}`, "t-out g", true);
          print(`         ${timeAgo(i.ts)}`, "t-out", true);
        });
      } else if (endpoint === "/logs") {
        (d.entries || []).slice(0, 8).forEach((e) => print(`  ${e.date}`, "t-out g", true));
        print("", "t-out"); print("  cat logs/<date> to read one", "t-out");
      } else if (endpoint === "/papers") {
        (d.papers || []).forEach((p, i) => {
          print(`  ${i + 1}. ${p.title}`, "t-out w", true);
          print(`     ${p.why}`, "t-out", true);
          print(`     ${p.url}`, "t-out b", true);
          printLine();
        });
      }
      printLine();
    } catch { print("  Could not reach API.", "t-out err"); }
  }

  async function thoughtsCmd() {
    const d = await fetchPosts();
    const posts = d?.posts || [];
    printLine();
    if (!posts.length) { print("  nothing published yet", "t-out err"); return; }
    posts.forEach((p) => {
      print(`  ${p.updated.slice(0, 10)}  v${p.revCount}  ${p.slug}`, "t-out g", true);
      print(`             ${p.title}`, "t-out", true);
    });
    printLine(); print("  read <slug> · changelog <slug>", "t-out b");
  }

  async function readCmd(slug) {
    if (!slug) { print("  Usage: read <slug>", "t-out err"); return; }
    const p = await fetchPost(slug);
    if (!p) { print(`  No such thought: ${slug}`, "t-out err"); return; }
    openThought(slug);
    print(`  → opened "${p.title}"`, "t-out g");
  }

  async function changelogCmd(slug) {
    if (!slug) { print("  Usage: changelog <slug>", "t-out err"); return; }
    const h = await fetchHistory(slug);
    if (!h) { print(`  No such thought: ${slug}`, "t-out err"); return; }
    printLine();
    print(`  ${h.title} — ${h.revisions.length} revision(s)`, "t-out w");
    h.revisions.forEach((r, i) => print(`  v${i + 1}  ${r.ts.slice(0, 16).replace("T", " ")}  ${r.note}`, "t-out g", true));
    printLine();
  }

  async function jarvisCmd() {
    const d = await fetchJarvis();
    printLine();
    if (!d) { print("  jarvis state unreachable", "t-out err"); return; }
    print(`  jarvis ${d.online ? "● online" : "○ offline"}  ${d.lastSeen ? "(seen " + timeAgo(d.lastSeen) + ")" : ""}`,
      d.online ? "t-out g" : "t-out err", true);
    (d.tasks || []).slice(0, 5).forEach((t) =>
      print(`  [${t.status}] ${t.task} (${timeAgo(t.ts)})`, "t-out", true));
    printLine();
    print("  display-only — tasks run from kathir's VM via `kos jarvis`", "t-out b");
    printLine();
  }

  async function learningCmd() {
    const d = await fetchLearning();
    printLine();
    const items = d?.items || [];
    if (!items.length) { print("  epistemic-feed not syncing yet", "t-out err"); return; }
    items.forEach((i) => {
      print(`  ▸ ${i.topic}`, "t-out g", true);
      if (i.summary) print(`    ${i.summary}`, "t-out", true);
    });
    printLine();
  }

  async function askTermCmd(q) {
    if (!q) { print("  Usage: ask <question>", "t-out err"); return; }
    print("  Thinking...", "t-out");
    try {
      const d = await ask(q);
      if (d.error) { print(`  Error: ${d.error}`, "t-out err"); return; }
      printLine();
      d.answer.split("\n").forEach((l) => print("  " + l, "t-out g", true));
      printLine();
    } catch { print("  Could not reach AI.", "t-out err"); }
  }

  async function openLog(date) {
    try {
      const d = await fetchLog(date);
      showTerm(); switchTab("bash"); clearTerm();
      d.content.split("\n").forEach((l) => print(l, "t-out", true));
    } catch { print("Failed to load log.", "t-out err"); }
  }

  function neofetch() {
    printLine();
    [`<span style="color:var(--accent)">  kathir</span><span style="color:var(--muted)">@portfolio</span>`,
     `  ─────────────────────────────`,
     `  <span style="color:var(--accent2)">OS</span>       kathir-os v3.0`,
     `  <span style="color:var(--accent2)">Render</span>   three.js · scroll-driven world`,
     `  <span style="color:var(--accent2)">Backend</span>  Cloudflare Workers + R2`,
     `  <span style="color:var(--accent2)">AI</span>       Gemini 2.0 Flash`,
     `  <span style="color:var(--accent2)">Agents</span>   4 cron · jarvis bridged · epistemic-feed`,
     `  `,
     `  <span style="background:var(--accent);color:#000;padding:0 4px">▓</span><span style="background:var(--accent2);padding:0 4px"> </span><span style="background:var(--accent3);padding:0 4px"> </span><span style="background:var(--accent4);padding:0 4px"> </span>`,
    ].forEach((l) => {
      const d = document.createElement("div");
      d.className = "t-out";
      d.innerHTML = "  " + l;
      termBody.appendChild(d);
    });
    printLine(); termBody.scrollTop = termBody.scrollHeight;
  }

  const THEMES = {
    matrix: { "--accent": "#00ff41", "--accent2": "#00cc33", "--accent3": "#33ff66", "--accent4": "#99ff99" },
    ocean: { "--accent": "#38bdf8", "--accent2": "#818cf8", "--accent3": "#34d399", "--accent4": "#f472b6" },
    fire: { "--accent": "#fb923c", "--accent2": "#f87171", "--accent3": "#fbbf24", "--accent4": "#e879f9" },
    default: { "--accent": "#7fffb2", "--accent2": "#a78bfa", "--accent3": "#38bdf8", "--accent4": "#fb923c" },
  };
  const applyTheme = (n) => {
    const t = THEMES[n];
    if (!t) { print(`  Themes: ${Object.keys(THEMES).join(", ")}`, "t-out err"); return; }
    Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    print(`  Theme: ${n}`, "t-out g");
  };

  let matrixOn = false;
  function matrixRain() {
    if (matrixOn) return;
    matrixOn = true;
    print("  Press any key to stop.", "t-out g");
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:800;background:#000;";
    const mc = document.createElement("canvas");
    mc.style.cssText = "width:100%;height:100%;";
    ov.appendChild(mc); document.body.appendChild(ov);
    mc.width = innerWidth; mc.height = innerHeight;
    const cols = Math.floor(mc.width / 16), drops = Array(cols).fill(1);
    const chars = "アイウエオ0123456789ABCDEF∇λα".split("");
    const mctx = mc.getContext("2d");
    const m = setInterval(() => {
      mctx.fillStyle = "rgba(0,0,0,.06)"; mctx.fillRect(0, 0, mc.width, mc.height);
      mctx.fillStyle = "#00ff41"; mctx.font = "14px JetBrains Mono";
      drops.forEach((y, i) => {
        mctx.fillText(chars[(Math.random() * chars.length) | 0], i * 16, y * 16);
        if (y * 16 > mc.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    }, 50);
    const stop = () => { clearInterval(m); ov.remove(); matrixOn = false; removeEventListener("keydown", stop); };
    setTimeout(() => addEventListener("keydown", stop), 400);
  }

  async function runCmd(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    cmdHistory.unshift(cmd); histIdx = -1;
    printCmd(cmd);
    const [c, ...args] = cmd.split(" ");
    const rest = args.join(" ").trim();
    switch (c.toLowerCase()) {
      case "help": helpCmd(); break;
      case "clear": clearTerm(); break;
      case "status": await liveCmd("/status", "status"); break;
      case "feed": await liveCmd("/feed", "feed"); break;
      case "logs": await liveCmd("/logs", "logs"); break;
      case "papers": await liveCmd("/papers", "papers"); break;
      case "thoughts": await thoughtsCmd(); break;
      case "read": await readCmd(rest); break;
      case "changelog": await changelogCmd(rest); break;
      case "jarvis": await jarvisCmd(); break;
      case "learning": await learningCmd(); break;
      case "ask": await askTermCmd(rest); break;
      case "neofetch": neofetch(); break;
      case "cat":
        if (rest.startsWith("logs/")) openLog(rest.slice(5));
        else if (rest.startsWith("thoughts/")) await readCmd(rest.slice(9));
        else print(`  No such file: ${rest}`, "t-out err");
        break;
      case "theme": applyTheme(rest || "default"); break;
      case "goto": {
        const map = { live: "#s-live", thoughts: "#s-thoughts", projects: "#s-projects", graph: "#s-graph", research: "#s-research", agents: "#s-agents", contact: "#s-contact", hero: "#s-hero" };
        const id = map[rest];
        if (id) { document.querySelector(id).scrollIntoView({ behavior: "smooth" }); print(`  → flying to ${rest}`, "t-out g"); }
        else print(`  Try: ${Object.keys(map).join(", ")}`, "t-out err");
        break;
      }
      case "matrix": matrixRain(); break;
      case "history": printLine(); cmdHistory.slice(0, 15).forEach((h, i) => print(`  ${i + 1}  ${h}`, "t-out")); printLine(); break;
      case "whoami": print("  kathir — building frontier AI from India 🇮🇳", "t-out g"); break;
      case "sudo":
        if (rest === "hire kathir") {
          printLine(); print("  🎉 EXCELLENT DECISION", "t-out g"); print("  → kathirksw@gmail.com", "t-out b");
          for (let i = 0; i < 4; i++) setTimeout(() => print("  🎊".repeat(4), "t-out"), i * 150);
        } else print("  Permission denied 😏", "t-out err");
        break;
      case "exit": closeTerm(); break;
      default: print(`  bash: ${c}: command not found. Type 'help'`, "t-out err");
    }
  }

  termInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { runCmd(termInput.value); termInput.value = ""; }
    else if (e.key === "ArrowUp") { e.preventDefault(); histIdx = Math.min(histIdx + 1, cmdHistory.length - 1); termInput.value = cmdHistory[histIdx] || ""; }
    else if (e.key === "ArrowDown") { e.preventDefault(); histIdx = Math.max(histIdx - 1, -1); termInput.value = histIdx >= 0 ? cmdHistory[histIdx] : ""; }
    else if (e.key === "Tab") {
      e.preventDefault();
      const all = ["help", "status", "feed", "thoughts", "read", "changelog", "jarvis", "learning", "logs", "papers", "ask", "neofetch", "cat", "theme", "goto", "matrix", "history", "clear", "sudo", "exit", "whoami"];
      const m = all.filter((x) => x.startsWith(termInput.value));
      if (m.length === 1) termInput.value = m[0] + " ";
      else if (m.length > 1) print("  " + m.join("  "), "t-out");
    }
  });
  termBody.addEventListener("click", () => { if (!collapsed) termInput.focus(); });

  // ── ask-AI pane ──
  let aiHistory = [];
  const appendAI = (role, text, thinking = false) => {
    const msgs = $("ai-messages");
    const d = document.createElement("div");
    d.className = `ai-msg ${role}${thinking ? " thinking" : ""}`;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  };
  async function sendAI() {
    const q = $("ai-input").value.trim();
    if (!q) return;
    $("ai-input").value = "";
    appendAI("user", q);
    const thinking = appendAI("assistant", "thinking...", true);
    try {
      const d = await ask(q, aiHistory);
      thinking.remove();
      if (d.error) appendAI("assistant", `Error: ${d.error}`);
      else {
        appendAI("assistant", d.answer);
        aiHistory.push({ role: "user", content: q }, { role: "assistant", content: d.answer });
        if (aiHistory.length > 12) aiHistory = aiHistory.slice(-12);
      }
    } catch { thinking.remove(); appendAI("assistant", "Could not reach AI."); }
  }
  $("ai-send").onclick = sendAI;
  $("ai-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAI(); } });

  window.kosTerminal = { openLog, show: showTerm };
  return { openLog };
}
