# Installed artifacts, offline recovery and cutover acceptance

Deployed services use installed, versioned artifacts outside development checkouts. Neither the
source checkout nor its mutable build output is a production installation. Keep writable data
and verified rollback storage separate from installed code. Preserve an already-running legacy
checkout until its separately authorized replacement is ready; this build does not move or stop it.

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

## Explicit legacy Vault conversion

The installed `plugin/vault/migration.mjs` consumes a private reviewed JSON plan, not chat secrets.
It requires absolute database/key/new-target paths, the exact reviewed database SHA-256, explicit
human owners, `quiesced: true`, `archive_unmapped: true`, and entry mappings with `source_path`,
`source_uuid`, `target_id` and protected field-to-attribute mappings. Supported source attributes
are Password, UserName, URL and Notes; the CLI's Uuid attribute verifies each reviewed identity.

The old encrypted database/key are archived privately before conversion. Selected values travel
only in private process pipes into fresh versioned entries; mappings never include raw values.
Unmapped entries/history remain in the archive, new entries have no automatic executor grants,
and a failed import removes only its newly created destination. Wrong UUID/digest and existing
destinations reject. This is a tested conversion mechanism, not a claim that the real dataset's
mapping or key custody has been reviewed.

## Offline retirement preflight

The installed `plugin/installation/preflight.mjs` accepts a reviewed offline plan JSON. It is
**read-only**: no service operation, installation, migration, config edit or data mutation occurs.
It verifies:

- installed package/manifest version, one plugin entry and native asset presence;
- real installed/data/rollback paths outside any Git checkout and disjoint from one another;
- the reviewed archive checksum and rollback artifact checksums, including a read-only Work
  SQLite integrity check and denial of live nonempty snapshot WAL;
- explicit evidence that backups, isolated restoration and data mapping have been reviewed;
- recorded legacy service inactivity/disablement and a versioned rollback record.

The plan fields are `installed_root`, `data_root`, `rollback_root`, `version`, `archive`,
`archive_sha256`, `backups` (each has `kind`, `path`, `sha256`; Work and Vault are required),
`backups_verified`, `isolated_restore_verified`, `mapping_reviewed`, `legacy_service`
(`active`, `enabled`), and `legacy_runtime_version`. Rollback storage also contains `rollback.json`.

The result explicitly says **recorded offline evidence only**. It does not attest a remote or
currently-running service merely because a plan says it is stopped. Immediately before a future
approved cutover, independently re-inspect the actual old unit/process/listeners/registrations,
verify no writers remain, and confirm the installed artifact still matches the reviewed archive.
Tests deliberately distinguish synthetic checksum-only archive/Vault stubs in the placement
validator from the real package installation and real encrypted restoration tests.

Existing `snapshotLegacy`, `inspectLegacy` and `convertLegacy` functions remain engineering-only.
They preserve original SQLite snapshots and require exact digests and explicit dispositions;
no inferred identity, completion proof or authorization is fabricated. Real v2/v3 data mapping,
legacy Vault import and production retirement require the actual dataset/identity review and
separate authorization. Do not convert this checklist into a claim that those actions occurred.

Rollback restores verified snapshots and the old versioned installed artifact, not an in-place
schema downgrade or a development checkout. No release tag, package publication, real registry
installation, live service restart/retirement or production data conversion was performed here.
