import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestCorrelator, GatewayRequestError } from './correlator.js';
import type { ResponseFrame, Frame } from './types.js';

function makeResponse(
	id: string,
	ok: boolean,
	payload?: Record<string, unknown>,
	error?: ResponseFrame['error']
): ResponseFrame {
	return { type: 'res', id, ok, ...(payload && { payload }), ...(error && { error }) };
}

describe('RequestCorrelator', () => {
	describe('nextId', () => {
		it('returns monotonically increasing string IDs', () => {
			const c = new RequestCorrelator();
			expect(c.nextId()).toBe('1');
			expect(c.nextId()).toBe('2');
			expect(c.nextId()).toBe('3');
		});
	});

	describe('track + handleFrame', () => {
		it('resolves on successful response', async () => {
			const c = new RequestCorrelator();
			const promise = c.track('1');

			c.handleFrame(makeResponse('1', true, { result: 'ok' }));

			await expect(promise).resolves.toEqual({ result: 'ok' });
		});

		it('resolves with empty object when payload is undefined', async () => {
			const c = new RequestCorrelator();
			const promise = c.track('1');

			c.handleFrame(makeResponse('1', true));

			await expect(promise).resolves.toEqual({});
		});

		it('rejects with GatewayRequestError on error response', async () => {
			const c = new RequestCorrelator();
			const promise = c.track('1');

			c.handleFrame(
				makeResponse('1', false, undefined, {
					code: 'NOT_FOUND',
					message: 'Resource not found'
				})
			);

			await expect(promise).rejects.toThrow(GatewayRequestError);
			await expect(promise).rejects.toThrow('Resource not found');
		});

		it('returns true when frame matches pending request', () => {
			const c = new RequestCorrelator();
			c.track('1');
			expect(c.handleFrame(makeResponse('1', true, {}))).toBe(true);
		});

		it('returns false for non-response frames', () => {
			const c = new RequestCorrelator();
			const eventFrame: Frame = { type: 'event', event: 'test', payload: {} };
			expect(c.handleFrame(eventFrame)).toBe(false);
		});

		it('returns false for untracked response IDs', () => {
			const c = new RequestCorrelator();
			expect(c.handleFrame(makeResponse('999', true, {}))).toBe(false);
		});
	});

	describe('timeout', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('rejects after default timeout', async () => {
			const c = new RequestCorrelator(5000);
			const promise = c.track('1');

			vi.advanceTimersByTime(5000);

			await expect(promise).rejects.toThrow('timed out');
		});

		it('rejects after custom timeout', async () => {
			const c = new RequestCorrelator();
			const promise = c.track('1', 2000);

			vi.advanceTimersByTime(2000);

			await expect(promise).rejects.toThrow('timed out');
		});

		it('does not reject before timeout', async () => {
			const c = new RequestCorrelator(5000);
			const promise = c.track('1');
			let rejected = false;
			promise.catch(() => {
				rejected = true;
			});

			vi.advanceTimersByTime(4999);
			await Promise.resolve();

			expect(rejected).toBe(false);
			// Clean up
			vi.advanceTimersByTime(1);
			await promise.catch(() => {});
		});
	});

	describe('cancel', () => {
		it('rejects a specific pending request', async () => {
			const c = new RequestCorrelator();
			const promise = c.track('1');

			c.cancel('1', new Error('cancelled'));

			await expect(promise).rejects.toThrow('cancelled');
		});

		it('does not affect other pending requests', async () => {
			const c = new RequestCorrelator();
			const p1 = c.track('1');
			const p2 = c.track('2');

			c.cancel('1', new Error('cancelled'));

			await expect(p1).rejects.toThrow('cancelled');
			// p2 should still be pending
			expect(c.size).toBe(1);
			c.cancel('2', new Error('cleanup'));
			await p2.catch(() => {});
		});
	});

	describe('cancelAll', () => {
		it('rejects all pending requests', async () => {
			const c = new RequestCorrelator();
			const p1 = c.track('1');
			const p2 = c.track('2');

			c.cancelAll('disconnected');

			await expect(p1).rejects.toThrow('disconnected');
			await expect(p2).rejects.toThrow('disconnected');
			expect(c.size).toBe(0);
		});
	});

	describe('size', () => {
		it('tracks pending request count', async () => {
			const c = new RequestCorrelator();
			expect(c.size).toBe(0);

			const p1 = c.track('1');
			expect(c.size).toBe(1);

			const p2 = c.track('2');
			expect(c.size).toBe(2);

			c.handleFrame(makeResponse('1', true, {}));
			await p1;
			expect(c.size).toBe(1);

			c.cancel('2', new Error('x'));
			await p2.catch(() => {});
		});
	});

	describe('GatewayRequestError', () => {
		it('has correct properties', () => {
			const err = new GatewayRequestError({
				code: 'RATE_LIMITED',
				message: 'Too many requests',
				retryable: true,
				retryAfterMs: 1000
			});

			expect(err.name).toBe('GatewayRequestError');
			expect(err.code).toBe('RATE_LIMITED');
			expect(err.message).toBe('Too many requests');
			expect(err.retryable).toBe(true);
			expect(err.retryAfterMs).toBe(1000);
		});

		it('defaults retryable to false', () => {
			const err = new GatewayRequestError({
				code: 'UNKNOWN',
				message: 'Error'
			});
			expect(err.retryable).toBe(false);
		});
	});
});
