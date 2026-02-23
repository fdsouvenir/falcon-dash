// Barrel re-exports for PM server module
export { getDb, closeDb } from './database.js';
export type { Domain, Focus, Project, Activity } from './database.js';

export {
	listDomains,
	getDomain,
	createDomain,
	updateDomain,
	deleteDomain,
	reorderDomains,
	listFocuses,
	getFocus,
	createFocus,
	updateFocus,
	deleteFocus,
	reorderFocuses,
	moveFocus,
	listProjects,
	getProject,
	createProject,
	updateProject,
	deleteProject,
	listActivities,
	logActivity
} from './crud.js';

export { searchPM, rebuildSearchIndex } from './search.js';
export type { SearchResult, SearchOptions } from './search.js';

export { getPMStats } from './stats.js';
export type { PMStats } from './stats.js';

export {
	generateDashboardContext,
	generateDomainContext,
	generateProjectContext
} from './context.js';
export type { ContextResponse } from './context.js';

export {
	emitPMEvent,
	onPMEvent,
	getRecentEvents,
	getStateVersion,
	createEventData
} from './events.js';
export type { PMEvent, PMAction, PMEntityType } from './events.js';

export { PMError, PM_ERRORS } from './validation.js';
export { handlePMError } from './errors.js';

export { generateAndWriteContext } from './context-generator.js';
export { startContextScheduler, triggerContextGeneration } from './context-scheduler.js';
