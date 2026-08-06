# Troubleshooting

## Falcon Dash does not start

1. Confirm Node.js 20 or newer.
2. From source, run `npm ci` and then `npm run dev`; for a package, run `falcon-dash version` and
   `falcon-dash start`.
3. Use the URL and error printed by the process. Do not assume a port if it was overridden.
4. Run `/api/health` and `/api/ready` when the HTTP server is reachable.

## Gateway stays disconnected

1. Confirm OpenClaw is running on the same machine.
2. Check `GATEWAY_URL`, `GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_TOKEN`, and the local
   `~/.openclaw/openclaw.json` gateway port/token.
3. If the server device is pending, approve it in OpenClaw device management.
4. Inspect Settings → Information or Logs and the Falcon Dash server output.
5. Do not point Falcon Dash at a gateway on another host; remote gateways are unsupported.

The browser does not hold a gateway token and clearing browser storage does not repair server
authentication.

## A gateway-backed page is empty or stale

Check the connection state first. A ready page receives invalidations through
`/api/gateway/events`; a dropped EventSource reconnects automatically and should receive a fresh
snapshot. Reload once after the gateway is ready. If the problem continues, inspect the specific
RPC error and gateway capability list rather than treating it as an empty result.

## Work does not update

Work is local to Falcon Dash and uses `/api/work3/events` for invalidation. Reloading rereads the
canonical SQLite state even if a live event was missed. Check the Falcon Dash process for migration,
outbox, or database errors and verify the data directory is writable.

For agent access, confirm the `/api/v3` bearer token is valid and belongs to the intended agent. A
gateway token cannot substitute for a Falcon Work token.

## Vault not available

Confirm all three requirements:

- `keepassxc-cli` is on the Falcon Dash process `PATH`;
- `~/.openclaw/passwords.kdbx` exists and is readable;
- `~/.openclaw/vault.key` exists and is readable.

The current vault is key-file-only; there is no master-password prompt to unlock it. Test the same
files with `keepassxc-cli --no-password --key-file` and review server errors. Protect the files
while troubleshooting and never paste their contents into an issue.

## Agent lacks Work context

1. Mint or verify the agent token in Settings → Agent Tokens.
2. Confirm the Falcon Dash gateway extension is installed and its prompt hook is registered.
3. Ensure the hook can reach the same-host `FALCON_DASH_URL` and selects the correct token.
4. Check `GET /api/v3/brief` with that bearer token.
5. Remember that context injection is bounded and best-effort; use `falcon` for deeper state.

## Jobs or Automations fail

Jobs and Work Automations depend on OpenClaw native cron. Verify the gateway is ready, the advertised
cron methods are available, and the nested schedule/payload is valid. Runtime failure is not a
Falcon Work lifecycle change. The future integration scheduler is unrelated.

## Reporting a problem

Include the Falcon Dash version, OpenClaw version, route, setup, exact action, expected result,
actual result, and redacted logs. Never include gateway tokens, agent bearer tokens, vault entries,
the vault key file, or unredacted provider credentials.
