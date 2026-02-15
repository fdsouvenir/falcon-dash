import { get } from 'svelte/store';
import { GatewayConnection } from '$lib/gateway/connection.js';
import { RequestCorrelator } from '$lib/gateway/correlator.js';
import { EventBus } from '$lib/gateway/event-bus.js';
import { SnapshotStore } from '$lib/gateway/snapshot-store.js';
import { Reconnector } from '$lib/gateway/reconnector.js';
import { diagnosticLog } from '$lib/gateway/diagnostic-log.js';
import { tickHealth } from '$lib/stores/diagnostics.js';
import { addToast } from '$lib/stores/toast.js';
import type { Frame, ConnectionState } from '$lib/gateway/types.js';
import { CanvasStore } from '$lib/stores/canvas.js';
import { initA2UIBridge, getCanvasHostUrl } from '$lib/canvas/a2ui-bridge.js';
import { gatewayUrl, gatewayToken } from '$lib/stores/token.js';

// Stable per-tab instance ID — survives reconnects and HMR within the same tab,
// but each new tab gets its own ID. Prevents stale virtual canvas node accumulation.
function getStableTabInstanceId(): string {
	if (typeof sessionStorage !== 'undefined') {
		const key = 'openclaw-tab-instance-id';
		let id = sessionStorage.getItem(key);
		if (!id) {
			id = crypto.randomUUID();
			sessionStorage.setItem(key, id);
		}
		return id;
	}
	return crypto.randomUUID();
}
const tabInstanceId = getStableTabInstanceId();

export const connection = new GatewayConnection();
export const correlator = new RequestCorrelator();
export const eventBus = new EventBus();
export const snapshot = new SnapshotStore();
export const reconnector = new Reconnector(connection, eventBus);
export const canvasStore = new CanvasStore();

// Re-export for convenient access
export { diagnosticLog };

// --- Diagnostic callback wiring ---
connection.setDiagnosticCallback((event, detail) => {
	switch (event) {
		case 'connecting':
			diagnosticLog.log('connection', 'info', `Connecting to ${detail?.url}`, detail);
			break;
		case 'challenge':
			diagnosticLog.log('auth', 'info', 'Challenge received, authenticating');
			break;
		case 'hello-ok':
			diagnosticLog.log(
				'connection',
				'info',
				`Connected: connId=${detail?.connId}, server=${detail?.serverVersion}`,
				detail
			);
			break;
		case 'auth-failed':
			diagnosticLog.log('auth', 'error', 'Authentication failed');
			break;
		case 'pairing-required':
			diagnosticLog.log('auth', 'warn', 'Pairing required (close code 1008)', detail);
			break;
		case 'close':
			diagnosticLog.log('connection', 'warn', 'Connection closed', detail);
			break;
		case 'ws-error':
			diagnosticLog.log('error', 'warn', 'WebSocket error event (close will follow)');
			break;
		case 'parse-error':
			diagnosticLog.log('error', 'error', 'Failed to parse gateway frame');
			break;
	}
});

// --- Wire unexpected close to reconnector and correlator ---
connection.setOnClose((code, reason) => {
	diagnosticLog.log('connection', 'warn', `Unexpected close: code=${code}`, { code, reason });
	// Best-effort unregister — may fail if WS already closed, that's expected
	call('canvas.bridge.unregister', {}).catch(() => {});
	correlator.cancelAll('Connection lost unexpectedly');
	reconnector.onDisconnect();
});

// --- Disable reconnector on terminal auth states ---
connection.state.subscribe((state) => {
	if (state === 'AUTH_FAILED' || state === 'PAIRING_REQUIRED') {
		reconnector.disable();
	}
});

// --- Max reconnection attempts exhausted ---
reconnector.onMaxAttemptsExhausted = () => {
	diagnosticLog.log('reconnect', 'error', 'Max reconnection attempts exhausted — giving up');
	addToast(
		'Unable to reach gateway after multiple attempts. Check your connection and retry.',
		'error',
		0
	);
};

// --- Toast notifications on state transitions ---
let previousState: ConnectionState = 'DISCONNECTED';
connection.state.subscribe((state) => {
	if (state === 'AUTH_FAILED') {
		addToast('Authentication failed. Check your gateway token.', 'error', 8000);
	} else if (state === 'PAIRING_REQUIRED') {
		addToast(
			'Gateway token mismatch — the token may have been rotated. Reload to re-read from config.',
			'error',
			0
		);
	} else if (
		state === 'RECONNECTING' &&
		(previousState === 'READY' || previousState === 'DISCONNECTED')
	) {
		addToast('Connection lost. Reconnecting...', 'info', 4000);
	} else if (state === 'READY' && previousState === 'RECONNECTING') {
		addToast('Reconnected to gateway.', 'success', 3000);
		diagnosticLog.log('reconnect', 'info', 'Reconnected successfully');
	}
	previousState = state;
});

