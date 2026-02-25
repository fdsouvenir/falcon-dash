import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

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
		capabilities: {
			chatTypes: ['direct'],
			threads: true
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
		}
	});

	api.logger.info('Falcon Dashboard channel registered');
}
