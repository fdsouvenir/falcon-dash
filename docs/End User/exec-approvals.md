# Execution Approvals

Execution approvals are live OpenClaw requests for permission to run a command. Falcon Dash exposes
them globally at `/approvals`, in Settings → Approvals, and on an agent detail page.

For each pending request, inspect the agent, session, timestamp, and exact command. Available
responses are:

- **Allow once** — approve this request only;
- **Allow always** — approve and add the command to OpenClaw's persistent allow policy;
- **Deny** — reject this request;
- **Always deny** — reject and add the command to Falcon Dash's local deny handling.

Approval requests are time-sensitive and arrive through the gateway event stream. If the gateway is
disconnected, Falcon Dash cannot make a live decision and must not show stale requests as active.

These are OpenClaw execution approvals, not Work Reviews or Work Authorizations. A Work Review
evaluates a revision; a Work Authorization grants exact-scope permission under the Work domain.
Neither substitutes for an OpenClaw command approval.
