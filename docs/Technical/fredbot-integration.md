# Optional fredbot-backend Deployment Profile

Falcon Dash is installable and operable without fredbot-backend. This document exists only to bound
an optional managed-hosting adapter; it is not part of the core architecture, installation path,
configuration contract, or product vocabulary.

## Allowed responsibilities

An external hosting control plane may:

- install or upgrade the published Falcon Dash package;
- provision the same-host service environment and reverse proxy;
- ensure OpenClaw, KeePassXC, persistent storage, and the Falcon Dash gateway extension are present;
- monitor Falcon Dash health endpoints and restart the service;
- back up the installation's Work databases and built-in vault files;
- supply identity headers or infrastructure-specific logging outside Falcon Dash's domain.

## Boundaries

The adapter must not:

- provide a Falcon-only backend required by product code;
- move OpenClaw to another host or introduce remote-gateway behavior;
- replace the built-in KeePassXC vault with a provider-specific secret service;
- make fredbot paths, account names, domains, ports, repositories, or support procedures defaults in
  core docs or source;
- become the source of truth for Work, integrations, sessions, transcripts, or scheduler state.

## Adapter contract

Treat the hosting integration as ordinary deployment automation over the supported interfaces in
[deployment.md](deployment.md): package command, environment variables, same-host files, health
endpoints, and reverse-proxy requirements. Provider-specific implementation details belong in the
hosting repository, not in Falcon Dash.

Any Falcon Dash change needed only for this adapter must remain optional, tested with the adapter
absent, and documented here without changing the standalone product contract.
