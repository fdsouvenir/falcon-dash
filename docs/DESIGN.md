---
name: Synthesized Intelligence
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464555'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  code-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-md-mobile:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  sidebar_width: 260px
---

# Design System: Synthesized Intelligence

**Canonical source:** [Project Governance Portal](https://stitch.withgoogle.com/projects/13701669844013221224)

**Project ID:** `13701669844013221224`

**Authority:** The linked Stitch project is the visual and interaction-design authority for the
active desktop redesign. This repository copy records its target design system for implementation.

## Implementation status

This is the target system, not a claim that every current route already uses it. `src/app.css`
remains the executable source for shipped tokens and fonts; unchanged surfaces still use the dark
charcoal/amber palette and Geist Mono while the redesign is rolled out. Implement new approved
screens through the existing semantic CSS variables so the later global token migration does not
require route-level color rewrites.

## Brand & Style

The design system is engineered for high-stakes, AI-augmented project management. The brand personality is **Intelligent, Transparent, and Reliable**. It avoids the "black box" nature of AI by prioritizing auditability and clear reasoning paths.

The design style is **Corporate Modern with a Developer-Centric edge**. It utilizes a systematic, high-density layout that feels functional and precise. Key characteristics include:

- **Clarity over Decoration:** Every UI element serves a functional purpose in tracking agent progress.
- **High Information Density:** Designed for power users who need to oversee multiple autonomous agents simultaneously without cognitive overload.
- **Technical Sophistication:** Subtle use of monospaced elements for data points to evoke a sense of precision and "live" computation.

## Colors

The palette is rooted in a professional "Workplace White" and "Slate" foundation to ensure the interface feels grounded and reliable.

- **Primary (Indigo):** Reserved for human-led primary actions and core navigation.
- **AI/Agent (Violet/Purple):** A distinct semantic category for all agent-initiated tasks, reasoning blocks, and automated status updates.
- **Semantic Status:** Highly saturated tones for Success, Warning, and Error to ensure immediate scannability in high-density tables.
- **Neutrals:** A sophisticated range of cool grays (Slate) used to define hierarchy and "containerized" reasoning sections.

## Typography

This design system utilizes **Geist** for its systematic, neutral, and technical aesthetic, ensuring readability at small sizes in dense data grids. **JetBrains Mono** is used sparingly for labels, metadata, and "Reasoning" steps to signal technical accuracy.

- **Headlines:** Use tight letter-spacing and semi-bold weights to maintain a structured feel.
- **Body:** Set at 14px for the standard size to allow for high-density layouts without sacrificing legibility.
- **Monospace Labels:** Used for timestamps, IDs, and agent status tags to distinguish "System" data from "Content" data.

## Layout & Spacing

The layout uses a **fixed-fluid hybrid model**. A fixed-width left sidebar (260px) contains the primary navigation, while the main content area utilizes a fluid 12-column grid.

- **Density:** We use a 4px baseline grid. Padding in tables and lists should be compact (8px vertical) to maximize visible "Work" items.
- **Sidebar:** Icons are paired with labels. The "Work" item includes a subtle active-state indicator using the primary Indigo.
- **Breakpoints:**
  - Desktop (1280px+): Full 12-column grid, persistent sidebar.
  - Tablet (768px - 1279px): Sidebar collapses to icons only; 8-column grid.
  - Mobile (<768px): Single column, bottom navigation bar for core 'Work' views.

## Elevation & Depth

The design system relies on **Tonal Layers** and **Low-contrast outlines** rather than heavy shadows. This maintains a flat, efficient, and "digital-first" feel.

- **Level 0 (Background):** Slate-50 (#F8FAFC).
- **Level 1 (Cards/Surface):** Pure White with a 1px border (#E2E8F0).
- **Level 2 (Modals/Popovers):** Pure White with a soft, 8% opacity Indigo shadow to denote "active" attention.
- **Reasoning Blocks:** These use a subtle tonal shift (Slate-100) and a left-side accent border in Violet to visually "nest" the AI's logic within a task.

## Shapes

The shape language is **Soft and Precise**. A 0.25rem (4px) corner radius is the standard for cards and inputs, providing a modern look that feels disciplined rather than "bubbly."

- **Buttons/Inputs:** 4px radius.
- **Status Badges:** 2px or 4px radius (never fully pill-shaped) to maintain the systematic feel.
- **Progress Rings:** Circular, using a 2px stroke width for a lightweight, technical appearance.

## Components

- **Sidebar Navigation:** Items (Vault, Channels, Work, Tools, Skills) use 20px icons. The active "Work" state uses a ghost-button style with a 2px left border in Indigo.
- **Reasoning Blocks:** A specialized container with a light gray background and a monospaced font. It includes an "expand/collapse" chevron to show/hide the agent's step-by-step logic.
- **Status-Heavy Badges:** Rectangular with a 2px radius. Backgrounds are high-transparency (10% opacity) versions of the semantic colors, with high-contrast text for accessibility.
- **High-Density Data Tables:** No vertical borders; horizontal borders only. Row height is capped at 40px. Includes "mini-progress" bars for task completion within cells.
- **Activity Timelines:** A vertical 1px line connecting circular nodes. Agent-led nodes use the AI semantic color (Violet), while human nodes use the Primary color (Indigo).
- **Input Fields:** Flat design with a 1px Slate-200 border. Focus state switches the border to Indigo and adds a 2px "glow" (0% blur) ring.
