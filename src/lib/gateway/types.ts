// Connection states
export type ConnectionState =
	| 'DISCONNECTED'
	| 'CONNECTING'
	| 'AUTHENTICATING'
	| 'CONNECTED'
	| 'PAIRING_REQUIRED'
	| 'AUTH_FAILED'
	| 'READY'
	| 'RECONNECTING';

// Frame types
export interface RequestFrame {
	type: 'req';
	id: string;
	method: string;
	params?: Record<string, unknown>;
}

export interface ResponseFrame {
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

export interface EventFrame {
	type: 'event';
	event: string;
	payload: Record<string, unknown>;
	seq?: number;
	stateVersion?: number;
}

export type Frame = RequestFrame | ResponseFrame | EventFrame;

// Connection config
export interface ConnectionConfig {
	url: string;
	token: string;
	instanceId?: string;
}

// Hello-OK payload
export interface HelloOkPayload {
	type: 'hello-ok';
	protocol: number;
	server: {
		version: string;
		host: string;
		connId: string;
	};
	features: {
		methods: string[];
	};
	policy: {
		maxPayload: number;
		maxBufferedBytes: number;
		tickIntervalMs: number;
	};
	snapshot: {
		presence: unknown[];
		health: Record<string, unknown>;
		stateVersion: Record<string, number>;
		uptimeMs?: number;
		configPath?: string;
		stateDir?: string;
		sessionDefaults?: Record<string, unknown>;
	};
	auth?: {
		deviceToken?: string;
		role: string;
		scopes: string[];
	};
}

// Challenge payload
export interface ChallengePayload {
	nonce: string;
	ts: number;
}
