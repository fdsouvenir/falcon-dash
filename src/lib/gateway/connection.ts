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
import { signChallenge } from './device-identity.js';

const PROTOCOL_VERSION = 3;
const CLIENT_ID = 'openclaw-control-ui';
const CLIENT_MODE = 'webchat';
const CLIENT_VERSION = '0.1.0';

export type DiagnosticCallback = (event: string, detail?: Record<string, unknown>) => void;

export class GatewayConnection {
	private ws: WebSocket | null = null;
	private _state = writable<ConnectionState>('DISCONNECTED');
	private _helloOk = writable<HelloOkPayload | null>(null);
	private config: ConnectionConfig | null = null;
	private frameHandlers = new Set<(frame: Frame) => void>();
	private lastChallenge: ChallengePayload | null = null;
	private _onHelloOk: ((helloOk: HelloOkPayload) => void) | null = null;
	private _onClose: ((code: number, reason: string) => void) | null = null;
	private _connId: string | null = null;
	private _diagnosticCb: DiagnosticCallback | null = null;

	/** Connection state as a Svelte readable store */
	readonly state: Readable<ConnectionState> = readonly(this._state);

	/** Hello-OK payload as a Svelte readable store */
	readonly helloOk: Readable<HelloOkPayload | null> = readonly(this._helloOk);

	/** Connection ID from hello-ok (for debugging) */
	get connId(): string | null {
		return this._connId;
	}

	/** Register a callback invoked after hello-ok, before READY. Used to hydrate SnapshotStore. */
	setOnHelloOk(callback: (helloOk: HelloOkPayload) => void): void {
		this._onHelloOk = callback;
	}

	/** Register a callback invoked on unexpected WebSocket close (non-user-initiated). */
	setOnClose(callback: (code: number, reason: string) => void): void {
		this._onClose = callback;
	}

	/** Set a diagnostic callback for state transitions and protocol events */
	setDiagnosticCallback(cb: DiagnosticCallback): void {
		this._diagnosticCb = cb;
	}

	/** Set connection state (used by reconnection logic) */
	setConnectionState(state: ConnectionState): void {
		this._state.set(state);
	}

	/** Connect to the gateway */
	connect(config: ConnectionConfig): void {
		this.config = config;
		this.cleanup();
		this._state.set('CONNECTING');
		this._diagnosticCb?.('connecting', { url: config.url });

		const ws = new WebSocket(config.url);
		this.ws = ws;

		ws.addEventListener('open', () => {
			// Wait for challenge event — don't send anything yet
		});

		ws.addEventListener('message', (event: MessageEvent) => {
			if (this.ws !== ws) return;
			this.handleMessage(event);
		});

		ws.addEventListener('close', (event: CloseEvent) => {
			if (this.ws !== ws) return;
			this.handleClose(event);
		});

		ws.addEventListener('error', () => {
			if (this.ws !== ws) return;
			this._diagnosticCb?.('ws-error');
		});
	}

	/** Disconnect from the gateway */
	disconnect(): void {
		this.cleanup();
		this._state.set('DISCONNECTED');
		this._helloOk.set(null);
		this._connId = null;
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
			this._diagnosticCb?.('parse-error');
			return;
		}

		// Handle connect.challenge
		if (frame.type === 'event' && (frame as EventFrame).event === 'connect.challenge') {
			this._state.set('AUTHENTICATING');
			this._diagnosticCb?.('challenge');
			const challenge = (frame as EventFrame).payload as unknown as ChallengePayload;
			this.sendConnectFrame(challenge);
			return;
		}

		// Handle hello-ok response (connect frame uses '__connect' to avoid correlator ID collision)
		if (frame.type === 'res' && (frame as ResponseFrame).id === '__connect') {
			const res = frame as ResponseFrame;
			if (res.ok && res.payload) {
				const helloOk = res.payload as unknown as HelloOkPayload;
				if (helloOk.type === 'hello-ok') {
					this._helloOk.set(helloOk);
					this._connId = helloOk.server?.connId ?? null;
					this._state.set('CONNECTED');
					this._diagnosticCb?.('hello-ok', {
						connId: helloOk.server?.connId,
						serverVersion: helloOk.server?.version
					});
					// Call onHelloOk callback to hydrate snapshot before setting READY
					if (this._onHelloOk) {
						this._onHelloOk(helloOk);
					}
					this._state.set('READY');
				}
			} else if (!res.ok) {
				this._state.set('AUTH_FAILED');
				this._diagnosticCb?.('auth-failed');
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
			this._diagnosticCb?.('pairing-required', { code: 1008 });
		} else {
			this._state.set('DISCONNECTED');
			this._diagnosticCb?.('close', { code: event.code, reason: event.reason });
			this._onClose?.(event.code, event.reason ?? '');
		}
	}

	private sendConnectFrame(challenge: ChallengePayload): void {
		this.lastChallenge = challenge;
		if (!this.config) return;
		this.buildAndSendConnectFrame(challenge).catch((err) => {
			console.error('[GatewayConnection] Failed to sign challenge:', err);
			this._state.set('AUTH_FAILED');
			this._diagnosticCb?.('device-sign-error', { error: String(err) });
		});
	}

	private async buildAndSendConnectFrame(challenge: ChallengePayload): Promise<void> {
		if (!this.config) return;

		const instanceId = this.config.instanceId || crypto.randomUUID();

		const params: Record<string, unknown> = {
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
			scopes: [
				'operator.read',
				'operator.write',
				'operator.admin',
				'operator.approvals',
				'operator.pairing'
			],
			caps: ['canvas', 'canvas.a2ui'],
			commands: [
				'canvas.present',
				'canvas.hide',
				'canvas.navigate',
				'canvas.a2ui.pushJSONL',
				'canvas.a2ui.reset'
			],
			permissions: {},
			auth: { token: this.config.token },
			locale: navigator?.language || 'en-US',
			userAgent: `falcon-dash/${CLIENT_VERSION}`
		};

		if (this.config.device) {
			const signature = await signChallenge(this.config.device.privateKey, challenge.nonce);
			params.device = {
				id: this.config.device.id,
				publicKey: this.config.device.publicKeyBase64,
				signature,
				signedAt: Date.now()
			};
		}

		const connectFrame: RequestFrame = {
			type: 'req',
			id: '__connect',
			method: 'connect',
			params
		};

		this.send(connectFrame);
	}

	private cleanup(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this._connId = null;
	}
}
