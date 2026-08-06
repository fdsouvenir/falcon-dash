# Falcon Dash Design System

This is the current visual source of truth. `src/app.css` is its executable token definition and
[FRONTEND.md](FRONTEND.md) contains implementation rules.

## Character

Falcon Dash is a calm, dense flight deck for agent-assisted work: matte warm charcoal, quiet
instrumentation, precise typography, and one dominant accent. It should feel like a well-run room
at night, not a marketing page, neon AI dashboard, or generic infrastructure console.

Amber means a person is needed. Agent-owned or healthy activity stays cool and restrained.

## Color roles

Current global tokens:

| Role           | Value     | Use                                       |
| -------------- | --------- | ----------------------------------------- |
| Canvas         | `#131315` | page background                           |
| Lowest surface | `#0e0e10` | shell/sidebar depth                       |
| Panel          | `#1b1b1d` | primary grouped surface                   |
| Raised         | `#2a2a2c` | hover, input, secondary surface           |
| Border         | `#353437` | zone boundaries and hairlines             |
| Primary text   | `#e5e1e4` | readable warm foreground                  |
| Muted text     | `#9b9a94` | labels and metadata                       |
| Raptor amber   | `#f7bf59` | human-needed state, focus, primary action |
| Pressed amber  | `#d9a441` | primary containers and pressed state      |
| Healthy        | `#5cbb7a` | active, succeeded, available              |
| Danger         | `#d96757` | blocked, failed, destructive              |
| Information    | `#7a9cc4` | neutral readiness and information         |
| Authority      | `#a78bcb` | Reviews, Authorizations, governance facts |

Do not add a blue-navy base, decorative gradients, glows, or a second general-purpose accent.
Status color communicates meaning rather than decoration.

## Work object identity

Object colors identify type only in a small glyph tile. They do not color whole rows, text systems,
or panel borders.

| Type       | Token                    |
| ---------- | ------------------------ |
| Task       | `--work-type-task`       |
| Question   | `--work-type-question`   |
| Decision   | `--work-type-decision`   |
| Change     | `--work-type-change`     |
| Finding    | `--work-type-finding`    |
| Project    | `--work-type-project`    |
| Plan       | `--work-type-plan`       |
| Milestone  | `--work-type-milestone`  |
| Automation | `--work-type-automation` |
| Area       | `--work-type-area`       |
| Blocker    | `--work-type-blocker`    |

Glyph + short mono ID + title is the common Work row identity. Type color never substitutes for
status or actionability.

## Typography

- **Geist** is the self-hosted interface face at weights 400, 500, and 600.
- **Geist Mono** is used for IDs, timestamps, counts, numerical metrics, commands, and terminal
  content.
- Body text has a 14px minimum and comfortable leading. Long prose stays near 65 characters per
  line.
- Hierarchy comes primarily from weight, spacing, and foreground role rather than oversized display
  text.

Do not use Inter, remote fonts, serif display faces, emoji as navigation chrome, or default system
fonts as the product identity.

## Surfaces and components

- Use one border per zone and hairline divisions inside it. Avoid cards inside cards.
- The base radius is 8px; larger shared components may use the tokenized radius scale when their
  interaction requires it. Do not create a competing radius system.
- Work rows are compact, keyboard-focusable, and at least 44px tall; primary touch controls target
  48px on narrow viewports.
- Primary buttons use amber with dark text. Secondary buttons are quiet surfaces or hairline
  outlines. Destructive actions use danger semantics and confirmation.
- Inputs use a label above, help/error below, and amber focus. Floating labels are not part of the
  system.
- Filled badges are reserved for compact governance facts. Ordinary statuses use toned text.
- Loading uses layout-matched skeletons when possible. Empty states keep the structure and state one
  definitive result.

## Layout

- Use CSS Grid for structured relationships and flex layouts for linear controls.
- Keep content contained near 1500px where wide layouts need a reading boundary.
- Prefer list + detail, workspace + inspector, inbox + action panel, and label-rail grouped data.
- Use asymmetry when information weight differs; avoid three equal promotional cards.
- Collapse without horizontal scrolling below 768px and use `100dvh` plus safe-area insets.
- Density comes from aligned rows and hairlines, not tiny type or clipped content.

## Copy and motion

- Use direct product labels and decision-oriented helper text.
- Do not add eyebrows, taglines, repeated location labels, object-type tutorials, or counts stated
  twice.
- Do not expose internal terms such as “operator”, “control plane”, “Mission Control”, or
  “Automata” as user-facing navigation/copy.
- Motion is reserved for state changes, sheets, focus, and one restrained reveal where it helps
  comprehension. Honor `prefers-reduced-motion` and avoid parallax or decorative loops.

## Accessibility

- Maintain readable contrast and a visible 2px focus treatment.
- Preserve keyboard order, labels, described errors, and modal focus trapping.
- User text-size preference and browser zoom must not cause ordinary workflow overflow.
- Never rely on color alone for state, type, or authority.
- Verify loading, empty, error, disconnected, long-content, zoom, reduced-motion, and narrow-width
  states in the real shell.
