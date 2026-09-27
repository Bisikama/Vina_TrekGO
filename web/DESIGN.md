---
name: Trekking Portal
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
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#26513c'
  on-tertiary: '#ffffff'
  tertiary-container: '#3e6953'
  on-tertiary-container: '#b7e6cb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b1f0cd'
  primary-fixed-dim: '#96d4b2'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#105137'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#beedd1'
  tertiary-fixed-dim: '#a3d1b6'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#244f3a'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an authentic, dependable, and field-ready environment for an outdoor adventure and trekking ecosystem. Built for trekkers, mountain guides, logistics operators, and emergency responders, the interface balances natural serenity with tactical utility.

The design movement combines **Modern Utilitarianism** with subtle **Tactile Precision**:
- **Field-Ready Clarity**: High contrast ratios, scannable data chips, clear typographic hierarchies, and functional information density.
- **Calm Authority**: Grounded organic tones (forest green and warm neutral canvas) provide focus during preparation and calm assurance during incident response.
- **Tone & Voice (Vietnamese)**: Direct, inspiring, and safety-conscious. Action verbs are precise (e.g., "Bắt đầu hành trình", "Thuê thiết bị", "Gửi tín hiệu SOS").

## Colors

The palette draws inspiration from highland canopy and alpine trailheads, anchored by warm stone neutrals rather than sterile whites.

### Role Allocations
- **Primary (`#2F6B4F`)**: Canopy Forest Green. Used for primary calls-to-action, active navigation states, verified trail badges, and progress milestones.
- **Primary-Dark (`#1F4A36`)**: Deep Pine. Used for hover states on primary controls, sidebars, and critical system anchors.
- **Accent / Warning (`#F59E0B`)**: Alpine Amber. Applied to expedition highlights, weather alert tags, rating stars, and equipment availability notices.
- **Background Canvas (`#F7F7F4`)**: Limestone White. Soft off-white base reducing eye fatigue across prolonged route planning sessions.
- **Surface (`#FFFFFF`)**: Pure White. Dedicated to cards, elevated sheets, modal dialogs, and tabular data containers.
- **Text Primary (`#1F2937`)**: Deep Charcoal. Primary reading color ensuring strict WCAG AAA compliance against surface white and canvas.
- **Text Muted (`#6B7280`)**: Slate Grey. Secondary route metadata, coordinates, elevation specs, and timestamp labels.
- **Border / Hairline (`#E5E7EB`)**: Light Slate. Crisp, low-contrast bounding strokes for cards, separators, and inputs.
- **Functional Semantics**:
  - `Success` (`#16A34A`): Trail clear, check-in confirmed, gear reserved.
  - `Danger` (`#DC2626`): SOS broadcasts, high-risk storm warning, hazardous trail conditions.
  - `Info` (`#2563EB`): Route telemetries, permit requirements, GPS sync indicators.

## Typography

Typography relies exclusively on **Inter** to ensure maximum legibility for Vietnamese diacritics, geospatial coordinate readings, and compact data tables.

- **Numerics & Data**: Elevation gains (`+1,420m`), distance markers (`18.4 km`), and GPS waypoints should be typeset with tabular figures (`font-variant-numeric: tabular-nums`) to prevent optical wobble in live telemetry.
- **Hierarchy Rules**: Display levels are reserved for trail hero sections and promotional package intros. Section titles rely on `headline-md` and `headline-sm` with snug letter spacing for maximum scan efficiency.

## Layout & Spacing

This design system uses a strict **8px baseline spatial grid** across all desktop views, reflowing smoothly on portable touch devices.

- **Grid Architecture**:
  - **Desktop (1200px+)**: 12-column grid, `24px` (`1.5rem`) gutter, `32px` (`2rem`) margin. Max container width capped at `1440px`.
  - **Tablet (768px - 1199px)**: 8-column grid, `16px` (`1rem`) gutter, `24px` (`1.5rem`) margin.
  - **Mobile (< 768px)**: 4-column fluid layout, `12px` gutter, `16px` outer margin.
- **Rhythm Principles**:
  - Inline component stacks (icons with text, metadata items) use `space-xs` (8px).
  - Card internal padding uses `space-md` (16px) or `space-lg` (24px).
  - Vertical spacing between independent modules (e.g., Trail Map vs. Gear Checklist) standardizes on `space-xl` (32px) or `48px`.

## Elevation & Depth

Visual depth is achieved through **restrained atmospheric layering** that mimics ambient daylight over terrain rather than harsh directional casting.

