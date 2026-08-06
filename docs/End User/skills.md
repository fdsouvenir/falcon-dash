# Skills

The Skills page manages skills exposed by the connected OpenClaw Gateway.

Current controls can:

- list, search, refresh, expand, enable, and disable skills;
- install a skill by name with optional install ID and registry;
- update a skill API key through the gateway when supported.

Gateway protocol v4 does not expose `skills.uninstall`. Falcon Dash therefore reports that removal
requires an explicit change to OpenClaw `skills.entries` instead of calling a nonexistent RPC.

A skill changes what an OpenClaw agent can do; it does not automatically grant Falcon Work
authority or access to raw Vault values. Review the skill source, required scopes, and secret usage
before installation. Store credentials in the built-in Vault and use SecretRefs where the gateway
configuration supports them.

Falcon Dash itself installs only three namespaced runtime skills: `falcon-dash` for product
orientation, `falcon-dash-work` for the current Work interface, and `falcon-dash-vault` for Vault
and SecretRef handling. Frontend, testing, and other repository-development instructions are not
installed into OpenClaw agents.
