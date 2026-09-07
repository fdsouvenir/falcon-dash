# Deployment

Falcon Dash 4.0 is one installable OpenClaw plugin. It has no server, port, reverse proxy, process
manager or health endpoint of its own: it runs inside the OpenClaw Gateway process and renders
inside Control UI. There is no standalone application to deploy and no cutover from one, because
4.0 installs onto a machine with no earlier Falcon Dash present.

## Runtime requirements

- OpenClaw 2026.8.1 or later on the same machine; the tested baseline is 2026.9.2.
- Node.js 22.16 or newer, owned by the user the Gateway runs as. Managed SecretRef presets use the
  Gateway's actual `process.execPath`; a root-owned Node binary fails the ownership guard.
- Linux with `keepassxc-cli` and `flock`.
- The KeePassXC vault database and key file.
- `gateway.controlUi.experimental.customPlugins` opt-in for the native UI.

## Development from source

```bash
npm install
npm run build
npm run test
```

`npm run build` bundles TypeBox with its license, validates every executable plugin JavaScript
file, and builds the native Control UI bundle into `dist/control-ui/falcon/`. Installation needs no
runtime npm dependency execution. The OpenClaw SDK is an exact host peer, not a bundled dependency;
local development links or installs it separately.

## Package installation

Tagged releases publish `@fdsouvenir/falcon-dash` to GitHub Packages. Registry authentication and
scope configuration are required before installation. The package ships `plugin/`,
`dist/control-ui/`, `openclaw.plugin.json`, the build script and the plugin technical docs — no
source checkout, no CLI binaries and no runtime skills.

Install the reviewed archive through the supported OpenClaw plugin installer. Do not replace
installed files with links to a development checkout; installed code and writable data stay outside
any Git checkout.

## Data and files

Default paths are under the co-resident OpenClaw home:

| Path                            | Contents                              |
| ------------------------------- | ------------------------------------- |
| `~/.openclaw/data/falcon-dash/` | Work database and integration storage |
| `~/.openclaw/passwords.kdbx`    | built-in vault database               |
| `~/.openclaw/vault.key`         | built-in vault key file               |

Back up the vault database together with its key file, and protect both with restrictive
permissions. Do not commit any of them. Private recovery snapshots are described in
[the installation guide](plugin-v4-installation.md).

## Release path

`.github/workflows/publish.yml` publishes on `v*` tags after `npm ci`. `prepublishOnly` builds the
plugin and runs its tests. Publication and release depend on the complete reusable CI workflow,
including real-Gateway native browser acceptance and the managed SecretRef proof.

Run release validation after `npm ci`, not against an existing `node_modules`. The lockfile is the
authoritative toolchain for CI and publishing, including Prettier. Formatting committed for a
release must be produced and checked with the exact formatter version recorded in
`package-lock.json`. Before a release, run the validation required by
[../QUALITY.md](../QUALITY.md) and verify a clean installation on a machine that does not contain a
developer checkout.

## Verified managed-runtime compatibility

`npm run test:managed-runtime` creates an isolated install, copies the current Node binary
byte-for-byte into an owned test-runtime directory, verifies its owner/mode/hash, and uses that
Node for the real managed preset and Gateway inference proof. It verifies disabled/removed plugin
revocation and Vault-lock denial without a manual provider fallback, then confirms the system Node
was unchanged. CI runs this gate and uploads its nonsecret summary and harness logs — not Vault
files or provider request captures.

The fresh runtime fixture tightens **only its newly created Node copy** to mode 0700, because CI
toolcache binaries can carry broader source modes. It verifies ownership before doing so and checks
the original runtime hash, uid and mode remain unchanged. No system Node chmod or chown is used.

Protected worker cleanup owns a dedicated process group and verifies no runnable descendant remains
before reporting timeout failure. Runtime shutdown should still be supervised by the host: abrupt
death of a JavaScript supervisor cannot execute its cleanup handlers.

## Current gaps

Native UI is approved and bundled, but Custom plugin UI opt-in has been enabled only in synthetic
runtimes; production opt-in and restart remain out of scope here. No tag, publication, registry
installation or production configuration change has been performed. See
[the backend continuation](plugin-v4-backend.md) for compatibility evidence and remaining gaps, and
[CI/runtime boundaries](plugin-native-e2e.md) for what the browser matrix does and does not prove.