1. **Base Flat (0dp)**: Surface `#FFFFFF` sits directly on Canvas `#F7F7F4`, segmented strictly by subtle borders (`1px solid #E5E7EB`).
2. **Elevated Card (1dp)**:
   - Box Shadow: `0 1px 3px 0 rgba(31, 41, 55, 0.06), 0 1px 2px -1px rgba(31, 41, 55, 0.04)`
   - Border: `1px solid #E5E7EB`
   - Purpose: Trail cards, gear items, guide profiles.
3. **Floating Controls & Dropdowns (2dp)**:
   - Box Shadow: `0 4px 12px -2px rgba(31, 41, 55, 0.08), 0 2px 6px -2px rgba(31, 41, 55, 0.04)`
   - Purpose: Map tooltips, filter popovers, operational drop-downs.
4. **Emergency Modals & Action Overlays (3dp)**:
   - Box Shadow: `0 12px 32px -4px rgba(31, 41, 55, 0.16), 0 4px 12px -2px rgba(31, 41, 55, 0.08)`
   - Backdrop: `rgba(31, 41, 55, 0.45)` with `backdrop-filter: blur(4px)`.
   - Purpose: SOS trigger screens, payment confirmations, critical incident dispatched boards.

## Shapes

The shape system adopts consistent curved geometry (Scale 2) to maintain approachable outdoor-equipment ergonomics.

- **Standard Cards & Modules**: Explicit `12px` corner radius (`0.75rem`), balancing organic softness with structural stability.
- **Buttons, Form Inputs & Selectors**: `8px` (`0.5rem` / `rounded-md`) for predictable hit areas.
- **Pills & Chips**: Fully circular (`rounded-full`) for route status, difficulty tags (`Dễ`, `Trung bình`, `Thử thách`), and GPS coordinates.
- **Outer Modals & Sheets**: `16px` (`1rem` / `rounded-lg`) for large dialogue frames.

## Components

### Buttons
- **Primary**: Solid `#2F6B4F`, text `#FFFFFF`, radius `8px`, height `44px` (desktop). Hover: `#1F4A36`. Focus-visible: outline `2px solid #2F6B4F`, offset `2px`.
- **Secondary / Outlined**: Background transparent, border `1px solid #E5E7EB`, text `#1F2937`. Hover: background `#F7F7F4`, border `#2F6B4F`.
- **Emergency / SOS**: Background `#DC2626`, text `#FFFFFF`, bold weight. Pulse animation on active telemetry broadcast.

### Chips & Badges
- **Difficulty Badges**:
  - *Dễ (Easy)*: Background `#DCFCE7`, text `#166534`.
  - *Trung bình (Moderate)*: Background `#FEF3C7`, text `#92400E`.
  - *Khó / Thử thách (Hard)*: Background `#FEE2E2`, text `#991B1B`.
- **Telemetry Chips**: Height `28px`, neutral background `#F7F7F4`, border `1px solid #E5E7EB`, text `#1F2937`, containing icon + stat (e.g., `⚡ 12.4 km`, `▲ 850m`).

### Form Inputs & Selectors
- **Text & Date Fields**: Height `42px`, background `#FFFFFF`, border `1px solid #E5E7EB`, radius `8px`, padding `0 12px`.
- **Active / Focused**: Border `#2F6B4F`, ring `3px solid rgba(47, 107, 79, 0.15)`.
- **Error State**: Border `#DC2626`, text `#DC2626`, helper message displayed below with warning icon.

### Checkboxes & Radios
- **Checkbox**: `18px × 18px`, `4px` radius. Active fill `#2F6B4F` with white checkmark.
- **Radio**: `18px × 18px` circular, active state has an inner `#2F6B4F` dot surrounded by a white halo.

### Cards
- **Trail & Expedition Card**: Border radius `12px`, background `#FFFFFF`, border `1px solid #E5E7EB`. Contains an aspect-ratio `16:9` image thumbnail with difficulty chip pinned top-right, title in `headline-sm`, and metadata row at bottom separated by `1px` top border.
- **Gear Rental Card**: Includes equipment thumbnail, status availability indicator (`Còn hàng` in green, `Hết hàng` in muted slate), and rapid counter control (`+` / `-`).

### Incident Response Banner
- Sticky top alerts during severe conditions or SOS dispatches. Background `#FEF2F2`, border-left `4px solid #DC2626`, text `#991B1B` with action link ("Xem chi tiết cứu hộ").