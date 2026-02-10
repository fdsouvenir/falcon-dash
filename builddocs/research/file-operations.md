# OpenClaw Workspace File Operations — Research Findings

**Date:** 2026-02-07
**Purpose:** Understand how to read/write workspace files (SOUL.md, AGENTS.md, TOOLS.md, etc.) from a dashboard connecting via WebSocket to the OpenClaw Gateway.

---

## TL;DR

**OpenClaw does NOT expose workspace file read/write operations via the Gateway WebSocket protocol.** There are no `workspace.read`, `workspace.write`, `file.read`, or `file.write` RPC methods. Workspace files (SOUL.md, AGENTS.md, TOOLS.md, MEMORY.md, etc.) are loaded server-side during agent runs and injected into the system prompt. The control UI has no file editing capability.

For falcon-dash, we'll need to build our own file access layer — either through a custom HTTP API on the server, or by extending the gateway with custom methods.

---

## What Exists: Gateway WS Methods (Complete List)

From `server-methods-list.js`, the full set of Gateway WS methods:

### Config Methods (closest to file operations)
| Method | Purpose | Params |
|--------|---------|--------|
| `config.get` | Read `~/.openclaw/openclaw.json` | `{}` (empty) |
| `config.set` | Replace entire config file | `{ raw: string, baseHash?: string }` |
| `config.patch` | Merge-patch config (partial update) | `{ raw: string, baseHash?: string, sessionKey?, note?, restartDelayMs? }` |
| `config.apply` | Set + restart gateway | `{ raw: string, baseHash?: string, sessionKey?, note?, restartDelayMs? }` |
| `config.schema` | Get JSON Schema + UI hints for config | `{}` |

**Key detail:** `config.get` returns a snapshot object:
```typescript
{
  path: string,         // e.g. "~/.openclaw/openclaw.json"
  exists: boolean,
  raw: string | null,   // raw JSON5 file content
  parsed: object,
  valid: boolean,
  config: object,       // validated config
  hash: string,         // SHA-256 of raw content (for optimistic concurrency)
  issues: array,
  warnings: array,
  legacyIssues: array
}
```

The `baseHash` parameter on set/patch/apply implements optimistic concurrency — you must send the hash from the last `config.get` to prevent clobbering concurrent edits.

**These methods ONLY operate on `openclaw.json` — NOT workspace files.**

### Agent/Identity Methods
| Method | Purpose |
|--------|---------|
| `agents.list` | List configured agents (id, name, workspace dir) |
| `agent.identity.get` | Get agent name + avatar |

`agents.list` returns the workspace directory path per agent, but does NOT return file contents.

### Other Notable Methods
| Method | Purpose |
|--------|---------|
| `chat.send` | Send message to agent |
| `chat.history` | Get chat transcript |
| `chat.inject` | Inject assistant message (UI only) |
| `chat.abort` | Stop active run |
| `sessions.list` | List sessions |
| `sessions.preview` | Preview session transcript |
| `skills.status` | List skills |
| `cron.*` | Cron job management |
| `logs.tail` | Live gateway log tail |

---

## How Workspace Files Actually Work (Server-Side)

### File Definitions
From `agents/workspace.js`:

```javascript
DEFAULT_AGENTS_FILENAME = "AGENTS.md"
DEFAULT_SOUL_FILENAME = "SOUL.md"  
DEFAULT_TOOLS_FILENAME = "TOOLS.md"
DEFAULT_IDENTITY_FILENAME = "IDENTITY.md"
DEFAULT_USER_FILENAME = "USER.md"
DEFAULT_HEARTBEAT_FILENAME = "HEARTBEAT.md"
DEFAULT_BOOTSTRAP_FILENAME = "BOOTSTRAP.md"
DEFAULT_MEMORY_FILENAME = "MEMORY.md"
DEFAULT_MEMORY_ALT_FILENAME = "memory.md"
```

### Workspace Directory Resolution
From `agents/agent-scope.js`:

```
resolveAgentWorkspaceDir(cfg, agentId):
  1. Check agent-specific `workspace` field in config
  2. For default agent: check `agents.defaults.workspace`
  3. Fallback: ~/.openclaw/workspace (or ~/.openclaw/workspace-{agentId} for non-default)
```

### Loading Flow
1. **`loadWorkspaceBootstrapFiles(dir)`** — Reads all workspace files from disk (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md)
2. **`filterBootstrapFilesForSession(files, sessionKey)`** — Subagents only see AGENTS.md and TOOLS.md
3. **`resolveBootstrapFilesForRun(params)`** — Applies hook overrides
4. **`buildBootstrapContextFiles(files, opts)`** — Truncates to maxChars
5. **System prompt builder** — Injects files under "## Project Context" heading

### Return format from `loadWorkspaceBootstrapFiles`:
```typescript
Array<{
  name: string,    // e.g. "SOUL.md"
  path: string,    // full filesystem path
  content?: string, // file content (if exists)
  missing: boolean  // true if file doesn't exist
}>
```

