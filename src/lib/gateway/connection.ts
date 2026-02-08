import { writable, type Readable } from 'svelte/store';
import {
	ConnectionState,
	type ConnectParams,
	type Frame,
	type RequestFrame,
	type ResponseFrame,
	type EventFrame,
	type ShutdownPayload
} from './types';

export type ResponseHandler = (frame: ResponseFrame) => void;
export type EventHandler = (frame: EventFrame) => void;
export type DisconnectHandler = (intentional: boolean) => void;

/** Reconnection backoff config */
const BACKOFF_BASE_MS = 800;
const BACKOFF_MULTIPLIER = 1.7;
const BACKOFF_CAP_MS = 15_000;

export class GatewayConnection {
	private ws: WebSocket | null = null;
	private _state = writable<ConnectionState>(ConnectionState.DISCONNECTED);
	private onResponse: ResponseHandler | null = null;
	private onEvent: EventHandler | null = null;
	private onDisconnect: DisconnectHandler | null = null;

	// Reconnection state
	private url: string | null = null;
	private params: ConnectParams | null = null;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private intentionalClose = false;
	private autoReconnect = true;

	// Tick timeout
	private tickIntervalMs = 30_000;
	private tickTimer: ReturnType<typeof setTimeout> | null = null;

	/** Connection state as a Svelte readable store */
	get state(): Readable<ConnectionState> {
		return { subscribe: this._state.subscribe };
	}

	/** Register a handler for response frames */
	setResponseHandler(handler: ResponseHandler): void {
		this.onResponse = handler;
	}

	/** Register a handler for event frames */
	setEventHandler(handler: EventHandler): void {
		this.onEvent = handler;
	}

	/** Register a handler called on disconnect */
	setDisconnectHandler(handler: DisconnectHandler): void {
		this.onDisconnect = handler;
	}

	/** Set the tick interval from hello-ok policy */
	setTickInterval(ms: number): void {
		this.tickIntervalMs = ms;
	}

	/** Reset the tick timeout timer (call on every tick event) */
	resetTickTimer(): void {
		this.clearTickTimer();
		const timeout = this.tickIntervalMs * 2;
		this.tickTimer = setTimeout(() => {
			this.handleTickTimeout();
		}, timeout);
	}

	/** Open a WebSocket and send the connect frame */
	connect(url: string, params: ConnectParams): void {
		this.intentionalClose = false;
		this.url = url;
		this.params = params;

		if (this.ws) {
			this.closeSocket();
		}

		this._state.set(ConnectionState.CONNECTING);

		const ws = new WebSocket(url);
		this.ws = ws;

		ws.onopen = () => {
			this._state.set(ConnectionState.AUTHENTICATING);
			const connectFrame: RequestFrame = {
				type: 'req',
				id: '1',
				method: 'connect',
				params: params as unknown as Record<string, unknown>
			};
			this.sendRaw(connectFrame);
		};

		ws.onmessage = (event: MessageEvent) => {
			this.handleMessage(event.data);
		};

		ws.onclose = () => {
			this.ws = null;
			this.clearTickTimer();

			if (this.intentionalClose) {
				this._state.set(ConnectionState.DISCONNECTED);
				this.onDisconnect?.(true);
				return;
			}

			this.onDisconnect?.(false);
			this.scheduleReconnect();
		};

		ws.onerror = () => {
			// onerror is always followed by onclose
		};
	}

	/** Send a frame over the WebSocket */
	send(frame: RequestFrame): void {
		this.sendRaw(frame);
	}

	/** Cleanly close the connection (no auto-reconnect) */
	close(): void {
		this.intentionalClose = true;
		this.autoReconnect = false;
		this.clearReconnectTimer();
		this.clearTickTimer();
		this.closeSocket();
		this._state.set(ConnectionState.DISCONNECTED);
	}

	/** Update the connection state (used by higher-level modules) */
	setState(state: ConnectionState): void {
		this._state.set(state);
	}

	/** Mark connection as READY and reset backoff */
	setReady(): void {
		this.reconnectAttempt = 0;
		this.autoReconnect = true;
		this._state.set(ConnectionState.READY);
		this.resetTickTimer();
	}

	/** Handle a shutdown event from the gateway */
	handleShutdown(payload: ShutdownPayload): void {
		this.clearTickTimer();
		this.closeSocket();

		const delay = payload.restartExpectedMs ?? BACKOFF_BASE_MS;
		this._state.set(ConnectionState.RECONNECTING);
		this.reconnectTimer = setTimeout(() => {
			this.attemptReconnect();
		}, delay);
	}

	/** Check if the WebSocket is currently open */
	get isOpen(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}

	private sendRaw(frame: RequestFrame): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket is not connected');
		}
		this.ws.send(JSON.stringify(frame));
	}

	private closeSocket(): void {
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
			this.ws.onopen = null;
			this.ws.close();
			this.ws = null;
		}
	}

	private handleMessage(data: string): void {
		let frame: Frame;
		try {
			frame = JSON.parse(data) as Frame;
		} catch {
			return;
		}

		if (frame.type === 'res') {
			this.onResponse?.(frame);
		} else if (frame.type === 'event') {
			this.onEvent?.(frame);
		}
	}

	private handleTickTimeout(): void {
		this.closeSocket();
		this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		if (!this.autoReconnect || !this.url || !this.params) {
			this._state.set(ConnectionState.DISCONNECTED);
			return;
		}

		this._state.set(ConnectionState.RECONNECTING);
		const delay = this.calculateBackoff();
		this.reconnectTimer = setTimeout(() => {
			this.attemptReconnect();
		}, delay);
	}

	private attemptReconnect(): void {
		this.reconnectTimer = null;
		if (!this.url || !this.params) return;
		this.reconnectAttempt++;
		this.connect(this.url, this.params);
	}

	private calculateBackoff(): number {
		const delay = BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempt);
		return Math.min(delay, BACKOFF_CAP_MS);
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private clearTickTimer(): void {
		if (this.tickTimer) {
			clearTimeout(this.tickTimer);
			this.tickTimer = null;
		}
	}
}
