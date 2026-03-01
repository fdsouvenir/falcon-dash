import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { env } from '$env/dynamic/private';
import { ensureServerIdentity, buildSignMessage, signChallenge } from './server-device-identity.js';

const PROTOCOL_VERSION = 3;
const CLIENT_ID = 'gateway-client';
const CLIENT_MODE = 'ui';
const CLIENT_VERSION = '0.1.0';

const BACKOFF_BASE_MS = 800;
const BACKOFF_MULTIPLIER = 1.7;
const BACKOFF_CAP_MS = 15_000;

export type GatewayState = 'connecting' | 'ready' | 'disconnected';

export interface EventFrame {
	type: 'event';
	event: string;
	payload: Record<string, unknown>;
	seq?: number;
	stateVersion?: number;
}

interface ResponseFrame {
	type: 'res';
	id: string;
	ok: boolean;
	payload?: Record<string, unknown>;
	error?: {
		code: string;
		message: string;
		details?: unknown;
		retryable?: boolean;
		retryAfterMs?: number;
	};
}

interface ChallengePayload {
	nonce: string;
	ts: number;
}

export interface HelloOkPayload {
	type: 'hello-ok';
	protocol: number;
	server: { version: string; host: string; connId: string };
	features: { methods: string[] };
	policy: { maxPayload: number; maxBufferedBytes: number; tickIntervalMs: number };
	snapshot: {
		presence: unknown[];
		health: Record<string, unknown>;
		stateVersion: Record<string, number>;
		uptimeMs?: number;
		configPath?: string;
		stateDir?: string;
		sessionDefaults?: Record<string, unknown>;
	};
	auth?: { deviceToken?: string; role: string; scopes: string[] };
}

type EventHandler = (event: EventFrame) => void;
type StateHandler = (state: GatewayState) => void;

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

function readGatewayConfig(): { url: string; token: string } {
	const envUrl = env.GATEWAY_URL;
	const envToken = env.GATEWAY_TOKEN;
	if (envUrl && envToken) {
		return { url: envUrl.replace(/^ws/, 'ws'), token: envToken };
	}

	const configPath = join(homedir(), '.openclaw', 'openclaw.json');
	const raw = readFileSync(configPath, 'utf-8');
	const config = JSON.parse(raw);
	const token = config?.gateway?.auth?.token;
	if (!token) throw new Error('No gateway token in ~/.openclaw/openclaw.json');

	const port = config?.gateway?.port ?? 18789;
	const bind = config?.gateway?.bind ?? 'loopback';
	const host = bind === 'loopback' ? '127.0.0.1' : bind;
	return { url: `ws://${host}:${port}`, token };
}

export class GatewayClient {
	private ws: WebSocket | null = null;
	private _state: GatewayState = 'disconnected';
	private _snapshot: HelloOkPayload | null = null;
	private eventHandlers = new Set<EventHandler>();
	private stateHandlers = new Set<StateHandler>();
	private pending = new Map<string, PendingRequest>();
	private counter = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private instanceId = crypto.randomUUID();
	private shouldReconnect = true;
	private tickTimer: ReturnType<typeof setTimeout> | null = null;

	get state(): GatewayState {
		return this._state;
	}

	get snapshot(): HelloOkPayload | null {
		return this._snapshot;
	}

	connect(): void {
		if (this.ws) return;
		this.shouldReconnect = true;

		let config: { url: string; token: string };
		try {
			config = readGatewayConfig();
		} catch (err) {
			console.error('[gateway-client] Failed to read gateway config:', err);
			this.scheduleReconnect();
			return;
		}

		this.setState('connecting');
		console.log(`[gateway-client] Connecting to ${config.url}`);

		const ws = new WebSocket(config.url);
		this.ws = ws;

		ws.on('open', () => {
			// Wait for challenge event
		});

		ws.on('message', (data) => {
			if (this.ws !== ws) return;
			this.handleMessage(data.toString(), config.token);
		});

		ws.on('close', (code, reason) => {
			if (this.ws !== ws) return;
			this.ws = null;
			this.clearTickTimer();
			console.log(`[gateway-client] Disconnected: code=${code} reason=${reason.toString()}`);
			this.cancelAllPending('Connection lost');
			this.setState('disconnected');
			if (this.shouldReconnect) this.scheduleReconnect();
		});

		ws.on('error', (err) => {
			if (this.ws !== ws) return;
			console.error('[gateway-client] WebSocket error:', err.message);
		});
	}

	disconnect(): void {
		this.shouldReconnect = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.clearTickTimer();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.cancelAllPending('Shutting down');
		this.setState('disconnected');
	}

