import type { RequestFrame, ResponseFrame } from './types';

/** Methods that mutate state and require idempotency keys */
const MUTATION_METHODS = new Set([
	'chat.send',
	'chat.inject',
	'chat.abort',
	'agent',
	'send',
	'config.apply',
	'config.set',
	'config.patch',
	'cron.add',
	'cron.edit',
	'cron.rm',
	'cron.enable',
	'cron.disable',
	'cron.run',
	'exec.approval.resolve'
]);

interface PendingRequest {
	resolve: (payload: Record<string, unknown>) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class RequestCorrelator {
	private nextId = 1;
	private pending = new Map<string, PendingRequest>();
	private defaultTimeoutMs: number;

	constructor(defaultTimeoutMs = 30_000) {
		this.defaultTimeoutMs = defaultTimeoutMs;
	}

	/** Build a request frame and return a Promise for the response */
	send(
		method: string,
		params?: Record<string, unknown>,
		timeoutMs?: number
	): { frame: RequestFrame; promise: Promise<Record<string, unknown>> } {
		const id = String(this.nextId++);
		const timeout = timeoutMs ?? this.defaultTimeoutMs;

		const frameParams = { ...params };

		if (MUTATION_METHODS.has(method) && !frameParams.idempotencyKey) {
			frameParams.idempotencyKey = generateIdempotencyKey();
		}

		const frame: RequestFrame = {
			type: 'req',
			id,
			method,
			params: frameParams
		};

		const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Request ${method} (id=${id}) timed out after ${timeout}ms`));
			}, timeout);

			this.pending.set(id, { resolve, reject, timer });
		});

		return { frame, promise };
	}

	/** Handle an incoming response frame */
	handleResponse(frame: ResponseFrame): void {
		const entry = this.pending.get(frame.id);
		if (!entry) return;

		this.pending.delete(frame.id);
		clearTimeout(entry.timer);

		if (frame.ok) {
			entry.resolve(frame.payload);
		} else {
			const err = new Error(frame.error.message);
			Object.assign(err, { code: frame.error.code, details: frame.error.details });
			entry.reject(err);
		}
	}

	/** Reject all pending requests (called on disconnect) */
	rejectAll(reason = 'Connection lost'): void {
		for (const [id, entry] of this.pending) {
			clearTimeout(entry.timer);
			entry.reject(new Error(reason));
			this.pending.delete(id);
		}
	}

	/** Number of pending requests */
	get pendingCount(): number {
		return this.pending.size;
	}
}

/** Generate a unique idempotency key */
function generateIdempotencyKey(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
