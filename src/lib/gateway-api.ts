import { writable, readonly, type Readable } from 'svelte/store';

export class GatewayRpcError extends Error {
	readonly code: string;
	readonly details?: unknown;

	constructor(code: string, message: string, details?: unknown) {
		super(message);
		this.name = 'GatewayRpcError';
		this.code = code;
		this.details = details;
	}
}

/**
 * Call a gateway RPC method via the server-side proxy.
 */
export async function rpc<T = unknown>(
	method: string,
	params?: Record<string, unknown>
): Promise<T> {
	const res = await fetch('/api/gateway/rpc', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ method, params })
	});

	const data = await res.json();

	if (!data.ok) {
		throw new GatewayRpcError(
			data.error?.code ?? 'RPC_ERROR',
			data.error?.message ?? 'Unknown error',
			data.error?.details
		);
	}

	return data.payload as T;
}

// --- Event types ---

interface EventData {
	event: string;
	payload: Record<string, unknown>;
	seq?: number;
	stateVersion?: number;
}

type EventHandler = (payload: Record<string, unknown>, event: EventData) => void;

export interface HelloOkPayload {
	type: 'hello-ok';
	protocol: number;
	server: { version: string; host: string; connId: string };
	features: { methods: string[] };
	policy: { maxPayload: number; maxBufferedBytes: number; tickIntervalMs: number };
	snapshot: {
		presence: unknown[];
		health: Record<string, unknown>;
		stateVersion: Record<string, number>;
		uptimeMs?: number;
		configPath?: string;
		stateDir?: string;
		sessionDefaults?: Record<string, unknown>;
	};
	auth?: { deviceToken?: string; role: string; scopes: string[] };
}

// --- Gateway Events singleton ---

class GatewayEventManager {
	private es: EventSource | null = null;
	private handlers = new Map<string, Set<EventHandler>>();
	private wildcardHandlers = new Map<string, Set<EventHandler>>();
	private _connected = writable(false);
	private _snapshot = writable<HelloOkPayload | null>(null);
	private _state = writable<string>('disconnected');

	readonly connected: Readable<boolean> = readonly(this._connected);
	readonly snapshot: Readable<HelloOkPayload | null> = readonly(this._snapshot);
	readonly state: Readable<string> = readonly(this._state);

	on(event: string, handler: EventHandler): () => void {
		const isWildcard = event.includes('*');
		const map = isWildcard ? this.wildcardHandlers : this.handlers;
		let set = map.get(event);
		if (!set) {
			set = new Set();
			map.set(event, set);
		}
		set.add(handler);
		return () => {
			set!.delete(handler);
			if (set!.size === 0) map.delete(event);
		};
	}

	once(event: string): Promise<Record<string, unknown>> {
		return new Promise((resolve) => {
			const unsub = this.on(event, (payload) => {
				unsub();
				resolve(payload);
			});
		});
	}

	connect(): void {
		if (this.es) return;

		const es = new EventSource('/api/gateway/events');
		this.es = es;

		es.addEventListener('snapshot', (e) => {
			try {
				const data = JSON.parse(e.data) as HelloOkPayload;
				this._snapshot.set(data);
				this._connected.set(true);
				this._state.set('ready');
			} catch {
				console.error('[gateway-events] Failed to parse snapshot');
			}
		});

		es.addEventListener('gateway-status', (e) => {
			try {
				const data = JSON.parse(e.data) as { state: string };
				this._state.set(data.state);
				this._connected.set(data.state === 'ready');
			} catch {
				console.error('[gateway-events] Failed to parse status');
			}
		});

		es.addEventListener('gateway', (e) => {
			try {
				const data = JSON.parse(e.data) as EventData;
				this.dispatch(data);
			} catch {
				console.error('[gateway-events] Failed to parse event');
			}
		});

		es.onerror = () => {
			// EventSource auto-reconnects. Mark as disconnected until we get a new snapshot.
			this._connected.set(false);
			this._state.set('disconnected');
		};

		es.onopen = () => {
			// Connection opened, will get snapshot event shortly
		};
	}

	disconnect(): void {
		if (this.es) {
			this.es.close();
			this.es = null;
		}
		this._connected.set(false);
		this._state.set('disconnected');
	}

	private dispatch(data: EventData): void {
		// Exact match
		const exact = this.handlers.get(data.event);
		if (exact) {
			for (const handler of exact) {
				try {
					handler(data.payload, data);
				} catch (err) {
					console.error('[gateway-events] Handler error:', err);
				}
			}
		}

		// Wildcard match
		for (const [pattern, handlers] of this.wildcardHandlers) {
			if (this.matchWildcard(pattern, data.event)) {
				for (const handler of handlers) {
					try {
						handler(data.payload, data);
					} catch (err) {
						console.error('[gateway-events] Handler error:', err);
					}
				}
			}
		}
	}

	private matchWildcard(pattern: string, eventName: string): boolean {
		if (pattern === '*') return true;
		if (pattern.endsWith('.*')) {
			const prefix = pattern.slice(0, -2);
			return eventName === prefix || eventName.startsWith(prefix + '.');
		}
		return false;
	}
}

export const gatewayEvents = new GatewayEventManager();