	async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this._state !== 'ready') {
			throw new Error(`Gateway not ready (state: ${this._state})`);
		}

		const id = String(++this.counter);
		const promise = new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`RPC timeout: ${method} (id=${id})`));
			}, 30_000);
			this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
		});

		this.ws.send(JSON.stringify({ type: 'req', id, method, params }));
		return promise;
	}

	onEvent(handler: EventHandler): () => void {
		this.eventHandlers.add(handler);
		return () => {
			this.eventHandlers.delete(handler);
		};
	}

	onStateChange(handler: StateHandler): () => void {
		this.stateHandlers.add(handler);
		return () => {
			this.stateHandlers.delete(handler);
		};
	}

	private setState(state: GatewayState): void {
		if (this._state === state) return;
		this._state = state;
		for (const handler of this.stateHandlers) {
			try {
				handler(state);
			} catch (err) {
				console.error('[gateway-client] State handler error:', err);
			}
		}
	}

	private handleMessage(raw: string, token: string): void {
		let frame: { type: string; [key: string]: unknown };
		try {
			frame = JSON.parse(raw);
		} catch {
			console.error('[gateway-client] Failed to parse frame');
			return;
		}

		// Challenge-response auth
		if (frame.type === 'event' && (frame as unknown as EventFrame).event === 'connect.challenge') {
			console.log('[gateway-client] Challenge received, sending connect frame');
			const challenge = (frame as unknown as EventFrame).payload as unknown as ChallengePayload;
			this.sendConnectFrame(challenge, token);
			return;
		}

		// Connect response
		if (frame.type === 'res' && (frame as unknown as ResponseFrame).id === '__connect') {
			const res = frame as unknown as ResponseFrame;
			if (res.ok && res.payload) {
				const helloOk = res.payload as unknown as HelloOkPayload;
				if (helloOk.type === 'hello-ok') {
					this._snapshot = helloOk;
					this.reconnectAttempt = 0;
					this.setState('ready');
					console.log(
						`[gateway-client] Connected: connId=${helloOk.server?.connId} v=${helloOk.server?.version}`
					);
					this.startTickTimer(helloOk.policy.tickIntervalMs);
				}
			} else {
				console.error('[gateway-client] Auth failed:', res.error);
				this.ws?.close();
			}
			return;
		}

		// RPC response
		if (frame.type === 'res') {
			const res = frame as unknown as ResponseFrame;
			const pending = this.pending.get(res.id);
			if (pending) {
				this.pending.delete(res.id);
				clearTimeout(pending.timer);
				if (res.ok) {
					pending.resolve(res.payload);
				} else {
					const err = new Error(res.error?.message ?? 'RPC error');
					(err as Record<string, unknown>).code = res.error?.code;
					(err as Record<string, unknown>).details = res.error?.details;
					pending.reject(err);
				}
			}
			return;
		}

		// Event frame
		if (frame.type === 'event') {
			const evt = frame as unknown as EventFrame;
			// Reset tick timer on any event (tick events are the heartbeat)
			if (evt.event === 'tick') {
				this.resetTickTimer();
			}
			for (const handler of this.eventHandlers) {
				try {
					handler(evt);
				} catch (err) {
					console.error('[gateway-client] Event handler error:', err);
				}
			}
		}
	}

	private sendConnectFrame(challenge: ChallengePayload, token: string): void {
		const identity = ensureServerIdentity();
		const signedAt = Date.now();
		const scopes = [
			'operator.read',
			'operator.write',
			'operator.admin',
			'operator.approvals',
			'operator.pairing'
		];

		const message = buildSignMessage({
			deviceId: identity.deviceId,
			clientId: CLIENT_ID,
			clientMode: CLIENT_MODE,
			role: 'operator',
			scopes,
			signedAtMs: signedAt,
			token,
			nonce: challenge.nonce
		});
		const signature = signChallenge(message);

		const params = {
			minProtocol: PROTOCOL_VERSION,
			maxProtocol: PROTOCOL_VERSION,
			client: {
				id: CLIENT_ID,
				version: CLIENT_VERSION,
				platform: 'node',
				mode: CLIENT_MODE,
				displayName: 'Falcon Dashboard (Server)',
				instanceId: this.instanceId
			},
			role: 'operator',
			scopes,
			caps: ['canvas', 'canvas.a2ui', 'tool-events'],
			commands: [
				'canvas.present',
				'canvas.hide',
				'canvas.navigate',
				'canvas.a2ui.pushJSONL',
				'canvas.a2ui.reset'
			],
			permissions: {},
			auth: { token },
			device: {
				id: identity.deviceId,
				publicKey: identity.publicKeyBase64,
				signature,
				signedAt,
				nonce: challenge.nonce
			},
			locale: 'en-US',
			userAgent: `falcon-dash-server/${CLIENT_VERSION}`
		};

		const frame = JSON.stringify({ type: 'req', id: '__connect', method: 'connect', params });
		console.log(
			'[gateway-client] Sending connect frame with client.id:',
			CLIENT_ID,
			'mode:',
			CLIENT_MODE
		);
		this.ws?.send(frame);
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) return;
		const delay = Math.min(
			BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempt),
			BACKOFF_CAP_MS
		);
		this.reconnectAttempt++;
		console.log(
			`[gateway-client] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`
		);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.ws = null;
			this.connect();
		}, delay);
	}

	private startTickTimer(tickIntervalMs: number): void {
		this.clearTickTimer();
		const timeout = tickIntervalMs * 2.5;
		this.tickTimer = setTimeout(() => {
			console.warn(`[gateway-client] Tick timeout (${timeout}ms) — reconnecting`);
			this.ws?.close();
		}, timeout);
	}

	private resetTickTimer(): void {
		if (!this.tickTimer || !this._snapshot) return;
		this.startTickTimer(this._snapshot.policy.tickIntervalMs);
	}

	private clearTickTimer(): void {
		if (this.tickTimer) {
			clearTimeout(this.tickTimer);
			this.tickTimer = null;
		}
	}

	private cancelAllPending(reason: string): void {
		for (const [, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error(reason));
		}
		this.pending.clear();
	}
}

// --- Singleton ---
let instance: GatewayClient | null = null;

export function startGatewayClient(): void {
	if (instance) return;
	instance = new GatewayClient();
	instance.connect();
}

export function getGatewayClient(): GatewayClient {
	if (!instance) throw new Error('Gateway client not started — call startGatewayClient() first');
	return instance;
}

// Cleanup on server shutdown
if (typeof process !== 'undefined') {
	const shutdown = () => {
		if (instance) {
			instance.disconnect();
			instance = null;
		}
	};
	process.on('sveltekit:shutdown', shutdown);
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
}
