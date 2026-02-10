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

export const connection = new GatewayConnection();
export const correlator = new RequestCorrelator();
export const eventBus = new EventBus();
export const snapshot = new SnapshotStore();
export const reconnector = new Reconnector(connection, eventBus);

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
		addToast('Device pairing required.', 'error', 8000);
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
	reconnector.onConnected(helloOk.policy.tickIntervalMs);
	tickHealth.set({
		lastTickAt: Date.now(),
		tickIntervalMs: helloOk.policy.tickIntervalMs
	});
});

/**
 * Connect to the gateway with the given URL and token.
 */
export function connectToGateway(url: string, token: string): void {
	const config = { url, token, instanceId: crypto.randomUUID() };
	reconnector.enable(config);
	connection.connect(config);
}

/**
 * Disconnect from the gateway.
 */
export function disconnectFromGateway(): void {
	reconnector.disable();
	connection.disconnect();
	correlator.cancelAll();
	eventBus.clear();
	snapshot.clear();
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
