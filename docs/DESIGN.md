# Design System: Falcon Dash

> Authored 2026-07-24 with the Stitch `taste-design` methodology, replacing the accidental "generic dark dashboard" direction. **Approved 2026-07-24** (#344, via the Stitch render in project "Falcon Dash Work", stitch.withgoogle.com/projects/14770508551040756389). This is the single source of truth for Falcon Dash's visual language; global tokens adopted in `src/app.css`, Work module first, other modules follow per page pass (#344).

## 1. Visual Theme & Atmosphere

A **flight deck for an agent fleet**: cockpit-dense (7/10), structured asymmetry (4/10), restrained fluid motion (4/10). The room is dark, warm, and calm — matte charcoal with no blue cast — and the instruments do the talking. One color owns the room: **amber means the operator**. Anything that needs the operator's hand glows raptor-gold; everything the agents handle themselves stays cool and quiet. The second voice is the terminal: every identifier, timestamp, and numeral is monospaced, because this product's native tongue is a CLI.

The feeling to protect: _a well-run operations room at night_ — not a SaaS marketing page, not a neon "AI dashboard".

## 2. Color Palette & Roles

### Neutrals (warm zinc — no blue-navy cast anywhere)

- **Obsidian** `#131315` — page canvas. Never pure black.
- **Panel Coal** `#1A1A1D` — primary panel surface.
- **Raised Coal** `#202024` — raised rows, hover fills, input surfaces.
- **Hairline** `rgba(255,255,255,0.08)` — all interior structure; 1px only.
- **Bone** `#EDECE8` — primary text (warm off-white, matches the matte room).
- **Smoke** `#9B9A94` — secondary text, labels, metadata.
- **Ash** `#6E6D68` — tertiary/disabled text.

### The accent (exactly one hue, two steps)

Raptor Amber is the operator's color — needs-you signals, focus rings, active nav, primary buttons, links. If it's amber, it's asking for the operator. Never used decoratively. It ships as a two-step scale (values match the approved Stitch render and `src/app.css`):

- **Raptor Amber 400** `#F7BF59` — the interactive amber on dark surfaces: `--primary`, focus rings, active nav, and ALL attention/warning states (`--status-warning` is this exact value — "warning" and "needs the operator" are the same fact).
- **Raptor Amber 500** `#D9A441` — pressed states and containers (`--primary-container`), and the primary for a future light theme.

### Status (semantic, unchanged in meaning; recalibrated to the warm room)

- **Live Green** `#5CBB7A` — active/healthy/succeeded.
- **Signal Red** `#D96757` — danger/blocked/failing (warm red, not neon).
- **Steel Blue** `#7A9CC4` — info/ready (the only cool note, kept quiet).
- **Authority Violet** `#A78BCB` — authority acts, review dispositions.
- Attention/warning states use **Raptor Amber 400** — same token value as the accent, by design.

### Object-type palette (data encoding, glyph tiles ONLY)

Each v3 Work object type has a fixed hue + Lucide glyph, rendered as a small rounded tile: icon at full hue on a 12–15% alpha wash of the same hue. The hue never appears in text, borders, or backgrounds outside the tile — type color is identification, not decoration. (Validate final values with the dataviz categorical-palette method for contrast in both themes.)

| Type       | Glyph (Lucide)        | Hue                 |
| ---------- | --------------------- | ------------------- |
| Task       | `SquareCheck`         | Teal `#4FB3A9`      |
| Question   | `CircleHelp`          | Violet `#9D8CD6`    |
| Decision   | `Scale`               | Magenta `#C77BA4`   |
| Change     | `GitPullRequestArrow` | Orange `#D08A4F`    |
| Finding    | `FileSearch`          | Moss `#8FAE5D`      |
| Project    | `FolderKanban`        | Cobalt `#6D9BD1`    |
| Plan       | `Map`                 | Slate `#8B98A8`     |
| Milestone  | `Flag`                | Emerald `#57B98A`   |
| Automation | `Timer`               | Ice `#7BB8C9`       |
| Area       | `LayoutGrid`          | Stone `#A29A8C`     |
| Blocker    | `OctagonAlert`        | Signal Red (status) |

The glyph tile always pairs with the mono short id (`d2`, `c8`, `t42`) — the same names the operator and the agents use in the CLI. Glyph + id + title is the universal row anatomy everywhere Work renders.

## 3. Typography Rules

- **UI / Body:** **Geist** (self-hosted woff2) — weight-driven hierarchy (400/500/600), track-tight headings, no oversized display text. Hierarchy comes from weight and Smoke-vs-Bone color, not size jumps.
- **Data / Mono:** **Geist Mono** — ALL numerals, ids, timestamps, counts, KPI values, keyboard hints. Tabular figures. This is the product's signature texture (cockpit-dense rule: numbers are always mono).
- Body text ≥ 14px, relaxed leading, 65ch max on prose.
- **Banned:** Inter, system-default sans as the identity, any serif, decorative display fonts.

## 4. Component Stylings

- **Panels:** one border per zone (`1px` Hairline on Panel Coal, 10px radius); ALL interior structure via hairline dividers. Cards-in-cards are banned. Elevation exists only as the single hero moment per page (soft, background-tinted shadow) — everything else sits flat.
- **Work rows (universal anatomy):** `[type glyph tile] [mono id] [reason in status color — toned text, never filled pills] / [semibold title, truncated]`, right-aligned mono metadata. 44px min touch target, hover = Raised Coal fill, 2px Raptor Amber focus ring.
- **KPI cells:** label (Geist 500) left, value (Geist Mono, 28–32px, status-toned) right, mono breakdown subline in Smoke. 2px accent bar tinted to the cell's meaning.
- **Buttons:** flat fills, tactile 1px press translate, no glows. Primary = Raptor Amber on Obsidian text; secondary = ghost with Hairline border.
- **Inputs:** label above, error below in Signal Red, focus ring Raptor Amber. No floating labels.
- **Badges:** reserved for governance facts (authority acts, review dispositions) — everything else uses toned text.
- **Loading:** skeleton blocks matching layout; no spinners. **Empty states:** one quiet Smoke line; structure stays visible at zero data.

## 5. Layout Principles

- CSS Grid first; max-width containment (~1500px); label-rail panels (`11rem` rail + fluid content) are the house pattern for grouped data.
- Structured asymmetry: panel pairs may split unevenly when content demands (e.g. 5fr/4fr); never three equal cards in a row.
- Single-column collapse below 768px, zero horizontal scroll, `min-h-[100dvh]` never `h-screen`.
- Density discipline: `px-4 py-3` rows, hairline separation, no decorative padding.

## 6. Motion & Interaction

- One dose per page: staggered cascade reveal on the KPI strip (60ms steps, transform+opacity only, `prefers-reduced-motion` respected).
- A live-data pulse: the SSE "live" dot breathes on a slow loop; row hovers are instant fills, no transitions on color.
- Springy press feedback on buttons; nothing else animates. No parallax, no scroll choreography.

## 7. Anti-Patterns (Banned)

- Blue-navy dark surfaces, purple/neon gradients, glows — the "AI dashboard" look.
- Inter / default-system-font identity; serif anywhere.
- Filled status pills scattered through dense rows; color soup (type hues outside glyph tiles).
- Cards inside cards; three-equal-card rows; centered hero moments.
- Meta-copy: eyebrows, taglines, object-type explanations, repeated location labels, counts stated twice ("real dashboard test", issue #344).
- Ops jargon in user-facing copy: "operator", "cockpit", "control plane", "Mission Control", "Automata". (`operator` remains correct as an internal identifier — e.g. the person actor id — just never as a label a human reads.)
- Emojis in UI chrome; fabricated metrics or placeholder statistics; AI copy clichés ("Seamless", "Elevate").
- Pure black `#000000`; more than one UI accent; linear easing.

## 8. Application Map (where this lands first)

1. Global tokens (`src/app.css`): neutral recalibration, Raptor Amber accent, type-hue tokens, Geist/Geist Mono `@font-face` (self-hosted in `static/fonts/`).
2. `WorkGlyph` component (`src/lib/components/work/`) + row anatomy adoption in the Work overview.
3. Work overview panels re-toned to the amber-means-operator rule ("Needs your call" = amber accent bar; agent activity = cool tones).
4. Subsequent page passes (Projects, detail pages, Browse, Automations) inherit the same anatomy — tracked on #344.
