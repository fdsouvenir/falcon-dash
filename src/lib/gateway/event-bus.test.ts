import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './event-bus.js';
import type { EventFrame, Frame } from './types.js';

function makeEventFrame(event: string, payload: Record<string, unknown> = {}): EventFrame {
	return { type: 'event', event, payload };
}

describe('EventBus', () => {
	it('dispatches to exact match handlers', () => {
		const bus = new EventBus();
		const handler = vi.fn();
		bus.on('chat.message', handler);

		bus.handleFrame(makeEventFrame('chat.message', { text: 'hello' }));

		expect(handler).toHaveBeenCalledOnce();
		expect(handler).toHaveBeenCalledWith(
			{ text: 'hello' },
			expect.objectContaining({ event: 'chat.message' })
		);
	});

	it('does not dispatch to non-matching handlers', () => {
		const bus = new EventBus();
		const handler = vi.fn();
		bus.on('chat.message', handler);

		bus.handleFrame(makeEventFrame('presence.update', {}));

		expect(handler).not.toHaveBeenCalled();
	});

	it('dispatches to wildcard handlers', () => {
		const bus = new EventBus();
		const handler = vi.fn();
		bus.on('pm.*', handler);

		bus.handleFrame(makeEventFrame('pm.task.create', { id: 1 }));

		expect(handler).toHaveBeenCalledOnce();
	});

	it('dispatches to global wildcard (*)', () => {
		const bus = new EventBus();
		const handler = vi.fn();
		bus.on('*', handler);

		bus.handleFrame(makeEventFrame('anything.here', {}));

		expect(handler).toHaveBeenCalledOnce();
	});

	it('returns true for event frames', () => {
		const bus = new EventBus();
		expect(bus.handleFrame(makeEventFrame('test', {}))).toBe(true);
	});

	it('returns false for non-event frames', () => {
		const bus = new EventBus();
		const reqFrame: Frame = { type: 'req', id: '1', method: 'test' };
		expect(bus.handleFrame(reqFrame)).toBe(false);
	});

	it('unsubscribe function removes handler', () => {
		const bus = new EventBus();
		const handler = vi.fn();
		const unsub = bus.on('test', handler);

		unsub();
		bus.handleFrame(makeEventFrame('test', {}));

		expect(handler).not.toHaveBeenCalled();
	});

	it('once() resolves on next event', async () => {
		const bus = new EventBus();
		const promise = bus.once('done');

		bus.handleFrame(makeEventFrame('done', { result: 42 }));

		const payload = await promise;
		expect(payload).toEqual({ result: 42 });
	});

	it('once() only fires once', async () => {
		const bus = new EventBus();
		const promise = bus.once('done');

		bus.handleFrame(makeEventFrame('done', { n: 1 }));
		bus.handleFrame(makeEventFrame('done', { n: 2 }));

		const payload = await promise;
		expect(payload).toEqual({ n: 1 });
	});

	it('clear() removes all handlers', () => {
		const bus = new EventBus();
		const handler = vi.fn();
		bus.on('test', handler);
		bus.on('pm.*', handler);

		bus.clear();
		bus.handleFrame(makeEventFrame('test', {}));
		bus.handleFrame(makeEventFrame('pm.task', {}));

		expect(handler).not.toHaveBeenCalled();
	});

	it('catches and logs handler errors', () => {
		const bus = new EventBus();
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const badHandler = () => {
			throw new Error('boom');
		};
		const goodHandler = vi.fn();

		bus.on('test', badHandler);
		bus.on('test', goodHandler);

		bus.handleFrame(makeEventFrame('test', {}));

		expect(errorSpy).toHaveBeenCalled();
		expect(goodHandler).toHaveBeenCalledOnce();
		errorSpy.mockRestore();
	});

	it('dispatches to multiple handlers for same event', () => {
		const bus = new EventBus();
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		bus.on('test', handler1);
		bus.on('test', handler2);

		bus.handleFrame(makeEventFrame('test', {}));

		expect(handler1).toHaveBeenCalledOnce();
		expect(handler2).toHaveBeenCalledOnce();
	});
});
