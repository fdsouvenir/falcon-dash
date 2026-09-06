# Backend continuation after the initial checkpoint

This is the current backend status for [PR #366](https://github.com/fdsouvenir/falcon-dash/pull/366).
The initial checkpoint remains incomplete, but the UI hosting decision is **not a blocker to
backend implementation**. No native UI activation or production configuration change is included.

## Regression recovery

All **402 historical tests** now pass. The three previously failing suites were transformed as
browser code despite importing server-only modules. Vite now gives server regressions a Node
project and retains happy-dom for browser regressions. Test mode never installs the dev Gateway
WebSocket proxy or Sentry upload plugin, so regression execution does not read normal Gateway
credentials or establish live proxy connections. No historical tests were removed.

## Work domain and contracts

- Retained Question answers/hypotheses, Decision packages/outcomes, Finding validity and Area
  lifecycles follow the surviving v3 validation rules. Hypotheses never answer Questions;
  supported/confirmed answers and Findings require sources. Decided commitments cannot be
  rewritten through a package edit. Source references are bounded and unknown fields reject.
- Task dependencies pin both Definition revisions; explicit reaffirmation records the new pin in immutable event history rather than silently repinning. Milestone achievement snapshots explicitly selected supporting Work/result revisions.
- Task change-control revisions now carry scope, risk, rollback and acceptance. Authorization
  pins current Definition/change and optional Plan. Verified human principals grant/revoke;
  agent-provided identity/source assertions do not become human authority. This is Work
  metadata, not OpenClaw runtime permission enforcement.
- Review Tasks pin exact immutable artifact identities. Contextual Asks retain one subject,
  requirement, intended command and native session/agent reference. Resolution resubmits the
  actual semantic command and closes the Ask inside the same transaction only after validation.
- Artifact/event update/delete triggers and cross-Task Definition-pin checks protect immutable
  storage. Work schema version 3 upgrades only the isolated plugin schema; old unversioned Work
  databases require explicit conversion. Preflight checks existing databases read-only before
  changing permissions or journal mode.
- List projections support explicit fields/pagination and server-derived Project progress/current
  Milestone. Queue/brief use a constant-query read transaction with bounded bucket rows and exact
  totals; all attention causes remain classified even when displayed causes are truncated.
  Detail text exposes size metadata and an explicit full read. History has pagination.
- One TypeBox command schema serves the store and supported `defineFeatureContract` /
  `defineFeaturePlugin` backend operations: `work_list`, `work_queue`, `work_command`.
  The real pinned SDK validates inputs **and outputs** in tests. No native browser code is activated.
- The SDK's session-action context supplies a connection id/scopes, not a verified human profile.
  `falcon.identity` therefore binds the real Gateway principal to that connection, with revocation
  cleanup. Feature mutations fail closed until bound; they never infer a human from payload fields
  or use an agent id as the human principal.

Still under audit: complete type-specific update/supersession vocabulary, Task waiting-reference typing, complete revision/history pagination metadata, source/upstream
reference availability, independent-review derivations, token benchmarks, and remaining Project /
Milestone ordering/closure reconciliation. Do not call the complete #363 domain finished.

## Documents

The authorized text backend now supports browse/read/create/edit/mkdir, text upload/download,
no-clobber rename, explicitly confirmed trash and restore. Trash stays in a private, inaccessible
workspace subdirectory; normal Documents traversal cannot browse it. Restore verifies content and
never overwrites another file. Unknown operations remain errors. All operations retain root/actor
checks, symlink/hardlink restrictions and text-size limits. Read/download content is untrusted.

Directory moves, bulk transactions, richer binary/media handling, Markdown rendering and real
browser editor acceptance remain separate gates. Same-UID hostile filesystem writers remain
outside the stated trusted-workspace concurrency model; atomic rename is not cross-process CAS.

## KeePassXC and SecretRefs

- Real KeePassXC group creation, nested handles and redacted per-group inventory are implemented.
- Lock/unlock state and authority generations persist under the same `flock` as credential
  operations. A stale service instance cannot mutate after another instance locks/unlocks.
  Awaiting `lock()` is the durable completion boundary; local reveal results are also fenced.
- OAuth rotations can carry a connection guard. The private worker acquires the Integrations
  SQLite write lock, rechecks the connection's version/actor/phase, and holds it across the
  encrypted file's atomic publication. Tests exercise disconnect while real rotation is queued.
- `plugin/vault/resolve-secrets.mjs` implements the real OpenClaw exec-provider v1 protocol.
  `secretProviderIntegrations.keepassxc` declares the supported manifest preset, not a copied
  resolver path. It has no HOME fallback. Configure the nonsecret `FALCON_VAULT_DIRECTORY`
  path explicitly. The human owner grants exact `entries/<handle>/<field>` IDs; the resolver
  cannot use the broader executor inventory as a blanket grant. Disabled/removed plugin preset
  handling remains owned by OpenClaw.
- Resolver values travel only on the native private exec-provider pipe, never general tools,
  Gateway detail/list methods, audit payloads or error messages. Tests use synthetic credentials
  and check denial, durable lock and the real child process protocol.

Protected human entry/reveal/copy transport and UI remain gated on the UI decision. Per-entry
execution-policy refinement, revocation/removal workflows and complete key recovery need further
review. Filesystem key protection is not an external key-management service.

## Integrations and OAuth

- Maintenance is activated as a deterministic plugin service, not agent Automations. Only
  connections explicitly granting `service:falcon-integrations` are eligible, and Vault access
  still requires its own configured permission/unlock. Work is serialized with bounded catch-up.
- Durable phase/version claims, PID plus process-start identity, retries/backoff, explicit
  pause/disconnect and compare-and-swap finalization prevent competing refreshes and stale
  completion writes. Shutdown drains in-flight work. A second service does not steal a live
  process's claim. Ambiguous crashed exchanges require reauthorization instead of token replay.
- Successful token refresh does not itself mark a connection healthy; validation is scheduled
  separately. Native-owned credentials still reject Falcon refresh ownership.
- `HighLevelOAuth` implements human-bound, expiring, one-use state, configured redirect allowlists,
  confidential-client exchange, connection/Vault-version revalidation and guarded token storage.
  Raw authorization codes are neither persisted nor logged. Callback success says connected but
  unvalidated, and replay is denied. The OAuth URL is a protected human-flow output, never an
  ordinary agent tool response. No callback HTTP route or native UI handoff has been activated.
- OAuth tests are **provider HTTP fixtures**, not actual HighLevel consent/authentication.
  Cloudflare permission proof and Schwab's actual adapter remain unfinished.

The current public Schwab guide was read at
[OAuth restart vs refresh](https://developer.schwab.com/user-guides/apis-and-apps/oauth-restart-vs-refresh-token).
It requires restarting consent for scope/account changes, revocation, changed account credentials
or TFA, and compromised/malfunctioning refresh tokens; normal access-token expiry uses `expires_in`
and refresh. It does **not** establish an indefinite renewable session or a universal seven-day
policy. Do not invent either from third-party examples.

## Offline conversion

`plugin/work/migration.mjs` is engineering-only: no tool, route, startup import or dual-write path.
It creates a consistent read-only-source SQLite backup, checks integrity, reports missing Task
semantics and identifies every source entity. Conversion requires the exact snapshot digest and
an explicit disposition for every entity. Retired records remain in the original archive; retained
records use the same typed semantic commands. Missing Definition fields, identity mappings and
result evidence are never fabricated. A failed conversion removes only its newly created target.
The snapshot and mapping/provenance report remain the recovery/reference source.

Tests cover source preservation, missing semantics, stale/incomplete plans and explicit conversion.
This is a reviewed-command conversion mechanism, not a claim that the real v2/v3 datasets have
been mapped or migrated. Actual data-specific mapping and production restoration remain gated.

### Native resolver verification and managed-preset limitation

The pinned native `secrets audit --allow-exec` resolved one synthetic reference successfully with
zero unresolved/plaintext findings using the supported **manual exec provider** pointed at the
user-owned executable resolver. The nonsecret directory comes from that provider's explicit env
configuration; the launch environment omitted the convenience variable. After durable Vault lock,
the same native audit reported one unresolved reference with no value leakage or fallback.

The **manifest-managed preset did not pass on this host**: its required `${node}` command resolves
to root-owned `/usr/bin/node`, which the native exec-provider ownership guard rejects. No guard,
permissions policy or system executable ownership was changed. The manual exec path satisfies the
existing ownership check but does not carry the preset's automatic plugin-ownership revocation.
Do not claim these two modes are equivalent or that managed-preset acceptance is complete. This
needs a supported deployment decision or upstream compatibility fix before release.

TypeBox 1.3.18 is now bundled with its license by the build; the installed runtime has no npm
runtime dependency installation step. This also avoids the installed host's npm `edgesOut` failure
when updating a plugin that already has a linked OpenClaw peer. The SDK itself remains host-owned.

## Latest continuation evidence

- 64 plugin tests cover the current backend; all 402 retained historical tests pass in their
  corrected Node/happy-dom projects. No historical suite was removed to obtain that result.
- The public contract structurally factors repeated schemas into local JSON Pointer definitions.
  Expansion is tested equal to the original artifact. This reduces serialized contract size by
  roughly a quarter without omitting fields; it is not a v2 tokenizer benchmark.
- Work invalidations contain only process epoch and monotonic revision. Post-commit observer
  failures cannot undo a mutation; external database commits are detected. The supported SDK
  watch implementation is exercised for coalescing, stale responses, reconnect and disposal.
- Technical attention derivations are shared by mutation responses and bounded queues, and
  queue rows are deduplicated when multiple causes apply. Missing Task authorization is visible
  without claiming runtime enforcement. Review checkpoints pin the reviewed artifact and cannot
  be accepted for a different target.
- Vault execution grants are per-entry in addition to global eligibility; the creator does not
  retain agent access after the human owner replaces that grant. The owner can still reveal an
  owned value after execution access is disabled. Field-specific reveal/copy returns only the
  selected field. Append-only access audit excludes values and remains owner-readable while
  locked. Audit state is included in synthetic restore tests.
- Vault lock and local grant revocation prevent new resolutions. They do **not** retract copied
  values, revoke provider tokens, or promise to evict credentials already cached by OpenClaw.
  Native credential-owner/cache lifecycle and provider revocation are separate boundaries.
- Documents now includes actor-scoped root discovery, stable sorting/pagination and authorized
  path copying. Registered workspaces below OpenClaw state are allowed; state/credential roots
  are excluded. Root replacement, duplicate root ids, known credential containers,
  credential-shaped JSON and private-key content fail closed. These checks do not discover
  every possible secret embedded in ordinary prose. Non-cooperating concurrent filesystem
  writers, including external editors, are not covered by a cross-process CAS guarantee.
- HighLevel's probe follows the current documented `Version: v3` endpoint and verifies the
  configured sub-account identity. A whole-service fixture exercises validation, real encrypted
  storage, refresh and revalidation; requested scopes are not represented as verified grants.
  Source: [current Get Location contract](https://marketplace.gohighlevel.com/docs/ghl/locations/get-location/).

The reviewed provider-request harness remains limited to the pinned core OpenAI-compatible path
against a local fixture. It is not live HighLevel/Cloudflare/Schwab authentication, proof for every
agent harness, or rendered UI acceptance. The actual operator dataset, legacy credential import,
remaining domain/connection refinements, Cloudflare permission coverage, Schwab adapter, native UI
and managed-SecretRef deployment compatibility remain acceptance work. The original request and
source issues must remain open.
