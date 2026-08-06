---
name: falcon-dash-vault
description: >-
  Use whenever an OpenClaw agent needs a credential, provider connection, API token, password,
  service account, or SecretRef in a Falcon Dash installation. Prefer Vault references and scoped
  resolution; use direct KeePassXC access only for an explicitly authorized operation.
metadata:
  openclaw:
    emoji: '🔐'
    requires:
      bins: ['keepassxc-cli']
---

# Falcon Dash Vault

Falcon Dash includes a KeePassXC-backed vault. It is a built-in product component, not an optional
external integration.

- Database: `~/.openclaw/passwords.kdbx`
- Key file: `~/.openclaw/vault.key`
- Authentication: `--no-password --key-file ~/.openclaw/vault.key`

## Default behavior

1. Prefer an existing OpenClaw SecretRef or Falcon Dash Vault reference.
2. Resolve only the named entry and field needed for the operation.
3. Keep raw values out of prompts, Work records, logs, command arguments, and chat responses.
4. Use Falcon Dash or a scoped credential tool for create, update, rotation, and deletion when one
   is available. Use `keepassxc-cli` directly only when the requested operation requires it.
5. Never create, destroy, or reorganize the vault without explicit user direction.

## SecretRefs

The bundled OpenClaw exec provider is named `keepassxc`. A reference identifies an entry path and
optionally a field:

```json
{
	"source": "exec",
	"provider": "keepassxc",
	"id": "Providers/example/apiKey"
}
```

Supported field suffixes include `:Password`, `:UserName`, `:URL`, `:Notes`, and `:Title`. Omitting
the suffix resolves `Password`.

## Safe CLI diagnostics

Verify the installation without reading secrets:

```bash
keepassxc-cli --version
test -r ~/.openclaw/passwords.kdbx
test -r ~/.openclaw/vault.key
keepassxc-cli ls --no-password --key-file ~/.openclaw/vault.key -R -f ~/.openclaw/passwords.kdbx
```

`keepassxc-cli show` displays metadata by default. `--show-protected` (or `-s`) reveals protected
values in clear text. Use it only when the value is required for the authorized operation, and
never allow its output to enter a transcript or log.

When writing a credential through the CLI, provide the value through protected stdin or another
non-logging channel. Never place a literal secret in a shell command, here-document, or example.
