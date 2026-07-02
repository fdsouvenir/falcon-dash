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
	WorkStatus
} from './types.js';
