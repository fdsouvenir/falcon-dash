# KeePassXC SecretRef Integration

Falcon Dash includes a KeePassXC-backed vault and an OpenClaw exec-secret provider. The vault is a
product component, not an optional external service. The UI and resolver use the same database and
key file:

- database: `~/.openclaw/passwords.kdbx`
- key file: `~/.openclaw/vault.key`
- authentication: `keepassxc-cli --no-password --key-file`

Raw values are resolved server-side. Agent and browser interfaces should receive scoped operations
or redacted metadata rather than credentials.

## Current installation requirement

The current v3 code expects `keepassxc-cli`, the database, and the key file to exist. Automatic
provisioning is still an installation gap; it must be closed before the standalone installer can
claim a fully provisioned built-in vault.

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
