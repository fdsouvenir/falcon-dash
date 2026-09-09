# Vault

Falcon Dash includes a KeePassXC-backed credential vault. It is a built-in product component and
the source for Falcon Dash and OpenClaw SecretRefs, not an optional third-party vault. It appears
as the Vault page inside the OpenClaw Control UI.

## Storage and access

The Vault keeps its own database inside the plugin's private data directory — by default
`<OpenClaw state>/falcon-dash/vault`, or under `dataDir` when that is configured:

- database: `credentials.kdbx`
- key file: `unlock.key`
- authentication: `keepassxc-cli --no-password --key-file`

This is the plugin's own store. It is not any other KeePassXC database you already keep, including
one an OpenClaw SecretRef provider resolves directly.

Access is key-file only and unattended: there is no master-password prompt. The unlock key is
protected by filesystem ownership, not an external key-management system.

## Setting it up

There is nothing to set up. The plugin creates the encrypted database and its private key the first
time it starts, and opens it on every start after that. The Vault page is a credential list from the
first visit: no setup step, no unlock prompt, and no lock button.

Reaching the Gateway is what authorizes you. Anyone who can sign in to the operator UI can add,
reveal and organize credentials; `vaultOwners` no longer gates the page. Agents are separate — they
hold no session, so they reach a credential only when `vaultExecutors` names them and a human grants
that entry.

An existing vault is never silently adopted, and provisioning refuses to run twice.

If the page reads **Vault unavailable**, startup failed rather than waiting for you — usually a
missing `keepassxc-cli`, or a key file present without its database, which needs recovery. The
Gateway service health carries the reason; the other Falcon Dash modules keep working meanwhile.

`flock` serializes separate worker processes, so two operations cannot corrupt the database by
racing each other. If the binary, database or key file is missing or unreadable, the page says the
Vault is unavailable rather than showing an empty list.

## What you can do

Browse nested groups and entries, create groups and entries, and store username, password, URL and
notes. Entries can be edited, moved, renamed and removed.

**Group relocation works by moving entries into a newly created group, then removing the empty old
one.** The supported CLI offers no proven-safe whole-group rename, so the product does not pretend
to have one.

**Removal and relocation create a private recovery snapshot first**, preserve redacted audit
linkage, and disable recycled old entries. An entry's identity is its exact flattened path — never a
title search — so a renamed entry cannot be silently resurrected by matching its old name.

Old handles and SecretRefs do not follow a relocated entry. Update their bindings explicitly.

## Who can see a value

Raw values never enter ordinary tool responses or logs. They travel only inside private process
pipes.

- **A human owner** can reveal and copy a value they own, through an explicit authorized action.
- **A different authenticated person cannot** reveal an entry they do not own, even on the same
  gateway. This is tested in the browser acceptance suite, not merely intended.
- **Agents cannot reveal values at all.** An agent may create an entry and may be granted _executor_
  rights to use one, but revealing is denied. No raw-value Gateway method exists to call.
- Revealed values are cleared from the interface when the transport disconnects.

Every access is recorded in a redacted audit history.

## Recovery

The owner-only **Recovery snapshots** surface takes a consistent snapshot under the Vault worker
lock: the encrypted database, its private unlock key, policy, and a consistent audit snapshot, plus
hashes. Snapshots live under the private Vault directory.

**Restore is an offline operation, not a button.** Review identity mappings and configuration,
verify the recovered data in isolation, then select it during an authorized maintenance window.

Local revocation does not retroactively erase values already copied elsewhere, or tokens a provider
has cached upstream. Rotate at the provider when a credential is genuinely exposed.

## Carrying over from a previous version

Falcon Dash 4.0 has no vault conversion. An existing `passwords.kdbx` is opened as-is; it is not
converted, and no entry gains an executor grant automatically. Grant those explicitly after
installing.

## Related

- [SecretRef integration](../secretrefs.md)
- [Backend contracts](../Technical/plugin-v4-backend.md)
- [Installed artifacts and recovery](../Technical/plugin-v4-installation.md)
