# KeePassXC SecretRef Integration

Falcon Dash includes a KeePassXC-backed vault and an OpenClaw exec-secret provider. The vault is a
product component of the plugin, not an optional external service. The native Vault page and the
resolver use the same database and key file:

- database: `~/.openclaw/passwords.kdbx`
- key file: `~/.openclaw/vault.key`
- authentication: `keepassxc-cli --no-password --key-file`

Raw values are resolved inside the Gateway process. Agent and browser interfaces receive scoped
operations or redacted metadata, never credentials.

The resolver ships as `bin/keepassxc-secret-resolver.cjs`. An installed OpenClaw config references
it by absolute path, so moving or deleting that file breaks credential resolution across the
gateway.

## Provisioning

`keepassxc-cli` must exist on the host. The plugin Vault keeps its own database and key inside its
private data directory — `<dataDir>/vault/credentials.kdbx` and `unlock.key` — and creates both only
through an explicit owner setup action in the Control UI. Installation does not create them, and an
existing KeePassXC database is never adopted automatically, including one the bundled resolver above
already reads.

Until an owner runs setup the Vault reports `initialized: false`, its page offers only **Set up
Vault**, and any operation that needs the stored policy fails with `not_initialized`. That is a
provisioning state, not a fault: an unprovisioned Vault must not be reported as unavailable storage,
because the two call for opposite responses.

## Configure OpenClaw

Register the bundled resolver in `~/.openclaw/openclaw.json`. `providers` is an object keyed by
provider name:

```json
{
	"secrets": {
		"providers": {
			"keepassxc": {
				"source": "exec",
				"command": "/absolute/path/to/falcon-dash/bin/keepassxc-secret-resolver.cjs",
				"passEnv": ["PATH", "HOME"],
				"jsonOnly": true
			}
		}
	}
}
```

For a package installation, run `falcon-dash path` to locate the package root, then append
`/bin/keepassxc-secret-resolver.cjs`. Restart OpenClaw after changing its configuration.

## Secret IDs

An ID is a KeePassXC entry path with an optional field suffix:

| ID                     | Value returned |
| ---------------------- | -------------- |
| `Group/Entry`          | `Password`     |
| `Group/Entry:Password` | `Password`     |
| `Group/Entry:UserName` | `UserName`     |
| `Group/Entry:URL`      | `URL`          |
| `Group/Entry:Notes`    | `Notes`        |
| `Group/Entry:Title`    | `Title`        |

Use the provider from OpenClaw configuration with a SecretRef:

```json
{
	"source": "exec",
	"provider": "keepassxc",
	"id": "Providers/anthropic/apiKey"
}
```

The resolver implements exec-provider protocol v1, reads JSON on stdin, writes JSON on stdout, and
returns per-ID errors without exposing unrelated entries.

## Manual bootstrap

Until installation provisions the vault, create it with key-file-only authentication:

```bash
mkdir -p ~/.openclaw
keepassxc-cli db-create --set-key-file ~/.openclaw/vault.key ~/.openclaw/passwords.kdbx
```

Protect both files with operating-system permissions. Possession of the database and key file is
sufficient to read the vault.
