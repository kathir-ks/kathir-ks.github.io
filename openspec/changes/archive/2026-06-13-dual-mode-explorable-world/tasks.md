## 1. Design tokens & calmer/lighter foundation

- [x] 1.1 In `assets/css/main.css`, refine the `:root` token set: tighten the type
  scale, spacing rhythm, and contrast; reduce simultaneous accent usage toward a
  calmer palette (keep three.js scene colors in `scene.js` aligned to whatever accents
  survive).
- [x] 1.2 Add a light/quieter token group (surfaces, text, muted, borders) used by
  simple mode, defined so world and simple modes read as the same design family.
- [x] 1.3 Add `body.mode-world` / `body.mode-simple` scoping hooks (no behavior yet),
  and confirm `node --check` passes on any touched JS via the `.mjs` copy trick.

## 2. Simple view (also the universal fallback)

- [x] 2.1 Write the simple-view stylesheet (within `main.css`, scoped to
  `body.mode-simple`): calm 2D layout for all 8 `[data-station]` sections, generous
  whitespace, legible type, visible focus states, native cursor, no parallax/motion.
- [x] 2.2 Render the knowledge-graph section as a readable list (reuse learning/graph
  data already loaded by `ui.js`) instead of the 3D constellation when in simple mode.
- [x] 2.3 Ensure live data, thoughts modal (read + changelog tabs), and the terminal/
  "ask" overlay all work in simple mode unchanged.
- [x] 2.4 Verify the simple view fully replaces the old bare `no-webgl` flat fallback
  (content intact, no canvas) on a forced no-WebGL run.

## 3. View-mode selector & persistence

- [x] 3.1 Add `assets/js/viewmode.js` exporting `initViewMode(...)`: detect WebGL +
  `prefers-reduced-motion`, read stored preference, resolve mode with precedence
  forced-simple → stored → default `world`, and set the `body` mode class.
- [x] 3.2 Persist manual choices to localStorage (try/catch; session fallback on
  throw). Ensure a forced-simple render never overwrites a stored manual preference.
- [x] 3.3 Lazy-init the 3D scene only in world mode (move the dynamic
  `import("./scene.js")` behind `viewmode.js`); init `ui.js`/`terminal.js` in both.
- [x] 3.4 Set the resolved mode class before first paint (inline pre-module step, like
  today's `no-webgl`) to avoid a flash of the wrong mode.
- [x] 3.5 Rewire the `index.html` module bootstrap to call `initViewMode` instead of
  eagerly importing the scene.

## 4. View-mode toggle control

- [x] 4.1 Add a visible, persistent toggle control in the nav (world ⇄ simple); reflect
  the active mode and remembered preference.
- [x] 4.2 Switch modes live without a full reload: tear down / hide the canvas + its
  motion when leaving world; (re)init the scene when entering world.
- [x] 4.3 Disable or hide the world option when WebGL is unavailable.

## 5. Explorable world — grounding & visual cohesion

- [x] 5.1 In `scene.js`, add a shared ground/horizon and tune `FogExp2`/lighting so all
  stations sit in one continuous, grounded atmosphere.
- [x] 5.2 Re-anchor the 8 station builders to the ground and unify their visual language
  (consistent scale + disciplined accents) so they read as landmarks, not stray fields.

## 6. Explorable world — navigation

- [x] 6.1 Refactor camera control into a single reconciled navigation state that still
  derives a guided-tour progress from scroll (scroll-only coverage unchanged).
- [x] 6.2 Add drag-to-look (yaw/pitch offsets) layered over the tour path, with capped,
  eased motion.
- [x] 6.3 Add click-a-landmark to travel: animate to the target station and mark it the
  active/focused section.
- [x] 6.4 Add desktop keyboard movement (WASD/arrows) nudging position/progress, gated
  off on coarse-pointer and reduced-motion.
- [x] 6.5 Preserve the interactive knowledge-graph landmark (raycast hover/inspect,
  live data when synced else sample graph).
- [x] 6.6 Disable all autonomous/idle motion when `prefers-reduced-motion` is set even
  if the user opts into the world; navigation only on direct input.

## 7. Wayfinding

- [x] 7.1 Build a persistent landmark list/minimap derived from `STATION_POS` showing
  the current landmark and the other reachable ones, with click-to-travel.
- [x] 7.2 Add a clearly available "return to start" (hero/origin) control.
- [x] 7.3 Reuse the same landmark structure as the simple view's in-page navigation so
  one source serves both modes.

## 8. Content corrections

- [x] 8.1 Remove the "LabVIEW" mention from the Soliton Technologies timeline entry in
  `index.html`.
- [x] 8.2 Change "Madurai" → "Coimbatore" in the hero eyebrow, the about paragraph, the
  footer, and the `<meta name="description">` / any other on-page occurrence.

## 9. Verification

- [x] 9.1 Confirm the station/position invariant still holds: `[data-station]` count ==
  `STATION_POS.length` == landmark count, same order.
- [x] 9.2 `node --check` (via `.mjs` copies) passes for `viewmode.js`, `scene.js`,
  `ui.js`, and any other touched modules.
- [ ] 9.3 Manual browser verification of all paths: capable desktop (world default,
  toggle to simple and back, preference remembered), mobile/coarse-pointer, reduced-
  motion (forced simple, no autonomous motion, stored choice untouched), forced
  no-WebGL (full simple view).
- [x] 9.4 Confirm graceful-degradation paths (no-webgl, reduced-motion, mobile quality,
  sample graph, jarvis offline) all resolve correctly into the new simple view.
