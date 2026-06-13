## Context

Kathir OS v3 is a static GitHub Pages site (no build step, plain ES modules, three.js
0.169.0 via an importmap). `index.html` holds 8 `[data-station]` sections; `scene.js`
maps each to a `STATION_POS` entry and drives one camera along a Catmull-Rom curve from
scroll progress. DOM panels float over a fixed `#scene` canvas. Today the only
non-3D path is `body.no-webgl`, which just drops the canvas and leaves the panels on a
flat gradient — functional but not a designed reading experience.

This change keeps the 3D world as the default but (a) turns it into a navigable,
grounded *place* with real wayfinding, and (b) adds a deliberately calm, lighter,
elegant **simple view** that doubles as the universal fallback. A persisted toggle
chooses between them. We must preserve the hard invariants in `CLAUDE.md`: station/
position parallel arrays, no build step / no npm deps, escape-first markdown, no
secrets, and all graceful-degradation paths.

## Goals / Non-Goals

**Goals:**
- One content source feeding two renderings; no duplication of post/feed logic.
- Explorable 3D: grounded environment, landmark-per-station, look + travel + keyboard,
  scroll as a guided tour, and an always-present orientation aid.
- A simple view that is genuinely elegant (calmer/lighter palette, type, spacing) and
  is the single fallback for no-WebGL / reduced-motion / low-capability.
- Remembered view preference, with capability/accessibility forcing that never clobbers
  the stored manual choice.
- Stay no-build, ES-modules-only, three.js pinned at 0.169.0.

**Non-Goals:**
- No backend/worker/R2/API/MCP/bridge changes.
- No bundler, framework, or new runtime dependency.
- No first-person physics, collisions, or asset-heavy 3D models — "world" means a
  grounded, legible space, not a game engine.
- Not redesigning the content/IA — sections and their order are unchanged.

## Decisions

