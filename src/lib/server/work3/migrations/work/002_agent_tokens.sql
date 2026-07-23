-- Per-agent bearer tokens for /api/v3 (doc 06 auth adapters). Hashed at rest;
-- plaintext exists only at mint time and in the token file dropped for the
-- co-resident CLI.

CREATE TABLE falcon_agent_tokens (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX idx_falcon_agent_tokens_agent ON falcon_agent_tokens(agent_id);
