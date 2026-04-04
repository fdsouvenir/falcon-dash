import type { ChannelReadiness } from '$lib/stores/channel-readiness.js';

export type DiscordWizardMode = 'setup' | 'repair' | 'reconnect' | 'ready';

export interface DiscordCredentialErrors {
	clientId?: string;
	botToken?: string;
}

export function deriveDiscordWizardMode(readiness: ChannelReadiness): DiscordWizardMode {
	if (readiness.state === 'ready') return 'ready';
	if (readiness.state === 'degraded') return 'reconnect';
	if (readiness.state === 'misconfigured') return 'repair';
	return 'setup';
}

export function deriveDiscordWizardInitialStep(readiness: ChannelReadiness): number {
	if (readiness.state === 'ready') return 5;
	if (readiness.state === 'needs_input') return 2;
	return 0;
}

export function validateDiscordCredentials(
	clientId: string,
	botToken: string
): DiscordCredentialErrors {
	const errors: DiscordCredentialErrors = {};
	const trimmedClientId = clientId.trim();
	const trimmedBotToken = botToken.trim();

	if (!trimmedClientId) {
		errors.clientId = 'Client ID is required.';
	} else if (!/^\d{17,20}$/.test(trimmedClientId)) {
		errors.clientId = 'Client ID should be the numeric Discord application ID.';
	}

	if (!trimmedBotToken) {
		errors.botToken = 'Bot token is required.';
	} else if (!/^[A-Za-z0-9_\-.]{20,}$/.test(trimmedBotToken)) {
		errors.botToken = 'Bot token looks incomplete. Paste the full token from Discord.';
	}

	return errors;
}
