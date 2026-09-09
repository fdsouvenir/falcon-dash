# Changelog

All notable changes to Falcon Dash will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.1] - 2026-09-08

### Fixed

- **Agent tools reached a dead service copy.** The host registers the plugin more than once per
  process, and a tool-discovery registration never starts a service, so every `falcon_work`,
  `falcon_vault`, `falcon_integrations` and `falcon_documents` call failed with
  `unavailable` while the Control UI worked from the activated registration in the same process.
  The started modules are now published on a process-global resolved at invocation, so all
  registrations serve the one live instance. A stopped service still fails closed.
  ([#370](https://github.com/fdsouvenir/falcon-dash/issues/370))

## [4.0.0] - 2026-09-07

Falcon Dash is now **one installable OpenClaw plugin**. There is no standalone web application, no
second runtime, and no CLI.

### Changed

- **Everything ships inside OpenClaw.** Work, Integrations, KeePassXC Vault and Documents are
  internal modules of a single plugin rendering in the Control UI through native feature-plugin
  pages, not a separate site on its own port.
- **The Work domain is reconciled to [#363](https://github.com/fdsouvenir/falcon-dash/issues/363).**
  Task lifecycle is `open | ready | in_progress | waiting | completed | abandoned`; `cancelled`
  becomes reversible `abandoned` and `in_review` is gone. A Task's definition splits into title,
  description and `done_when`, stored as immutable revisions, with Plans and Results pinned to the
  exact definition revision they were written against.
- **Completion requires a Result that pins the current Definition**, so a Task cannot close against
  a result written for a goal that has since changed.
- **Blocked is derived, not declared** — computed from unresolved dependencies, pending Asks,
  unanswered Questions and active waits. Dependencies warn rather than veto: Falcon Dash never
  claims to control runtime permission, which stays with OpenClaw's approvals.

### Removed

- **All prior-version awareness.** No migration, conversion, legacy detection or compatibility
  code. 4.0 installs onto a machine with no earlier Falcon Dash present; pre-4.0 data is handled
  out of band.
- **The standalone SvelteKit application** and its entire dependency tree — 381 source files, the
  `falcon` and `falcon-dash` CLIs, and 42 development dependencies.
- **Channels, Shell, Labs, Apps, Jobs, Ops and Heartbeat.** OpenClaw natively owns channel
  onboarding, agents, approvals, skills, automations and canvas apps.
- **Phase, Review, standalone Change Request and Blocker** as Work types. A review is an ordinary
  Task pointing at the artifact revision it reviews; change control is a revisioned boundary
  carried on a Task.
- Project archive state, the Project Plan artifact, and the canonical current-next pointer.

### Validation

- 127 plugin unit tests
- 30 real-Gateway Chromium acceptance cases at desktop and narrow widths
- An isolated managed-install proof covering SecretRef resolution, disable/remove denial and
  vault-lock denial, with no secret leakage
- A published package containing only `plugin/`, `dist/control-ui/`, the manifest, the build script
  and the plugin technical docs

### Upgrade notes

There is no upgrade path, by design. Export and delete any pre-4.0 Work database before installing;
the KeePassXC vault carries over as an existing file and is opened as-is, never converted or
adopted automatically. Requires OpenClaw 2026.8.1 or later, Node 22.16+, Linux, `keepassxc-cli` and
`flock`.

### Not included

The coordination agent and the four Work contract changes that serve it are 4.1
([#367](https://github.com/fdsouvenir/falcon-dash/issues/367)). Provider adapters are exercised
against fixtures rather than live vendor consent, native UI opt-in has been enabled only in
synthetic runtimes, and no packaged Vault skill ships.

## [3.0.0] - 2026-07-23

### Added

- Work v3's semantic command engine, typed domain objects, lifecycle guards, optimistic
  concurrency, provenance, reconciliation, and append-only Event Log
- Mission Control, Needs Resolution, Projects, Automata, Browse, and type-specific Work detail
  surfaces for operators
- Governance records for Plans, Reviews, Authorizations, and Change Requests
- Agent-native `/api/v3` endpoints with bearer-token identities and a `falcon` CLI supporting TOON
  and JSON output
- OpenClaw-backed Automata composed read-through from the live runtime record (no mirrored
  state or drift semantics), with native run history and recoverable deletion
- Gateway protocol v4 adapters while retaining protocol v3 compatibility

### Changed

- `/work` now serves Work v3 and uses `work3.db` plus `work3-events.db` as its canonical stores
- Work context is supplied through the gateway brief plugin instead of the v2 markdown context
  mirror
- Search now opens the v3 Browse surface

### Breaking

- Removed the Work v2 UI, server module, context and reconciliation schedulers, and
  `/api/work/*` endpoints
- Falcon Dash does not migrate or read v2 Work data in application code. The existing `work.db`
  remains untouched for any one-time operator-managed disposition.

## [0.2.0] - 2026-02-16

### Added

- Docker image and GHCR publishing workflow
- SDLC infrastructure — release workflow, security policy, tests, health checks
- Canvas diagnostics tab in settings
- Improved canvas A2UI loading, bridge status indicators, and content overflow handling
- UX polish — scrollbars, session filtering, theme fix, auto-naming, dividers, skills app, cron polish, settings fallbacks

### Fixed

- PM feature detection so the projects page loads correctly
- Accessibility attributes on SkillsTab modal dialogs

## [0.1.0] - 2026-02-09

### Added

- Real-time chat with streaming responses, thinking blocks, and tool call visualization
- Slash commands, threads, bookmarks, and search in chat
- Markdown rendering with Shiki syntax highlighting, KaTeX math, and Mermaid diagrams
- Project management with domains, focuses, projects, tasks, and subtasks
- Document browser with create, rename, and delete operations
- Cron job management with scheduling and run history
- Heartbeat monitoring with status indicators
- KeePassXC password vault integration
- Settings page with config editor, device management, Discord, live logs, model selection, and skills
- Canvas system with A2UI bridge for agent-rendered UI surfaces
- Gateway WebSocket client with protocol v3 support
- Exponential backoff reconnection with tick-based health monitoring
- Ed25519 device identity and challenge-response authentication
- Gateway canvas bridge plugin for routing canvas commands to operators
- Vitest testing framework with initial unit tests
- GitHub Actions CI workflow
- Husky pre-commit hooks with lint-staged
- ESLint, Prettier, and TypeScript strict mode
