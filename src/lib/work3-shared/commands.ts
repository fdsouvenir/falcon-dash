/**
 * Shared semantic-command manifest (doc 06): consumed by the CLI for verbs and
 * help, and asserted against the server registry by a drift test — the two
 * surfaces cannot diverge silently. No server imports.
 */

export interface Work3CommandMeta {
	name: string;
	/** Entity type the command targets; null for creation commands. */
	target: 'task' | 'area' | 'blocker' | null;
	summary: string;
	/** Required payload fields. */
	required: string[];
	/** Optional payload fields. */
	optional: string[];
}

export const WORK3_COMMANDS: Work3CommandMeta[] = [
	// Area
	{
		name: 'create_area',
		target: null,
		summary: 'Create an Area (durable sphere of responsibility)',
		required: ['title'],
		optional: ['summary']
	},
	{
		name: 'update_area',
		target: 'area',
		summary: 'Edit Area title/summary (never lifecycle)',
		required: [],
		optional: ['title', 'summary']
	},
	{
		name: 'archive_area',
		target: 'area',
		summary: 'Archive an Area (Work must be reassigned or explicitly excepted)',
		required: [],
		optional: ['exception_reason']
	},
	{
		name: 'restore_area',
		target: 'area',
		summary: 'Restore an archived Area to active',
		required: [],
		optional: []
	},
	// Task
	{
		name: 'create_task',
		target: null,
		summary: 'Create a Task (a concrete action) in an Area',
		required: ['title', 'area_id'],
		optional: ['summary', 'completion_condition', 'priority', 'owner', 'due_at']
	},
	{
		name: 'update_task',
		target: 'task',
		summary: 'Edit Task definition fields (never lifecycle)',
		required: [],
		optional: ['title', 'summary', 'completion_condition', 'priority', 'owner', 'due_at', 'area_id']
	},
	{
		name: 'ready_task',
		target: 'task',
		summary: 'Mark a backlog Task ready to act (requires an owner)',
		required: [],
		optional: ['owner']
	},
	{
		name: 'start_task',
		target: 'task',
		summary: 'Start work on a ready Task (blocked Tasks cannot start)',
		required: [],
		optional: []
	},
	{
		name: 'wait_task',
		target: 'task',
		summary: 'Mark a Task waiting on a named response, event, or time',
		required: ['waiting_on', 'reason', 'resume_condition'],
		optional: ['follow_up_at']
	},
	{
		name: 'resume_task',
		target: 'task',
		summary: 'Resume a waiting Task (clears waiting metadata)',
		required: [],
		optional: ['to']
	},
	{
		name: 'submit_task_for_review',
		target: 'task',
		summary: 'Submit Task output for review (requires a result summary)',
		required: ['result_summary'],
		optional: []
	},
	{
		name: 'accept_task',
		target: 'task',
		summary: 'Accept reviewed Task output and complete the Task',
		required: [],
		optional: []
	},
	{
		name: 'complete_task',
		target: 'task',
		summary: 'Complete a Task directly (requires result summary)',
		required: [],
		optional: ['result_summary']
	},
	{
		name: 'cancel_task',
		target: 'task',
		summary: 'Cancel a Task (requires a reason; preserves history)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'reopen_task',
		target: 'task',
		summary: 'Reopen a terminal Task to ready (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Blocker
	{
		name: 'create_blocker',
		target: null,
		summary: 'Record an explicit constraint preventing actionable Work from proceeding',
		required: ['blocked_id', 'source_kind', 'reason', 'resolution_condition'],
		optional: ['source_work_id', 'source_label', 'unblock_task_id']
	},
	{
		name: 'resolve_blocker',
		target: 'blocker',
		summary: 'Resolve a blocker (requires a summary of what cleared it)',
		required: ['summary'],
		optional: ['source_refs']
	},
	{
		name: 'invalidate_blocker',
		target: 'blocker',
		summary: 'Invalidate a blocker that was wrong or ceased to apply',
		required: ['reason'],
		optional: []
	}
];

export function commandMeta(name: string): Work3CommandMeta | undefined {
	return WORK3_COMMANDS.find((command) => command.name === name);
}
