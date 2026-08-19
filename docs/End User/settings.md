# Settings and Labs

`/settings` contains the remaining Falcon Dash preferences and advanced utilities. Tabs are URL-addressable with
`?tab=` and currently include:

| Tab         | Purpose                                                          |
| ----------- | ---------------------------------------------------------------- |
| Preferences | local display and text-size preferences                          |
| Information | gateway status, runtime information, and administrative controls |
| Workspace   | edit selected agent workspace files                              |
| Terminal    | open a local shell on the Falcon Dash host                       |
| About       | Falcon Dash and gateway version/status information               |

Information and About call gateway RPCs and require a ready OpenClaw connection. Preferences are
local browser state; Work and Vault data have their own server-side stores.

Terminal can materially affect the installation. Confirm the target and expected recovery path
before running shell commands. Use the dedicated routes or native OpenClaw tooling for agent,
approval, device, configuration, log, token, and canvas workflows.
