# The coordination agent

Falcon Dash runs one locked agent on the gateway whose entire job is to **escalate, follow up and
mediate**. It is not a general agent given a Work persona: its identity, tool policy and procedure
are fixed, in the same spirit as OpenClaw's own `openclaw` expert.

It exists because those three behaviors have no home in a plugin. A plugin is passive — it answers
commands. Nothing inside one ever wakes up and notices that a Task went quiet three weeks ago.
Injecting the domain contract into every general agent's prompt is compliance by hope; a locked
agent whose only job is the procedure below is compliance by construction.

**It mediates. It does not enforce.** It cannot stop an agent from acting, and nothing here should
be described as if it could. The real runtime gate is OpenClaw's exec approvals.

## Boundaries

**It may change coordination state only.** Reassign a Task once the owner has granted a handoff,
close Asks that were answered or abandoned, re-target an escalation, record follow-ups.

**It may never touch domain content.** No Definition, Plan or Result. It never completes and never
abandons. It finishes negotiations; it never decides that work is done.

## Triggers

- **On events** — an Ask is raised, two agents collide over the same Task, someone consults it.
- **On a scheduled sweep** — the procedure below. The sweep is the point: silence emits no event,
  so without it the follow-up job does not exist.

## Deterministically agentic

**The plugin detects. The agent communicates.**

Detection is ordinary deterministic code: a projection that evaluates the conditions below over
every open object and returns a findings list. The agent never scans the board itself. This is not
an optimization — a model asked to check nineteen conditions across a hundred-odd objects on every
sweep is expensive, slow, and gives different answers on different runs. Computing findings makes
the sweep exact and repeatable, and leaves the model a small job.

The agent's job is the part that needs judgment: writing a message the owning agent will actually
act on, recognizing when three findings are one underlying problem, and deciding whether a reply
warrants ending a chase or restating it.

Because detection is deterministic, **the agent runs on a cheap model**. The model is configurable;
the sweep's correctness does not depend on which one is chosen.

## The sweep

### Every Project

1. No accountable human set.
2. Every Milestone achieved and every Task terminal, but the Project is not complete.
3. No open Work and no terminal state — dormant without saying so.

### Every Milestone

4. All associated Work is terminal but the Milestone is not achieved.
5. No associated Work at all.

### Every Task

6. `done_when` is missing or a placeholder — including _"Not stated in the pre-4.0 record"_.
7. The Definition was revised after the current Plan was written. **The plan is stale.**
8. The Definition was revised after the current Result was written.
9. `in_progress` with no event for the staleness window.
10. `waiting`, and the thing it waits on has resolved — the blocking Task closed, the Question was
    answered, the person replied. It should resume.
11. `waiting` past its `follow_up_at`.
12. `waiting` with no typed reference, so nobody can be chased.
13. `ready` and unassigned past the staleness window.
14. Assigned to an agent that no longer exists on the gateway.
15. Depends on Work that is already complete — the dependency needs reaffirming or removing.

### Every Question and Decision

16. Open past the staleness window with no answer, or no decision.
17. No `answerable_by`, or no `deciders` — nobody to chase.

### Every Ask

18. Open past the staleness window.
19. Its target agent no longer exists.

## The escalation ladder

Findings go **to the owning agent first**, never straight to a human.

The ladder runs on its own clock, not on the sweep's. A sweep is frequent so that findings are
current; a reminder waits `reminderInterval` so that a frequent sweep does not escalate to a human
within the hour. A finding detected on ten consecutive sweeps is still one finding on one ladder.

| Step | Action                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------- |
| 1st  | Message the owning agent naming the object and the condition. Record the finding on the object. |
| 2nd  | After `reminderInterval`, message again, noting how long it has been unresolved.                |
| 3rd  | After `escalateAfter` unheeded reminders, record a durable Ask against the accountable human.   |

The accountable human resolves through the Project, then the Area default, then the gateway owner.
Gateways are multiplayer — "the operator" is not a single person, so escalation always names one.

A human is **messaged** only when work is actually blocked. Everything else is recorded and waits
to be read. Routine coordination must never train anyone to ignore this agent.

A finding clears when the condition no longer holds on a later sweep. Nothing is marked resolved
because someone replied — only because the object changed.

## Configuration

Every window is **human-editable** in the Falcon settings surface. The values below are starting
defaults, not product decisions — the right numbers depend on how a particular gateway is used, and
nobody should have to edit a config file to change them.

| Setting                  | Default | Governs                                          |
| ------------------------ | ------- | ------------------------------------------------ |
| `sweepInterval`          | 1 hour  | How often detection runs                         |
| `reminderInterval`       | 24 h    | Wait between ladder steps on one finding         |
| `escalateAfter`          | 2       | Unheeded reminders before a human is involved    |
| `stale.inProgress`       | 3 days  | Conditions 9 — a running Task with no events     |
| `stale.readyUnassigned`  | 7 days  | Condition 13                                     |
| `stale.questionDecision` | 5 days  | Condition 16                                     |
| `stale.ask`              | 2 days  | Condition 18                                     |
| `model`                  | cheap   | The sweep model; detection does not depend on it |

Structural conditions — 1, 3, 5, 6, 12, 14, 17, 19 — have no window. They are either true or not.

A window set to zero disables its condition. That must be visible in the settings surface, because
a silently disabled check is worse than a noisy one.

## Why nothing blocks

Earlier drafts of the domain wanted hard gates: refuse completion on a stale Plan, refuse to start
an unauthorized change. Most of those dissolve here. A gate stops an agent that is trying to record
honest progress, while doing nothing about an agent that simply never tells Work anything. The
sweep catches both, because it reads the objects rather than trusting the reporter.

Two gates remain, and both are about the completion claim rather than the work:

- A Result must pin the current Definition — enforced today in `complete`.
- A Milestone cannot be achieved over open Work without explicitly detaching each item.

## Related

- [Work backend contracts](plugin-v4-backend.md)
- [Plugin runtime and scope](plugin-v4.md)
