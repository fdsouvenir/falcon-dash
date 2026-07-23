# Changelog

All notable changes to Falcon Dash will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-07-23

### Added

- Work v3's semantic command engine, typed domain objects, lifecycle guards, optimistic
  concurrency, provenance, reconciliation, and append-only Event Log
- Mission Control, Needs Resolution, Projects, Automata, Browse, and type-specific Work detail
  surfaces for operators
- Governance records for Plans, Reviews, Authorizations, and Change Requests
- Agent-native `/api/v3` endpoints with bearer-token identities and a `falcon` CLI supporting TOON
  and JSON output
- OpenClaw-backed Automata with definition reconciliation and run history
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
