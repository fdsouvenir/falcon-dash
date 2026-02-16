import { describe, it, expect, beforeEach, vi } from 'vitest';

const TOKEN_KEY = 'falcon-dash:gateway-token';
const URL_KEY = 'falcon-dash:gateway-url';

describe('gatewayToken', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
	});

	it('starts as null when localStorage is empty', async () => {
		const { gatewayToken } = await import('./token.js');
		let value: string | null = null;
		gatewayToken.subscribe((v) => {
			value = v;
		})();
		expect(value).toBeNull();
	});

	it('persists token to localStorage on set', async () => {
		const { gatewayToken } = await import('./token.js');
		gatewayToken.set('my-token');
		expect(localStorage.getItem(TOKEN_KEY)).toBe('my-token');
	});

	it('removes from localStorage on clear', async () => {
		localStorage.setItem(TOKEN_KEY, 'old-token');
		const { gatewayToken } = await import('./token.js');
		gatewayToken.clear();
		expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
	});

	it('reads initial value from localStorage', async () => {
		localStorage.setItem(TOKEN_KEY, 'existing-token');
		const { gatewayToken } = await import('./token.js');
		let value: string | null = null;
		gatewayToken.subscribe((v) => {
			value = v;
		})();
		expect(value).toBe('existing-token');
	});
});

describe('gatewayUrl', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
	});

	it('defaults to ws://127.0.0.1:18789', async () => {
		const { gatewayUrl } = await import('./token.js');
		let value = '';
		gatewayUrl.subscribe((v) => {
			value = v;
		})();
		expect(value).toBe('ws://127.0.0.1:18789');
	});

	it('persists custom URL to localStorage', async () => {
		const { gatewayUrl } = await import('./token.js');
		gatewayUrl.set('ws://example.com:9999');
		expect(localStorage.getItem(URL_KEY)).toBe('ws://example.com:9999');
	});
});
