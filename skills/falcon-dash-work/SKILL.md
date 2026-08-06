---
name: falcon-dash-work
description: >-
  Use for every Falcon Dash v3 Work read or mutation: inspect the brief or queue, search and read
  typed objects, or execute semantic commands through the packaged falcon CLI or bearer-authenticated
  /api/v3 interface.
---

# Falcon Dash v3 Work

Use the packaged `falcon` CLI by default. It reads the same canonical Work domain as the human UI,
discovers semantic verbs from the shared command manifest, handles object versions, and renders
compact output. Use the HTTP interface when structured JSON is required.

## Orient before acting

```bash
falcon brief
falcon queue
falcon work search "query"
falcon project list --status active
falcon project get p1 --full
```

The brief is deliberately bounded. Read the target object before changing it whenever lifecycle,
authority, relationships, or current version matters.

## Typed commands

Use object-specific nouns and verbs instead of patching a generic status field:

Run `falcon <noun>` without a verb to see its current legal command surface. For example,
`falcon project` lists the available Project reads and transitions.

The shared command manifest is authoritative. If an example in this skill conflicts with the CLI,
follow the CLI.

Common reads are `list` and `get`; `--full` requests the full projection and `--json` requests JSON
output. Current user-facing nouns include Project, Milestone, Task, Question, Decision, Change,
Finding, Plan, Review, Authorization, Blocker, Area, and Automation. The API/CLI noun for an
Automation is currently `automaton`.

## Mutation discipline

- Read before writing and preserve the returned object version.
- Use the legal semantic verb for the transition. Do not invent generic PATCH requests.
- Supply an idempotency key when retrying a command after an uncertain network result.
- Treat command guard failures as current domain facts. Report the unmet prerequisite rather than
  bypassing it or fabricating approval.
- Human-authority commands require the exact trusted source information defined by the command.
  An agent label or prose claim never creates human authority.
- After a successful mutation, report the changed object and the next meaningful action. Do not
  create workflow noise solely to narrate the mutation.

## HTTP interface

Every request requires a Falcon agent bearer token:

```text
GET  /api/v3/brief
GET  /api/v3/queue
GET  /api/v3/objects/:type
GET  /api/v3/objects/:type/:id?view=detail|full
GET  /api/v3/search?q=...
GET  /api/v3/history?subject=...
POST /api/v3/sources/resolve
POST /api/v3/commands/:command
```

List reads accept `limit`, `offset`, optional `fields`, and reader-specific filters. Empty lists are
definitive successful results.

Commands use this envelope:

```json
{
	"target": "p1",
	"expected_version": 3,
	"idempotency_key": "stable-retry-key",
	"payload": {}
}
```

The agent interface returns structured validation, conflict, guard, authorization, and not-found
errors. Preserve those distinctions when explaining a failure.
