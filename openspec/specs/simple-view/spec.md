# simple-view Specification

## Purpose

The simple view is the calm, accessible, 2D presentation of the site. It provides
complete content parity with the explorable world from the same data sources, serves
as the universal graceful-degradation fallback (no-WebGL, reduced-motion, low-capability),
and preserves the non-3D interactive features such as opening thoughts, their changelogs,
and the terminal/ask overlay.

## Requirements

### Requirement: Complete content parity

The simple view SHALL present every content section of the site — hero, live system
feeds, thoughts, projects, knowledge graph (as a readable list), research/about,
agents, and contact — using the same data sources as the explorable world.

#### Scenario: All sections reachable without 3D
- **WHEN** a visitor uses the simple view
- **THEN** every `[data-station]` section's content is rendered and reachable by
  scrolling and/or in-page navigation, with no WebGL canvas present

#### Scenario: Live data still loads
- **WHEN** the simple view is active
- **THEN** activity feed, research log, arXiv picks, thoughts, jarvis status, and
  learning items load from the same API as the world view and degrade to their empty/
  offline states identically

### Requirement: Calm, elegant, accessible presentation

The simple view SHALL use a calmer, lighter, more restrained visual treatment than the
world view: legible type scale, generous whitespace, reduced simultaneous accent
colors, and no autonomous motion or parallax.

#### Scenario: No autonomous motion
- **WHEN** the simple view is rendered
- **THEN** there is no scroll-driven camera, particle motion, custom-cursor lag, or
  parallax; only direct user-initiated interactions animate

#### Scenario: Readable contrast and focus
- **WHEN** a visitor navigates the simple view with keyboard or assistive tech
- **THEN** text meets legible contrast, interactive elements have visible focus, and
  the custom cursor does not hide the native cursor

### Requirement: Simple view is the universal fallback

The simple view SHALL be the rendering used for all graceful-degradation paths
(no-WebGL, reduced-motion, low-capability/mobile) rather than a separate bare layout.

#### Scenario: No-WebGL device
- **WHEN** the world cannot initialize
- **THEN** the full simple view is shown (not a stripped flat fallback) with all
  content intact

### Requirement: Interactive content preserved

The simple view SHALL preserve the existing interactive content features that are not
inherently 3D: opening a thought, viewing its changelog/revisions, and the terminal/
"ask" overlay.

#### Scenario: Open a thought and its changelog
- **WHEN** a visitor selects a thought in the simple view
- **THEN** the thought opens with its read view and changelog tabs working as in the
  world view
