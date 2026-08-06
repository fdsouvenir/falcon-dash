# Documentation Ownership Map

Documentation changes are part of implementation, not cleanup to defer. Before editing a
high-signal code area, read the smallest matching current document below. If behavior, boundaries,
configuration, or rerun steps changed, update that document in the same change.

## Code-to-document map

| Change area                                                                                                 | Paths that usually trigger it                                                                                                                                      | Current docs that own the truth                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Shell, navigation, route behavior                                                                           | `src/routes/**`, `src/lib/components/AppShell.svelte`, `src/lib/components/mobile/**`                                                                              | `docs/Technical/components.md`, `docs/FRONTEND.md`, the exact `docs/End User/*` guide                                     |
| Visual tokens and shared UI                                                                                 | `src/app.css`, `src/lib/components/ui/**`, `static/fonts/**`                                                                                                       | `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/Technical/components.md`                                                      |
| Browser state and realtime wiring                                                                           | `src/lib/stores/**`, `src/lib/gateway-api.ts`, `src/lib/canvas/**`                                                                                                 | `docs/Technical/stores.md`, `docs/RELIABILITY.md`, `docs/Technical/gateway-protocol.md`                                   |
| Server gateway client and proxy                                                                             | `src/lib/server/gateway-*.ts`, `src/routes/api/gateway/**`, `src/entry.js`, `src/hooks.server.ts`                                                                  | `docs/Technical/gateway-protocol.md`, `docs/Technical/architecture.md`, `docs/Technical/deployment.md`                    |
| Gateway plugin and ambient agent context                                                                    | `gateway-plugin/**`, plugin manifest or packaging                                                                                                                  | `docs/Technical/gateway-plugin.md`, `docs/Technical/architecture.md`, `docs/Technical/work-management.md`                 |
| Work domain, API, CLI, and UI                                                                               | `src/lib/server/work3/**`, `src/lib/work3/**`, `src/lib/work3-shared/**`, `src/routes/api/v3/**`, `src/routes/api/work3/**`, `src/routes/work/**`, `bin/falcon.js` | `docs/Technical/work-management.md`, `docs/End User/work.md`, relevant `docs/Technical/v3/*` contract                     |
| Vault and SecretRefs                                                                                        | `src/lib/server/vault/**`, `src/routes/api/vault/**`, `src/lib/components/vault/**`, `bin/keepassxc-secret-resolver.cjs`                                           | `docs/End User/passwords.md`, `docs/secretrefs.md`, `docs/Technical/architecture.md`, `skills/falcon-dash-vault/SKILL.md` |
| Channels, agents, skills, approvals, jobs, heartbeat, operations, documents, canvas apps, secrets, settings | matching route, component, and store paths                                                                                                                         | the exact `docs/End User/*` guide plus the relevant technical overview                                                    |
| Package, startup, environment, release                                                                      | `package.json`, `bin/falcon-dash.js`, `src/entry.js`, `.github/workflows/**`, deployment config                                                                    | `docs/Technical/deployment.md`, `docs/Technical/architecture.md`                                                          |
| Roadmap or product boundary                                                                                 | approved epic or explicit product decision                                                                                                                         | `docs/ROADMAP.md`; change `docs/PURPOSE.md` only with its owner's explicit direction                                      |
| Validation or harness behavior                                                                              | `scripts/**`, `e2e/**`, test configuration                                                                                                                         | `docs/HARNESS.md`, `docs/QUALITY.md`, and the specific workflow doc                                                       |

## Update rules

1. End-user docs describe only behavior a user can reach in the current build.
2. Technical docs describe current code paths, storage, and failure boundaries.
3. Future behavior belongs in `ROADMAP.md` and must carry a version label.
4. v3 contract docs preserve approved semantics. Amend them only when the contract itself changes;
   put as-built details in the current technical docs.
5. Optional deployment profiles cannot become prerequisites for installation or product behavior.
6. A code change may legitimately require no doc edit, but the reason must be specific; touching an
   unrelated doc is not evidence of freshness.

`npm run check:docs` enforces this map for changed high-signal paths. The check is a guardrail, not a
replacement for reading the owning document.
