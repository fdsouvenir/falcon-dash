# Article Notes

Source: `https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4`

Use this reference when you need a compact playbook for prompting or reviewing a visually led
frontend task.

For Falcon Dash, apply the article's guidance through the existing product constraints:

- SvelteKit 2 + Svelte 5 runes
- Tailwind 4 utilities
- dark layered tokens from `src/app.css`
- shared UI primitives in `src/lib/components/ui/`
- desktop/mobile shell split instead of one universal page frame

## High-Signal Takeaways

- Start with low or medium reasoning for simpler frontend work; raise it only when the task is
  unusually ambitious or tangled.
- Define constraints before implementation: type, color, layout, section count, and primary CTA.
- Give the model visual guardrails such as screenshots, mood boards, or a clearly written visual
  direction.
- Structure the page like a narrative rather than a pile of components.
- Ground the interface in real copy, product context, or believable data.
- Verify visually across multiple viewports.

## Prompt Recipe

When you need a starting prompt, include:

1. What the surface is and who it is for.
2. The desired visual thesis.
3. The design constraints.
4. The page or screen structure.
5. The interaction ideas.
6. The verification requirements.

Example shape:

```text
Build a [surface] for [audience/use case].

Visual thesis:
- [mood, material, energy]

Constraints:
- [font guidance]
- [color/token guidance]
- [section count / above-the-fold rules]
- [desktop + mobile requirement]

Structure:
- [hero/workspace]
- [support/proof/detail]
- [final action]

Interaction:
- [entrance motion]
- [scroll/sticky/depth effect]
- [hover/state transition]

Verification:
- Check desktop and mobile layouts
- Ensure fixed elements never overlap primary content
- Remove any motion or decoration that does not improve clarity
```

Falcon Dash variant:

```text
Use $frontend-skill to refine this Falcon Dash screen.

Context:
- This is a SvelteKit/Svelte 5 product surface, not a marketing page.
- Keep the existing dark surface hierarchy and semantic status colors.
- Prefer shared UI primitives and tokenized classes over bespoke styling.

Surface:
- Build for the existing desktop shell and mobile shell.
- Organize the screen as [list + detail / workspace + inspector / status + feed].

Constraints:
- Maintain compact, operator-friendly density.
- Avoid card mosaics and decorative gradients.
- Keep copy operational and scannable.

Interaction:
- Add only restrained transitions that improve state changes, sheets, or affordance clarity.

Verification:
- Check loading, empty, error, and connected states.
- Check overflow and scrolling inside the shell.
- Check mobile layout, safe areas, and bottom navigation interactions.
```

## Review Questions

- Does the first viewport read as one composition?
- Is the visual anchor doing real narrative work?
- Is the copy specific enough to sound like a real product?
- Is the page organized into clear sections with one job each?
- Are cards solving interaction problems, or just filling space?
- Does the mobile layout preserve the same hierarchy?
- Does the screen still match Falcon Dash's existing shell and token system?
- Are status colors semantic, or just decorative?
- Did the implementation use the repo's shared UI building blocks where appropriate?

## When To Escalate

Increase ambition only when the brief supports it:

- richer motion systems
- more expressive typography
- stronger imagery direction
- more involved storytelling layouts

If the repo already has a strong design language, adaptation is more important than novelty.

That rule applies strongly in Falcon Dash. The best result usually feels like a sharper version
of the current product, not a brand-new aesthetic.
