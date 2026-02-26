# Skills

Skills are capabilities and integrations that extend what your agent can do. Think of them as add-ons -- each skill gives your agent access to a new tool or service, such as web search, code execution, or connecting to third-party APIs.

## Viewing available skills

The Skills page shows a list of all installed skills. Each entry includes:

- **Name and version** -- the skill's name and its current version number.
- **Description** -- a brief summary of what the skill does.
- **Status indicator** -- a green dot means the skill is enabled and ready. A yellow dot means it is enabled but may need an API key to work properly. A red dot means the skill is disabled.
- **API key status** -- if a skill requires an API key to connect to an external service, you will see whether one has been set.

You can use the search box to filter skills by name or description.

## Enabling and disabling skills

Each skill has a checkbox to enable or disable it. When a skill is disabled, your agent will not use it. Toggle the checkbox to change the setting. The change takes effect immediately.

## Setting an API key

Some skills need an API key to work -- for example, a web search skill may need an API key from the search provider. Click the "API Key" button on the skill's row, enter the key, and click "Save."

## Installing a new skill

Click the "Install Skill" button to add a new skill. Enter the skill's package name in the form that appears. You can optionally provide a custom install identifier and a registry URL if the skill is hosted on a private registry.

Click "Install" and wait for the process to complete. The new skill will appear in your list once installed.

## Uninstalling a skill

If you no longer need a skill, click the "Uninstall" button on its row. You will be asked to confirm before the skill is removed.

## How agents use skills

Your agent automatically has access to all enabled skills. When your agent encounters a task that requires a skill -- such as searching the web or calling an external API -- it will use the appropriate skill without you needing to do anything. You can see which skills your agent used by reviewing the conversation in chat.
