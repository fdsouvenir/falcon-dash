# Work

Work is Falcon Dash's shared dashboard and the agent-facing source of truth.

Use `/work` to see what needs a human call, what is at risk, what the agent can act on, what is
waiting, and which governance or automation states need attention. Falcon Dash opens to Work by
default; `/` redirects to `/work`.

## Destinations

The Work shell keeps five destinations available on every Work page:

- **Work** — the overview inbox: what needs your call, what is at risk, what is in motion, and recent activity.
- **Projects** — the portfolio and each Project's route, proof, current work, and history.
- **Needs Resolution** — Questions, Decisions, Reviews, and Authorizations requiring a human.
- **Automations** — live OpenClaw automation configuration, health, scheduling, and Run history.
- **Browse** — search and filters across existing Work and knowledge objects.

Creation is agent-driven. Browse does not provide generic create forms. Project-local Phase and
Milestone composers are the limited exception because they shape an existing Project's route and
proof. Work v3 does not include an in-product agent composer.

## Work overview

The signal strip answers four questions: what needs your call, what is at risk, what is due next,
and what changed recently. Each total links to its detailed section and shows the mix of Work
types.

Below it, "Due next" groups dated work into Today (including anything overdue, in red), This week,
Next week, and Later. Two grouped panels follow: "Needs your call" (decisions, questions, review
outputs, plan reviews, and change gates — Review stays separate from Authorization and
Verification) and "At risk and waiting" (blocked work, unhealthy automations, reconciliation,
external and agent waits, and what the agent is working on). Every empty group gives a definitive
state, and bounded groups link onward for the remaining items.

The overview refreshes its queue after Work events while the page is open. If the live stream is
temporarily unavailable, the current page remains usable and a normal navigation or reload gets the
latest state.

## Portfolio and Browse

Projects opens with a compact health distribution and counted focus filters for blocked, at-risk,
overdue, no-next-move, and stale outcomes. Project rows use reader-supplied health and progress;
target and last-update timestamps support the date-focused views. Selecting a focus writes the
choice to `?focus=` so the view is linkable and reload-safe.

Browse is an inspection surface, not a creation surface. Type tabs cover Tasks, Questions,
Decisions, Changes, Projects, Findings, and Areas. Types with an operator focus taxonomy show
counted focus chips: Task timing/actionability, Project health and motion, Change Authorization/
Verification/failure, and Finding validity. Full-text matches highlight the indexed snippet.
Terminal and archived rows remain available in a collapsed section, and unsupported search input is
shown as an explicit error.

Needs Resolution keeps Questions, Decisions, Reviews, and Authorizations in four separate sections.
Rows expand in place to expose semantic actions without losing queue context. A Review records an
evaluation of an exact submitted revision; an Authorization grants exact-scope permission and is
never implied by Review. The page loads the complete set of Change Requests needing Authorization,
with authority-ready Plans first, instead of applying the bounded overview-queue row limit.

## Object Pages

Each Work type has a distinct detail experience rather than a generic record card:

- Tasks show their definition, completion condition, result, operating context, blockers, waiting
  state, legal lifecycle commands, and command timeline.
- Questions lead with the prompt and impact, section long context into a scannable brief, and keep
  the authoritative answer, confidence, revisions, and sources together.
- Decisions present stakes, consequence of delay, options, recommendation, deciders, and
  supersession lineage before asking for one radio-card selection and rationale. A recommendation
  is labeled but does not choose itself.
- Change Requests show execution, verification, and Authorization in one compact state strip. Reviews are
  evaluations; they are never presented as permission to execute. A guarded execution control
  remains visible and explains which Authorization state prevents it.
- Findings show conclusion, significance, confidence, validity, sources, and supersession. A
  source that cannot be resolved stays visible with its unavailable reason.
- Projects use a ledger: Status, Route, Proof, Current work, and History, with the operating brief
  pinned alongside it on wide screens. Status includes server-derived health, progress, current
  next work, and risk flags. Route manages ordered Phases. Proof distinguishes work that merely
  contributes from terminal, source-backed satisfaction assertions and explicit authority
  waivers. Current work groups Tasks, Questions, Decisions, and Change Requests by Phase.
- Automations operate on the same OpenClaw-backed object and show runtime unavailability as a health
  error, not as a fake lifecycle state. The inventory distinguishes lifecycle from health. Detail
  pages read native Run history through from OpenClaw, keep Falcon lifecycle history separate, and
  restore a deleted snapshot as a new paused runtime object.

## Semantic Actions

Buttons issue semantic Work commands; they do not patch fields or write lifecycle state directly.
The action form is generated from the shared command contract, so required fields and optional
fields stay consistent with the CLI and API.

Consequential actions require confirmation. When a command is present but unavailable, the page
explains the unmet guard. If an object changes while a form is open, Falcon Dash preserves the
entered values, reports the current version, and offers a refresh-and-reapply path.

On a small screen, semantic actions collapse into a sticky action bar above the Falcon navigation.
Opening it presents one selected command form in a bottom sheet; other legal or guarded commands
remain available as touch-sized choices without filling the object page with forms.

The history timeline records the actor, event, version transition, and sources across the Project,
its assigned Work, Plans, Reviews, Authorizations, structure, and proof links. Evidence is visible
on every source-bearing event; authority-creating acts are called out with their claimed human
authority source. When Work moves between Projects, each ledger keeps only the events from the
periods when that Work belonged to it, including the incoming and outgoing assignment boundaries.
Pending assignment boundaries take effect immediately even while Event Log transfer is catching
up.

Project pages are the only Work pages with creation controls. Their collapsed operating-brief
controls add a Phase or Milestone within the current Project; they do not create generic Work.
Phase and Milestone lifecycle controls stay attached to the structure they govern, and Milestone
achievement requests source references. Archiving a Project freezes these child structure
controls until the Project is restored.

## Agent Contract

Agents use `/api/v3`, the Work CLI, or generated context. Work objects are referenced by their
type and ID, such as `Change Request c28` or `Project p4`.

Falcon Dash maintains the authoritative structured state. Clients may format, group, filter, and
link reader projections, but they must not infer lifecycle, health, actionability, Authorization
effectiveness, or reconciliation state that the server has not supplied.
