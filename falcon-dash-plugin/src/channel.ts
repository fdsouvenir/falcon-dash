import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

// Broadcast function captured from gateway context (set by canvas-bridge on first register)
type BroadcastFn = (event: string, payload: unknown) => void;
let gatewayBroadcast: BroadcastFn | null = null;

export function setGatewayBroadcast(fn: BroadcastFn): void {
	gatewayBroadcast = fn;
}

const BUBBLE_EFFECTS = new Set(['slam', 'loud', 'gentle', 'invisible-ink']);
const SCREEN_EFFECTS = new Set([
	'confetti',
	'fireworks',
	'hearts',
	'balloons',
	'celebration',
	'lasers',
	'spotlight',
	'echo'
]);

function resolveEffectType(effectName: string): 'bubble' | 'screen' | null {
	if (BUBBLE_EFFECTS.has(effectName)) return 'bubble';
	if (SCREEN_EFFECTS.has(effectName)) return 'screen';
	return null;
}

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
	'list-pins',
	'poll',
	'sendWithEffect'
] as const;

export function registerFalconDashChannel(api: OpenClawPluginApi): void {
	api.registerChannel({
		id: 'falcon',
		meta: {
			id: 'falcon',
			label: 'Falcon Dashboard',
			selectionLabel: 'Falcon Dashboard',
			aliases: ['fd', 'falcon-dash'],
			docsPath: '/channels/falcon',
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
			blockStreaming: true,
			polls: true,
			effects: true
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
			resolveTarget: (params) => {
				// Single-operator dashboard: accept any target and pass through.
				// The gateway routes by session key, not by user/group ID.
				const to = params.to?.trim();
				if (!to) {
					return { ok: false, error: new Error('Target is required') };
				}
				return { ok: true, to };
			},
			sendText: async () => ({
				channel: 'falcon' as 'falcon' & Record<never, never>,
				messageId: `fd-${Date.now()}`
			}),
			sendPoll: async () => ({
				channel: 'falcon' as 'falcon' & Record<never, never>,
				messageId: `fd-poll-${Date.now()}`
			})
		},

		// Step 2: Threading adapter
		threading: {
			resolveReplyToMode: () => 'all',
			allowExplicitReplyTagsWhenOff: true,
			buildToolContext: ({ context }) => ({
				currentChannelId: context.Channel ?? undefined,
				currentChannelProvider: 'falcon',
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
				if (ctx.action === 'sendWithEffect') {
					const text = (ctx.params.message ?? ctx.params.text ?? '') as string;
					const effectName = (ctx.params.effect ?? ctx.params.effectId ?? '') as string;

					if (!effectName) {
						return {
							content: [{ type: 'text' as const, text: 'Missing effect name' }],
							details: { error: 'missing_effect' }
						};
					}

					const effectType = resolveEffectType(effectName);
					if (!effectType) {
						return {
							content: [
								{
									type: 'text' as const,
									text: `Unknown effect: ${effectName}. Valid effects: ${[...BUBBLE_EFFECTS, ...SCREEN_EFFECTS].join(', ')}`
								}
							],
							details: { error: 'unknown_effect' }
						};
					}

					if (!gatewayBroadcast) {
						api.logger.warn(
							'sendWithEffect: no broadcast function available (no client connected?)'
						);
						return {
							content: [
								{
									type: 'text' as const,
									text: 'No dashboard client connected to receive effects'
								}
							],
							details: { error: 'no_broadcast' }
						};
					}

					const messageId = `fd-effect-${Date.now()}`;
					// Broadcast via custom event — the frontend handles routing
					// to the active session (no session key needed here since the
					// gateway doesn't know which frontend session is active).
					gatewayBroadcast('falcon.sendEffect', {
						messageId,
						role: 'assistant',
						content: text,
						timestamp: Date.now(),
						sendEffect: {
							type: effectType,
							name: effectName
						}
					});

					api.logger.info(
						`sendWithEffect: broadcast ${effectType}/${effectName} via falcon.sendEffect`
					);
					return {
						content: [
							{
								type: 'text' as const,
								text: `Sent message with ${effectName} effect`
							}
						],
						details: { messageId, effect: effectName, effectType }
					};
				}

				// For all other actions, gateway handles routing
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
				'Falcon Dash is a single-operator dashboard. For message tool actions, use target: "operator" (the dashboard always resolves to the connected operator).',
				'Falcon Dash supports: reactions (emoji), threaded replies, message editing, file attachments, pin/unpin, polls, and visual effects.',
				'Use thread-create to start a threaded conversation. Use thread-reply to reply within an existing thread.',
				'Use poll to create interactive polls with multiple options.',
				'IMPORTANT: To send a message with a visual effect, you MUST use action: "sendWithEffect" via the message tool. Do NOT use node.invoke, canvas, or HTML rendering for effects. Pass "effect" with one of: bubble effects (slam, loud, gentle, invisible-ink) or screen effects (confetti, fireworks, hearts, balloons, celebration, lasers, spotlight, echo). Example: { "action": "sendWithEffect", "target": "operator", "message": "Hello!", "effect": "fireworks", "channel": "falcon" }',
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
		},

		// Step 8: Gateway lifecycle adapter
		gateway: {
			startAccount: async ({ abortSignal }) => {
				// Falcon is gateway-native — no external connection needed.
				// Keep the channel alive until the gateway stops it.
				await new Promise<void>((resolve) => {
					abortSignal.addEventListener('abort', () => resolve(), { once: true });
				});
			}
		}
	});

	api.logger.info('Falcon Dashboard channel registered');
}
