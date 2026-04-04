import { describe, expect, it } from 'vitest';
import {
	deriveAggregateState,
	mapChannelReadiness,
	type ChannelReadiness
} from './channel-readiness.js';

describe('channel readiness', () => {
	it('prefers ready when any channel is ready', () => {
		const channels = [{ state: 'misconfigured' }, { state: 'ready' }] as ChannelReadiness[];

		expect(deriveAggregateState(channels)).toBe('ready');
	});

	it('maps missing credentials to needs_input', () => {
		const readiness = mapChannelReadiness(
			'telegram',
			'Telegram',
			{ configured: true, running: false, tokenSource: 'none' },
			[{ configured: true, running: false, tokenStatus: 'missing', tokenSource: 'none' }]
		);

		expect(readiness.state).toBe('needs_input');
		expect(readiness.ctaLabel).toBe('Add credentials');
	});

	it('maps channel errors to misconfigured repair state', () => {
		const readiness = mapChannelReadiness(
			'discord',
			'Discord',
			{ configured: true, running: true, lastError: 'Invalid bot token' },
			[{ configured: true, running: true, connected: false, lastError: 'Invalid bot token' }]
		);

		expect(readiness.state).toBe('misconfigured');
		expect(readiness.summary).toBe('Repair needed');
		expect(readiness.detail).toBe('Invalid bot token');
	});

	it('maps disconnected discord to degraded reconnect state', () => {
		const readiness = mapChannelReadiness(
			'discord',
			'Discord',
			{ configured: true, running: true, tokenSource: 'config' },
			[{ configured: true, running: true, connected: false, tokenStatus: 'available' }]
		);

		expect(readiness.state).toBe('degraded');
		expect(readiness.ctaLabel).toBe('Reconnect');
	});

	it('maps running telegram bot to ready', () => {
		const readiness = mapChannelReadiness(
			'telegram',
			'Telegram',
			{ configured: true, running: true, tokenSource: 'config', mode: 'polling' },
			[{ configured: true, running: true, tokenStatus: 'available', mode: 'polling' }]
		);

		expect(readiness.state).toBe('ready');
		expect(readiness.summary).toBe('Ready');
	});
});
