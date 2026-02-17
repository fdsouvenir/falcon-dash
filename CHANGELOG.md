# Changelog

All notable changes to Falcon Dash will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
