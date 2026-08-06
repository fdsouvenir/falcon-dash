# Channels

The Channels page reports live OpenClaw chat-provider readiness and links to setup or repair flows.
It does not contain local Falcon Dash conversation channels.

## Current providers

- **Discord** is the primary live provider. Its card reports configured and running state and opens
  the Discord setup/repair wizard.
- **Telegram** remains an advanced provider with its own setup route.
- **WhatsApp** is status-only in the current build. No route, gateway method, or local archive
  adapter is wired, so the UI must not imply it can be configured yet.

The page requires a ready gateway to inspect provider state. `Ready`, `Degraded`, `Needs input`,
`Repair`, and `Not configured` describe the adapter's current validation result; they are not stored
Falcon Dash lifecycle states.

## Configuration safety

Provider credentials should be stored in the built-in Vault and referenced through OpenClaw
SecretRefs where supported. Setup pages may update OpenClaw configuration, so review the requested
scopes and restart requirements before applying changes.

Channels are optional external communication paths. Falcon Dash itself does not require Discord,
Telegram, WhatsApp, or a provider-specific hosting backend.
