# Falcon Dash Gateway Plugin

The Falcon Dash gateway plugin complements the native gateway client. The client handles standard
OpenClaw transport; the plugin supplies bounded Falcon-specific context and capabilities.

## Responsibility split

Use the native gateway client for OpenClaw RPCs, events, sessions, approvals, configuration, and
native cron. Use the plugin only when Falcon Dash must extend what an agent knows or can do, such as:

- injecting a bounded Work or integration brief before a prompt;
- exposing safe Falcon-specific tools that preserve server-side authority and secret boundaries;
- connecting Falcon-specific canvas or channel surfaces where no native OpenClaw capability exists.

The plugin must not duplicate OpenClaw sessions, transcript storage, scheduler ownership, or
standard RPC transport.

## Current versioned hook

`gateway-plugin/brief-context.js` is the versioned v3 Work-context hook. Its `buildWorkBrief()`
function:

1. discovers an agent bearer token from `FALCON_DASH_TOKEN` or the Falcon token directory;
2. calls `GET /api/v3/brief` on the same-host Falcon Dash server;
3. formats bounded Actionable, Needs operator, Blocked risk, and Unhealthy automation sections;
4. caches the result for 60 seconds;
5. times out quickly and returns an empty string on failure.

Prompt delivery must remain best-effort: a stopped dashboard or unavailable brief cannot prevent an
agent from receiving every prompt.

The hook tolerates the pre-rename `needs_fred` response key only to survive deployment skew. New
server and plugin code use `needs_operator`.

## Packaging status

The repository currently versions the brief hook but not the complete installable gateway
extension source and packaging. Existing installations may have a compiled companion extension
that registers `before_prompt_build`, channel, and canvas behavior, but that deployed copy is not a
portable source of truth for the product.

This is a standalone-installation gap. Before Falcon Dash distribution can rely on the plugin, the
repo must own:

- the complete extension source and OpenClaw plugin manifest;
- installation, upgrade, and removal behavior;
- version compatibility and restart requirements;
- tests proving hook registration, bounded failure, and context redaction;
- an idempotent deployment path that does not assume a particular user's home directory.

`openclaw.plugin.json` at the repo root is Falcon Dash module metadata. It is not evidence that the
full OpenClaw gateway extension is packaged.

## Agent context contract

Context should teach an agent just enough to act correctly:

- Falcon Dash Work is the authoritative work surface and `falcon`/`/api/v3` are the deeper access
  paths;
- the built-in vault holds secrets and raw values must be used only through approved server-side
  tools or SecretRefs;
- v4 integrations will expose live health and scoped lifecycle actions rather than asking agents to
  interpret stale prose;
- OpenClaw native Automations and Falcon integration lifecycle schedules are different systems;
- the current project/object may be supplied for v5 conversations without copying the transcript.

Context must be bounded, redacted, attributable, and regenerable from canonical state. Do not inject
raw credentials, complete databases, unbounded history, or policy that exists only in a markdown
file.

## Evolution by version

- **v3:** bounded Work brief and `falcon` orientation.
- **v4:** integration catalog, health, safe actions, and built-in-vault usage guidance.
- **v5:** project/object conversation context, rich tool/canvas affordances, and session references.

Each addition should prove that native gateway capabilities are insufficient before expanding the
plugin surface.
