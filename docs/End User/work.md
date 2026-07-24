# Work

Work is Falcon Dash's operator control plane and the agent-facing source of truth.

Use `/work` to see what needs a human call, what is at risk, what the agent can act on, what is
waiting, and which governance or automation states need attention. Falcon Dash opens to Work by
default; `/` redirects to `/work`.

## Destinations

The Work shell keeps five destinations available on every Work page:

- **Mission Control** — the executive action queue and material recent changes.
- **Projects** — the portfolio and each Project's route, proof, current work, and history.
- **Needs Resolution** — Questions, Decisions, Reviews, and Authorizations requiring a human.
- **Automata** — live OpenClaw automation configuration, health, scheduling, and Run history.
- **Browse** — search and filters across existing Work and knowledge objects.

Creation is agent-driven. Browse does not provide generic create forms. Project-local Phase and
Milestone composers are the limited exception because they shape an existing Project's route and
proof. Work v3 does not include an in-product agent composer.

## Mission Control

The first row answers four questions: what needs your call, what is at risk, what an agent can act
on, and what is waiting. Each total links to its detailed section and shows the mix of Work types.

The detailed queue keeps Review separate from Authorization and Verification. Waiting is split
between agent handoffs and external dependencies. Every empty section gives a definitive state,
and bounded queues link to Browse for the remaining items.

Mission Control refreshes its queue after Work events while the page is open. If the live stream is
temporarily unavailable, the current page remains usable and a normal navigation or reload gets the
latest state.

## Object Pages

Each Work type has a distinct detail experience rather than a generic record card:

- Tasks show their definition, completion condition, result, operating context, blockers, waiting
  state, legal lifecycle commands, and command timeline.
- Questions lead with the prompt and impact, section long context into a scannable brief, and keep
  the authoritative answer, confidence, revisions, and sources together.
- Decisions present stakes, consequence of delay, options, recommendation, deciders, and
  supersession lineage before asking for one radio-card selection and rationale. A recommendation
  is labeled but does not choose itself.
- Change Requests show execution, verification, and Authorization as separate facts. Reviews are
  evaluations; they are never presented as permission to execute. A guarded execution control
  remains visible and explains which Authorization state prevents it.
- Findings show conclusion, significance, confidence, validity, sources, and supersession. A
  source that cannot be resolved stays visible with its unavailable reason.
- Projects use a ledger: Status, Route, Proof, Current work, and History, with the operating brief
  pinned alongside it on wide screens.
- Automata operate on the same OpenClaw-backed object and show runtime unavailability as a health
  error, not as a fake lifecycle state.

## Semantic Actions

Buttons issue semantic Work commands; they do not patch fields or write lifecycle state directly.
The action form is generated from the shared command contract, so required fields and optional
fields stay consistent with the CLI and API.

Consequential actions require confirmation. When a command is present but unavailable, the page
explains the unmet guard. If an object changes while a form is open, Falcon Dash preserves the
entered values, reports the current version, and offers a refresh-and-reapply path.

The history timeline records the actor, event, version transition, and sources. Authority-creating
acts are called out with their claimed human authority source.

## Agent Contract

Agents use `/api/v3`, the Work CLI, or generated context. Work objects are referenced by their
type and ID, such as `Change Request c28` or `Project p4`.

Falcon Dash maintains the authoritative structured state. Clients may format, group, filter, and
link reader projections, but they must not infer lifecycle, health, actionability, Authorization
effectiveness, or reconciliation state that the server has not supplied.
