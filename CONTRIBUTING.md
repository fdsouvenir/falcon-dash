# Contributing to Falcon Dash

Thank you for your interest in contributing to Falcon Dash!

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A running [OpenClaw](https://github.com/fdsouvenir/openclaw) gateway (for integration testing)

## Local Setup

```bash
git clone https://github.com/fdsouvenir/falcon-dash.git
cd falcon-dash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. Vite proxies `/ws` to the gateway at `ws://127.0.0.1:18789`.

## Available Scripts

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `npm run dev`           | Start the Vite dev server with HMR |
| `npm run build`         | Production build                   |
| `npm run check`         | TypeScript type checking           |
| `npm run lint`          | ESLint                             |
| `npm run format`        | Format all files with Prettier     |
| `npm run format:check`  | Check formatting without writing   |
| `npm run test`          | Run tests                          |
| `npm run test:watch`    | Run tests in watch mode            |
| `npm run test:coverage` | Run tests with coverage report     |

## Branch Naming

- `feat/` — new features
- `fix/` — bug fixes
- `chore/` — maintenance, dependencies, tooling
- `docs/` — documentation changes

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — a new feature
- `fix:` — a bug fix
- `chore:` — maintenance tasks
- `docs:` — documentation changes
- `refactor:` — code restructuring without behavior change
- `test:` — adding or updating tests

## Pull Request Process

1. Create a branch from `main` using the naming convention above.
2. Make your changes and ensure all checks pass:
   ```bash
   npm run format:check
   npm run lint
   npm run check
   npm run test
   npm run build
   ```
3. Open a PR against `main`. Fill out the PR template.
4. Address review feedback.

## Code Style

Code style is enforced automatically:

- **Prettier** formats on save and at commit time (via Husky + lint-staged)
- **ESLint** catches common issues
- **TypeScript** strict mode is enabled

Configuration: tabs, single quotes, no trailing commas, 100 character print width.

### Svelte 5

This project uses Svelte 5 runes. Use `$state()`, `$derived()`, `$effect()`, `$props()` and `onevent` handlers (not Svelte 4 `on:event` syntax).
