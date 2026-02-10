import { GatewayConnection } from '$lib/gateway/connection.js';
import { RequestCorrelator } from '$lib/gateway/correlator.js';
import { EventBus } from '$lib/gateway/event-bus.js';
import { SnapshotStore } from '$lib/gateway/snapshot-store.js';
import { Reconnector } from '$lib/gateway/reconnector.js';
import type { Frame } from '$lib/gateway/types.js';

export const connection = new GatewayConnection();
export const correlator = new RequestCorrelator();
export const eventBus = new EventBus();
export const snapshot = new SnapshotStore();
export const reconnector = new Reconnector(connection, eventBus);

// Wire frame handling: correlator first, then event bus
connection.onFrame((frame: Frame) => {
	if (correlator.handleFrame(frame)) return;
	eventBus.handleFrame(frame);
});

// Wire hello-ok callback: hydrate snapshot, enable reconnection
connection.setOnHelloOk((helloOk) => {
	snapshot.hydrate(helloOk);
	snapshot.subscribe(eventBus);
	reconnector.onConnected(helloOk.policy.tickIntervalMs);
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
