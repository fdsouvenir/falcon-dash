# Docs Ownership Map

This file maps common change areas to the docs that should usually move with them.

## Primary Docs By Change Area

| Change area                                                | Primary docs                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Shell, layout, route UX, operator surfaces                 | `docs/FRONTEND.md`, `docs/Technical/components.md`, relevant `docs/End User/*`                       |
| Store semantics, hydration, realtime state, event wiring   | `docs/RELIABILITY.md`, `docs/Technical/stores.md`, `docs/Technical/architecture.md`                  |
| Project management behavior and generated PM context       | `docs/Technical/pm-pipeline.md`, `docs/End User/projects.md`                                         |
| Gateway, channels, agents, canvas, approvals               | `docs/Technical/gateway-protocol.md`, `docs/Technical/gateway-plugin.md`, relevant `docs/End User/*` |
| Validation rules, rerun paths, smoke coverage expectations | `docs/QUALITY.md`, `docs/HARNESS.md`                                                                 |
| Plan-writing and execution discipline                      | `docs/PLANS.md`                                                                                      |

## Rule of Thumb

If a future agent would need to know about the change before editing adjacent code, the matching doc
should probably change in the same PR.
