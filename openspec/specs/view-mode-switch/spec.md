# view-mode-switch Specification

## Purpose

The view-mode switch governs which presentation a visitor sees. It defaults capable
first-time visitors to the explorable world, offers a persistently reachable control
to switch between world and simple views, remembers the visitor's preference across
visits, and forces the simple view when capability or accessibility constraints require
it — without overwriting a manually stored preference.

## Requirements

### Requirement: Default view mode

The site SHALL render the explorable 3D world as the default view on a visitor's
first arrival, when no prior preference exists and the device is capable.

#### Scenario: First-time capable visitor
- **WHEN** a visitor with WebGL support, no `prefers-reduced-motion`, and no stored
  preference loads the site
- **THEN** the explorable world is rendered and the simple view is not shown

### Requirement: Visitor can switch view modes

The site SHALL provide a visible, persistently reachable control that switches between
the explorable world and the simple view.

#### Scenario: Switch from world to simple
- **WHEN** a visitor in the explorable world activates the view-mode control toward
  "simple"
- **THEN** the 3D canvas and its motion are torn down or hidden and the simple view is
  rendered with the same content

#### Scenario: Switch from simple back to world
- **WHEN** a visitor in the simple view activates the view-mode control toward "world"
  on a capable device
- **THEN** the explorable world is rendered and the simple view is hidden

### Requirement: Preference is remembered

The site SHALL persist the visitor's chosen view mode and apply it on the next visit.

#### Scenario: Returning visitor with a stored preference
- **WHEN** a visitor who previously chose the simple view returns to the site on a
  capable device
- **THEN** the simple view is rendered without first flashing the 3D world

#### Scenario: Preference storage unavailable
- **WHEN** persistence (localStorage) is unavailable or throws
- **THEN** the site SHALL fall back to the default mode for the session without error

### Requirement: Capability and accessibility forcing

The site SHALL force the simple view, overriding any stored preference, when the
device cannot or should not render the world.

#### Scenario: No WebGL
- **WHEN** WebGL is unavailable or the scene fails to initialize
- **THEN** the simple view is rendered and the world toggle is disabled or hidden

#### Scenario: Reduced motion
- **WHEN** the visitor has `prefers-reduced-motion: reduce`
- **THEN** the simple view is rendered by default and any world view shown has no
  autonomous motion

#### Scenario: Forced mode is not persisted as a manual choice
- **WHEN** the simple view is shown only because of a capability/accessibility force
- **THEN** the visitor's previously stored manual preference SHALL NOT be overwritten
