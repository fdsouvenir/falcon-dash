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
	BLOCKER_SOURCE_KINDS,
	loadQuestion,
	currentAnswer,
	answerHistory,
	ANSWER_CONFIDENCES,
	loadDecision,
	currentPackage,
	packageHistory,
	loadFinding,
	FINDING_CONFIDENCES,
	loadPlan,
	currentPlanRevision,
	latestDraftRevision,
	planRevisions,
	REVIEW_OUTCOMES,
	loadChange,
	currentChangeRevision,
	changeSubjectState,
	effectiveAuthorization,
	EXECUTION_STATES,
	VERIFICATION_STATES,
	loadProject,
	projectCriteria,
	satisfiedCriteria,
	loadPhase,
	loadMilestone,
	activeLinks,
	RELATIONSHIP_TYPES,
	reconcileTerminal,
	invalidateSatisfiesFrom,
	loadAutomatonAttrs,
	automatonHealth,
	syncAutomatonsOnce
} from './objects/index.js';
export type {
	TaskRow,
	TaskStatus,
	BlockerRow,
	QuestionRow,
	AnswerRow,
	DecisionRow,
	DecisionPackageRow,
	FindingRow,
	PlanRow,
	PlanRevisionRow,
	ChangeRow,
	ChangeRevisionRow,
	ProjectRow,
	CompletionCriterion,
	PhaseRow,
	MilestoneRow,
	RelationshipRow,
	RelationshipType
} from './objects/index.js';
export {
	activeBlockersFor,
	activeBlockersForMany,
	isBlocked,
	taskActionability,
	activeWorkCountForArea
} from './read/derived.js';
export {
	reviewDisposition,
	reviewsFor,
	hasRequiredComments,
	authorizationsFor,
	authorizationEffectiveness,
	scopeFingerprint
} from './read/governance-derived.js';
export type {
	ReviewRow,
	ReviewDisposition,
	AuthorizationRow,
	AuthorizationEffectiveness
} from './read/governance-derived.js';
export { projectHealth, projectProgress, milestoneScheduleState } from './read/project-derived.js';
export type {
	ProjectHealth,
	ProjectProgress,
	MilestoneScheduleState
} from './read/project-derived.js';

export { resolveWork3SourceRef, setSourceKindResolver } from './sources.js';
export { getCronGateway, setCronGatewayForTests } from './cron-gateway.js';
export type { CronGatewayApi, CronJob, CronRun } from './cron-gateway.js';
export type { SourceResolution } from './sources.js';

import { getWork3Db, getWork3EventsDb } from './db.js';
import { startWork3OutboxWorker } from './outbox.js';
import { registerWork3Objects } from './objects/index.js';
import { setAuthoritySourceResolver } from './engine/authority.js';
import { resolveWork3SourceRef } from './sources.js';

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
	// Asserted human-instruction refs must resolve to their native record.
	setAuthoritySourceResolver(async (ref) => (await resolveWork3SourceRef(ref)).available);
	startWork3OutboxWorker();
	subscribeAutomatonRuntimeEvents();
}

let automatonEventsSubscribed = false;

/**
 * Follow gateway `cron` events (doc 06): on any job/run change, refresh
 * snapshots and detect direct deletions. Definition changes are detected by
 * re-reading and comparing updatedAtMs (the audited `configRevision` token
 * does not exist in the installed gateway build).
 */
function subscribeAutomatonRuntimeEvents(): void {
	if (automatonEventsSubscribed) return;
	automatonEventsSubscribed = true;
	// Dynamic import keeps test environments (no gateway singleton) clean.
	import('$lib/server/gateway-client.js')
		.then(({ getGatewayClient }) => {
			const client = getGatewayClient();
			let syncScheduled = false;
			client.onEvent((event: { event: string }) => {
				if (event.event !== 'cron' || syncScheduled) return;
				syncScheduled = true;
				setTimeout(() => {
					syncScheduled = false;
					import('./objects/automaton.js')
						.then((automaton) => automaton.syncAutomatonsOnce())
						.catch((error) => console.error('[work3] automaton sync failed:', error));
				}, 500);
			});
		})
		.catch((error) => console.error('[work3] automaton event subscription failed:', error));
}

export function resetWork3StartedForTests(): void {
	started = false;
}
