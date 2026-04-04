import type { ChannelReadiness } from '$lib/stores/channel-readiness.js';

export type TelegramWizardMode = 'setup' | 'repair' | 'reconnect' | 'ready';

export interface TelegramTokenErrors {
	botToken?: string;
}

export function deriveTelegramWizardMode(readiness: ChannelReadiness): TelegramWizardMode {
	if (readiness.state === 'ready') return 'ready';
	if (readiness.state === 'degraded') return 'reconnect';
	if (readiness.state === 'misconfigured') return 'repair';
	return 'setup';
}

export function deriveTelegramWizardInitialStep(readiness: ChannelReadiness): number {
	if (readiness.state === 'ready') return 5;
	if (readiness.state === 'needs_input' || readiness.state === 'misconfigured') return 2;
	return 0;
}

export function validateTelegramToken(botToken: string): TelegramTokenErrors {
	const trimmedBotToken = botToken.trim();

	if (!trimmedBotToken) {
		return { botToken: 'Bot token is required.' };
	}

	if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(trimmedBotToken)) {
		return {
			botToken:
				'Bot token should match the BotFather format: numeric id, colon, then the full token.'
		};
	}

	return {};
}
