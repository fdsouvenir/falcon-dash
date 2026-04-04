import { describe, expect, it } from 'vitest';
import type { ChannelReadiness } from '$lib/stores/channel-readiness.js';
import {
	deriveDiscordWizardInitialStep,
	deriveDiscordWizardMode,
	validateDiscordCredentials
} from './discord-wizard.js';

function makeReadiness(
	state: ChannelReadiness['state'],
	overrides: Partial<ChannelReadiness> = {}
): ChannelReadiness {
	return {
		id: 'discord',
		label: 'Discord',
		state,
		summary: 'Summary',
		detail: 'Detail',
		href: '/channels/discord',
		ctaLabel: 'Set up',
		configured: state !== 'not_configured',
		running: state === 'ready',
		...overrides
	};
}

describe('discord wizard helpers', () => {
	it('uses reconnect mode for degraded readiness', () => {
		expect(deriveDiscordWizardMode(makeReadiness('degraded'))).toBe('reconnect');
	});

	it('uses repair mode for misconfigured readiness', () => {
		expect(deriveDiscordWizardMode(makeReadiness('misconfigured'))).toBe('repair');
	});

	it('starts on credentials when readiness needs input', () => {
		expect(deriveDiscordWizardInitialStep(makeReadiness('needs_input'))).toBe(2);
	});

	it('starts on verification when discord is already ready', () => {
		expect(deriveDiscordWizardInitialStep(makeReadiness('ready'))).toBe(5);
	});

	it('requires numeric client ids and full bot tokens', () => {
		expect(validateDiscordCredentials('abc', 'short')).toEqual({
			clientId: 'Client ID should be the numeric Discord application ID.',
			botToken: 'Bot token looks incomplete. Paste the full token from Discord.'
		});
	});

	it('accepts plausible discord credentials', () => {
		expect(
			validateDiscordCredentials('123456789012345678', 'abcDEF1234567890_-token.segment')
		).toEqual({});
	});
});
