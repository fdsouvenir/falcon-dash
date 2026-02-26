# Settings

The Settings page contains all of Falcon Dash's configuration options, organized into tabs across the top of the page. Below is a guide to each tab.

---

## User

The User tab is where you tell your agent about yourself. It manages a file called USER.md that your agent reads to understand your preferences, context, and communication style.

**When you would use it:** When you first set up Falcon Dash, or any time you want to update what your agent knows about you.

**What you can do:**

- Create the USER.md file if it does not exist yet.
- View its contents rendered as formatted text.
- Click "Edit" to modify the file in a text editor, then save your changes.

---

## Agents

The Agents tab shows all the agents configured in your system. Each agent is displayed as a card with its name, icon, role, and how many active sessions it has.

**When you would use it:** When you want to see which agents are available, add a new agent, edit an agent's role, or remove an agent you no longer need.

**What you can do:**

- View all agents and their current status (a green dot means the agent has active sessions).
- **Spawn a new agent** -- click "Spawn Agent" to create a new agent. It gets an automatically generated ID, and you can set its name and role afterward.
- **Edit an agent** -- click the edit icon on an agent's card to change its role. The agent's name and emoji are set by the agent itself in chat -- just ask your agent if you want to change those.
- **Delete an agent** -- click the delete icon to remove an agent from the configuration. The primary agent cannot be deleted.

After making changes, a banner will remind you that the gateway needs to be restarted for changes to take effect.

---

## Preferences

The Preferences tab lets you customize how Falcon Dash looks and behaves.

**When you would use it:** When you want to adjust the visual theme, turn notifications on or off, or change your default project view.

**What you can do:**

- **Theme** -- choose between Dark, Light, or System (follows your device setting).
- **Compact mode** -- toggle tighter spacing throughout the interface.
- **Browser notifications** -- enable or disable desktop notifications for important events.
- **Notification sound** -- turn the notification sound on or off.
- **Default project view** -- choose which view (Dashboard, Kanban Board, List, or Tree) appears when you open the Projects page.
- **Log out** -- end your Cloudflare Access session and sign out.

---

## Information

The Information tab shows detailed information about your current gateway connection, including technical data that can be useful for troubleshooting.

**When you would use it:** When you want to verify your connection status, check which model your agent is using, or review system details.

**What you can see:**

- Connection status with a live indicator (connected, reconnecting, or disconnected).
- Gateway server version and uptime.
- Current AI model and thinking level.
- Number of connected devices and active sessions.
- Your authentication role and permissions.
- Session defaults such as context token limits and the default agent.
- A list of all connected devices.
- Usage and cost information by AI provider.
- Active and recently completed agent runs.

---

## Config

The Config tab provides a raw editor for the gateway configuration file. This is an advanced feature that is usually managed by Fredbot Hosting on your behalf.

**When you would use it:** Rarely. Only when Fredbot Hosting asks you to make a specific configuration change, or during guided troubleshooting.

**What you can do:**

- View the current gateway configuration.
- Edit and save changes.
- Format the configuration for readability.
- Apply changes and restart the gateway (this briefly disconnects all users).

A warning is displayed because incorrect changes can affect system stability.

---

## Discord

The Discord tab lets you connect your agent to a Discord server so it can send and receive messages there.

**When you would use it:** When you want your agent to be available in a Discord channel.

**What you can do:**

- Follow a step-by-step guide to create a Discord bot and connect it.
- Enter your Discord application's Client ID and Bot Token.
- See the connection status, including which server and how many channels are active.
- Disconnect the Discord integration if you no longer need it.

---

## Devices

The Devices tab manages which devices and applications are allowed to connect to your gateway.

**When you would use it:** When a new device or application needs to be paired, or when you want to review or revoke access for existing devices.

**What you can do:**

- **Approve or reject pairing requests** -- when a new device tries to connect, it appears here as a pending request. You can approve or reject it.
- **View paired devices** -- see all devices that have been granted access, including when they were paired and when they were last seen.
- **Rotate a token** -- generate a new authentication token for a device. The device will need to re-authenticate.
- **Revoke access** -- permanently remove a device's access to the gateway.

---

## Logs

The Logs tab provides a real-time stream of gateway log messages, useful for seeing what is happening behind the scenes.

**When you would use it:** When troubleshooting an issue, or when you are curious about what the gateway is doing in real time.

**What you can do:**

- Click "Play" to start streaming live logs, and "Pause" to stop.
- Filter logs by level (Debug, Info, Warn, Error) or search by text.
- Toggle "Auto-follow" to keep the view scrolled to the latest messages.
- Clear the log display.

---

## Approvals

The Approvals tab controls which commands your agent is allowed to run on its own and which ones require your approval first.

**When you would use it:** When you want to control what your agent can do automatically versus what it should ask you about before proceeding.

**What you can do:**

- **Set the ask policy:**
  - Off -- the agent does not ask for approval.
  - On miss -- the agent asks only when a command is not in the allowlist.
  - Always -- the agent asks before running any command.
- **Manage the allowlist** -- add commands that the agent can run without asking (for example, "git status" or "ls").
- **Review pending approvals** -- when the agent requests permission to run a command, it appears here. You can allow it once, allow it always (adds it to the allowlist), deny it, or always deny it.
- **Manage the denylist** -- commands added here are automatically denied without prompting.

---

## Workspace

The Workspace tab gives you access to key configuration files in your agent's workspace. These files shape your agent's personality and behavior.

**When you would use it:** When you want to review or edit how your agent is configured, or to see what your agent has written about itself.

**What you can do:**

- View and edit four workspace files:
  - **Soul** -- your agent's core instructions and personality.
  - **Agents** -- information about peer agents in the system.
  - **Identity** -- how your agent identifies itself (name, description).
  - **Memory** -- persistent notes and context your agent has saved.
- If you have multiple agents, use the agent picker at the top to switch between them.
- Click "Edit" to modify a file and "Save" to apply changes.
- Create a file if it does not exist yet.

The workspace files auto-refresh periodically, so you will see updates your agent makes without needing to reload.

---

## Canvas

The Canvas tab shows diagnostic information about the canvas system -- the technology behind the interactive apps your agent creates.

**When you would use it:** When an app is not displaying properly and you want to check if the canvas system is working correctly.

**What you can see:**

- Whether the canvas bridge is registered and connected.
- The canvas host URL and whether it is reachable.
- A list of active canvas surfaces (each surface is an app instance).
- Your pinned apps.
- A log of recent canvas events.

---

## Gateway control

The Gateway Control tab embeds the gateway's own control interface directly within Falcon Dash.

**When you would use it:** When you need to access gateway-level controls that are not available through other Falcon Dash tabs.

**What you can do:**

- Interact with the gateway's built-in control panel without leaving Falcon Dash.

---

## About

The About tab shows version information and a summary of the system.

**When you would use it:** When you need to check which version of Falcon Dash or the gateway you are running, or when reporting an issue.

**What you can see:**

- The Falcon Dash version number.
- The OpenClaw Gateway version.
- Your agent's name and description.
- Gateway uptime and active session count.
