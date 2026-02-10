import type { ResponseFrame, Frame } from './types.js';

export interface GatewayError {
	code: string;
	message: string;
	details?: unknown;
	retryable?: boolean;
	retryAfterMs?: number;
}

export class GatewayRequestError extends Error {
	readonly code: string;
	readonly details?: unknown;
	readonly retryable: boolean;
	readonly retryAfterMs?: number;

	constructor(error: GatewayError) {
		super(error.message);
		this.name = 'GatewayRequestError';
		this.code = error.code;
		this.details = error.details;
		this.retryable = error.retryable ?? false;
		this.retryAfterMs = error.retryAfterMs;
	}
}

interface PendingRequest {
	resolve: (payload: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class RequestCorrelator {
	private pending = new Map<string, PendingRequest>();
	private counter = 0;
	private defaultTimeout: number;

	constructor(defaultTimeout = 30_000) {
		this.defaultTimeout = defaultTimeout;
	}

	/** Generate a unique request ID (monotonic counter) */
	nextId(): string {
		return String(++this.counter);
	}

	/** Generate an idempotency key for mutating methods */
	idempotencyKey(): string {
		return crypto.randomUUID();
	}

	/**
	 * Register a request and return a Promise that resolves/rejects
	 * when the matching response arrives.
	 */
	track<T = unknown>(id: string, timeout?: number): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Request ${id} timed out after ${timeout ?? this.defaultTimeout}ms`));
			}, timeout ?? this.defaultTimeout);

			this.pending.set(id, {
				resolve: resolve as (payload: unknown) => void,
				reject,
				timer
			});
		});
	}

	/**
	 * Handle an incoming frame. If it's a response matching a pending request,
	 * resolve or reject the Promise. Returns true if the frame was handled.
	 */
	handleFrame(frame: Frame): boolean {
		if (frame.type !== 'res') return false;

		const res = frame as ResponseFrame;
		const pending = this.pending.get(res.id);
		if (!pending) return false;

		clearTimeout(pending.timer);
		this.pending.delete(res.id);

		if (res.ok) {
			pending.resolve(res.payload ?? {});
		} else {
			pending.reject(
				new GatewayRequestError(res.error ?? { code: 'UNKNOWN', message: 'Unknown error' })
			);
		}

		return true;
	}

	/** Cancel all pending requests (e.g., on disconnect) */
	cancelAll(reason = 'Connection closed'): void {
		for (const [id, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error(reason));
			this.pending.delete(id);
		}
	}

	/** Number of currently pending requests */
	get size(): number {
		return this.pending.size;
	}
}
