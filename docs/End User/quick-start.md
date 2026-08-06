# Quick Start

Falcon Dash is a same-host dashboard for OpenClaw. It opens to Work and connects to the local
OpenClaw Gateway through the Falcon Dash server; there is no browser gateway-token form.

## Before you start

The installation needs:

- OpenClaw running on the same machine with a configured gateway port and token;
- Falcon Dash installed or a source checkout with dependencies installed;
- KeePassXC CLI, `~/.openclaw/passwords.kdbx`, and `~/.openclaw/vault.key` for Vault;
- the Falcon Dash gateway extension when ambient Work context is required.

The current package does not yet provision the vault or complete extension automatically. Follow
[../Technical/deployment.md](../Technical/deployment.md) for the current setup boundary.

## Start Falcon Dash

From a source checkout:

```bash
npm run dev
```

From an installed package:

```bash
falcon-dash start
```

Open the URL printed by the server. Development normally uses
`http://127.0.0.1:5173`; the package launcher defaults to port `3000`.

## First gateway connection

Falcon Dash creates a server device identity and authenticates to OpenClaw. If OpenClaw requires
pairing, approve the pending Falcon Dash server device with the OpenClaw device-management command
or control UI. The browser itself is not paired to the gateway.

When connected, gateway-backed pages show live data. If the gateway is unavailable, Falcon Dash
shows a disconnected state rather than asking for a browser token.

## Orient yourself

- **Work** is the home page and shared human/agent source of truth.
- **Vault** manages credentials in the built-in KeePassXC database.
- **Channels** checks and configures supported OpenClaw chat providers.
- **Labs / Settings** contains gateway, agent, workspace, diagnostics, approvals, and terminal
  controls.

Other direct routes include Documents, Jobs, Heartbeat, Operations, Skills, Agents, Approvals,
Secret Providers, and plugin-created Canvas Apps. There is no current in-product conversation page;
project-contextual agent conversations are a v5 roadmap feature.

## Give an agent Work access

Open Settings → Agent Tokens and mint a token for the agent. The plaintext token is shown once and
the stored record is hashed. Install or configure the Falcon Dash gateway hook so session-start
prompts receive the bounded Work brief, then use `falcon` for deeper reads and commands.

Do not paste the gateway token, agent token, or vault values into browser storage or documentation.
