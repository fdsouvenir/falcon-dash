import { describe, expect, it } from 'vitest';
import type { ChannelReadiness } from '$lib/stores/channel-readiness.js';
import {
	deriveTelegramWizardInitialStep,
	deriveTelegramWizardMode,
	validateTelegramToken
} from './telegram-wizard.js';

function makeReadiness(
	state: ChannelReadiness['state'],
	overrides: Partial<ChannelReadiness> = {}
): ChannelReadiness {
	return {
		id: 'telegram',
		label: 'Telegram',
		state,
		summary: 'Summary',
		detail: 'Detail',
		href: '/channels/telegram',
		ctaLabel: 'Set up',
		configured: state !== 'not_configured',
		running: state === 'ready',
		...overrides
	};
}

describe('telegram wizard helpers', () => {
	it('uses reconnect mode for degraded readiness', () => {
		expect(deriveTelegramWizardMode(makeReadiness('degraded'))).toBe('reconnect');
	});

	it('uses repair mode for misconfigured readiness', () => {
		expect(deriveTelegramWizardMode(makeReadiness('misconfigured'))).toBe('repair');
	});

	it('starts on credentials when telegram needs input', () => {
		expect(deriveTelegramWizardInitialStep(makeReadiness('needs_input'))).toBe(2);
	});

	it('starts on credentials when telegram needs repair', () => {
		expect(deriveTelegramWizardInitialStep(makeReadiness('misconfigured'))).toBe(2);
	});

	it('starts on verification when telegram is already ready', () => {
		expect(deriveTelegramWizardInitialStep(makeReadiness('ready'))).toBe(5);
	});

	it('requires a full botfather token', () => {
		expect(validateTelegramToken('123:short')).toEqual({
			botToken:
				'Bot token should match the BotFather format: numeric id, colon, then the full token.'
		});
	});

	it('accepts plausible telegram credentials', () => {
		expect(validateTelegramToken('123456789:ABCdefGhIJKlmNoPQRsTUVwxy_z-123')).toEqual({});
	});
});
