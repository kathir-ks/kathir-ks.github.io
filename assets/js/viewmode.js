// Kathir OS v3 — view-mode selector.
//
// Owns the lifecycle of the two experiences:
//   • the explorable 3D world  (default on capable devices)
//   • the simple view          (calm 2D reading; also the universal fallback)
//
// Responsibilities: capability detection, preference persistence, the nav toggle,
// lazy/once initialization of the heavy three.js scene, and the wayfinding landmark
// rail that is shared by both modes. UI data-loading (ui.js) and the terminal run in
// both modes unchanged.

import { initUI, graphTooltip } from "./ui.js";
import { initTerminal } from "./terminal.js";

const KEY = "kos.viewmode"; // stored *manual* preference: "world" | "simple"
const WORLD = "world";
const SIMPLE = "simple";

// ── capability ────────────────────────────────────────────────

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function readPref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === WORLD || v === SIMPLE ? v : null;
  } catch {
    return null;
  }
}
function writePref(v) {
  // Only ever called for an explicit user choice, so a forced/default render never
  // overwrites a returning visitor's stored preference.
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage unavailable (privacy mode) — honour for this session only */
  }
}

// Resolve the mode to show on load. worldAvailable is false only when WebGL can't run
// at all; reduced-motion lowers the *default* to simple but still allows opting in.
function resolveMode() {
  const worldAvailable = webglOK();
  if (!worldAvailable) return { mode: SIMPLE, worldAvailable: false };
  const pref = readPref();
  if (pref) return { mode: pref, worldAvailable: true };
  return { mode: reducedMotion() ? SIMPLE : WORLD, worldAvailable: true };
}

// ── scene proxy ───────────────────────────────────────────────
// initUI() is handed a stable object immediately; the real scene may attach later
// (first time the visitor enters world mode). Graph data set before then is cached
// and replayed once the real scene exists.

function makeSceneProxy() {
  return {
    _real: null,
    _cachedGraph: null,
    setGraph(g) {
      this._cachedGraph = g;
      if (this._real) this._real.setGraph(g);
    },
    attach(real) {
      this._real = real;
      if (this._cachedGraph) real.setGraph(this._cachedGraph);
    },
  };
}

// ── boot ──────────────────────────────────────────────────────

export function initViewMode() {
  const resolved = resolveMode();
  let mode = resolved.mode;
  const worldAvailable = resolved.worldAvailable;

  applyModeClass(mode);

  const sceneProxy = makeSceneProxy();
  let sceneApi = null; // the real three.js api, once initialized

  // Lazily import + initialize the 3D scene exactly once, on first world entry.
  async function ensureScene() {
    if (sceneApi || !worldAvailable) return;
    try {
      const { initScene } = await import("./scene.js");
      sceneApi = initScene({ onGraphHover: graphTooltip });
      sceneProxy.attach(sceneApi);
    } catch (e) {
      console.warn("3D scene unavailable, falling back to simple view:", e);
      sceneApi = null;
      forceSimple();
    }
  }

  function forceSimple() {
    mode = SIMPLE;
    applyModeClass(mode);
    sceneApi?.setActive(false);
    syncToggle(toggle, mode, worldAvailable);
  }

  function setMode(next, { persist } = { persist: true }) {
    if (next === WORLD && !worldAvailable) next = SIMPLE;
    mode = next;
    applyModeClass(mode);
    if (persist) writePref(mode);
    if (mode === WORLD) {
      ensureScene().then(() => sceneApi?.setActive(true));
    } else {
      sceneApi?.setActive(false);
    }
    syncToggle(toggle, mode, worldAvailable);
  }

  // Always-on UI + terminal + wayfinding (shared by both modes).
  initUI(sceneProxy);
  initTerminal();
  buildWayfinding();

  const toggle = document.getElementById("mode-toggle");
  if (toggle) {
    if (!worldAvailable) {
      toggle.disabled = true;
      toggle.hidden = true;
    } else {
      toggle.addEventListener("click", () =>
        setMode(mode === WORLD ? SIMPLE : WORLD));
    }
    syncToggle(toggle, mode, worldAvailable);
  }

  // Kick off the scene if we're starting in world mode.
  if (mode === WORLD) ensureScene().then(() => sceneApi?.setActive(true));
}

function applyModeClass(mode) {
  const b = document.body;
  b.classList.toggle("mode-world", mode === WORLD);
  b.classList.toggle("mode-simple", mode === SIMPLE);
}

function syncToggle(toggle, mode, worldAvailable) {
  if (!toggle || !worldAvailable) return;
  // The button advertises the mode you'd switch *to*.
  toggle.textContent = mode === WORLD ? "simple view" : "3D world";
  toggle.setAttribute("aria-pressed", mode === SIMPLE ? "true" : "false");
}

// ── wayfinding rail ───────────────────────────────────────────
// One landmark per [data-station] section, derived live from the DOM so it can never
// drift from the scene's STATION_POS array. Click travels there (a smooth scroll,
// which drives the world camera in world mode and is plain navigation in simple mode).
// The current landmark is tracked with an IntersectionObserver.

const STATION_LABELS = {
  "s-hero": "Start",
  "s-live": "Live",
  "s-thoughts": "Thoughts",
  "s-projects": "Projects",
  "s-graph": "Graph",
  "s-research": "Research",
  "s-agents": "Agents",
  "s-contact": "Contact",
};

function buildWayfinding() {
  const sections = [...document.querySelectorAll("[data-station]")];
  if (!sections.length) return;

  const rail = document.createElement("nav");
  rail.id = "wayfind";
  rail.setAttribute("aria-label", "Site map");

  sections.forEach((sec) => {
    const label = STATION_LABELS[sec.id] || sec.id.replace(/^s-/, "");
    const btn = document.createElement("button");
    btn.className = "wf-dot";
    btn.type = "button";
    btn.dataset.target = sec.id;
    btn.setAttribute("aria-label", `Go to ${label}`);
    btn.innerHTML = `<span class="wf-pip"></span><span class="wf-label">${label}</span>`;
    btn.addEventListener("click", () =>
      sec.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    rail.appendChild(btn);
  });

  // "return to start" — same target as the first dot, but always reachable.
  const home = document.createElement("button");
  home.className = "wf-home";
  home.type = "button";
  home.setAttribute("aria-label", "Return to start");
  home.textContent = "↑";
  home.addEventListener("click", () =>
    sections[0].scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  rail.appendChild(home);

  document.body.appendChild(rail);

  const dots = [...rail.querySelectorAll(".wf-dot")];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      dots.forEach((d) => d.classList.toggle("here", d.dataset.target === e.target.id));
    });
  }, { threshold: 0.4 });
  sections.forEach((s) => io.observe(s));
}
