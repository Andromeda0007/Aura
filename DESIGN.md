# Design

## Theme
**"Aurora, grounded."** A calm, premium, studious canvas with decisive moments of color and motion. Scene that forces the choices: *a teacher glances at a large smartboard from across a lit classroom while talking and writing; the room sometimes dims for projection.* → both themes are first-class; **light = lit-room default** (crisp, high-contrast, paper-clean — NOT warm cream), **dark = dimmed-room** (deep midnight indigo, not pure black). Identity colour (indigo→violet, the "aurora") is **committed but disciplined**: one primary, one supporting accent, spent deliberately — never as decoration, never as gradient text.

## Color (OKLCH; one primary + one accent + semantic)
Strategy = **Committed-restrained**: true-neutral surfaces, ink at full contrast, indigo carries identity on key actions/active states only.

**Light**
- bg `oklch(0.99 0 0)` · surface `oklch(1 0 0)` · surface-2 `oklch(0.97 0.004 270)`
- ink `oklch(0.22 0.02 270)` (body ≥ 4.5:1) · ink-muted `oklch(0.45 0.02 270)` (NOT light gray)
- border `oklch(0.91 0.006 270)`
- primary `oklch(0.52 0.20 274)` (indigo) · primary-ink `oklch(0.99 0 0)`
- accent `oklch(0.62 0.20 300)` (violet) · positive `oklch(0.60 0.15 155)` (emerald, scores/correct) · danger `oklch(0.58 0.20 25)`

**Dark** (midnight indigo, tinted toward the brand hue — not gray, not black)
- bg `oklch(0.20 0.03 270)` · surface `oklch(0.24 0.035 270)` · surface-2 `oklch(0.28 0.04 270)`
- ink `oklch(0.95 0.01 270)` · ink-muted `oklch(0.74 0.02 270)`
- border `oklch(0.34 0.04 270)`
- primary `oklch(0.70 0.17 274)` (brighter for dark) · accent `oklch(0.78 0.15 300)` · positive `oklch(0.72 0.15 155)` · danger `oklch(0.70 0.18 25)`

Keep CSS-variable token names (`--background`, `--foreground`, `--card`, `--muted`, `--primary`, `--accent`, …) so the swap is contained to `globals.css`; add `--positive`. Verify every text/bg pair ≥ AA at smartboard brightness.

## Typography — register split (per impeccable product.md)
Aura is a **hybrid**: brand surfaces (landing `/`, auth, public quiz, end-of-class report) vs **product surfaces (app: dashboard, workspace, stats, settings, library)** where the tool must disappear into the task.
- **Brand surfaces:** pair on a contrast axis — `Fraunces` (variable serif display, optical sizing) for headlines + `Geist Sans` for everything else. Letter-spacing floor **-0.02em**; `text-wrap: balance` on h1–h3.
- **Product surfaces:** **`Geist Sans` only** (one family carries headings/labels/data) — NO serif display in UI labels/buttons/data. **Fixed rem scale** (ratio ~1.125–1.2), not fluid clamp. Full state vocabulary on every control (default/hover/focus/active/disabled/loading/error); skeletons not spinners; teaching empty states.
- **Mono:** `Geist Mono` for share codes, tokens, code blocks.

## Shape, spacing, elevation
- **Radius:** cards/inputs **12–16px** (never 24/32+); full-pill only for chips/tags/icon-buttons.
- **Spacing:** 4px base; vary rhythm (section gaps larger than intra-card). No uniform wall of equal gaps.
- **Elevation:** pick ONE per element — a single solid 1px border **or** a soft shadow ≤8px blur. **Never border+wide-shadow together** (ghost-card ban).

## Motion (emil-design-eng)
- Durations 150–300ms; **ease-out** (quint/expo); **no bounce/elastic**.
- Spend motion on meaning: AI result reveal (fade+rise, ~12px), listening pulse, quiz option lock/correct, compression chip state, page/panel transitions. Stagger lists; don't apply one identical entrance to every section.
- Reveals enhance already-visible content (never gate visibility on a transition). Every animation has a `prefers-reduced-motion: reduce` crossfade/instant fallback.

## Components
- **Buttons:** primary (solid indigo), outline, ghost, danger; ≥44px height (touch); clear focus ring (`--ring`).
- **Cards:** used sparingly, never nested; not an endless identical grid — vary size/role.
- **Board:** the hero — full-bleed, minimal chrome, recessed toolbar; ink colours remap legibly per theme.
- **Stats:** restrained stat row (label + value + tiny delta), NOT the big-number/gradient hero-metric template.
- **Result cards (quiz/summary/diagram/…):** distinct per type, one accent each, animated arrival.

## Absolute bans (refuse + rewrite)
Gradient text · glassmorphism-as-default · identical icon-card grids · cream/sand body bg · side-stripe borders · per-section uppercase eyebrows / `01 02 03` markers · border+softshadow ghost cards · over-rounding (≥24px on cards) · text that overflows at any breakpoint.

## Accessibility
WCAG AA both themes (AAA large headings); visible focus; full keyboard nav; touch targets ≥44px; reduced-motion honored everywhere.
