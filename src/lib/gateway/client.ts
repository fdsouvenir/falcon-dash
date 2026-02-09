import type { Readable } from 'svelte/store';
import { GatewayConnection } from './connection';
import { RequestCorrelator } from './correlator';
import { EventBus } from './events';
import { SnapshotStore } from './snapshot';
import {
	ConnectionState,
	type EventFrame,
	type GatewayConfig,
	type HelloOkPayload,
	type ResponseFrame,
	type ShutdownPayload
} from './types';
import { buildConnectParams, generateInstanceId } from './auth';

type Unsubscribe = () => void;

export class GatewayClient {
	private connection = new GatewayConnection();
	private correlator = new RequestCorrelator();
	private events = new EventBus();
	readonly snapshot = new SnapshotStore();
	private instanceId = generateInstanceId();

	constructor() {
		this.connection.setResponseHandler((frame: ResponseFrame) => {
			this.handleResponse(frame);
		});
		this.connection.setEventHandler((frame: EventFrame) => {
			this.handleEvent(frame);
		});
		this.connection.setDisconnectHandler((intentional: boolean) => {
			this.handleDisconnect(intentional);
		});
	}

	/** Connection state as a Svelte readable store */
	get state(): Readable<ConnectionState> {
		return this.connection.state;
	}

	/** Connect to the gateway and return the hello-ok payload */
	async connect(config: GatewayConfig): Promise<HelloOkPayload> {
		const params = buildConnectParams(config.token, this.instanceId);

		this.connection.connect(config.url, params);

		const payload = await this.waitForHelloOk();
		this.processHelloOk(payload);
		return payload;
	}

	/** Disconnect from the gateway */
	disconnect(): void {
		this.correlator.rejectAll('Disconnected by client');
		this.events.clear();
		this.connection.close();
	}

	/** Send a request and return a typed response Promise */
	async call<T = Record<string, unknown>>(
		method: string,
		params?: Record<string, unknown>
	): Promise<T> {
		const { frame, promise } = this.correlator.send(method, params);
		this.connection.send(frame);
		return promise as Promise<T>;
	}

	/** Subscribe to gateway events */
	on(event: string, handler: (payload: unknown) => void): Unsubscribe {
		return this.events.on(event, handler);
	}

	/** Wait for the next occurrence of an event */
	once(event: string): Promise<unknown> {
		return this.events.once(event);
	}

	private async waitForHelloOk(): Promise<HelloOkPayload> {
		return new Promise<HelloOkPayload>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Hello-OK timeout'));
			}, 10_000);

			const originalHandler = this.connection['onResponse'];

			this.connection.setResponseHandler((frame: ResponseFrame) => {
				if (frame.id === '1') {
					clearTimeout(timeout);
					this.connection.setResponseHandler((f: ResponseFrame) => {
						this.handleResponse(f);
					});

					if (frame.ok) {
						resolve(frame.payload as unknown as HelloOkPayload);
					} else {
						if (frame.error.code === 'PAIRING_REQUIRED') {
							this.connection.setState(ConnectionState.PAIRING_REQUIRED);
						} else {
							this.connection.setState(ConnectionState.AUTH_FAILED);
						}
						reject(new Error(frame.error.message));
					}
				} else {
					originalHandler?.(frame);
				}
			});
		});
	}

	private processHelloOk(payload: HelloOkPayload): void {
		this.connection.setState(ConnectionState.CONNECTED);
		this.snapshot.hydrate(payload.snapshot);
		this.connection.setTickInterval(payload.policy.tickIntervalMs);
		this.connection.setReady();
	}

	private handleResponse(frame: ResponseFrame): void {
		this.correlator.handleResponse(frame);
	}

	private handleEvent(frame: EventFrame): void {
		if (frame.event === 'tick') {
			this.connection.resetTickTimer();
		} else if (frame.event === 'shutdown') {
			this.connection.handleShutdown(frame.payload as unknown as ShutdownPayload);
		} else if (frame.event === 'presence') {
			this.snapshot.updatePresence(frame.payload as unknown as unknown[]);
			if (frame.stateVersion !== undefined) {
				this.snapshot.setStateVersion('presence', frame.stateVersion);
			}
		} else if (frame.event === 'health') {
			this.snapshot.updateHealth(frame.payload);
			if (frame.stateVersion !== undefined) {
				this.snapshot.setStateVersion('health', frame.stateVersion);
			}
		}

		this.events.emit(frame.event, frame.payload);
	}

	private handleDisconnect(intentional: boolean): void {
		this.correlator.rejectAll(intentional ? 'Disconnected by client' : 'Connection lost');
		if (!intentional) {
			this.events.clear();
		}
	}
}

/** Singleton gateway client instance */
export const gateway = new GatewayClient();
