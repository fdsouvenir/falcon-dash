import { writable, readonly, type Readable } from 'svelte/store';
import type {
	ConnectionState,
	ConnectionConfig,
	Frame,
	RequestFrame,
	ResponseFrame,
	EventFrame,
	HelloOkPayload,
	ChallengePayload
} from './types.js';

const PROTOCOL_VERSION = 3;
const CLIENT_ID = 'openclaw-control-ui';
const CLIENT_MODE = 'webchat';
const CLIENT_VERSION = '0.1.0';

export class GatewayConnection {
	private ws: WebSocket | null = null;
	private _state = writable<ConnectionState>('DISCONNECTED');
	private _helloOk = writable<HelloOkPayload | null>(null);
	private config: ConnectionConfig | null = null;
	private frameHandlers = new Set<(frame: Frame) => void>();
	private lastChallenge: ChallengePayload | null = null;

	/** Connection state as a Svelte readable store */
	readonly state: Readable<ConnectionState> = readonly(this._state);

	/** Hello-OK payload as a Svelte readable store */
	readonly helloOk: Readable<HelloOkPayload | null> = readonly(this._helloOk);

	/** Connect to the gateway */
	connect(config: ConnectionConfig): void {
		this.config = config;
		this.cleanup();
		this._state.set('CONNECTING');

		const ws = new WebSocket(config.url);
		this.ws = ws;

		ws.addEventListener('open', () => {
			// Wait for challenge event — don't send anything yet
		});

		ws.addEventListener('message', (event: MessageEvent) => {
			this.handleMessage(event);
		});

		ws.addEventListener('close', (event: CloseEvent) => {
			this.handleClose(event);
		});

		ws.addEventListener('error', () => {
			// Error always followed by close, handle there
		});
	}

	/** Disconnect from the gateway */
	disconnect(): void {
		this.cleanup();
		this._state.set('DISCONNECTED');
		this._helloOk.set(null);
	}

	/** Send a raw frame */
	send(frame: RequestFrame): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket is not connected');
		}
		this.ws.send(JSON.stringify(frame));
	}

	/** Register a frame handler (for response correlation and event bus) */
	onFrame(handler: (frame: Frame) => void): () => void {
		this.frameHandlers.add(handler);
		return () => {
			this.frameHandlers.delete(handler);
		};
	}

	private handleMessage(event: MessageEvent): void {
		let frame: Frame;
		try {
			frame = JSON.parse(String(event.data)) as Frame;
		} catch {
			console.error('[GatewayConnection] Failed to parse frame:', event.data);
			return;
		}

		// Handle connect.challenge
		if (frame.type === 'event' && (frame as EventFrame).event === 'connect.challenge') {
			this._state.set('AUTHENTICATING');
			const challenge = (frame as EventFrame).payload as unknown as ChallengePayload;
			this.sendConnectFrame(challenge);
			return;
		}

		// Handle hello-ok response
		if (frame.type === 'res' && (frame as ResponseFrame).id === '1') {
			const res = frame as ResponseFrame;
			if (res.ok && res.payload) {
				const helloOk = res.payload as unknown as HelloOkPayload;
				if (helloOk.type === 'hello-ok') {
					this._helloOk.set(helloOk);
					this._state.set('CONNECTED');
					// Immediately set READY after hello-ok (snapshot is already included)
					this._state.set('READY');
				}
			} else if (!res.ok) {
				this._state.set('AUTH_FAILED');
			}
			return;
		}

		// Dispatch to registered handlers
		for (const handler of this.frameHandlers) {
			try {
				handler(frame);
			} catch (err) {
				console.error('[GatewayConnection] Frame handler error:', err);
			}
		}
	}

	private handleClose(event: CloseEvent): void {
		this.ws = null;
		if (event.code === 1008) {
			// Pairing required
			this._state.set('PAIRING_REQUIRED');
		} else {
			this._state.set('DISCONNECTED');
		}
	}

	private sendConnectFrame(challenge: ChallengePayload): void {
		this.lastChallenge = challenge;
		if (!this.config) return;

		const instanceId = this.config.instanceId || crypto.randomUUID();

		const connectFrame: RequestFrame = {
			type: 'req',
			id: '1',
			method: 'connect',
			params: {
				minProtocol: PROTOCOL_VERSION,
				maxProtocol: PROTOCOL_VERSION,
				client: {
					id: CLIENT_ID,
					version: CLIENT_VERSION,
					platform: 'web',
					mode: CLIENT_MODE,
					displayName: 'Falcon Dashboard',
					instanceId
				},
				role: 'operator',
				scopes: ['operator.read', 'operator.write'],
				caps: [],
				commands: [],
				permissions: {},
				auth: { token: this.config.token },
				locale: navigator?.language || 'en-US',
				userAgent: `falcon-dash/${CLIENT_VERSION}`
			}
		};

		this.send(connectFrame);
	}

	private cleanup(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}
}
