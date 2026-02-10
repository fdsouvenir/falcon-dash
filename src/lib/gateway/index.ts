export { GatewayConnection } from './connection.js';
export { RequestCorrelator, GatewayRequestError } from './correlator.js';
export { EventBus } from './event-bus.js';
export type { GatewayError } from './correlator.js';
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
