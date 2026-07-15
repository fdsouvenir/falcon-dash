export {
	closeWorkDb,
	ensureWorkSchema,
	getLegacyPmDbPath,
	getWorkDb,
	getWorkDbPath,
	openLegacyPmDb,
	resetWorkSchemaForTests
} from './database.js';
export {
	WorkError,
	addEvidenceRef,
	createWorkRelationship,
	deleteWorkRelationship,
	createWorkBlockerLink,
	createWorkItem,
	deleteWorkBlockerLink,
	deleteWorkCategory,
	getWorkBlockerLink,
	getWorkArea,
	getWorkCategory,
	getWorkItem,
	getWorkItemByLegacy,
	listWorkAreas,
	listWorkBlockerLinks,
	listWorkChangeLog,
	listWorkCategories,
	listWorkItems,
	listWorkQueue,
	listWorkRelationships,
	listWorkRelationshipsForItems,
	recordWorkChangeLog,
	updateWorkBlockerLink,
	updateWorkItem,
	upsertWorkArea,
	upsertWorkCategory
} from './crud.js';
export { applyWorkMigration, isWorkSourceOfTruth, previewWorkMigration } from './migration.js';
export { generateWorkContext, generateWorkItemContext } from './context.js';
export { generateAndWriteContext, getWorkContextDir } from './context-writer.js';
export { triggerContextGeneration } from './context-scheduler.js';
export { runReconciliationSweep } from './reconciliation-scheduler.js';
export {
	createContextualAgentSession,
	ensureRelationship,
	hasStaleRiskForProject,
	listReconciliationRunsForItem,
	reconcileWorkItem
} from './reconciliation.js';
export { emitWorkEvent, getRecentWorkEvents, getWorkStateVersion, onWorkEvent } from './events.js';
export { getFalconDashModules, FALCON_DASH_MODULES } from './module.js';
export type {
	WorkArea,
	WorkBlockerLink,
	WorkBlockerSource,
	WorkBlockerStatus,
	WorkCategory,
	WorkCategoryDeleteResult,
	WorkCategoryKind,
	WorkChange,
	WorkChangeAction,
	WorkChangeEntityType,
	WorkChangeLogEntry,
	WorkContextResponse,
	WorkEvidenceRef,
	WorkItem,
	WorkItemType,
	WorkMigrationMap,
	WorkMigrationPreview,
	WorkPriority,
	WorkQueue,
	WorkReconciliationRun,
	WorkReconciliationRunView,
	WorkReconciliationStatus,
	WorkRelationship,
	WorkRelationType,
	WorkStatus
} from './types.js';
