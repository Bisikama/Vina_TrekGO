---
name: Alpine Fin-Tech Trek
colors:
  surface: '#fbf9f3'
  surface-dim: '#dbdad4'
  surface-bright: '#fbf9f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ee'
  surface-container: '#efeee8'
  surface-container-high: '#eae8e2'
  surface-container-highest: '#e4e2dd'
  on-surface: '#1b1c19'
  on-surface-variant: '#41493a'
  inverse-surface: '#30312d'
  inverse-on-surface: '#f2f1eb'
  outline: '#717a68'
  outline-variant: '#c1cab5'
  surface-tint: '#2f6c00'
  primary: '#2f6c00'
  on-primary: '#ffffff'
  primary-container: '#9fe870'
  on-primary-container: '#2e6900'
  inverse-primary: '#91d963'
  secondary: '#47672d'
  on-secondary: '#ffffff'
  secondary-container: '#c5eba3'
  on-secondary-container: '#4b6c31'
  tertiary: '#725c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#fed018'
  on-tertiary-container: '#6f5900'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#acf67c'
  primary-fixed-dim: '#91d963'
  on-primary-fixed: '#092100'
  on-primary-fixed-variant: '#225100'
  secondary-fixed: '#c8eea5'
  secondary-fixed-dim: '#acd28c'
  on-secondary-fixed: '#0c2000'
  on-secondary-fixed-variant: '#304f18'
  tertiary-fixed: '#ffe082'
  tertiary-fixed-dim: '#eec200'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#564500'
  background: '#fbf9f3'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
typography:
  display:
    fontFamily: Space Grotesk
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system pairs the utilitarian discipline of Scandinavian fintech with the vibrant, high-vis spirit of modern alpine exploration. It serves outdoor trekkers, alpine runners, and backcountry navigators who demand instantaneous legibility in blinding direct sun, dense mist, or dusk conditions. 

