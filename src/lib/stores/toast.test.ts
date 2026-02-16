import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('toast store', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		let counter = 0;
		vi.stubGlobal('crypto', {
			randomUUID: () => `uuid-${++counter}`
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('starts empty', async () => {
		const { toasts } = await import('./toast.js');
		let value: unknown[] = [];
		toasts.subscribe((v) => {
			value = v;
		})();
		expect(value).toHaveLength(0);
	});

	it('addToast adds a toast', async () => {
		const { toasts, addToast } = await import('./toast.js');
		let value: unknown[] = [];
		const unsubscribe = toasts.subscribe((v) => {
			value = v;
		});

		addToast('Test message');
		expect(value).toHaveLength(1);
		expect(value[0]).toMatchObject({
			message: 'Test message',
			type: 'info',
			duration: 4000
		});
		unsubscribe();
	});

	it('addToast defaults to info type', async () => {
		const { toasts, addToast } = await import('./toast.js');
		let value: unknown[] = [];
		const unsubscribe = toasts.subscribe((v) => {
			value = v;
		});

		addToast('Info message');
		expect(value[0]).toMatchObject({ type: 'info' });
		unsubscribe();
	});

	it('removeToast removes specific toast', async () => {
		const { toasts, addToast, removeToast } = await import('./toast.js');
		let value: unknown[] = [];
		const unsubscribe = toasts.subscribe((v) => {
			value = v;
		});

		addToast('First');
		addToast('Second');
		expect(value).toHaveLength(2);

		removeToast('uuid-1');
		expect(value).toHaveLength(1);
		expect(value[0]).toMatchObject({ message: 'Second' });
		unsubscribe();
	});

	it('auto-removes toast after duration', async () => {
		const { toasts, addToast } = await import('./toast.js');
		let value: unknown[] = [];
		const unsubscribe = toasts.subscribe((v) => {
			value = v;
		});

		addToast('Auto remove', 'info', 2000);
		expect(value).toHaveLength(1);

		vi.advanceTimersByTime(2000);
		expect(value).toHaveLength(0);
		unsubscribe();
	});
});
