# Secret Providers

`/secrets` manages OpenClaw SecretRef provider configuration. It is distinct from `/passwords`:

- **Vault** stores and edits credentials in Falcon Dash's built-in KeePassXC database.
- **Secret Providers** tells OpenClaw how to resolve a SecretRef without displaying the resolved
  value.

The current page reads live OpenClaw configuration and can add or remove environment, file, and exec
providers. Provider name, type, path, or command are visible; resolved secret values are not.

Falcon Dash's preferred built-in provider is the bundled KeePassXC exec resolver documented in
[../secretrefs.md](../secretrefs.md). The UI may expose OpenClaw's other provider types for advanced
configuration, but their existence does not make the built-in Vault optional.

Adding or removing a provider applies gateway configuration. Confirm the provider name and every
SecretRef that depends on it before removal, and keep paths/commands restricted to the same host.
