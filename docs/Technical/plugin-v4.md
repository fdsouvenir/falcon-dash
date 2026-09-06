# Single-plugin implementation preview

**Status: incomplete, not release-ready.** Branch `feat/falcon-plugin-v4` implements an isolated
engineering checkpoint for [#364](https://github.com/fdsouvenir/falcon-dash/issues/364), not the
completed next major version. Current issue bodies #326, #329, #330, #345, #347, #360, #361, #363
and #365 govern the target. Historical standalone docs do not override them. `PURPOSE.md` remains
owner-protected and knowingly describes the superseded standalone direction.

## Actual package and runtime

The package has exactly one OpenClaw entry, `plugin/index.mjs`, and one `falcon-dash` manifest.
It registers real SDK services, tools, scoped Gateway methods, four tab descriptors, authenticated
HTTP routes, and one `before_prompt_build` hook returning `prependSystemContext`. No Channels,
Shell, Labs, Apps, Jobs, Ops, Heartbeat, channel transport, standalone server, or mirrored
OpenClaw runtime data is loaded by that entry. Historical Svelte source remains in Git for
conversion/recovery reference, but is not shipped in the plugin package. It is not a second install.

`npm run build`, `npm run check`, and `npm test` now target the directly executable JavaScript plugin. Historical Svelte checks/tests/builds
require the explicit `*:historical-standalone` scripts. There is no production cutover here.
Development dependencies are not runtime plugin dependencies. OpenClaw is an exact optional peer
at **2026.9.2**; Node **22.16+**, Linux `/proc/self/fd`, `flock`, and KeePassXC CLI are prerequisites.
This Linux-only preview must not be advertised as portable or broadly version-compatible.

## Verified host limitation: human UI writes

The inspected installed host is OpenClaw 2026.9.2, build `3928bad`.

- `PluginControlUiDescriptor` supports `surface: "tab"`, a plugin HTTP `path`, and required scopes.
- The host renders external tabs in sandboxed iframes; descriptors are real registration, unlike
  the old custom `modules` manifest metadata.
- `authorizeControlUiPluginCookieRequest` in the pinned runtime's `http-auth-utils` accepts only
  **GET and HEAD**. The external tab component contains no general authenticated mutation bridge.
- `dispatchGatewayMethod` is supported only inside declared authenticated HTTP request scope;
  `contracts.gatewayMethodDispatch: ["authenticated-request"]` is declared here.
- Native feature UI offers authenticated `host.request`, but it executes trusted code in the
  Control UI origin and requires the separate Custom plugin UI opt-in. This is a different trust
  boundary, not something an external iframe receives automatically.

The preview therefore serves **read-only iframe content**. It does not use GET mutations,
credentials in URLs, permissive CORS, or a bearer token handed into the frame. Approval to use a
minimal native bridge around sandboxed application content was requested but not received.
This is a consequential unresolved boundary for interactive Work, Documents, protected Vault
entry and human Reveal/Hide/Copy. Do not ship those actions through generic tool payloads instead.

## Implemented backend checkpoint

### Work

Private SQLite storage uses WAL, FULL synchronous mode, busy timeout, STRICT tables, immediate
transactions, optimistic versions, idempotency receipts, immutable Definition/Plan/Result/change
artifact snapshots, and transactional events. Existing unversioned databases are rejected rather
than silently adopted. Task starting requires explicit accountable assignment; waiting preserves
its prior state in the event history. Completion can report truthful results despite dependency
warnings. Milestone achievement rejects unfinished associated Work. Project completion is derived;
reopening its Milestone reopens that projection. Abandonment requires each unfinished item's
explicit abandon/detach disposition and records affected objects individually.

Definition edits mark pinned artifacts stale rather than repinning them. Full reads expose artifact
and event history; lists exclude those bodies. Empty lists and unknown query fields are explicit.
Repeated Task completion is a no-op. Independent connections exercise optimistic conflicts.

This is **not yet the whole #363 domain**: durable contextual Asks, Question/Decision/Finding/Area
semantic transitions, review targets, structured Task authorization/reconciliation, placement
reconciliation, complete aggregate queues, field selection, size-bounded detail/truncation,
benchmarks, and historical data conversion remain incomplete. `revise_change` currently stores
an immutable narrative artifact only; it grants no authority and is not a finished change-control
implementation. No unsupported governance behavior should be inferred from its existence.

### Documents

Explicit root/actor ACLs and write enablement gate text browse/read/create/edit/mkdir. Linux
file-descriptor-anchored directory traversal rejects dot/credential paths, symlink components,
nonregular files, hardlinks, and oversized/binary content. Root paths cannot traverse OpenClaw
state. Content is treated as text, not trusted markup. Saves compare content versions and publish
via same-directory atomic replacement; stale edits reject instead of overwriting silently.

This assumes trusted same-UID workspace writers. Version checking is not a cross-process CAS
against a hostile concurrent filesystem writer. Protected filename filtering does not discover
arbitrary credentials someone embeds in an otherwise authorized document: configure dedicated
noncredential roots. Rename, download/upload UI, recoverable deletion, bulk actions, Markdown
rendering, browser editing and full accessibility acceptance remain incomplete.

### Vault

The backend provisions a new KeePassXC database and private local unlock key only through an
explicit owner operation; it starts locked. The unlock key is protected by filesystem ownership,
not an external key-management system. Existing Vaults are not adopted. `flock` serializes
separate worker processes. OAuth access/refresh material is one encrypted JSON Password value;
rotation copies the encrypted database, changes the value through stdin, verifies it, fsyncs,
then atomically publishes. Optimistic versions reject a concurrent loser. An omitted unchanged
refresh token survives a partial rotation. Ordinary inventory returns handles only.

Synthetic tests exercise the **real KeePassXC CLI**, operator- and agent-created entries,
human-owner reveal in the backend, agent reveal denial, locking, and pair rotation. Raw protected
CLI stdout stays inside private service pipes and never enters ordinary tool responses or logs.
Separate tests restore a consistent SQLite snapshot and a quiesced synthetic KeePassXC/key backup. This does **not** prove the human browser path, a complete entry/group UI, revocation races,
SecretRef resolver integration, or production recovery. Those are release gates, not implied
by successful unit tests. No raw-value Gateway method is registered.

### Integrations

One SQLite lifecycle service and adapter interface separate public connection state from Vault
material. HighLevel refresh and location validation plus Cloudflare token validation use fixed
HTTPS endpoints, timeout and redirect rejection. Concurrent refresh rejects rather than
performing another exchange. Interrupted refresh becomes reauthorization-required rather than
blindly reusing a potentially consumed token. Native-owned credentials reject Falcon refresh.

Provider tests are **mock HTTP fixtures, not authenticated provider proof**. Cloudflare token
verification alone is not permission proof and is reported unavailable, not ready. Schwab is
not implemented or registered. HighLevel consent/callback/code exchange, permission verification,
full durable scheduler ownership/recovery, lifecycle service activation, UI actions, redacted audit
projection, shared credential authorization races and end-to-end live validation remain incomplete.
The timer helper is not activated by this prerelease: automatic maintenance must not be claimed.

## Reliability audit (#361)

| Pattern                                                      | Checkpoint disposition                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Shared generated contract                                    | Adopted operation-schema composition; full derivation/guard generation incomplete        |
| Epoch + monotonic revision                                   | Adopted in Work read/mutation responses                                                  |
| Canonical reread/reconnect/stale browser response protection | Pending interactive bridge and UI implementation                                         |
| SQLite hardening                                             | Adopted for new Work database; integrations/WAL permission and recovery audit incomplete |
| Just-in-time authority                                       | Partial checks in credential resolution; asynchronous mutation revocation remains a gate |
| Reported versus independently verified proof                 | Results do not claim independent verification; review Task links pending                 |
| Workboard integration or dispatch                            | Rejected: separate, unsynchronized products; no runtime dependency                       |

Recommend keeping Workboard disabled when using Falcon Work; the plugin never changes its config.

## Validation and isolated rerun

Run `npm run build:plugin`, `npm run test:plugin`, and formatting/lint checks. Tests create and remove
only their own synthetic temporary directories. Preserve all real state and credentials.
For any OpenClaw CLI call, set **both** `OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` to the
isolated test directory and invoke the absolute pinned 2026.9.2 binary. Never invoke an unpinned
binary against the operator's normal state. Validate metadata, pack, then install that archive
inside isolated state. Do not publish the package or restart the production Gateway.

Provider-request prompt-injection proof, real interactive Control UI acceptance, source-data
migration and backup/restore proof are still required. Passing registration spies is not proof
of a real installation or provider-bound system prompt; report each separately.

## Deferred controlled cutover (not executed)

1. Independently review and finish every domain/security/UI gap above; choose the host UI boundary.
2. Identify the old service, its actual database paths, schema versions, attachments and credential
   ownership without reading credential values. Record the exact old binary/package and config.
3. During an authorized maintenance window, quiesce old writers. Take consistent SQLite backups
   through supported backup APIs, encrypted Vault/key backups with private permissions, plus
   attachment/config snapshots. Hash and verify every artifact and test restoration in isolation.
4. Implement explicit offline converters for obsolete Phase, Review, Change, Blocker, Project Plan,
   assignment, waiting and result records. Preserve original source snapshots/history and mapping
   reports. Quarantine ambiguous semantics for review; do not manufacture approval or new results.
5. Prove restored/conversion counts, relationships, artifact pins, representative histories, and
   credential resolution in isolated acceptance. No dual-write or permanent migration UI.
6. Only after separate release authorization, install the reviewed artifact, switch data paths,
   disable the old standalone service, and verify native plugin identity, UI, tools and health.
7. On failure, stop replacement writers and restore the verified old snapshots and old runtime.
   Do not try an in-place database downgrade. Retain rollback material until acceptance closes.

Synthetic offline SQLite and encrypted Vault/key restoration are tested in `plugin/tests/recovery.test.mjs`. These steps remain a preparation checklist, **not a verified production conversion/cutover runbook**. No live
backup, migration, service disable, production configuration change or public release occurred.

## Host validation caveats

The pinned `plugins validate` command accepts the newer tool/feature authoring metadata, not
plain `definePluginEntry` service plugins; it reports that authoring metadata is missing. Use
`plugins inspect falcon-dash --runtime --json`, actual isolated Gateway startup, and scoped RPC
checks as distinct runtime evidence rather than inventing metadata to satisfy that command.
External `before_prompt_build` hooks additionally need the owner-controlled
`plugins.entries.falcon-dash.hooks.allowConversationAccess` grant. Default installation blocks
that hook; a successful registration spy alone must never be reported as injection proof.

The [checkpoint evidence](plugin-v4-evidence.md) distinguishes passing tests, fixture-only checks,
blocked browser acceptance, and the actual runtime installation proof.
