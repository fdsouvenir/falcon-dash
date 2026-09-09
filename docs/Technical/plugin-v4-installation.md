# Installed artifacts and private Vault recovery

Deployed services use installed, versioned artifacts outside development checkouts. Neither the
source checkout nor its mutable build output is a production installation. Keep writable data
separate from installed code. 4.0 installs onto a machine with no earlier Falcon Dash present;
there is no cutover, rollback-to-previous-version or legacy retirement path in this build.

## Release and installation gates

- `scripts/verify-release-metadata.mjs` checks package/plugin/lockfile identity and versions,
  the GitHub Packages registry and the single plugin entry. In tag jobs the tag must exactly
  equal `v<package version>`. A prerelease uses the `next` distribution tag and a prerelease
  GitHub Release rather than advertising itself as stable.
- Both publication and release depend on complete reusable CI, including real-Gateway native
  browser acceptance and the managed SecretRef proof. The production-dependency audit is
  fail-closed. The release job builds the reviewed archive and attaches it with `SHA256SUMS`.
- Registry metadata/dry-pack tests verify the native entry/styles, Vault recovery code and
  documentation are present, while standalone source/runtime, node_modules, development state
  and test evidence directories are absent. Dry-pack is not an actual registry publication.
- Install the reviewed archive with the supported OpenClaw plugin installer; do not replace
  installed files with links to a development checkout. Inspect the installed package/version
  and runtime registration. The pinned host, Linux/KeePassXC prerequisites, private data paths,
  native Custom plugin UI opt-in and user-owned Node requirement for the managed preset still apply.

## Post-install configuration

Plugin settings live under `plugins.entries.falcon-dash.config`, the location the host validates
against the manifest `configSchema`. Placing a plugin setting directly on
`plugins.entries.falcon-dash` fails whole-config validation with `Unrecognized key`, and the
gateway then skips every subsequent config reload until the key is moved or removed.

A fresh install leaves `vaultOwners` empty, so `falcon.vault.read` reports `can_manage: false`
and no human can unlock or manage the Vault. Each owner is a full actor string, not a bare
profile id: `plugin/vault/service.mjs` requires `owners.has(actor) && actor.startsWith('human:')`.
Resolve the operator's profile id from the host's own user profile store and configure:

```json
{
	"plugins": {
		"entries": {
			"falcon-dash": {
				"enabled": true,
				"hooks": { "allowConversationAccess": true },
				"config": { "vaultOwners": ["human:<profile-id>"] }
			}
		}
	}
}
```

`hooks.allowConversationAccess` is the owner grant described under
[Host validation caveats](plugin-v4.md); without it the host blocks the `before_prompt_build`
hook and no domain contract reaches an agent. The native Control UI pages additionally need the
`gateway.controlUi.experimental.customPlugins` opt-in.

The Vault module starts as an empty private store under `<dataDir>/vault`. It does not adopt an
existing KeePassXC database from anywhere on the host, and 4.0 ships no importer.

## Private Vault recovery

The owner-only native **Recovery snapshots** surface creates a consistent snapshot under the
existing Vault worker lock. It contains the encrypted database, its private unlock key, policy
and a consistent SQLite access-audit snapshot plus hashes. Publication rechecks the original
human authority. Snapshots stay beneath the private Vault directory in `recovery/<id>`; no
browser download, Documents route, ordinary tool output or chat transfer exposes their bytes.

Treat a snapshot as credential-bearing backup material because it includes the unlock key.
Transfer/retain it only through protected host backup tooling. Do not put it in a source repo,
CI uploads, shared attachments or ordinary cloud folders. Losing both key and backup is not
recoverable by generating a replacement key.

The installed helper `plugin/vault/recovery.mjs` accepts an absolute snapshot path, a **new**
absolute private destination and `--quiesced`. It verifies paths, private permissions and all
hashes before creating a destination; existing/live Vaults are never overwritten. The restored
policy starts locked with a new authority generation. Synthetic tests unlock the restored real
KeePassXC database and verify owner access, while corruption and existing destinations reject.

Restore is an offline operation, not an in-place native UI button. Review identity mappings and
configuration, verify the recovered data in isolation, then select it only during an authorized
maintenance window. Group removal is limited to empty groups. Entry move/removal creates a
private recovery snapshot, preserves redacted audit linkage and disables recycled old entries.
Exact flattened paths—not KeePassXC title-search fallback—determine handle identity. Old
handles/SecretRefs do not silently follow relocated entries; update their bindings explicitly.

Human credential/policy changes pause and invalidate dependent Falcon connections before
publication. Resume/test only after reviewing the completed change. A failed storage operation
may conservatively leave a connection paused; this is preferable to claiming old validation
still applies. Integration-owned atomic rotations retain their separate existing lease guard.
