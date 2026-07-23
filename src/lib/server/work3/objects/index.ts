import { getCommand } from '../engine/registry.js';
import { registerAreaCommands } from './area.js';
import { registerTaskCommands } from './task.js';
import { registerBlockerCommands } from './blocker.js';
import { registerSliceReaders } from './readers.js';

export { loadArea, requireActiveArea } from './area.js';
export { loadTask, legalCommandsFor, TASK_STATUSES, TASK_PRIORITIES } from './task.js';
export type { TaskRow, TaskStatus } from './task.js';
export { loadBlocker, BLOCKER_SOURCE_KINDS } from './blocker.js';
export type { BlockerRow } from './blocker.js';

/**
 * Register all v3 object commands and readers. Idempotent per registry state —
 * safe to call from startWork3() and from tests after a registry reset.
 */
export function registerWork3Objects(): void {
	if (getCommand('create_area')) return;
	registerAreaCommands();
	registerTaskCommands();
	registerBlockerCommands();
	registerSliceReaders();
}
