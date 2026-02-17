import { get } from 'svelte/store';
import { GatewayConnection } from '$lib/gateway/connection.js';
import { RequestCorrelator } from '$lib/gateway/correlator.js';
import { EventBus } from '$lib/gateway/event-bus.js';
import { SnapshotStore } from '$lib/gateway/snapshot-store.js';
import { Reconnector } from '$lib/gateway/reconnector.js';
import { diagnosticLog } from '$lib/gateway/diagnostic-log.js';
import { tickHealth } from '$lib/stores/diagnostics.js';
import { addToast } from '$lib/stores/toast.js';
import type { Frame, ConnectionState, ConnectionConfig } from '$lib/gateway/types.js';
import {
	ensureDeviceIdentity,
	exportPublicKeyBase64,
	storeDeviceToken
} from '$lib/gateway/device-identity.js';
import { CanvasStore } from '$lib/stores/canvas.js';
import { initA2UIBridge, getCanvasHostUrl } from '$lib/canvas/a2ui-bridge.js';
import { gatewayUrl, gatewayToken } from '$lib/stores/token.js';
import { checkPMAvailability } from '$lib/stores/pm-store.js';

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

// PM feature detection — reactive subscription to snapshot.features
checkPMAvailability();

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
		case 'device-sign-error':
			diagnosticLog.log('auth', 'error', 'Failed to sign device challenge', detail);
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
let pairingRetryTimer: ReturnType<typeof setTimeout> | null = null;
let pairingRetryCount = 0;
const PAIRING_MAX_RETRIES = 10;
const PAIRING_RETRY_DELAY_MS = 3000;

connection.state.subscribe((state) => {
	if (state === 'AUTH_FAILED') {
		reconnector.disable();
	} else if (state === 'PAIRING_REQUIRED') {
		reconnector.disable();
		// Start pairing retry loop — device may be approved momentarily
		if (pairingRetryCount < PAIRING_MAX_RETRIES) {
			pairingRetryCount++;
			diagnosticLog.log(
				'auth',
				'info',
				`Pairing retry ${pairingRetryCount}/${PAIRING_MAX_RETRIES} in ${PAIRING_RETRY_DELAY_MS}ms`
			);
			pairingRetryTimer = setTimeout(() => {
				connection.disconnect();
				const gwUrl = get(gatewayUrl);
				const gwToken = get(gatewayToken);
				if (gwUrl && gwToken) {
					connectToGateway(gwUrl, gwToken);
				}
			}, PAIRING_RETRY_DELAY_MS);
		} else {
			diagnosticLog.log('auth', 'error', 'Pairing retries exhausted — giving up');
			addToast(
				'Device pairing timed out. Approve this device in the gateway admin, then refresh.',
				'error',
				0
			);
		}
	} else if (state === 'READY') {
		// Pairing succeeded — clear retry state
		if (pairingRetryTimer) {
			clearTimeout(pairingRetryTimer);
			pairingRetryTimer = null;
		}
		if (pairingRetryCount > 0) {
			diagnosticLog.log('auth', 'info', `Device paired after ${pairingRetryCount} retries`);
			pairingRetryCount = 0;
		}
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
	} else if (state === 'PAIRING_REQUIRED' && pairingRetryCount <= 1) {
		addToast('Device pairing in progress...', 'info', 6000);
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
	const gwUrl = get(gatewayUrl);
	const gatewayHost = (() => {
		try {
			return new URL(gwUrl.startsWith('ws') ? gwUrl.replace(/^ws/, 'http') : gwUrl).hostname;
		} catch {
			return '127.0.0.1';
		}
	})();
	const gwPort = (() => {
		try {
			return (
				parseInt(new URL(gwUrl.startsWith('ws') ? gwUrl.replace(/^ws/, 'http') : gwUrl).port, 10) ||
				18789
			);
		} catch {
			return 18789;
		}
	})();
	// Canvas host runs on gateway port + 4 (e.g. 18793 when gateway is 18789)
	// Use hello-ok payload if available, otherwise default offset
	const canvasHostPort = (helloOk as unknown as Record<string, unknown>).canvasHostPort
		? Number((helloOk as unknown as Record<string, unknown>).canvasHostPort)
		: gwPort + 4;
	canvasStore.setCanvasHostBaseUrl(getCanvasHostUrl(gatewayHost, canvasHostPort));
	call<{ nodeId?: string }>('canvas.bridge.register', {})
		.then((result) => {
			canvasStore.setBridgeStatus({ registered: true, nodeId: result?.nodeId });
			diagnosticLog.log('canvas', 'info', 'Canvas bridge registered', {
				nodeId: result?.nodeId
			});
		})
		.catch((err) => {
			canvasStore.setBridgeStatus({ registered: false, error: String(err) });
			diagnosticLog.log(
				'canvas',
				'info',
				'canvas.bridge.register unavailable — plugin not installed'
			);
		});
	if (helloOk.auth?.deviceToken) {
		storeDeviceToken(helloOk.auth.deviceToken).catch((err) => {
			console.warn('[gateway] Failed to persist device token:', err);
		});
	}
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
export async function connectToGateway(url: string, token: string): Promise<void> {
	const identity = await ensureDeviceIdentity();
	const publicKeyBase64 = await exportPublicKeyBase64(identity.publicKey);

	const config: ConnectionConfig = {
		url,
		token,
		instanceId: tabInstanceId,
		device: { id: identity.deviceId, publicKeyBase64, privateKey: identity.privateKey }
	};

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
	(window as unknown as Record<string, unknown>).__oc = {
		call,
		connection,
		snapshot,
		eventBus,
		canvasStore,
		testCanvasPresent: (title?: string) => {
			const surfaceId = `test-${crypto.randomUUID().slice(0, 8)}`;
			canvasStore.handleCommand('canvas.present', {
				surfaceId,
				title: title ?? `Test Canvas ${new Date().toLocaleTimeString()}`
			});
			console.log(`[test] Created test surface: ${surfaceId}`);
			return surfaceId;
		},
		testCanvasPush: (surfaceId: string, messages?: unknown[]) => {
			const defaultMessages = [
				{
					type: 'surfaceUpdate',
					componentType: 'text',
					id: 'test-1',
					content: 'Hello from test!'
				},
				{ type: 'data', key: 'testData', data: { value: 42 } }
			];
			canvasStore.handleCommand('canvas.a2ui.pushJSONL', {
				surfaceId,
				messages: messages ?? defaultMessages
			});
			console.log(`[test] Pushed messages to surface: ${surfaceId}`);
		}
	};
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
