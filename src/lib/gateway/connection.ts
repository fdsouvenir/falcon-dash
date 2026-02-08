import { writable, type Readable } from 'svelte/store';
import {
	ConnectionState,
	type ConnectParams,
	type Frame,
	type RequestFrame,
	type ResponseFrame,
	type EventFrame
} from './types';

export type FrameHandler = (frame: Frame) => void;
export type ResponseHandler = (frame: ResponseFrame) => void;
export type EventHandler = (frame: EventFrame) => void;

export class GatewayConnection {
	private ws: WebSocket | null = null;
	private _state = writable<ConnectionState>(ConnectionState.DISCONNECTED);
	private onResponse: ResponseHandler | null = null;
	private onEvent: EventHandler | null = null;

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

	/** Open a WebSocket and send the connect frame */
	connect(url: string, params: ConnectParams): void {
		if (this.ws) {
			this.close();
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
			this.send(connectFrame);
		};

		ws.onmessage = (event: MessageEvent) => {
			this.handleMessage(event.data);
		};

		ws.onclose = () => {
			this.ws = null;
			this._state.set(ConnectionState.DISCONNECTED);
		};

		ws.onerror = () => {
			// onerror is always followed by onclose, so state
			// will transition to DISCONNECTED in onclose handler
		};
	}

	/** Send a frame over the WebSocket */
	send(frame: RequestFrame): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket is not connected');
		}
		this.ws.send(JSON.stringify(frame));
	}

	/** Cleanly close the connection */
	close(): void {
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}
		this._state.set(ConnectionState.DISCONNECTED);
	}

	/** Update the connection state (used by higher-level modules) */
	setState(state: ConnectionState): void {
		this._state.set(state);
	}

	/** Check if the WebSocket is currently open */
	get isOpen(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
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
}
