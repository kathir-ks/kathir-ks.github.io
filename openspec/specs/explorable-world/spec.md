# explorable-world Specification

## Purpose

The explorable 3D world is the default, immersive presentation of the site:
a continuous, grounded environment whose stations appear as landmarks a visitor
can navigate freely (look, travel, move) while scroll remains a guided tour. It
preserves the interactive knowledge graph and scales detail to device capability,
handing off to the simple view when it cannot run.

## Requirements

### Requirement: Grounded continuous environment

The explorable world SHALL present its stations within one continuous, grounded
environment (a sense of ground/horizon/atmosphere) rather than as disconnected
particle fields floating in void.

#### Scenario: Spatial grounding is visible
- **WHEN** the world is rendered on a capable device
- **THEN** there is a consistent ground/horizon and atmospheric depth cue shared
  across stations, giving a coherent sense of place

### Requirement: Landmark stations

Each content section SHALL appear as a recognizable landmark in the world, and the set
of landmarks SHALL stay in sync with the `[data-station]` sections and `STATION_POS`
array (parallel, same order, same count).

#### Scenario: Station and landmark parity
- **WHEN** the world initializes
- **THEN** there is exactly one landmark per `[data-station]` section in the same
  order, and selecting a landmark surfaces that section's content

### Requirement: Free navigation through the space

The explorable world SHALL let a desktop visitor move through and look around the
space using more than scroll: pointer/drag to look, click-a-landmark to travel to it,
and keyboard movement.

#### Scenario: Travel to a landmark
- **WHEN** a visitor clicks or selects a landmark
- **THEN** the camera travels smoothly to that landmark and its content becomes the
  focused/active section

#### Scenario: Look and move
- **WHEN** a visitor drags to look or uses the movement keys on desktop
- **THEN** the view orientation/position updates responsively without disorienting
  jumps

### Requirement: Scroll remains a guided tour

Scrolling SHALL continue to work as a guided path that visits the landmarks in order,
so scroll-only and trackpad visitors lose no access.

#### Scenario: Scroll visits stations in order
- **WHEN** a visitor only scrolls
- **THEN** the camera follows a guided path through the landmarks in section order,
  equivalent in coverage to the previous scroll experience

### Requirement: Wayfinding and orientation

The explorable world SHALL provide wayfinding affordances so a visitor always knows
where they are, what landmarks exist, and how to return.

#### Scenario: Orientation aid present
- **WHEN** a visitor is anywhere in the world
- **THEN** an affordance (e.g., minimap/compass/landmark list) indicates the current
  location and the other reachable landmarks

#### Scenario: Return to start
- **WHEN** a visitor wants to go back to the beginning
- **THEN** a clearly available control returns them to the hero/origin landmark

### Requirement: Interactive knowledge graph preserved

The knowledge-graph landmark SHALL remain interactive (hover/inspect nodes) and SHALL
continue to render live epistemic data when available and the sample graph otherwise.

#### Scenario: Inspect a graph node
- **WHEN** a visitor focuses the graph landmark and points at a node on a fine pointer
- **THEN** that node's details surface, using live data if synced or the sample graph
  if not

### Requirement: Performance and graceful degradation

The explorable world SHALL maintain interactive frame rates by scaling detail to
device capability and SHALL hand off to the simple view when it cannot run.

#### Scenario: Low-capability device
- **WHEN** the device is mobile/coarse-pointer or low-power
- **THEN** detail and motion are reduced, and if the world still cannot run acceptably
  the simple view is used instead

#### Scenario: Reduced motion within the world
- **WHEN** `prefers-reduced-motion` is set but a visitor still opts into the world
- **THEN** autonomous/idle motion is disabled and navigation is driven only by direct
  input
