// Settings Module Types
// Reference: builddocs/falcon-dash-architecture-v02.md §17

// --- Config Types ---

export interface ConfigSchema {
	properties: Record<string, ConfigSchemaProperty>;
	required?: string[];
}

export interface ConfigSchemaProperty {
	type: string;
	description?: string;
	default?: unknown;
	enum?: string[];
	properties?: Record<string, ConfigSchemaProperty>;
	items?: ConfigSchemaProperty;
}

export interface ConfigSnapshot {
	payload: Record<string, unknown>;
	hash: string;
}

export interface ConfigPatchParams {
	key: string;
	[field: string]: unknown;
}

export interface ConfigApplyParams {
	payload: Record<string, unknown>;
	baseHash: string;
}

// --- Skill Types ---

export interface SkillEntry {
	id: string;
	name: string;
	version: string;
	description?: string;
	enabled: boolean;
	config?: Record<string, unknown>;
	requiredConfig?: string[];
}

export interface SkillStatusResponse {
	skills: SkillEntry[];
}

// --- Node Types ---

export interface NodeCapabilities {
	models?: string[];
	tools?: string[];
	maxConcurrency?: number;
}

export interface NodeEntry {
	id: string;
	name: string;
	status: 'online' | 'offline' | 'connecting';
	capabilities: NodeCapabilities;
	lastSeen?: number;
	version?: string;
}

export interface NodeListResponse {
	nodes: NodeEntry[];
}

export interface NodeDescribeResponse {
	node: NodeEntry;
}

// --- Device Types ---

export interface DeviceEntry {
	id: string;
	name: string;
	role: string;
	status: 'pending' | 'approved' | 'rejected' | 'revoked';
	lastSeen?: number;
	createdAt: number;
}

export interface DevicePairRequest {
	deviceId: string;
	name: string;
	role: string;
}

export interface DeviceListResponse {
	devices: DeviceEntry[];
}

// --- Exec Approval Types ---

export interface ExecApproval {
	id: string;
	command: string;
	requestedAt: number;
	status: 'pending' | 'approved' | 'denied';
	approvedBy?: string;
}

export interface ExecAllowlistEntry {
	pattern: string;
	description?: string;
	addedAt: number;
}

// --- Log Types ---

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
	timestamp: number;
	level: LogLevel;
	message: string;
	source?: string;
}

export interface LogTailParams {
	cursor?: string;
	limit?: number;
	level?: LogLevel;
}

export interface LogTailResponse {
	entries: LogEntry[];
	cursor: string;
}
