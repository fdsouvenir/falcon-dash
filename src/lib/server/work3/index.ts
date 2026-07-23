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
export {
	humanAuthorityPreGuard,
	setAuthoritySourceResolver,
	extractAuthoritySource,
	HUMAN_AUTHORITY_SOURCE_KINDS
} from './engine/authority.js';
export {
	mintAgentToken,
	revokeAgentToken,
	listAgentTokens,
	resolveBearerActor,
	getTokenFilePath,
	getTokenFileDir
} from './auth.js';
export { personActorFromRequest, executePersonCommand } from './person.js';
export {
	registerObjectReader,
	getObjectReader,
	listObjectTypes,
	validateReadOptions,
	projectFields,
	resetObjectReadersForTests
} from './read/registry.js';
export type { ObjectReadDefinition, ReadOptions, ReadView } from './read/registry.js';
export { ulid } from './ulid.js';

export {
	registerWork3Objects,
	loadArea,
	requireActiveArea,
	loadTask,
	legalCommandsFor,
	loadBlocker,
	TASK_STATUSES,
	TASK_PRIORITIES,
	BLOCKER_SOURCE_KINDS
} from './objects/index.js';
export type { TaskRow, TaskStatus, BlockerRow } from './objects/index.js';
export {
	activeBlockersFor,
	activeBlockersForMany,
	isBlocked,
	taskActionability,
	activeWorkCountForArea
} from './read/derived.js';

import { getWork3Db, getWork3EventsDb } from './db.js';
import { startWork3OutboxWorker } from './outbox.js';
import { registerWork3Objects } from './objects/index.js';

let started = false;

/**
 * Idempotent module startup: open both databases (applying migrations),
 * register object commands/readers, and start the outbox transfer worker.
 * Called from hooks.server.ts.
 */
export function startWork3(): void {
	if (started) return;
	started = true;
	getWork3Db();
	getWork3EventsDb();
	registerWork3Objects();
	startWork3OutboxWorker();
}

export function resetWork3StartedForTests(): void {
	started = false;
}
