# Vault

Falcon Dash includes a KeePassXC-backed credential vault at `/passwords`. It is a built-in product
component and the source for Falcon Dash/OpenClaw SecretRefs, not an optional third-party vault.

## Current behavior

The Vault page can:

- browse nested groups and entries;
- create groups and entries;
- inspect, copy, edit, move/rename, and delete an entry;
- store username, password, URL, notes, and generated passwords.

The current implementation uses key-file-only, unattended access:

- `~/.openclaw/passwords.kdbx`
- `~/.openclaw/vault.key`
- `keepassxc-cli --no-password --key-file`

There is no Falcon Dash master-password prompt or unlock screen. If the binary, database, or key
file is missing or unreadable, the page shows Vault not available.

## SecretRefs

OpenClaw can resolve values from the same vault through Falcon Dash's bundled exec provider. Use
SecretRefs so gateway configuration identifies an entry path instead of storing plaintext. See
[../secretrefs.md](../secretrefs.md) for the exact provider configuration and ID format.

## Security boundary

The browser receives a selected entry only when the human opens it. Agents should use approved
tools or SecretRefs and should not receive raw vault contents in prompt context. Protect both the
database and key file: together they are sufficient to read every entry.