// --- Tick event logging and health tracking ---
eventBus.on('tick', () => {
	tickHealth.set({
		lastTickAt: Date.now(),
		tickIntervalMs: null // updated on hello-ok via reconnector
	});
	diagnosticLog.log('tick', 'debug', 'Tick received');
});

// --- Reconnector tick timeout logging ---
reconnector.onTickTimeout = (timeoutMs) => {
	diagnosticLog.log('tick', 'warn', `Tick timeout: no tick in ${timeoutMs}ms`, { timeoutMs });
};

// Wire frame handling: correlator first, then event bus
connection.onFrame((frame: Frame) => {
	if (correlator.handleFrame(frame)) return;
	eventBus.handleFrame(frame);
});

// Wire hello-ok callback: hydrate snapshot, enable reconnection, update tick health
connection.setOnHelloOk((helloOk) => {
	snapshot.hydrate(helloOk);
	snapshot.subscribe(eventBus);
	canvasStore.subscribe(eventBus, call);
	const browserHost = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
	const gwPort = (() => {
		try {
			return parseInt(new URL(get(gatewayUrl)).port, 10) || 18789;
		} catch {
			return 18789;
		}
	})();
	canvasStore.setCanvasHostBaseUrl(getCanvasHostUrl(browserHost, gwPort));
	call('canvas.bridge.register', {}).catch(() => {
		diagnosticLog.log(
			'canvas',
			'info',
			'canvas.bridge.register unavailable — plugin not installed'
		);
	});
	reconnector.onConnected(helloOk.policy.tickIntervalMs);
	tickHealth.set({
		lastTickAt: Date.now(),
		tickIntervalMs: helloOk.policy.tickIntervalMs
	});
});

// --- A2UI action bridge: wire canvas actions from A2UI web component ---
initA2UIBridge((action) => {
	canvasStore.sendAction(action.surfaceId, action.actionId, action.payload);
});

// --- Best-effort cleanup on tab close ---
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		call('canvas.bridge.unregister', {}).catch(() => {});
	});
}

/**
 * Set the active chat run ID on the canvas store so surfaces auto-associate.
 */
export function setCanvasActiveRunId(runId: string | null): void {
	canvasStore.setActiveRunId(runId);
}

/**
 * Connect to the gateway with the given URL and token.
 */
export function connectToGateway(url: string, token: string): void {
	const config = { url, token, instanceId: tabInstanceId };

	// Refresh token from server config before each reconnection attempt
	reconnector.onBeforeReconnect = async () => {
		try {
			const res = await fetch('/api/gateway-config');
			if (!res.ok) return null;
			const data = await res.json();
			if (data?.token) {
				gatewayToken.set(data.token);
				return { ...config, token: data.token };
			}
		} catch {
			// Fetch failed — proceed with existing token
		}
		return null;
	};

	reconnector.enable(config);
	connection.connect(config);
}

/**
 * Disconnect from the gateway.
 */
export function disconnectFromGateway(): void {
	call('canvas.bridge.unregister', {}).catch(() => {});
	reconnector.disable();
	connection.disconnect();
	correlator.cancelAll();
	eventBus.clear();
	snapshot.clear();
	canvasStore.clear();
}

/**
 * Call a gateway method and return a typed Promise.
 */
export function call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
	const id = correlator.nextId();
	const promise = correlator.track<T>(id);
	try {
		connection.send({ type: 'req', id, method, params });
	} catch (err) {
		correlator.cancel(id, err instanceof Error ? err : new Error(String(err)));
	}
	return promise;
}

// Expose gateway internals on window for dev debugging (e.g. __oc.call('pm.domain.list'))
if (typeof window !== 'undefined' && import.meta.env.DEV) {
	(window as any).__oc = { call, connection, snapshot, eventBus, canvasStore };
}

/**
 * Return a complete connection health snapshot for diagnostics export.
 */
export function getConnectionSummary(): Record<string, unknown> {
	const state = get(connection.state);
	const reconMetrics = get(reconnector.metrics);
	const corrMetrics = get(correlator.metrics);

	return {
		timestamp: new Date().toISOString(),
		connectionState: state,
		connId: connection.connId,
		networkOnline: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
		reconnect: {
			attempt: reconMetrics.attempt,
			maxAttempts: reconMetrics.maxAttempts,
			exhausted: reconMetrics.exhausted,
			tickIntervalMs: reconMetrics.tickIntervalMs
		},
		requests: {
			total: corrMetrics.totalRequests,
			pending: corrMetrics.pendingCount,
			timeouts: corrMetrics.totalTimeouts,
			errors: corrMetrics.totalErrors,
			successRate:
				corrMetrics.totalRequests > 0
					? (
							((corrMetrics.totalRequests - corrMetrics.totalErrors - corrMetrics.totalTimeouts) /
								corrMetrics.totalRequests) *
							100
						).toFixed(1) + '%'
					: 'N/A'
		},
		log: diagnosticLog.summary()
	};
}
