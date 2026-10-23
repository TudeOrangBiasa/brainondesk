---
colors:
  agent: "#d97757"
  agent-foreground: "#ffffff"
  azure-blue: "#3784ff"
  sky-blue: "#69a3ff"
  crystal-blue: "#d5e5ff"
  morning-mist: "#fbf9f4"
  night-sky: "#231f20"
  blue-dark: "#29325c"
  cream: "#f7f4ed"
  white-cream: "#fff5e1"
  orange-light: "#fbe1bc"
  gray-light: "#5f5c62"
typography:
  sans: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
  mono: "JetBrains Mono Variable, ui-monospace, monospace"
  scale:
    2xs: 0.688rem
    1sm: 0.813rem
rounded:
  base: 0.625rem
spacing:
  base: 4
components:
  - button
  - dialog
  - combobox
  - toast
  - sidebar
  - editor
---

# DESIGN.md

## Overview

BrainOnDesk (app + desktop + docs site) uses Tailwind v4 with shadcn `neutral` base, Radix primitives, and one Base UI island (spelling-language combobox). Dark mode is class-based (`.dark`). Design tokens live as `@theme` variables in `packages/app/src/globals.css`; per-IDE palettes (Dracula, Nord, …) are generated from `src/lib/color-themes.ts` into `color-themes.generated.css` and out-specify the base blocks.

## Colors

Primary brand blue is `--color-azure-blue: #3784ff` with a full `azure-50…950` oklch ramp. Neutrals are oklch gray `50…950`. Surfaces: `--color-morning-mist: #fbf9f4` (light), `--color-night-sky: #231f20` (dark), `--color-cream: #f7f4ed`. Agent affordances use terracotta `--color-agent: #d97757` on white foreground — reserved for agent presence (badges, insert flashes, undo-ready nudge), never for brand CTAs. File-tree muted chrome uses `--color-tree-muted` (light-dark gray-400/500) shared between the Pierre shadow tree and sidebar rows.

## Typography

Sans: Inter Variable; mono: JetBrains Mono Variable. Two sub-base steps exist: `text-2xs` (11px) and `text-1sm` (13px) for dense chrome (file trees, pickers, status rows).

## Layout

App shell is a sidebar + editor + panel layout. Desktop serves the same CSS via electron-vite (`root: packages/app`), so every utility used outside `src/**` — HTML entries, Streamdown dist chunks — needs an explicit `@source` line in `globals.css` or it silently drops in desktop-dev while working in web-dev.

## Elevation & Depth

Overlays (dialogs, popovers, combobox popup) portal inside the dialog focus boundary; Escape dismisses innermost popup first, never the whole dialog. The spelling combobox popup must stay inside the Settings dialog focus boundary. Reduced-transparency mode strips `backdrop-filter` from opted-in slots and restores opaque backgrounds via the `reduced-transparency` custom variant.

## Shapes

Neutral base radius from shadcn. Motion uses strong custom easings (`--ease-out-strong`, `--ease-in-out-strong`) that outpunch built-in keywords; one-shot state flashes (agent-flash 2s, agent-insert-flash 1.4s) deliberately exceed the ~300ms interaction ceiling because they signal rare events, not frequent input.

## Components

Buttons, dialogs, toasts, and sidebar rows follow shadcn/Radix patterns. The spelling-language picker is the shadcn Combobox multiple-selection chips pattern backed by Base UI (Radix has no Combobox primitive) — keep Base UI scoped to that island. Settings search (cmdk) and the combobox each own their Escape handling; scope interception to the open popup. Agent presence: breathing badge while editing, insert flash on changed ranges, accent-slide flash on agent navigation.

## Do's and Don'ts

- Do keep `@source` directives in sync when adding entry HTML or vendored utility sources — desktop-dev is the canary.
- Do use `--color-agent` only for agent presence, not brand actions.
- Do scope Escape and focus portals to the innermost open surface.
- Don't add a second UI primitive library for a pattern Radix or the existing Base UI island already covers.
- Don't hardcode overlay colors as `rgba(255,255,255,1)` — use `var(--background)` so dark mode holds.