---

## Control UI Source Analysis

The bundled control UI (`dist/control-ui/assets/index-CXUONUC9.js`) uses these WS methods:
- `config.get`, `config.set`, `config.apply`, `config.schema`
- `chat.send`, `chat.history`, `chat.abort`
- `agents.list`, `agent.identity.get`
- `sessions.list`, `sessions.patch`, `sessions.delete`
- `channels.status`, `channels.logout`
- `cron.list`, `cron.add`, `cron.remove`, `cron.run`, `cron.runs`, `cron.update`
- `skills.status`, `skills.install`, `skills.update`
- `exec.approvals.*`
- `models.list`, `logs.tail`, `node.list`
- `update.run`
- `web.login.start`, `web.login.wait`
- `device.pair.*`, `device.token.*`

**The word "workspace" appears exactly ONCE in the entire control UI bundle** — confirming it has zero workspace file management features.

---

## Config vs Workspace Files: Important Distinction

| Aspect | Config (`openclaw.json`) | Workspace Files (SOUL.md etc.) |
|--------|-------------------------|-------------------------------|
| Location | `~/.openclaw/openclaw.json` | `~/.openclaw/workspace/` (or custom) |
| WS Access | ✅ `config.get/set/patch/apply` | ❌ None |
| Purpose | System configuration | Agent personality & context |
| Edited by | User via UI/CLI | User AND agent (read/write tool) |
| Format | JSON5 | Markdown |

The config file contains a `workspace` path setting that *points to* where workspace files live, but the config methods don't read/write those files.

---

## Options for falcon-dash

### Option A: Custom REST API on the Server (Recommended)
Build a small HTTP API (could be a separate service or Hono middleware) that:
1. Reads the workspace dir from `agents.list` response or config
2. Provides endpoints:
   - `GET /api/workspace/files` — List workspace files
   - `GET /api/workspace/files/:name` — Read file content
   - `PUT /api/workspace/files/:name` — Write file content
   - Add hash-based optimistic concurrency (like config.set does)

### Option B: Use the Agent to Read/Write
Send workspace file operations through `chat.send`:
- "Read SOUL.md and return its contents" 
- "Update TOOLS.md with: ..."
This is unreliable and costs API tokens.

### Option C: Extend Gateway via Plugin
OpenClaw has a plugin system. Create a plugin that registers additional gateway methods:
- `workspace.list` 
- `workspace.read`
- `workspace.write`
Would need to study the plugin SDK more to confirm this is possible for gateway methods.

### Option D: Direct Filesystem Access
If falcon-dash runs on the same machine, read/write files directly using the workspace path from config. The workspace path can be determined by:
1. Calling `config.get` → parse `agents.defaults.workspace` or per-agent `workspace`
2. Default: `~/.openclaw/workspace/`

---

## Relevant Source Files

| File | Purpose |
|------|---------|
| `dist/agents/workspace.js` | Workspace file loading, bootstrap file definitions |
| `dist/agents/bootstrap-files.js` | Bootstrap file resolution for agent runs |
| `dist/agents/agent-scope.js` | Agent workspace dir resolution |
| `dist/agents/system-prompt.js` | System prompt builder (injects workspace files) |
| `dist/gateway/server-methods/config.js` | Config RPC handlers |
| `dist/gateway/server-methods-list.js` | Complete method registry |
| `dist/gateway/protocol/schema/config.js` | Config method schemas (TypeBox) |
| `dist/gateway/control-ui.js` | Control UI HTTP handler |
| `dist/config/paths.js` | Config/state path resolution |
| `dist/config/io.js` | Config file read/write with hash-based concurrency |

---

## Recommended Approach for falcon-dash

**Option D (direct filesystem access)** is the simplest since falcon-dash runs locally. The flow:

1. On dashboard load, call `config.get` via WS → extract workspace path from `config.agents.defaults.workspace` (default: `~/.openclaw/workspace`)
2. Use a server-side API route in falcon-dash to read/write files in that directory
3. Implement the same hash-based concurrency pattern OpenClaw uses for config

### Known Workspace Files to Support
- `SOUL.md` — Agent identity/personality
- `AGENTS.md` — Agent behavior rules  
- `TOOLS.md` — Tool-specific notes
- `IDENTITY.md` — Agent identity (alternative to SOUL.md)
- `USER.md` — User info for the agent
- `HEARTBEAT.md` — Heartbeat instructions
- `BOOTSTRAP.md` — First-run instructions (deleted after use)
- `MEMORY.md` — Long-term memory
- `memory/` — Daily memory files (subdirectory)

### Security Considerations
- Workspace files can contain sensitive info (in MEMORY.md especially)
- File writes should be validated (prevent path traversal)
- Consider read-only mode for certain files
- The `.secrets/` directory should NEVER be exposed
