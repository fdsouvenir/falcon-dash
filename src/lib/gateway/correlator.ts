import { writable, readonly, type Readable } from 'svelte/store';
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

export interface CorrelatorMetrics {
	pendingCount: number;
	totalRequests: number;
	totalTimeouts: number;
	totalErrors: number;
	lastErrorAt: number | null;
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

	private _totalRequests = 0;
	private _totalTimeouts = 0;
	private _totalErrors = 0;
	private _lastErrorAt: number | null = null;

	private _metrics = writable<CorrelatorMetrics>({
		pendingCount: 0,
		totalRequests: 0,
		totalTimeouts: 0,
		totalErrors: 0,
		lastErrorAt: null
	});

	/** Request metrics as a Svelte readable store */
	readonly metrics: Readable<CorrelatorMetrics> = readonly(this._metrics);

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
		this._totalRequests++;
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				this._totalTimeouts++;
				this._lastErrorAt = Date.now();
				this.updateMetrics();
				reject(new Error(`Request ${id} timed out after ${timeout ?? this.defaultTimeout}ms`));
			}, timeout ?? this.defaultTimeout);

			this.pending.set(id, {
				resolve: resolve as (payload: unknown) => void,
				reject,
				timer
			});
			this.updateMetrics();
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
			this._totalErrors++;
			this._lastErrorAt = Date.now();
			pending.reject(
				new GatewayRequestError(res.error ?? { code: 'UNKNOWN', message: 'Unknown error' })
			);
		}

		this.updateMetrics();
		return true;
	}

	/** Cancel a single pending request by ID (e.g., when send fails) */
	cancel(id: string, error: Error): void {
		const entry = this.pending.get(id);
		if (entry) {
			clearTimeout(entry.timer);
			this.pending.delete(id);
			entry.reject(error);
			this.updateMetrics();
		}
	}

	/** Cancel all pending requests (e.g., on disconnect) */
	cancelAll(reason = 'Connection closed'): void {
		for (const [id, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error(reason));
			this.pending.delete(id);
		}
		this.updateMetrics();
	}

	/** Number of currently pending requests */
	get size(): number {
		return this.pending.size;
	}

	private updateMetrics(): void {
		this._metrics.set({
			pendingCount: this.pending.size,
			totalRequests: this._totalRequests,
			totalTimeouts: this._totalTimeouts,
			totalErrors: this._totalErrors,
			lastErrorAt: this._lastErrorAt
		});
	}
}
