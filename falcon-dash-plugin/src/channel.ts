import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

const SUPPORTED_ACTIONS = [
	'send',
	'react',
	'reactions',
	'reply',
	'edit',
	'thread-create',
	'thread-reply',
	'thread-list',
	'search',
	'read',
	'sendAttachment',
	'pin',
	'unpin',
	'list-pins'
] as const;

export function registerFalconDashChannel(api: OpenClawPluginApi): void {
	api.registerChannel({
		id: 'falcon-dash',
		meta: {
			id: 'falcon-dash',
			label: 'Falcon Dashboard',
			selectionLabel: 'Falcon Dashboard',
			docsPath: '/channels/falcon-dash',
			blurb: 'Web dashboard channel for Falcon Dash'
		},

		// Step 1: Expanded capabilities
		capabilities: {
			chatTypes: ['direct'],
			threads: true,
			reactions: true,
			reply: true,
			edit: true,
			media: true,
			blockStreaming: true
		},

		config: {
			listAccountIds: () => ['default'],
			resolveAccount: (_cfg, accountId) => ({
				accountId: accountId ?? 'default',
				enabled: true
			})
		},

		outbound: {
			deliveryMode: 'gateway',
			sendText: async () => ({
				channel: 'falcon-dash' as 'falcon-dash' & Record<never, never>,
				messageId: `fd-${Date.now()}`
			})
		},

		// Step 2: Threading adapter
		threading: {
			resolveReplyToMode: () => 'all',
			allowExplicitReplyTagsWhenOff: true,
			buildToolContext: ({ context }) => ({
				currentChannelId: context.Channel ?? undefined,
				currentChannelProvider: 'falcon-dash',
				currentThreadTs: context.MessageThreadId?.toString(),
				currentMessageId: context.CurrentMessageId,
				replyToMode: 'all',
				skipCrossContextDecoration: true
			})
		},

		// Step 3: Message actions adapter
		actions: {
			listActions: () => [...SUPPORTED_ACTIONS],
			supportsAction: ({ action }) => (SUPPORTED_ACTIONS as readonly string[]).includes(action),
			handleAction: async (ctx) => {
				// For gateway delivery mode, the gateway handles routing.
				api.logger.info(`Message action '${ctx.action}' routed via gateway`);
				return {
					content: [{ type: 'text' as const, text: 'Routed via gateway' }],
					details: { routed: true }
				};
			}
		},

		// Step 4: Streaming adapter
		streaming: {
			blockStreamingCoalesceDefaults: {
				minChars: 20,
				idleMs: 150
			}
		},

		// Step 5: Agent prompt adapter
		agentPrompt: {
			messageToolHints: () => [
				'Falcon Dash supports: reactions (emoji), threaded replies, message editing, file attachments, and pin/unpin.',
				'Use thread-create to start a threaded conversation. Use thread-reply to reply within an existing thread.',
				'The operator sees rich markdown including code blocks, math (KaTeX), and Mermaid diagrams.'
			]
		},

		// Step 6: Status adapter
		status: {
			buildAccountSnapshot: ({ account }) => ({
				accountId: (account as { accountId: string }).accountId,
				enabled: true,
				configured: true,
				name: 'Falcon Dashboard'
			})
		},

		// Step 7: Heartbeat adapter
		heartbeat: {
			checkReady: async ({ deps }) => {
				if (deps?.hasActiveWebListener?.()) {
					return { ok: true, reason: 'Gateway client connected' };
				}
				return {
					ok: false,
					reason: 'No Falcon Dash client connected'
				};
			}
		}
	});

	api.logger.info('Falcon Dashboard channel registered');
}
