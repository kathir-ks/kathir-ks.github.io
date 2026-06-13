## Why

The current site renders as a single scroll-driven 3D world. It is a strong first
step, but it asks every visitor to engage with the 3D experience to read the
content, has no calm reading path for people who just want the information, and the
3D itself reads as abstract floating particle fields rather than a coherent place
you can move through. We want to keep the signature 3D experience as the default,
sharpen it into something that genuinely *feels* like an explorable world, and offer
a simple, elegant alternative for visitors (and devices) that prefer a quiet read.

## What Changes

- **Add a "simple view" — a calm, elegant 2D reading experience** of the exact same
  content (hero, live, thoughts, projects, graph, research, agents, contact). No 3D
  canvas, no autonomous motion: clean typography, generous whitespace, a lighter and
  more restrained palette. This becomes the rendering used for the existing
  `no-webgl` / reduced-motion / mobile fallbacks instead of today's bare flat mode.
- **Add a view-mode switch.** The 3D world stays the default first impression; a
  visible, persistent control toggles to the simple view and the choice is remembered
  (localStorage) so returning visitors land where they left off. Reduced-motion and
  no-WebGL still force the simple view.
- **Rework the 3D from a scroll-rail into an explorable environment.** Stations become
  navigable landmarks in one continuous, grounded space (horizon/atmosphere instead of
  pure void). Visitors can move through it — pointer/drag to look, click-a-landmark to
  travel, keyboard movement on desktop — with clear wayfinding (where am I, where can I
  go, how do I get back) and a minimap/compass affordance. Scroll still works as a
  guided "tour" path so nothing regresses for scroll-only users. **BREAKING** to the
  internal scene navigation contract (scroll-progress → camera) — see Impact.
- **Refine the shared visual language toward "calmer / lighter elegant."** Tune the
  type scale, spacing, contrast, and color harmony; reduce the number of simultaneous
  neon accents; make the design feel intentional and easy to follow in both modes.
- **Content corrections (folded in):** remove the LabVIEW reference from the research
  timeline, and change the stated location from **Madurai** to **Coimbatore**
  everywhere it appears in the site (hero eyebrow, about text, footer, meta).

## Capabilities

### New Capabilities
- `simple-view`: A no-3D, accessible, elegant 2D rendering of all site content,
  including how it is chosen (manual toggle, persisted preference) and when it is
  forced (no-WebGL, reduced-motion, low-capability devices).
- `explorable-world`: The refined 3D environment as a navigable space — grounded
  scene, landmark stations, free-look + travel-to-landmark + keyboard movement, scroll
  as a guided tour, wayfinding affordances, and graceful performance degradation.
- `view-mode-switch`: The mechanism that selects, persists, and switches between the
  explorable world (default) and the simple view, including capability-based forcing.

### Modified Capabilities
<!-- No pre-existing OpenSpec specs in openspec/specs/; nothing to modify as a delta. -->

## Impact

- **Frontend (no build step preserved):** `index.html` (toggle control, body mode
  classes, content corrections), `assets/css/main.css` (calmer/lighter design tokens,
  full simple-view stylesheet, mode-scoped styles), `assets/js/scene.js` (navigation
  model rework: free-look/travel/keyboard, grounded environment, wayfinding; scroll
  becomes one input among several), and a new small module for view-mode selection +
  persistence wired from the `index.html` module bootstrap.
- **Hard invariants touched:** the `[data-station]` ↔ `STATION_POS` parallel-array
  invariant must continue to hold and now also feeds the simple view and the
  landmark/wayfinding list; graceful-degradation paths (no-webgl, reduced-motion,
  mobile quality, sample graph, jarvis offline) must all resolve to the new simple
  view. three.js stays at 0.169.0 via the existing importmap.
- **Out of scope:** no changes to Cloudflare Workers, the R2 data model, the API
  surface, the MCP server, or the VM bridge. Pure frontend + content.
- **Deploy:** changes are within `index.html` and `assets/**`, already covered by the
  Pages workflow `paths:`; no new top-level static dir is introduced.
