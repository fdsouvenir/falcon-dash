# SecretRefs Integration Guide

Falcon Dash ships a KeePassXC exec provider (`bin/keepassxc-secret-resolver.cjs`) that bridges your KeePassXC vault to [OpenClaw's secrets system](https://docs.openclaw.ai/gateway/secrets). Once wired up, any gateway provider config can reference vault entries by path instead of storing plaintext credentials in `openclaw.json`.

## What the secret resolver does

The resolver implements the OpenClaw exec provider protocol:

1. The gateway passes a JSON payload to the script over stdin with a list of secret IDs.
2. The script opens `~/.openclaw/passwords.kdbx` using a key file (`~/.openclaw/vault.key`) — **no master password required**.
3. It calls `keepassxc-cli` to look up each entry and returns the values as JSON on stdout.

The gateway treats the returned values as opaque strings and injects them wherever a `SecretRef` appears in provider configs.

## Prerequisites

- `keepassxc-cli` must be on `PATH` (ships with KeePassXC).
- Vault database: `~/.openclaw/passwords.kdbx`
- Key file: `~/.openclaw/vault.key`

## Gateway configuration

Add the provider to `~/.openclaw/openclaw.json`:

```json
{
	"secrets": {
		"providers": [
			{
				"type": "exec",
				"name": "keepassxc",
				"command": "/path/to/falcon-dash/bin/keepassxc-secret-resolver.cjs"
			}
		]
	}
}
```

If Falcon Dash was installed globally via npm, the path is typically:

```
/usr/lib/node_modules/@fdsouvenir/falcon-dash/bin/keepassxc-secret-resolver.cjs
```

Restart the gateway after editing `openclaw.json`.

## Secret ID format

Secret IDs map directly to KeePassXC entry paths. The group and entry name are separated by `/`, and an optional `:Field` suffix selects a specific attribute.

| ID format              | Returns                   |
| ---------------------- | ------------------------- |
| `Group/Entry`          | Password field (default)  |
| `Group/Entry:Password` | Password field (explicit) |
| `Group/Entry:UserName` | Username field            |
| `Group/Entry:URL`      | URL field                 |
| `Group/Entry:Notes`    | Notes field               |

Examples:

```
Providers/anthropic/apiKey          → password stored under Providers → anthropic/apiKey
Services/openai:UserName            → username of the Services → openai entry
Tokens/discord-bot:Notes            → notes field of the discord-bot entry
```

## Referencing secrets in provider configs

Use a `SecretRef` object anywhere a string value is accepted in your provider configuration:

```json
{
	"providers": {
		"anthropic": {
			"apiKey": { "source": "exec", "provider": "keepassxc", "id": "Providers/anthropic/apiKey" }
		},
		"openai": {
			"apiKey": { "source": "exec", "provider": "keepassxc", "id": "Providers/openai/apiKey" }
		}
	}
}
```

The gateway resolves all `SecretRef` objects at startup (and on config reload) before passing values to providers. Plain strings are passed through unchanged, so you can mix SecretRefs and literals in the same config.

See [OpenClaw secrets docs](https://docs.openclaw.ai/gateway/secrets) for the full SecretRef schema and supported source types.

## Vault authentication

The resolver uses key-file-only authentication (`--no-password --key-file`). There is no interactive password prompt — the gateway can resolve secrets unattended as long as `~/.openclaw/vault.key` is present and readable.

To create the vault with a key file (no master password):

```bash
keepassxc-cli db-create --set-key-file ~/.openclaw/vault.key ~/.openclaw/passwords.kdbx
```

To add an entry:

```bash
keepassxc-cli add \
  --no-password \
  --key-file ~/.openclaw/vault.key \
  -p ~/.openclaw/passwords.kdbx \
  "Providers/anthropic/apiKey"
```