The aesthetic is built on high contrast, clean architectural structure, and hyper-legible tactical data overlays. The visual tone balances technical precision with warm, approachable physical forms. Generous curved containers mimic organic stones and smooth mountain tools, juxtaposed against a razor-sharp, energetic electric lime-green (#9fe870) accent that denotes momentum, current GPS states, and active wayfinding.

## Colors

The palette synthesizes outdoor technical gear with Scandinavian minimalism:

- **Primary Accent (`#9fe870`)**: Electric lime green. Used strictly for interactive triggers, primary state badges, active GPS breadcrumbs, and live telemetry tracking.
- **Deep Forest / Secondary (`#163300`, `#2ead4b`)**: Deep organic greens. `#163300` acts as a softened alternative to harsh dark inks for secondary headers, icons, and hero graphic fills; `#2ead4b` denotes completed path segments and positive elevation changes.
- **Neutral Core (`#0e0f0c`)**: Deep dark ink. Provides stark, readable contrast for critical typographic hierarchies and high-priority tracking information.
- **Canvas & Surface Tier (`#f4f6f2`, `#e8ebe6`, `#ffffff`)**: Canvas begins at `#f4f6f2` (soft pale sage), dropping to `#e8ebe6` for recessed tray wells and track backgrounds. Elevated interactive sheets and floating HUD panels leverage pure `#ffffff`.
- **System States (`#ffd11a`, `#d03238`)**: Safety amber (`#ffd11a`) handles rapid weather shifts, daylight alerts, and battery optimization modes; Emergency red (`#d03238`) flags off-trail route deviations, SOS triggers, and storm warnings.

## Typography

The typographic hierarchy combines **Space Grotesk** for architectural, bold numeric metrics and high-impact headings with **Inter** for sustained readability in dynamic movement.

- **Headlines & Big Metrics**: Space Grotesk provides a technical, forward-leaning posture suitable for elevation counts, cardinal bearings, and trail designations. Tabular figures must be enabled for running meters, speed counters, and GPS coordinates to eliminate jitter.
- **Body & Data Labels**: Inter maintains high contrast and legibility under direct ambient sun or physical vibrations during movement. 
- **Micro-labels**: Always uppercase for trail safety classifications, weather updates, and telemetry types with generous letter spacing (`0.05em`).

## Layout & Spacing

This design system is built mobile-first around outdoor single-thumb access. The layout adheres to a 4-column fluid mobile grid anchored by an 8pt base grid rhythm:

- **Thumb Zone Anchoring**: Primary functional controls, route-recording toggles, and critical waypoint triggers are pinned to the bottom 35% of the mobile viewport.
- **HUD Safe Areas**: The top 15% of the canvas is reserved for status monitoring (battery, satellite fix, altitude status, and ambient weather).
- **Margins & Gutters**: Outer canvas padding sits at `16px` (`margin: 1rem`), while inner grid gutter spacing sits at `12px` (`gutter: 0.75rem`) to maximize viewable terrain on mapping screens.
- **Card Spacing**: Information tiles use `16px` internal padding (`space-md`) with `12px` gaps (`gutter`) in double-column layouts.

## Elevation & Depth

To preserve outdoor visibility without muddiness, this system relies on crisp tonal differentiation, low-contrast protective outlines, and selective tinted ambient drop shadows:

- **Flat Map HUD Surfaces**: Floating panels on interactive 3D map views use `#ffffff` cards supported by an ambient drop shadow tinted with deep ink (`#0e0f0c` at 8% opacity, 16px blur, 6px Y-offset) plus an ultra-thin 1px border (`rgba(14, 15, 12, 0.06)`).
- **Tonal Layering**: Non-map screens use no drop shadows. Instead, pure white cards sit flat against the `#f4f6f2` sage canvas, surrounded by a 1px border of `#e8ebe6`.
- **Active Modals & Bottom Sheets**: Interactive sheets utilize a soft frosted backdrop filter (`blur(12px)`) with an opaque `#ffffff` container to preserve contrast over colorful contour maps.

## Shapes

The geometric signature balances tactile ergonomics with functional clarity:

- **Base Cards & Modules**: Utilize `16px` to `20px` corner radii (`rounded-lg`), mirroring rounded hand tools and GPS receivers.
- **Interactive Buttons & Chips**: Utilize pure pill geometry (`9999px`) to create an instantly identifiable, friendly target for thumb taps even when wearing thin trekking gloves.
- **Elevation Profiles & Metric Bars**: Inner tracks use soft `8px` corner radii to maintain consistent internal geometric relationships.

## Components

### Buttons
- **Primary Pill**: Background `#9fe870`, text `#0e0f0c`, font `label-lg`. Full pill radius (`9999px`), minimum height of `52px` for gloved field accessibility. Active state darkens slightly to `#8dd460`.
- **Secondary / Action Pill**: Background `#0e0f0c`, text `#ffffff`, font `label-lg`.
- **Ghost Utility**: Background `transparent`, border `1.5px solid #e8ebe6`, text `#0e0f0c`.

### Chips & Weather Badges
- **Weather Status Chips**: Pill-shaped containers (`32px` height) with `#ffffff` fill, containing a mini icon, Space Grotesk metric, and micro label. Border `1px solid #e8ebe6`.
- **Hazard Badges**: Pill-shaped with `#ffd11a` background, `#0e0f0c` text, and bold uppercase micro typography.

### Input Fields & Search Bars
- **Waypoint Search**: Full pill shape, `#ffffff` surface, `48px` height, inset `16px` horizontal padding with a trail icon anchor and trailing voice/GPS locator button. Border `1.5px solid #e8ebe6`, focusing to `#0e0f0c`.

### Cards & Telemetry Tiles
- **Route Summary Card**: `#ffffff` background, `20px` border radius, `16px` padding. Contains a split layout: distance/elevation gain on the left, miniature vector SVG elevation sparkline on the right.
- **Current Position HUD Card**: Floating card at the bottom of the map, utilizing primary lime `#9fe870` for the record/pause button, dark ink `#0e0f0c` for current speed, and a forest green `#163300` progress bar for route completion.

### Elevation Profile & 3D Map GPS Cards
- **Elevation Visualizer**: Crisp vector fill using `#9fe870` with an opacity gradient fading to `rgba(159, 232, 112, 0.0)` at the baseline. Current user position is anchored by a high-contrast `#0e0f0c` pin with a center dot of `#9fe870`.
- **Off-Route Alert Pill**: Floats at top center of map view. Background `#d03238`, text `#ffffff`, uppercase `label-sm`, with pulsating micro dot indicator.