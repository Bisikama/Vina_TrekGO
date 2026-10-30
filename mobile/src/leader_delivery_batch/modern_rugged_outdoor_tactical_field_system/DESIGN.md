---
name: Modern Rugged Outdoor Tactical Field System
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#404943'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#707972'
  outline-variant: '#c0c9c1'
  surface-tint: '#2d694d'
  primary: '#125238'
  on-primary: '#ffffff'
  primary-container: '#2f6b4f'
  on-primary-container: '#aae9c6'
  inverse-primary: '#96d4b2'
  secondary: '#a33d23'
  on-secondary: '#ffffff'
  secondary-container: '#ff8162'
  on-secondary-container: '#731a04'
  tertiary: '#005249'
  on-tertiary: '#ffffff'
  tertiary-container: '#006c61'
  on-tertiary-container: '#84eddd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b1f0cd'
  primary-fixed-dim: '#96d4b2'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#105137'
  secondary-fixed: '#ffdad2'
  secondary-fixed-dim: '#ffb4a2'
  on-secondary-fixed: '#3c0700'
  on-secondary-fixed-variant: '#83260e'
  tertiary-fixed: '#8cf5e4'
  tertiary-fixed-dim: '#6fd8c8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system embodies the intersection of alpine endurance and tactical discipline: Modern Rugged Outdoor engineered with Tactical Tech precision. Designed specifically for demanding field operations—spanning high-altitude trekkers, licensed mountain leaders, safety dispatch operators, and gear warehouse logistics—the visual language prioritizes instant legibility under blinding tropical sunlight, dense jungle canopies, and harsh weather.

The aesthetic blends high-contrast utilitarian layouts with functional minimalism. Visual clutter is stripped away in favor of high-information-density data cards, bold status indicators, and tactical geometry. Every interaction delivers reassurance, mission-critical clarity, and rugged reliability. Touch targets are intentionally expanded to accommodate gloved hands, wet screens, or high-vibration movement on the trail.

## Colors

The color architecture is built to support critical field differentiation and rigorous outdoor legibility:

- **Primary (`#2F6B4F` Forest Green):** The core field brand color. Represents navigation, active route paths, primary system actions, and environmental vitality. Accompanied by **Deep Pine (`#1F4A36`)** for focused states and pressed elements, and **Darkest Pine (`#081C15`)** for high-priority tactical framing and dark utility bars.
- **Secondary (`#E76F51` Trail Orange):** Waypoint markers, urgent secondary actions, active tracking counters, and leader beacons.
- **Tertiary (`#2A9D8F` Technical Teal):** Topographical data layers, GPS signal telemetry, altitude metrics, and offline cache states.
- **Critical Status & Safety Roles:**
  - **SOS / Danger (`#DC2626`):** Emergency SOS triggers, fall detection alerts, hazard zone warnings, and abort flows.
  - **Alpine Amber / Warning (`#F59E0B`):** Severe weather inbound, rapid barometric drops, equipment check flags, and trail re-routes.
  - **Success (`#16A34A`):** Waypoint check-ins, checkpoint validations, and gear audit sign-offs.
  - **Information (`#2563EB`):** Logistic dispatches, mountain hut telemetry, and base camp sync pings.
- **Surfaces & Typography Neutrals:**
  - **Canvas (`#F7F7F4`):** Warm-tinted off-white canvas that cuts direct sun glare compared to harsh pure white.
  - **Surface (`#FFFFFF`):** High-contrast elevated panels and interactive cards.
  - **Primary Text (`#1F2937`):** Near-black text maintaining strict WCAG AAA contrast against Canvas and Surface.
  - **Muted Text (`#6B7280`):** Secondary metrics, unit labels, and auxiliary trail metadata.
  - **Border (`#E5E7EB`):** Low-profile structural boundaries defining tactical grid containers.

## Typography

Inter serves as the unified typographic engine across all roles. Its tall x-height, neutral geometric apertures, and unambiguous letterforms guarantee legibility in extreme outdoor scenarios where rapid glancing is required.

Crucially, Inter delivers native, robust rendering for complex Vietnamese diacritical marks (dấu mũ, dấu móc, and stacked tones such as ể, ẩ, ặ, ỗ), eliminating clipping or uneven vertical line rendering across altitude readings, location names, and packing manifests. Numerical information such as GPS coordinates, bearings, barometric pressure, and inventory serial numbers must utilize tabular numerals (`tnum`) to eliminate jitter during real-time GPS updates.

## Layout & Spacing

The mobile layout is anchored to a standard 390px baseline viewport, deploying a rigid 4-column fluid layout with 16px (`1rem`) outer margins and 12px (`0.75rem`) gutters. An 8px spatial baseline governs all vertical vertical positioning, rhythm, and layout stacks:

