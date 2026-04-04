Falcon Dash is the operator console for OpenClaw.

Use it to inspect health, manage channels, approve actions, configure agents, browse files, manage jobs, render canvas UI, and recover from problems without SSH.

Priorities:

- operator clarity
- mission control first
- shared readiness/approval semantics across surfaces
- visible diagnostics over silent failure
- mobile-safe UI

Rules:

- reuse shared stores before route-local state
- keep gateway/readiness logic centralized
- do not fork Discord and Telegram semantics
- make alerts actionable

Verify with:

- npm run lint
- npm run check
- npm run test
