# Chatting with your agent

The chat view is where you have conversations with your agent. This guide covers everything you can do in a chat.

## Starting a conversation

1. Select a channel from the sidebar (for example, #general).
2. The chat area opens. If the channel is empty, you will see a welcome screen with suggestion chips you can click.
3. Type your message in the text box at the bottom and press Enter.

Your message appears immediately in the chat, and your agent begins working on a response.

## Sending messages

- **Send a message:** Type in the text box at the bottom and press Enter.
- **Add a line break:** Press Shift+Enter to start a new line without sending.
- **Attach a file:** Click the paperclip icon next to the text box (desktop only) to select a file, or drag and drop a file onto the message area. You can also paste an image from your clipboard. Attached files appear as chips above the text box before you send.
- **Remove an attachment:** Click the X on the attachment chip to remove it before sending.

## Reading agent responses

Your agent's responses appear in the chat with the agent's name shown in purple. Responses can include:

- **Formatted text:** Your agent can use bold, italic, headings, bullet lists, and other formatting.
- **Code blocks:** Programming code appears in a syntax-highlighted block with a language label.
- **Math formulas:** Mathematical expressions are rendered in proper notation.
- **Diagrams:** Some agents can create flowcharts and diagrams that render inline.
- **Thinking:** When your agent uses extended reasoning, you may see a collapsible "Thinking" section above the response showing the agent's reasoning process.
- **Tool usage:** When your agent uses tools (like reading files or searching), you will see collapsible tool call indicators showing what the agent did.

## Streaming responses and stopping the agent

When your agent is responding, you will see text appear progressively as it is generated. During this time:

- The send button changes to a red stop button.
- Click the stop button (or use the `/stop` slash command) to interrupt the agent and stop it from generating further output.
- The text the agent already produced will remain visible.

## Slash commands

Type `/` in the message box to open the slash command menu. These are special commands that control your conversation rather than sending a message to the agent.

Available commands:

- `/new` -- Start a fresh conversation in the current channel. You can optionally specify a model name, like `/new claude-sonnet`.
- `/stop` -- Stop the agent if it is currently generating a response.
- `/reasoning` -- Set the agent's thinking level. Options: off, minimal, low, medium, high, xhigh. For example, `/reasoning high`.
- `/compact` -- Compress the conversation history to save context space. You can optionally add instructions about what to preserve, like `/compact keep the project requirements`.
- `/status` -- Show information about the current session.
- `/usage` -- Show how many tokens have been used in this session.
- `/context` -- Show how much of the context window has been used.

When you type `/`, matching commands appear in a popup menu. Use the arrow keys to navigate and press Enter or Tab to select a command.

## Replying to messages

You can reply to a specific message to create a direct reference:

1. Hover over a message to reveal the action buttons.
2. Click the reply button (curved arrow icon).
3. A preview of the message you are replying to appears above the text box.
4. Type your reply and press Enter.
5. Your message will appear with a reference to the original message. Click the reference to scroll to the original.

To cancel a reply before sending, click the X on the reply preview banner.

## Threads

Threads let you have a focused side conversation about a specific message without cluttering the main chat.

1. Hover over a message and click the thread button (speech bubble icon).
2. A thread panel opens on the right side of the screen (on desktop) or as a full-screen overlay (on mobile).
3. Continue your conversation within the thread.
4. Close the thread panel by clicking the X to return to the main chat.

## Searching messages

To find a specific message:

1. Click the search icon in the chat header.
2. A search bar appears with two modes: "All Chats" searches across all your conversations, and "This Chat" searches only the current conversation.
3. Type your search terms. Results appear as you type.
4. Click a result to jump to that message in the conversation. The message will briefly highlight so you can spot it.

## Reactions

You can add reactions to any message:

1. Hover over a message to reveal the action buttons.
2. Click the smiley face icon.
3. Select an emoji from the picker.
4. Your reaction appears below the message.

Click an existing reaction to toggle it on or off. Reactions show a count when multiple people have reacted with the same emoji.

## Copying messages

Hover over a message and click the copy button (two overlapping squares icon) to copy the message text to your clipboard. A checkmark will briefly appear to confirm the copy.

## Bookmarks

Some messages display a bookmark button (star icon) in the action bar. Click it to bookmark a message for easy reference later. Click again to remove the bookmark. Bookmarked messages are marked with a filled star.

## Notifications

Falcon Dash sends you notifications when important things happen, such as:

- A new message arrives in one of your channels.
- An agent completes a long-running task.
- An exec approval is waiting for your response.

The notification bell in the bottom of the sidebar shows a blue badge with a count when you have unread notifications. Click it to open the notification panel, where you can:

- Click a notification to jump to the related conversation.
- Click "Mark all read" to dismiss all notifications.
- Click "Clear" to remove all notifications from the list.
