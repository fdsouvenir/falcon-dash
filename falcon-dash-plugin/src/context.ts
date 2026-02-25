import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

/**
 * Static Falcon Dash context injected into every agent prompt via
 * the `before_prompt_build` plugin hook. Teaches agents how to
 * identify and respond to Falcon Dash sessions with rich content.
 */
const FALCON_DASH_CONTEXT = `\
## Falcon Dash

Falcon Dash is a web/mobile PWA you use to interact with your human and vice versa

You can identify Falcon Dash sessions by the session key. Falcon Dash session keys contain the format \`fd-{type}-{8hex}\` (e.g., \`fd-chat-a1b2c3d4\`). The \`fd-\` prefix means Falcon Dash; the type segment definitions a what capabilities are available. Adapt your responses to match.

### Falcon Dash session type definitions

#### (\`fd-chat\`)

Your human is DMing you through the Falcon Dash UI. You can respond with rich content:

- **Markdown** — GFM: tables, strikethrough, task lists
- **Math** — KaTeX: inline \`$...$\`, display \`$$...$$\`
- **Diagrams** — Mermaid in fenced code blocks
- **Code** — syntax-highlighted with copy button
- **Admonitions** — \`>note\`, \`>tip\`, \`>warning\`, \`>caution\`, \`>important\`
- **Collapsible sections** — \`<details>\`/\`<summary>\``;

/**
 * Build the peer agent context section from the live OpenClaw config.
 * Returns markdown listing all peer agents (excluding the current agent),
 * or an empty string if there are fewer than 2 agents.
 */
export function buildPeerContext(
	api: OpenClawPluginApi,
	currentAgentId: string | undefined
): string {
	const agents = api.config.agents?.list;
	if (!agents || agents.length <= 1) return '';

	const peerLines: string[] = [];
	for (const peer of agents) {
		if (!peer.id || peer.id === currentAgentId) continue;

		const displayName = peer.identity?.name || peer.name || peer.id;
		const parts = [`id: \`${peer.id}\``];
		if (peer.identity?.emoji) parts.push(`emoji: ${peer.identity.emoji}`);
		if (peer.identity?.theme) parts.push(`theme: ${peer.identity.theme}`);
		peerLines.push(`- **${displayName}** (${parts.join(', ')})`);
	}

	if (peerLines.length === 0) return '';

	return `\n\n## Peers

Collaborate with peer agents via \`sessions_send\` using their agent ID. Each agent has its own workspace, memory, and sessions.

### Peer agents

${peerLines.join('\n')}`;
}

/**
 * Build the full prepend context string: static Falcon Dash context +
 * dynamic peer list from the current config.
 */
export function buildContext(api: OpenClawPluginApi, currentAgentId: string | undefined): string {
	return FALCON_DASH_CONTEXT + buildPeerContext(api, currentAgentId);
}
