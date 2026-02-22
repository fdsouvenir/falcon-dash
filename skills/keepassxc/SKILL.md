---
name: keepassxc
description: >-
  Manage passwords in the KeePassXC vault via keepassxc-cli. Use when the agent
  needs to store, retrieve, update, or delete credentials (API keys, tokens,
  passwords, service accounts). The vault is managed by Falcon Dash, the
  OpenClaw operator dashboard.
metadata:
  openclaw:
    emoji: "\U0001F510"
    requires:
      bins: ['keepassxc-cli']
---

# KeePassXC Password Manager

Manage credentials stored in the KeePassXC vault at `~/.openclaw/passwords.kdbx` using `keepassxc-cli`.

## References

- [CLI examples](references/cli-examples.md) — command reference with auth flags

## Authentication

The vault uses **keyfile authentication** (no master password). Every command must include:

```
--no-password --key-file ~/.openclaw/vault.key
```

## Workflow

1. **Verify access:**

   ```bash
   keepassxc-cli --version
   test -f ~/.openclaw/passwords.kdbx && echo "vault exists"
   ```

2. **Discover entries:**

   ```bash
   keepassxc-cli ls --no-password --key-file ~/.openclaw/vault.key -R -f ~/.openclaw/passwords.kdbx
   ```

3. **Read a credential:**

   ```bash
   keepassxc-cli show --no-password --key-file ~/.openclaw/vault.key ~/.openclaw/passwords.kdbx "path/to/entry"
   ```

4. **Create / update / delete** — see [CLI examples](references/cli-examples.md) for full syntax.

## Guardrails

- **Never log or echo passwords.** Pipe output to files or use in variables — never print to stdout in scripts.
- **Use `show -s`** when you only need metadata (title, username, URL) without exposing the password.
- **Prefer `vault://path/to/entry` references** over copying raw secrets into config files or environment variables.
- **Do not create or destroy the vault** — it is provisioned and managed by Falcon Dash.
- **Do not reorganize the group structure** without explicit operator approval.
- **Entries are organized in groups** (folders). Use `ls` to understand the existing structure before adding entries.
