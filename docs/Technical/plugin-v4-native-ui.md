# Native Control UI implementation

## Approval and boundary

Native trusted Control UI code is approved in the current bodies of #364, #365, #330 and #347.
There is no remaining UI-trust design decision. One `falcon-dash` package now declares the
prebuilt native entry `dist/control-ui/falcon/index.js` and its stylesheet. The four native
pages use the supported `defineControlUiPlugin`, host page/navigation/dialog APIs and authenticated
host requests. Work commands and queries use `createFeatureClient(workFeature, host)`.

Enable **Settings → Labs → Custom plugin UI**, or
`gateway.controlUi.experimental.customPlugins: true`, in an approved installation and reload
following the required Gateway restart. The synthetic managed-install harness enables this only
in its own generated runtime config. Production config/restart is not performed. With the opt-in
off, upstream gates native assets and the retained authenticated read-only fallback explains
how to enable the native pages; backend operations remain available.

## Implemented interactions

- Work: attention buckets, Projects, Browse/search, canonical detail, associated Project/Milestone
  work, relationships and open Asks with native conversation links. Create and contextual actions
  use schema-derived labeled forms, source/option arrays, nullable values and typed dispositions.
  History loads on demand. Definition/result/change/authorization remain separate sections.
- Vault: encrypted initialization, lock/unlock, protected entry, groups, deliberate field-specific
  Reveal/Hide/Copy for human- and agent-created entries, versioned field rotation and executor policy.
  The protected RPC is not a general agent tool or background feature query. It requires an actual
  connection-bound human owner and original authority through async worker activity and return.
  No plaintext browser persistence or secret-bearing URLs are used. Revealed values clear on
  Hide, a 15-second deadline, lock/epoch/ownership loss, disconnection, loss of write access,
  presentation loss or disposal. Cleanup includes host dialogs rendered outside the mount node.
  Explicit Copy writes the selected value to the system clipboard; the UI does not promise to
  erase the clipboard later or undo a value already copied by the human.
- Integrations: health/freshness, connection creation with server-derived human identity, Test,
  Refresh, Pause/Resume, Disconnect and HighLevel consent/completion backed by the existing
  version-fenced OAuth implementation. `oauthRedirectUris` explicitly allowlists callback URIs.
  Consent codes use protected human fields, not chat. No real vendor consent or validation was
  performed. The connection's named service/agents must also have Vault execution grants.
- Documents: authorized roots, breadcrumbs, filename search/sort, text viewing/editing, create
  file/folder, text upload/download, rename, copy path, targeted recoverable trash, bounded selected
  file trash and per-item undo. Stale writes retain edits; Compare latest version lets the human
  review the saved content before explicitly using its version for the next Save. Markdown uses
  the existing unified/remark/rehype sanitization libraries and an empty-sandbox iframe with a
  deny-by-default CSP. No script, network image, form or embedded active document capability is
  granted to file content.

## Verification and exact limitation

`plugin/tests/native-ui.test.mjs` evaluates the actual bundled native module in an offline
Happy DOM fixture. It tests registrations/typed transport, real WorkStore creation, stale reply
retirement, protected input outside the mount container, Reveal/Hide, authority-loss cleanup and
non-executing document content. `native-vault.test.mjs` additionally runs real KeePassXC with
synthetic human/agent entries and original-authority races. `native-integrations.test.mjs` tests
connection derivation and consent authority. These are **not screenshots or real Control UI E2E**.

The configured managed browser is healthy (CDP and page readiness both true), but the browser tool
explicitly denied `http://127.0.0.1:28971` with `browser navigation blocked by policy`. Installed
`docs/tools/browser.md` distinguishes this from browser startup failure and says navigation policy
is separate from healthy local CDP. No alternate URL, direct CDP/Playwright navigation or proxy was
used to bypass the denial. The local browser limitation does not block the separately authorized real-Gateway CI browser
suite on its own runner. Use that required gate and its screenshots for desktop/narrow acceptance;
do not bypass the local browser policy or infer acceptance from offline DOM tests. The initial
native checkpoint was not release-ready; current acceptance is tracked in the E2E evidence.

Other acceptance still requiring verification: full real-shell navigation and native descriptor
placement, optimistic recovery/reconnect in that shell, clipboard permissions, high-density
Project/Decision layouts, narrow viewport/focus/zoom/reduced motion, and independent review of the
new native protected transport. DOM tests cannot close these gates. Live provider consent remains
a separate, explicitly unperformed step. Legacy dataset-specific conversion and production
cutover remain outside this synthetic build's evidence.

## Local candidate evidence

- `artifacts/plugin-v4/native-all-tests.txt`: 99 plugin tests passed, including the retained 80.
- `artifacts/plugin-v4/native-historical-tests.txt`: 402 retained historical tests passed.
- `artifacts/plugin-v4/managed-install-4120649/combined-proof.json`: current archive installed,
  runtime loaded, native assets declared, isolated opt-in on, managed revocation/lock checks and
  real synthetic-provider request passed; original system Node unchanged.
- `artifacts/plugin-v4/native-browser-policy.json`: healthy browser control and denied isolated
  navigation; **no rendered evidence or screenshots**.
- `artifacts/plugin-v4/native-types.txt`, `native-lint.txt`, `native-format.txt`, `native-docs.txt`,
  `native-harness.txt`, `native-skills.txt`: source/package quality checks.

The local browser-policy limitation is unchanged. A required, separately authorized CI browser job now exercises the real isolated Gateway on its own runner; see [native E2E](plugin-native-e2e.md). Host-only proof is already local; browser acceptance must be reported from actual CI results, not inferred from the test implementation.

Native Work forms now retain one idempotency key across an uncertain reply and expose explicit
review/reapply controls after a version conflict. Updating the reviewed command version does not
silently repin Plan, Result or authorization references. Closed real transport sockets also retire
server-side authority, even if a synthetic `invalidated` flag was never attached.

Review repairs retire pending Reveal/Copy responses on Hide as well as existing lifecycle
cleanup. Renaming a dirty document keeps its edit buffer and reviewed version. Native select
fields choose their first declared option when no initial value is supplied.

Rendered review found the host light theme's generic `.field` selector overriding the dark
native input backgrounds. Native field classes are now namespaced to avoid this collision;
actual desktop/narrow screenshots remain the acceptance evidence for contrast and layout.
