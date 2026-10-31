# Design System: Falcon Dash Vault

## 1. Visual Theme & Atmosphere

A dense, restrained operator console for a local-first password manager. The product is a
KeePassXC front end used by one technical operator managing on the order of 100 credentials,
some of which are also resolved programmatically by AI agents. The interface must feel closer
to a terminal file browser or a database client than to a consumer password app: quiet, dark,
information-dense, and never decorative.

The governing emotion is *custody*. The operator is looking at their own secrets. The UI should
feel careful and deliberate — nothing playful, nothing that hides state, nothing that makes a
destructive action easy to hit by accident.

## 2. Color Palette & Roles

These are the product's existing tokens and must be preserved exactly:

- `--canvas: #131315` — page background, the deepest surface.
- `--panel: #1b1b1d` — cards, rails, table surfaces, menus. One step above canvas.
- `--border: #353437` — hairlines, dividers, input outlines, table rules.
- `--text: #e5e1e4` — primary reading text, entry titles, values.
- `--muted: #aaa9a3` — labels, metadata, timestamps, secondary counts, placeholder text.
- `--amber: #f7bf59` — the single accent. Primary actions, focus rings, selection, active nav.

The current system has no role for risk or state, which is its most serious gap. Add:

- `--danger: #e2564a` — destructive actions only (remove, revoke). Never used decoratively.
- `--danger-dim: #3a1f1c` — destructive hover/confirm backgrounds.
- `--ok: #6fbf87` — unlocked, verified, granted, healthy.
- `--warn: #d8973c` — conflict, review-required, execution-disabled.

Accent discipline: amber is for what the operator should do next. It must not appear on more
than one control per region. Danger is never a default fill — destructive buttons are text or
outline until the moment of confirmation.

## 3. Typography Rules

- `FalconGeist` for all interface text.
- `FalconMono` for anything that is data rather than prose: entry handles, group paths, field
  values (revealed and masked), version numbers, agent identifiers, timestamps, hashes.
- The mono/sans split carries meaning. If a string is stored in the database, it is mono.
- Entry titles: 14px, weight 500, `--text`.
- Field labels: 11px, uppercase, letter-spacing 0.06em, `--muted`.
- Metadata and counts: 12px, `--muted`.
- Masked values render as `••••••••••` in mono at the same size as the revealed value, so
  revealing does not reflow the row.

## 4. Component Stylings

- **Buttons.** 44px minimum target, dropping to 32px only under `@media (pointer: fine)`; 8px
  radius, 1px `--border`, `--panel` fill, `--text` label. Primary gets `--amber` fill with a
  near-black label. Destructive is borderless `--danger` text until hovered, then `--danger-dim`
  fill. Any icon-only control carries an accessible name naming the field it acts on.
- **Rows.** Entry rows are 40px, separated by a single `--border` hairline, not by card gaps.
  Hover raises the row to `#212124`. The selected row shows a 2px `--amber` left edge.
- **Inputs.** 32px tall, `--canvas` fill, 1px `--border`, 6px radius. Focus swaps the border to
  `--amber` with no glow. Monospace for any field holding a secret, handle, or path.
- **Field rows in the inspector.** A three-column grid: label (fixed 96px, `--muted`, uppercase)
  / value (flex, mono, masked by default) / actions (fixed, right-aligned). All three share a
  single baseline. This grid is mandatory — misaligned label/value/action rows are the specific
  defect this system exists to eliminate.
- **Group tree.** 24px rows, 12px indent per level, disclosure triangle, entry count in
  `--muted` on the right. Maximum nesting depth is five.
- **Empty and error states.** One line of `--muted` prose plus one action. Never an illustration.

## 5. Layout Principles

- Three-pane workspace: a 220px group rail, a fluid entry list, and a 340px inspector. On narrow
  viewports the rail becomes a scrolling strip and the inspector stacks under the list, rather
  than compressing either below readable width.
- A persistent command bar above the list holds search and the primary action. Search is always
  visible. Past a couple of dozen entries, retrieval is the product.
- Content is left-aligned to a 16px gutter and the panel respects the host container's width;
  it must never bleed past the viewport edge.
- Vertical rhythm is 4px. Row padding 8px/12px. Section gaps 16px. No gap exceeds 24px.
- Density target: at least 14 entry rows visible at 900px viewport height without scrolling.

## 6. Motion & Interaction

- Reveal is a toggle on one control, never a Reveal button beside a Hide button.
- A revealed value auto-masks after 15 seconds, matching the shipped hold; shortening it is a
  security decision, never a design one.
- Copy gives a 1.5s inline confirmation in place of the button label. No toast.
- Inspector slide-in is 120ms ease-out. Row hover is instant. Nothing else animates.
- Destructive actions require typing the entry name to confirm, and the confirm button stays
  disabled until the typed value matches.
- Optimistic concurrency is user-visible: if the stored version has moved underneath an open
  editor, the UI shows a conflict banner offering reload or overwrite, never a silent failure.

## 7. Anti-Patterns / Constraints

- Never render a row of more than three peer buttons. Secondary and destructive actions live in
  an overflow menu.
- Never show a Reveal control for a field the record does not carry. Field presence is known.
- Never display a secret value without an explicit reveal, and never place a revealed value in
  a screenshot-friendly position such as a page heading.
- Never style a destructive control identically to a benign one.
- No cards-in-cards. No drop shadows. No gradients. No rounded corners above 8px.
- No marketing language, no illustrations, no onboarding hero, no metrics dashboard.
- Do not invent fields. A record carries exactly: password, username, url, notes, plus version.
- There is one kind of entry. Never surface a Login/Agent badge, a type filter, or a create-time
  choice of record shape: the storage difference is internal and every entry is agent-readable.
- KeePassXC records **no modification timestamp**, so no list may show a "Modified" column.
- The list shows title and group only. Reading any field costs one subprocess per entry, so a
  username column would delay the list by seconds; username belongs in the inspector.
- Controls keep a 44px minimum touch target; compact them only under `@media (pointer: fine)`.
