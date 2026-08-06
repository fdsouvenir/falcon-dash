# Agents

Falcon Dash reads configured agents and active agent work from the co-resident OpenClaw Gateway.
There is no Agent Rail in the current shell and no Falcon-owned agent runtime.

## Agent detail

Open `/agents/<agent-id>` to inspect one agent. The page is available only while the gateway is
connected and has four tabs:

- **Config** — identity, workspace, and editable role/theme metadata;
- **Lifecycle** — active runs, stop controls, refresh, and gateway restart;
- **Channels** — channel status associated with the agent;
- **Approvals** — pending execution approvals for the agent.

Falcon Dash distinguishes configured agents from active tasks. A configured agent may have no
active run, and an active task must be stopped by its task identity rather than by deleting the
agent configuration.

## Agent Tokens

Settings → Agent Tokens manages Falcon bearer tokens for `/api/v3` Work access. Mint a token for a
specific agent and capture the plaintext value when it is returned; Falcon Dash stores only a hash.
These tokens authorize the Work API and context hook. They are not OpenClaw gateway tokens.

## Ownership

OpenClaw owns agent configuration, workspaces, tasks, sessions, and runtime lifecycle. Falcon Dash
provides management views and local Work context. Future v5 conversation views will reference
OpenClaw sessions rather than copying them.
