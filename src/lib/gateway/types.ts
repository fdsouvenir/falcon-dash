// Gateway WS Protocol Types
// Reference: builddocs/ws-protocol.md

// --- Connection States ---

export enum ConnectionState {
	DISCONNECTED = 'DISCONNECTED',
	CONNECTING = 'CONNECTING',
	AUTHENTICATING = 'AUTHENTICATING',
	CONNECTED = 'CONNECTED',
	PAIRING_REQUIRED = 'PAIRING_REQUIRED',
	AUTH_FAILED = 'AUTH_FAILED',
	READY = 'READY',
	RECONNECTING = 'RECONNECTING'
}

// --- Frame Types ---

export type FrameType = 'req' | 'res' | 'event';

export interface RequestFrame {
	type: 'req';
	id: string;
	method: string;
	params?: Record<string, unknown>;
}

export interface ResponseFrameOk {
	type: 'res';
	id: string;
	ok: true;
	payload: Record<string, unknown>;
}

export interface ResponseFrameError {
	type: 'res';
	id: string;
	ok: false;
	error: GatewayError;
}

export type ResponseFrame = ResponseFrameOk | ResponseFrameError;

export interface EventFrame {
	type: 'event';
	event: string;
	payload: Record<string, unknown>;
	seq?: number;
	stateVersion?: number;
}

export type Frame = RequestFrame | ResponseFrame | EventFrame;

// --- Error Shape ---

export interface GatewayError {
	code: string;
	message: string;
	details?: unknown;
	retryable?: boolean;
	retryAfterMs?: number;
}

// --- Connect Params ---

export interface ClientInfo {
	id: 'openclaw-control-ui';
	version: string;
	platform: 'web';
	mode: 'webchat';
	displayName: string;
	instanceId: string;
}

export interface AuthParams {
	token: string;
}

export interface DeviceParams {
	id: string;
	publicKey?: string;
	signature?: string;
	signedAt?: number;
	nonce?: string;
}

export interface ConnectParams {
	minProtocol: number;
	maxProtocol: number;
	client: ClientInfo;
	role: string;
	scopes: string[];
	caps: string[];
	commands: string[];
	permissions: Record<string, unknown>;
	auth: AuthParams;
	locale: string;
	userAgent: string;
	device?: DeviceParams;
}

// --- Hello-OK Response ---

export interface ServerInfo {
	version: string;
	host: string;
	connId: string;
}

export interface Features {
	methods: string[];
}

export interface Policy {
	maxPayload: number;
	maxBufferedBytes: number;
	tickIntervalMs: number;
}

export interface StateVersion {
	presence: number;
	health: number;
}

export interface Snapshot {
	presence: unknown[];
	health: Record<string, unknown>;
	stateVersion: StateVersion;
	uptimeMs: number;
	configPath: string;
	stateDir: string;
	sessionDefaults: Record<string, unknown>;
}

export interface HelloOkAuth {
	deviceToken?: string;
	role: string;
	scopes: string[];
}

export interface HelloOkPayload {
	type: 'hello-ok';
	protocol: number;
	server: ServerInfo;
	features: Features;
	policy: Policy;
	snapshot: Snapshot;
	auth?: HelloOkAuth;
}

// --- Agent Event Types ---

export type AgentEventKind = 'thinking' | 'tool_start' | 'tool_result' | 'text_delta' | 'text_end';

export interface AgentEventThinking {
	kind: 'thinking';
	runId: string;
	sessionKey: string;
	content: string;
}

export interface AgentEventToolStart {
	kind: 'tool_start';
	runId: string;
	sessionKey: string;
	toolName: string;
	args: Record<string, unknown>;
}

export interface AgentEventToolResult {
	kind: 'tool_result';
	runId: string;
	sessionKey: string;
	toolName: string;
	result: unknown;
}

export interface AgentEventTextDelta {
	kind: 'text_delta';
	runId: string;
	sessionKey: string;
	content: string;
}

export interface AgentEventTextEnd {
	kind: 'text_end';
	runId: string;
	sessionKey: string;
}

export type AgentEvent =
	| AgentEventThinking
	| AgentEventToolStart
	| AgentEventToolResult
	| AgentEventTextDelta
	| AgentEventTextEnd;

// --- Chat Types ---

export type MessageRole = 'user' | 'assistant' | 'system' | 'inject';

export interface ThinkingBlock {
	content: string;
	startedAt: number;
	completedAt?: number;
	durationMs?: number;
}

export type ToolCallStatus = 'pending' | 'complete' | 'error';

export interface ToolCall {
	toolName: string;
	args: Record<string, unknown>;
	result?: unknown;
	status: ToolCallStatus;
}

export interface ChatMessage {
	id: string;
	sessionKey: string;
	role: MessageRole;
	content: string;
	timestamp: number;
	runId?: string;
	thinking?: ThinkingBlock[];
	toolCalls?: ToolCall[];
}

// --- Chat Method Params/Responses ---

export interface ChatSendParams {
	sessionKey: string;
	content: string;
	model?: string;
	thinkingLevel?: string;
}

export interface ChatSendAck {
	runId: string;
	status: 'started';
}

export interface ChatHistoryParams {
	sessionKey: string;
	afterSeq?: number;
	limit?: number;
}

export interface ChatHistoryResponse {
	messages: ChatMessage[];
	hasMore: boolean;
}

export interface ChatAbortParams {
	sessionKey: string;
}

export interface ChatInjectParams {
	sessionKey: string;
	role: MessageRole;
	content: string;
}

// --- Session Types ---

export interface Session {
	key: string;
	displayName: string;
	lastMessage?: string;
	unreadCount: number;
	updatedAt: number;
	model?: string;
	thinkingLevel?: string;
}

export interface SessionListParams {
	kinds?: string[];
	limit?: number;
	activeMinutes?: number;
	messageLimit?: number;
}

export interface SessionListResponse {
	sessions: Session[];
}

export interface SessionPatchParams {
	sessionKey: string;
	displayName?: string;
	model?: string;
	thinkingLevel?: string;
}

// --- Agent Run State ---

export type AgentRunStatus = 'running' | 'complete' | 'error';

export interface AgentRunState {
	runId: string;
	sessionKey: string;
	status: AgentRunStatus;
	startedAt: number;
	seq: number;
}

// --- Shutdown Event ---

export interface ShutdownPayload {
	reason: string;
	restartExpectedMs?: number;
}

// --- Models Types ---

export interface ModelInfo {
	id: string;
	name: string;
	provider: string;
}

export interface ModelsListResponse {
	models: ModelInfo[];
}

// --- Gateway Config ---

export interface GatewayConfig {
	url: string;
	token: string;
}
