export { GatewayConnection } from './connection.js';
export { RequestCorrelator, GatewayRequestError } from './correlator.js';
export { EventBus } from './event-bus.js';
export { SnapshotStore } from './snapshot-store.js';
export { Reconnector } from './reconnector.js';
export { AgentStreamManager } from './stream.js';
export type { PresenceEntry, SessionDefaults } from './snapshot-store.js';
export type { GatewayError } from './correlator.js';
export type {
	StreamEvent,
	AnyStreamEvent,
	StreamEventType,
	MessageStartEvent,
	DeltaEvent,
	ToolCallEvent,
	ToolResultEvent,
	MessageEndEvent
} from './stream.js';
export type {
	ConnectionState,
	ConnectionConfig,
	Frame,
	RequestFrame,
	ResponseFrame,
	EventFrame,
	HelloOkPayload,
	ChallengePayload
} from './types.js';
