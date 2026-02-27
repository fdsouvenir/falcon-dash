export { GatewayConnection } from './connection.js';
export { RequestCorrelator, GatewayRequestError } from './correlator.js';
export { EventBus } from './event-bus.js';
export { SnapshotStore } from './snapshot-store.js';
export { Reconnector } from './reconnector.js';
export { DiagnosticLog, diagnosticLog } from './diagnostic-log.js';
export type { PresenceEntry, SessionDefaults } from './snapshot-store.js';
export type { GatewayError, CorrelatorMetrics } from './correlator.js';
export type { ReconnectorMetrics } from './reconnector.js';
export type { DiagnosticEvent, DiagnosticCategory, DiagnosticLevel } from './diagnostic-log.js';
export type { DiagnosticCallback } from './connection.js';
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
