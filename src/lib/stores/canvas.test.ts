import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { EventBus } from '$lib/gateway/event-bus.js';
import { CanvasStore } from './canvas.js';

vi.mock('$lib/canvas/delivery.js', () => ({
	sendCanvasAction: vi.fn().mockResolvedValue(undefined),
	pushSurfaceMessage: vi.fn(),
	clearSurface: vi.fn()
}));

vi.mock('$lib/gateway/diagnostic-log.js', () => ({
	diagnosticLog: { log: vi.fn() }
}));

function makeEventFrame(event: string, payload: Record<string, unknown> = {}) {
	return { type: 'event' as const, event, payload };
}

describe('CanvasStore', () => {
	let store: CanvasStore;
	let eventBus: EventBus;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let callFn: any;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new CanvasStore();
		eventBus = new EventBus();
		callFn = vi.fn().mockResolvedValue(undefined);
	});

	// --- subscribe ---
	it('subscribe wires EventBus handlers', () => {
		store.subscribe(eventBus, callFn);

		// Dispatching a node.invoke.request event should reach handleCommand
		eventBus.handleFrame(
			makeEventFrame('node.invoke.request', {
				id: 'req-1',
				command: 'canvas.present',
				params: { surfaceId: 's1' }
			})
		);

		expect(get(store.surfaces).has('s1')).toBe(true);
	});

	// --- canvas.present ---
	it('canvas.present creates surface and sets visible/currentSurfaceId', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1', title: 'Test' });

		const surfaces = get(store.surfaces);
		expect(surfaces.has('surf-1')).toBe(true);
		const surface = surfaces.get('surf-1')!;
		expect(surface.visible).toBe(true);
		expect(surface.title).toBe('Test');
		expect(get(store.currentSurfaceId)).toBe('surf-1');
	});

	// --- canvas.present (existing) ---
	it('canvas.present updates existing surface', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1', title: 'Original' });
		store.handleCommand('canvas.present', { surfaceId: 'surf-1', title: 'Updated' });

		const surfaces = get(store.surfaces);
		expect(surfaces.size).toBe(1);
		expect(surfaces.get('surf-1')!.title).toBe('Updated');
	});

	// --- canvas.present (with requestId) ---
	it('canvas.present with requestId calls canvas.bridge.invokeResult with ok:true', () => {
		store.subscribe(eventBus, callFn);
		store.handleCommand('canvas.present', { surfaceId: 'surf-1' }, 'req-42');

		expect(callFn).toHaveBeenCalledWith('canvas.bridge.invokeResult', {
			id: 'req-42',
			ok: true,
			payload: { surfaceId: 'surf-1' }
		});
	});

	// --- canvas.hide ---
	it('canvas.hide sets visible: false and clears currentSurfaceId', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1' });
		expect(get(store.currentSurfaceId)).toBe('surf-1');

		store.handleCommand('canvas.hide', { surfaceId: 'surf-1' });

		const surface = get(store.surfaces).get('surf-1')!;
		expect(surface.visible).toBe(false);
		expect(get(store.currentSurfaceId)).toBeNull();
	});

	// --- canvas.navigate ---
	it('canvas.navigate updates URL', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1', url: 'http://old' });
		store.handleCommand('canvas.navigate', { surfaceId: 'surf-1', url: 'http://new' });

		expect(get(store.surfaces).get('surf-1')!.url).toBe('http://new');
	});

	// --- canvas.navigate (no URL) ---
	it('canvas.navigate without url is a no-op', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1', url: 'http://original' });
		store.handleCommand('canvas.navigate', { surfaceId: 'surf-1' });

		expect(get(store.surfaces).get('surf-1')!.url).toBe('http://original');
	});

	// --- canvas.a2ui.pushJSONL (array) ---
	it('canvas.a2ui.pushJSONL pushes messages array', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1' });
		store.handleCommand('canvas.a2ui.pushJSONL', {
			surfaceId: 'surf-1',
			messages: [{ type: 'text', content: 'hi' }, { type: 'data' }]
		});

		const surface = get(store.surfaces).get('surf-1')!;
		expect(surface.messages).toHaveLength(2);
		expect(surface.messages[0]).toEqual({ type: 'text', content: 'hi' });
	});

	// --- canvas.a2ui.pushJSONL (JSONL string) ---
	it('canvas.a2ui.pushJSONL parses jsonl string and pushes', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1' });
		const jsonl = '{"type":"a"}\n{"type":"b"}';
		store.handleCommand('canvas.a2ui.pushJSONL', { surfaceId: 'surf-1', jsonl });

		const surface = get(store.surfaces).get('surf-1')!;
		expect(surface.messages).toHaveLength(2);
		expect(surface.messages[0]).toEqual({ type: 'a' });
		expect(surface.messages[1]).toEqual({ type: 'b' });
	});

	// --- canvas.a2ui.pushJSONL (auto-create) ---
	it('canvas.a2ui.pushJSONL auto-creates surface if missing', () => {
		// Set currentSurfaceId by presenting then using that ID
		store.handleCommand('canvas.present', { surfaceId: 'surf-1' });
		// pushJSONL to a different surface that doesn't exist yet — pushMessage auto-creates
		store.handleCommand('canvas.a2ui.pushJSONL', {
			surfaceId: 'surf-new',
			messages: [{ type: 'test' }]
		});

		const surfaces = get(store.surfaces);
		expect(surfaces.has('surf-new')).toBe(true);
		expect(surfaces.get('surf-new')!.messages).toHaveLength(1);
	});

	// --- canvas.a2ui.reset ---
	it('canvas.a2ui.reset clears messages and calls clearSurface', async () => {
		const { clearSurface } = await import('$lib/canvas/delivery.js');
		store.handleCommand('canvas.present', { surfaceId: 'surf-1' });
		store.handleCommand('canvas.a2ui.pushJSONL', {
			surfaceId: 'surf-1',
			messages: [{ a: 1 }]
		});
		expect(get(store.surfaces).get('surf-1')!.messages).toHaveLength(1);

		store.handleCommand('canvas.a2ui.reset', { surfaceId: 'surf-1' });

		expect(get(store.surfaces).get('surf-1')!.messages).toHaveLength(0);
		expect(clearSurface).toHaveBeenCalledWith('surf-1');
	});

	// --- unknown command ---
	it('unknown command calls respondError when requestId is given', () => {
		store.subscribe(eventBus, callFn);
		store.handleCommand('canvas.bogus', {}, 'req-99');

		expect(callFn).toHaveBeenCalledWith('canvas.bridge.invokeResult', {
			id: 'req-99',
			ok: false,
			error: 'Unknown command: canvas.bogus'
		});
	});

	// --- resolveSurfaceId fallback ---
	it('resolveSurfaceId falls back to currentSurfaceId when none explicit', () => {
		store.handleCommand('canvas.present', { surfaceId: 'surf-1', url: 'http://initial' });
		expect(get(store.currentSurfaceId)).toBe('surf-1');

		// navigate without explicit surfaceId — should resolve to current
		store.handleCommand('canvas.navigate', { url: 'http://navigated' });

		expect(get(store.surfaces).get('surf-1')!.url).toBe('http://navigated');
	});

	// --- respondOk ---
	it('respondOk sends correct invokeResult params', () => {
		store.subscribe(eventBus, callFn);
		store.handleCommand('canvas.hide', { surfaceId: 'nonexistent' }, 'req-ok');

		expect(callFn).toHaveBeenCalledWith('canvas.bridge.invokeResult', {
			id: 'req-ok',
			ok: true,
			payload: undefined
		});
	});

	// --- respondError ---
	it('respondError sends correct invokeResult params', () => {
		store.subscribe(eventBus, callFn);
		store.handleCommand('canvas.unknown', {}, 'req-err');

		expect(callFn).toHaveBeenCalledWith('canvas.bridge.invokeResult', {
			id: 'req-err',
			ok: false,
			error: 'Unknown command: canvas.unknown'
		});
	});

	// --- restorePinnedSurfaces ---
	it('restorePinnedSurfaces creates surfaces and skips duplicates', () => {
		store.handleCommand('canvas.present', { surfaceId: 'existing' });

		store.restorePinnedSurfaces([
			{ surfaceId: 'existing', surfaceUrl: 'http://dup', surfaceTitle: 'Dup' },
			{ surfaceId: 'new-pin', surfaceUrl: 'http://new', surfaceTitle: 'New' }
		]);

		const surfaces = get(store.surfaces);
		expect(surfaces.size).toBe(2);
		// existing should NOT be overwritten
		expect(surfaces.get('existing')!.visible).toBe(true);
		// new-pin should be created with visible: false
		expect(surfaces.get('new-pin')!.visible).toBe(false);
		expect(surfaces.get('new-pin')!.url).toBe('http://new');
		expect(surfaces.get('new-pin')!.title).toBe('New');
	});

	// --- sendAction ---
	it('sendAction delegates to sendCanvasAction', async () => {
		const { sendCanvasAction } = await import('$lib/canvas/delivery.js');
		await store.sendAction('surf-1', 'click', { x: 10 });

		expect(sendCanvasAction).toHaveBeenCalledWith('surf-1', 'click', { x: 10 });
	});

	// --- clear ---
	it('clear resets all state', () => {
		store.subscribe(eventBus, callFn);
		store.handleCommand('canvas.present', { surfaceId: 'surf-1' });
		expect(get(store.surfaces).size).toBe(1);

		store.clear();

		expect(get(store.surfaces).size).toBe(0);
		expect(get(store.currentSurfaceId)).toBeNull();
	});

	// --- EventBus dispatch: node.invoke.request ---
	it('EventBus dispatch: node.invoke.request reaches handleCommand', () => {
		store.subscribe(eventBus, callFn);

		eventBus.handleFrame(
			makeEventFrame('node.invoke.request', {
				id: 'inv-1',
				command: 'canvas.present',
				params: { surfaceId: 'evt-surf' }
			})
		);

		expect(get(store.surfaces).has('evt-surf')).toBe(true);
		expect(callFn).toHaveBeenCalledWith(
			'canvas.bridge.invokeResult',
			expect.objectContaining({
				id: 'inv-1',
				ok: true
			})
		);
	});

	// --- EventBus dispatch: canvas.deliver ---
	it('EventBus dispatch: canvas.deliver reaches handleCommand', () => {
		store.subscribe(eventBus, callFn);

		eventBus.handleFrame(
			makeEventFrame('canvas.deliver', {
				command: 'canvas.present',
				params: { surfaceId: 'deliver-surf', title: 'Delivered' }
			})
		);

		const surface = get(store.surfaces).get('deliver-surf');
		expect(surface).toBeDefined();
		expect(surface!.title).toBe('Delivered');
	});

	// --- EventBus dispatch: canvas.message ---
	it('EventBus dispatch: canvas.message pushes messages to surface', () => {
		store.subscribe(eventBus, callFn);

		eventBus.handleFrame(
			makeEventFrame('canvas.message', {
				surfaceId: 'msg-surf',
				messages: [{ type: 'hello' }]
			})
		);

		const surface = get(store.surfaces).get('msg-surf');
		expect(surface).toBeDefined();
		expect(surface!.messages).toHaveLength(1);
		expect(surface!.messages[0]).toEqual({ type: 'hello' });
	});
});
