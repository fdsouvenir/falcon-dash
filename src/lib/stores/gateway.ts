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
		case 'parse-error':
			diagnosticLog.log('error', 'error', 'Failed to parse gateway frame');
			break;
	}
});

// --- Toast notifications on state transitions ---
let previousState: ConnectionState = 'DISCONNECTED';
connection.state.subscribe((state) => {
	if (state === 'AUTH_FAILED') {
		addToast('Authentication failed. Check your gateway token.', 'error', 8000);
	} else if (state === 'PAIRING_REQUIRED') {
		addToast('Device pairing required.', 'error', 8000);
	} else if (state === 'RECONNECTING' && previousState === 'READY') {
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
	connection.connect(config);
	reconnector.enable(config);
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
	connection.send({ type: 'req', id, method, params });
	return promise;
}