- **Touch Surface Floor:** An uncompromising minimum touch target of 48x48px is enforced on every interactive element (buttons, tabs, checkboxes, gear scan targets, SOS switches) to guarantee error-free triggering with wet fingers or tactical gloves.
- **Rhythm & Structure:** Component padding uses `space-md` (12px) for compact tactical tiles and `space-lg` (16px) for standard status cards. Stacks of cards maintain `space-sm` (8px) to `space-md` (12px) spacing to preserve high information density without visual crowding.
- **Field Ergonomics:** Primary operational commands and thumb-triggered action bars are pinned within the bottom 120px safe area of the mobile viewport, keeping top zones reserved for real-time telemetry (satellite lock status, battery reserve, offline sync status).

## Elevation & Depth

To maintain maximum screen visibility under intense glare and harsh daylight conditions, this system discards low-contrast ambient blurs and heavy drop shadows. Depth and hierarchy are achieved through structural boundaries and tactile planar steps:

- **Level 0 (Canvas):** Ground layer (`#F7F7F4`), providing an anti-glare, calm operational base.
- **Level 1 (Surface Cards & Panels):** Pure white (`#FFFFFF`) with a 1px solid border in `#E5E7EB`. Used for waypoint lists, sensor panels, and inventory line items.
- **Level 2 (Tactical Modals & Heads-Up Displays):** Pure white (`#FFFFFF`) bounded by a 1px crisp outline in `#1F2937` (or primary `#2F6B4F`) supported by a direct, tactical hard shadow (`0 2px 4px rgba(8, 28, 21, 0.08)`).
- **Level 3 (SOS & High-Priority Emergency Floats):** Solid primary or alert fill, surrounded by a 2px high-contrast rim (`#DC2626` or `#081C15`), ensuring instant visual dominance over map backgrounds and data tables.

## Shapes

The design language applies subtle, soft corner treatments (`roundedness: 1`), instilling an instrument-grade, hardware-like discipline. 

- Interactive controls, status badges, and input containers employ a base corner radius of `4px` (`0.25rem`).
- Cards, grouped telemetry units, and modal sheets scale to `8px` (`0.5rem`).
- Chip components and quick-status markers stay compact at `4px` to avoid toy-like organic pill shapes, maintaining the tactical look and feel of outdoor GPS receivers, field radios, and military compasses.

## Components

### Buttons & Action Triggers
- **Primary Field Action:** Solid Forest Green (`#2F6B4F`) background, white text (`#FFFFFF`), `Inter 14px bold`, uppercase with slight tracking (`0.02em`). Height: 48px minimum. Corner radius: 4px. Focus/Active: `#1F4A36`.
- **Secondary Action:** Transparent background with a 1.5px border in `#2F6B4F`, primary text `#2F6B4F`. Height: 48px.
- **Trail / Leader Accent:** Solid Trail Orange (`#E76F51`) background, white text. Applied exclusively to waymarking, route deviation pings, and group alerts.
- **SOS Critical Emergency Button:** Minimum 56px height, solid SOS Red (`#DC2626`), high-contrast white text, permanent 2px inset tactile outline. Features a hold-to-activate radial progress indicator to prevent false triggers.

### Chips & Tactical Status Badges
- Compact rectangular profiles (28px height, 4px radius, 8px horizontal padding).
- **Online/Synced:** `#16A34A` text on `#DCFCE7` background.
- **GPS Telemetry / Offline Cached:** `#2A9D8F` text on `#E6F4F2` background with accompanying technical glyph.
- **Hazard Warning:** `#F59E0B` text on `#FEF3C7` background.
- Typography: `label-sm` (10px, weight 700, uppercase).

### Cards & Telemetry Tiles
- Background: Surface White (`#FFFFFF`), 1px border `#E5E7EB`, 4px–8px radius.
- Padding: 12px internal. Header zones feature strong separation lines with tabular metadata displays (e.g., `ALT: 2,840m`, `BEARING: 042° NE`, `BAT: 94%`).
- Role adaptations:
  - **Trekker:** Elevation profile, remaining distance, hydration reminder.
  - **Mountain Leader:** Group roster beacon states, sweep tail distance, weather radar mini-tile.
  - **Admin / Safety Ops:** Active SAR (Search and Rescue) incident monitor, alert broadcast toggle.
  - **Warehouse / TrekOps:** Barcode / RFID scan preview, gear inspection checklist status.

### Form Inputs & Barcode Target Fields
- Form inputs feature a minimum height of 48px, background `#FFFFFF`, border 1.5px `#E5E7EB`, and `body-lg` text (`16px`) to prevent automated mobile browser zooming.
- Active/Focus state uses a 2px `#2F6B4F` border with zero blur.
- Input labels sit above in `label-md` (`12px`, `#1F2937`, weight 600) with localized Vietnamese field guidance.

### Checkboxes & Radio Selectors
- Sizing: 24x24px physical box nested inside a strict 48x48px hit target.
- Selected State: 2px border with solid `#2F6B4F` fill and crisp white checkmark / center pip. Designed for gear inspection sign-offs and rapid muster headcounts.

### Lists & Navigation Rails
- Dense list rows separated by 1px solid dividers (`#E5E7EB`). Row height minimum 52px.
- Left edge contains tactical color accents (3px vertical status strip) representing trail difficulty, gear service readiness, or individual member health beacon statuses.