# Settings and Labs

`/settings` contains advanced Falcon Dash and OpenClaw administration. Tabs are URL-addressable with
`?tab=` and currently include:

| Tab             | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| User            | edit the user workspace profile file                                    |
| Agents          | inspect and update configured OpenClaw agents                           |
| Agent Tokens    | mint and manage bearer tokens for Falcon Work access                    |
| Preferences     | local display and text-size preferences                                 |
| Information     | gateway status, runtime information, and administrative controls        |
| Config          | edit and apply OpenClaw gateway configuration                           |
| Devices         | review and manage gateway device pairing                                |
| Logs            | tail current gateway logs                                               |
| Approvals       | configure and respond to execution approvals                            |
| Workspace       | edit selected agent workspace files                                     |
| Canvas          | inspect Falcon canvas bridge state and events                           |
| Gateway Control | embed the native OpenClaw Control UI through Falcon's same-origin proxy |
| Terminal        | open a local shell on the Falcon Dash host                              |
| About           | Falcon Dash and gateway version/status information                      |

Many tabs call gateway RPCs and require a ready OpenClaw connection. Preferences are local browser
state; Work and Vault data have their own server-side stores.

Config, Devices, Approvals, Gateway Control, and Terminal can materially affect the installation.
Confirm the target and expected recovery path before changing configuration, approving a device,
granting a persistent command policy, restarting the gateway, or running shell commands.

The Canvas tab is diagnostics for current plugin surfaces. It is not the v5 contextual conversation
and canvas product described in the roadmap.
