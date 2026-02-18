import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
	vi.resetModules();
	vi.restoreAllMocks();
});

describe('initA2UIBridge', () => {
	it('sets globalThis.openclawCanvasA2UIAction', async () => {
		const { initA2UIBridge } = await import('./a2ui-bridge.js');
		const sendAction = vi.fn();

		initA2UIBridge(sendAction);

		expect((globalThis as Record<string, unknown>).openclawCanvasA2UIAction).toBeDefined();
		delete (globalThis as Record<string, unknown>).openclawCanvasA2UIAction;
	});

	it('cleanup removes the global', async () => {
		const { initA2UIBridge } = await import('./a2ui-bridge.js');
		const cleanup = initA2UIBridge(vi.fn());

		expect((globalThis as Record<string, unknown>).openclawCanvasA2UIAction).toBeDefined();

		cleanup();

		expect((globalThis as Record<string, unknown>).openclawCanvasA2UIAction).toBeUndefined();
	});

	it('postMessage delegates to sendAction callback', async () => {
		const { initA2UIBridge } = await import('./a2ui-bridge.js');
		const sendAction = vi.fn();
		initA2UIBridge(sendAction);

		const bridge = (globalThis as Record<string, unknown>).openclawCanvasA2UIAction as {
			postMessage: (data: unknown) => void;
		};
		const action = { surfaceId: 's1', actionId: 'click', payload: { x: 1 } };
		bridge.postMessage(action);

		expect(sendAction).toHaveBeenCalledWith(action);
		delete (globalThis as Record<string, unknown>).openclawCanvasA2UIAction;
	});
});

describe('getLoadedTier', () => {
	it('returns not-loaded initially', async () => {
		const { getLoadedTier } = await import('./a2ui-bridge.js');
		expect(getLoadedTier()).toBe('not-loaded');
	});
});

describe('getCanvasHostUrl', () => {
	it('returns default URL with default host and port', async () => {
		const { getCanvasHostUrl } = await import('./a2ui-bridge.js');
		expect(getCanvasHostUrl()).toBe('http://127.0.0.1:18793/__openclaw__');
	});

	it('uses provided host and port', async () => {
		const { getCanvasHostUrl } = await import('./a2ui-bridge.js');
		expect(getCanvasHostUrl('10.0.0.1', 9999)).toBe('http://10.0.0.1:9999/__openclaw__');
	});
});

describe('ensureA2UILoaded', () => {
	it('skips loading when already loaded (customElements.get returns truthy)', async () => {
		vi.stubGlobal('customElements', {
			get: vi.fn().mockReturnValue(class FakeElement {}),
			define: vi.fn()
		});

		const { ensureA2UILoaded } = await import('./a2ui-bridge.js');
		await ensureA2UILoaded();

		// Should not call define since the element is already registered
		expect(customElements.define).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});

	it('deduplicates concurrent calls', async () => {
		const getCalls: unknown[] = [];
		vi.stubGlobal('customElements', {
			get: vi.fn().mockImplementation(() => {
				getCalls.push(1);
				// First few calls return undefined (not loaded), eventually return truthy after define
				if (getCalls.length > 5) return class FakeElement {};
				return undefined;
			}),
			define: vi.fn()
		});
		vi.stubGlobal('document', {
			querySelector: vi.fn().mockReturnValue(null),
			createElement: vi.fn(() => {
				const el = {
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: ''
				};
				// Simulate script load failure to fall through tiers
				setTimeout(() => el.onerror?.(), 0);
				return el;
			}),
			head: { appendChild: vi.fn() }
		});

		const { ensureA2UILoaded } = await import('./a2ui-bridge.js');

		// Both calls should share the same promise
		const p1 = ensureA2UILoaded('http://fake');
		const p2 = ensureA2UILoaded('http://fake');

		await Promise.all([p1, p2]);

		// Should have resolved without errors
		vi.unstubAllGlobals();
	});

	it('registers placeholder when all tiers fail', async () => {
		const defineMock = vi.fn();
		vi.stubGlobal('customElements', {
			get: vi.fn().mockReturnValue(undefined),
			define: defineMock
		});
		vi.stubGlobal('document', {
			querySelector: vi.fn().mockReturnValue(null),
			createElement: vi.fn(() => {
				const el = {
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: ''
				};
				setTimeout(() => el.onerror?.(), 0);
				return el;
			}),
			head: { appendChild: vi.fn() }
		});

		const { ensureA2UILoaded, getLoadedTier } = await import('./a2ui-bridge.js');
		await ensureA2UILoaded('http://fake-host');

		expect(defineMock).toHaveBeenCalledWith('openclaw-a2ui-host', expect.any(Function));
		expect(getLoadedTier()).toBe('placeholder');

		vi.unstubAllGlobals();
	});
});
