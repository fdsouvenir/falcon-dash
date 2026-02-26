# Exec approvals

Exec approvals are a safety feature that lets you control what commands your agent runs on the system. When your agent wants to run a command that is not on the pre-approved list, it asks for your permission first.

## Why approvals exist

Your agent can execute commands on the server to accomplish tasks -- for example, running scripts, installing packages, or managing files. Some commands are pre-approved and run automatically because they are known to be safe (things like listing files, checking status, or reading data).

When your agent wants to run a command that is not on the pre-approved list, Falcon Dash shows you an approval prompt so you can decide whether to allow it. This keeps you in control of what actions the agent takes on your behalf.

## The approval prompt

When your agent requests permission, an approval prompt appears at the bottom of the chat area. It includes:

- A yellow warning header that says "Agent wants to run:" along with the agent's name.
- The exact command the agent wants to execute, displayed in a code block.
- If multiple approvals are pending, a badge shows "1 of X" so you know how many are waiting.

Below the command, you have four options:

**Deny:** Blocks this command. The agent will not run it and will need to find another approach.

**Allow Once:** Permits the agent to run this specific command one time. If the agent wants to run it again later, it will ask again.

**Always Allow:** Permits this command and adds it to the approved list, so the agent can run it in the future without asking. Use this for commands you trust and expect the agent to use regularly.

**Always Deny:** Blocks this command and adds it to a deny list. The agent will not be able to run this command or ask about it again.

## Notifications for pending approvals

When an exec approval is waiting for your response, you will see:

- The approval prompt appears directly in the chat view.
- On mobile, approvals appear in a bottom sheet that slides up.
- If you are on a different page in Falcon Dash, a notification alerts you that an approval is pending.

Approvals are time-sensitive. If your agent is waiting on an approval, it cannot continue with that task until you respond.

## Pre-approved commands

Your Fredbot Hosting configuration includes a list of commands that are automatically approved. These are common, safe operations that your agent uses frequently, such as searching files, checking version control status, or reading configuration. You do not need to approve these each time.

If you have questions about which commands are pre-approved or want to adjust the list, contact Fredbot Hosting support.