### D1 — View-mode owns the lifecycle; scene & simple view are interchangeable renderers
A new small module (`assets/js/viewmode.js`) is the single source of truth for the
active mode. It reads capability + stored preference, sets a `body` class
(`mode-world` / `mode-simple`), and lazily initializes the 3D scene only when needed
(today's dynamic `import("./scene.js")` moves behind it). The `index.html` bootstrap
calls `initViewMode({ initUI, initTerminal })` instead of eagerly importing the scene.
*Why:* keeps `index.html` thin, makes "switch mode without reload" possible, and lets
no-WebGL/reduced-motion resolve to the same simple view as a manual choice.
*Alternative considered:* two separate HTML pages (`/` and `/simple`). Rejected — it
duplicates the module bootstrap and breaks single-deploy simplicity.

### D2 — Mode is CSS-class driven; both renderings share one DOM
The existing `[data-station]` sections remain the content. `body.mode-simple` restyles
them into the calm 2D layout and hides the canvas/cursor/parallax; `body.mode-world`
keeps panels translucent over the canvas. *Why:* content parity is automatic and UI
data-loading code in `ui.js` is untouched. *Alternative:* render-time templating per
mode — rejected as duplicative and build-ish.

### D3 — Preference & forcing precedence
Resolution order on load: forced-simple (no WebGL OR `prefers-reduced-motion`) →
stored manual preference → default `world`. A "forced" simple render must not write to
storage, so a returning capable user keeps whatever they last *chose*. The toggle is
disabled/hidden when WebGL is unavailable. *Why:* matches the `view-mode-switch` spec
and avoids a reduced-motion visit silently demoting a user forever.

### D4 — Explorable navigation = guided tour + free overrides over one camera rig
Rather than replace scroll, layer inputs on the existing camera. Scroll still maps to a
progress value that follows the landmark path (the guided tour). Added on top:
drag-to-look (yaw/pitch offsets), click-a-landmark (animate progress/target to that
station), and WASD/arrows on desktop (nudge position/progress). A single "navigation
state" reconciles them so inputs compose instead of fighting. *Why:* preserves the
scroll experience required by the spec, reuses the Catmull-Rom path, and avoids a
full free-fly camera (disorienting, accessibility-hostile). *Alternative:* full
6-DOF fly cam (PointerLockControls) — rejected as too easy to get lost in and bad on
trackpad/mobile.

### D5 — Grounding via a shared ground/horizon + fog, not per-station skyboxes
Add one ground plane / horizon and tune the existing `FogExp2` and lighting so all
stations sit in a continuous atmosphere. Keep the station builders but re-anchor them
to the ground and unify their visual language (shared accent discipline, consistent
scale). *Why:* cheap, cohesive, no new assets, keeps GPU budget for navigation.

### D6 — Wayfinding: a persistent landmark list / minimap derived from `STATION_POS`
A small always-visible affordance lists the landmarks (from the same array driving the
scene) showing the current one and offering click-to-travel + "return to start." This
list is also what powers the simple view's in-page nav, so one structure serves both.
*Why:* satisfies orientation requirements and reinforces the station/position
invariant by reading from a single source.

### D7 — "Calmer / lighter elegant" as token changes, applied to both modes
Introduce refined CSS custom properties (softer surfaces, fewer simultaneous accents, a
tightened type scale and spacing rhythm). World mode keeps a dark, atmospheric skin;
simple mode uses the lighter/quieter end of the same token set so the two feel related,
not like different sites. *Why:* the user chose a unified calmer direction over fully
distinct per-mode skins; tokens keep it consistent and low-risk.

### D8 — Content corrections live in the markup
Remove "LabVIEW" from the Soliton timeline entry; change "Madurai" → "Coimbatore" in
the hero eyebrow, about paragraph, footer, and the `<meta>`/description where present.
Pure text edits, no logic.

## Risks / Trade-offs

- **Navigation can disorient / motion-sickness** → Cap look/travel speeds, ease all
  camera moves, disable autonomous motion under reduced-motion, always offer
  return-to-start and the landmark list.
- **Scroll vs. free-move input conflict** → Single reconciled nav state with clear
  precedence (active drag/keys temporarily lead; scroll resumes the tour) instead of
  multiple handlers mutating the camera directly.
- **Two modes drift out of sync** → Both render the same `[data-station]` DOM and read
  landmarks from `STATION_POS`; no parallel content copy. CI-free, so a manual
  station-count check stays in `tasks`.
- **Heavier scene hurts low-end devices** → Reuse the existing `Q` quality factor and
  `prefers-reduced-motion` gates; if init fails or perf is unacceptable, fall through
  to the simple view (which is now a first-class experience, not a bare fallback).
- **Flash of wrong mode on load** → Resolve mode and set the `body` class before the
  scene/UI paint (inline, pre-module), mirroring how `no-webgl` is set today.
- **localStorage throwing (privacy modes)** → Wrap in try/catch; fall back to default
  for the session.
- **No automated tests** → Verify modules with `node --check` via `.mjs` copies and the
  in-memory R2 mock pattern; the 3D/world behaviors are verified manually in a browser.

## Migration Plan

1. Land tokens + simple-view stylesheet and the `viewmode.js` selector first; wire the
   `no-webgl`/reduced-motion fallback to the new simple view (already an improvement on
   its own, independently shippable).
2. Add the toggle control + persistence.
3. Rework `scene.js` navigation (grounding → guided-tour refactor → look/travel/keyboard
   → wayfinding) incrementally, keeping scroll working at each step.
4. Apply content corrections.
5. Verify in a browser across: capable desktop, mobile, reduced-motion, and forced
   no-WebGL. Push to `main` (Pages auto-deploys from `index.html`/`assets/**`).

Rollback: revert the commit(s); no data/schema/worker state changes, so rollback is
purely static-asset reversion with no migration to undo.

## Open Questions

- Wayfinding form factor: minimap vs. compass vs. simple landmark list — start with the
  landmark list (lowest risk, doubles as simple-view nav) and revisit.
- Keyboard movement scheme on desktop (WASD vs. arrows vs. both) and whether to expose
  it at all on first release, or ship look + click-to-travel + scroll first.
- Whether the simple view's palette should be true light or a lighter muted-dark —
  decide during visual tuning against contrast/accessibility.
