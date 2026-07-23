export {
	getWork3Db,
	getWork3EventsDb,
	getWork3DbPath,
	getWork3EventsDbPath,
	closeWork3Dbs
} from './db.js';
export { allocateEntityId, insertEntity, loadEntity, bumpEntityVersion } from './envelope.js';
export { appendRevision, currentRevision, revisionHistory } from './revisions.js';
export { onWork3Event, emitWork3Event } from './bus.js';
export {
	startWork3OutboxWorker,
	stopWork3OutboxWorker,
	transferWork3OutboxOnce,
	kickWork3Outbox,
	getWork3OutboxDiagnostics
} from './outbox.js';
export { listWork3Events } from './eventlog.js';
export {
	registerCommand,
	getCommand,
	listCommands,
	listCommandNames,
	resetRegistryForTests
} from './engine/registry.js';
export type {
	CommandDefinition,
	ExecuteContext,
	PreGuardContext,
	DomainEventInput,
	ExecuteOutcome
} from './engine/registry.js';
export { executeCommand } from './engine/execute.js';
export type { CommandInput } from './engine/execute.js';
export { ulid } from './ulid.js';

import { getWork3Db, getWork3EventsDb } from './db.js';
import { startWork3OutboxWorker } from './outbox.js';

let started = false;

/**
 * Idempotent module startup: open both databases (applying migrations) and
 * start the outbox transfer worker. Called from hooks.server.ts.
 */
export function startWork3(): void {
	if (started) return;
	started = true;
	getWork3Db();
	getWork3EventsDb();
	startWork3OutboxWorker();
}

export function resetWork3StartedForTests(): void {
	started = false;
}
