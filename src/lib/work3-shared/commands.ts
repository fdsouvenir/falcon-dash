/**
 * Shared semantic-command manifest (doc 06): consumed by the CLI for verbs and
 * help, and asserted against the server registry by a drift test — the two
 * surfaces cannot diverge silently. No server imports.
 */

export interface Work3CommandMeta {
	name: string;
	/** Entity type the command targets; null for creation commands. */
	target:
		| 'task'
		| 'area'
		| 'blocker'
		| 'question'
		| 'decision'
		| 'finding'
		| 'plan'
		| 'review'
		| 'authorization'
		| 'change_request'
		| null;
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
	},
	// Question
	{
		name: 'create_question',
		target: null,
		summary: 'Create a Question (missing knowledge that materially affects work)',
		required: ['question', 'area_id'],
		optional: [
			'context',
			'impact',
			'priority',
			'steward',
			'answerable_by',
			'working_hypothesis',
			'target_at'
		]
	},
	{
		name: 'update_question',
		target: 'question',
		summary: 'Edit Question context/impact/steward fields (never lifecycle)',
		required: [],
		optional: [
			'context',
			'impact',
			'priority',
			'steward',
			'answerable_by',
			'working_hypothesis',
			'target_at'
		]
	},
	{
		name: 'answer_question',
		target: 'question',
		summary: 'Answer a Question (immutable answer revision; supported answers need sources)',
		required: ['answer', 'confidence'],
		optional: ['source_refs']
	},
	{
		name: 'revise_answer',
		target: 'question',
		summary: 'Revise an answer (prior revision preserved; lifecycle stays answered)',
		required: ['answer', 'confidence'],
		optional: ['source_refs']
	},
	{
		name: 'withdraw_question',
		target: 'question',
		summary: 'Withdraw an unanswered Question (requires a reason)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'reopen_question',
		target: 'question',
		summary: 'Reopen an answered/withdrawn Question (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Decision
	{
		name: 'create_decision',
		target: null,
		summary: 'Create a decision-ready Decision directly as pending',
		required: [
			'area_id',
			'title',
			'prompt',
			'consequence_of_no_decision',
			'deciders',
			'options',
			'recommendation'
		],
		optional: ['context', 'stakes', 'priority', 'needed_by']
	},
	{
		name: 'revise_decision',
		target: 'decision',
		summary: 'Replace a pending/deferred package with a new immutable revision',
		required: [
			'title',
			'prompt',
			'consequence_of_no_decision',
			'deciders',
			'options',
			'recommendation'
		],
		optional: ['context', 'stakes']
	},
	{
		name: 'decide',
		target: 'decision',
		summary: 'Record the immutable Decision outcome (requires human authority basis)',
		required: ['option_id', 'rationale'],
		optional: ['authority_source']
	},
	{
		name: 'defer_decision',
		target: 'decision',
		summary: 'Defer a pending Decision (requires a reason)',
		required: ['reason'],
		optional: ['until']
	},
	{
		name: 'resume_decision',
		target: 'decision',
		summary: 'Resume a deferred Decision to pending',
		required: [],
		optional: []
	},
	{
		name: 'withdraw_decision',
		target: 'decision',
		summary: 'Withdraw a pending/deferred Decision (requires a reason)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'supersede_decision',
		target: 'decision',
		summary: 'Create a new pending Decision superseding a decided one',
		required: [
			'title',
			'prompt',
			'consequence_of_no_decision',
			'deciders',
			'options',
			'recommendation'
		],
		optional: ['context', 'stakes', 'needed_by']
	},
	// Finding
	{
		name: 'create_finding',
		target: null,
		summary: 'Record a durable evidence-backed conclusion (sources required)',
		required: ['title', 'conclusion', 'confidence', 'source_refs'],
		optional: ['significance', 'targets', 'observed_at', 'area_id']
	},
	{
		name: 'supersede_finding',
		target: 'finding',
		summary: 'Replace a Finding with a corrected one (history preserved)',
		required: ['title', 'conclusion', 'confidence', 'source_refs'],
		optional: ['significance', 'targets', 'observed_at', 'area_id']
	},
	{
		name: 'retract_finding',
		target: 'finding',
		summary: 'Retract a Finding (requires reason; corrective sources when applicable)',
		required: ['reason'],
		optional: ['source_refs']
	},
	// Plan
	{
		name: 'create_plan',
		target: null,
		summary: 'Create a Plan (draft revision 1) attached to a piece of Work',
		required: ['work_item_id', 'title', 'steps'],
		optional: ['summary', 'assumptions', 'risks', 'out_of_scope', 'validation_checks']
	},
	{
		name: 'update_plan',
		target: 'plan',
		summary: 'Edit the draft revision in place (drafts only — submitted Plans are immutable)',
		required: [],
		optional: [
			'title',
			'summary',
			'steps',
			'assumptions',
			'risks',
			'out_of_scope',
			'validation_checks'
		]
	},
	{
		name: 'submit_plan',
		target: 'plan',
		summary:
			'Submit the draft revision (immutable from now; supersedes the prior submitted revision)',
		required: [],
		optional: []
	},
	{
		name: 'revise_plan',
		target: 'plan',
		summary: 'Create a linked draft replacement for the submitted revision',
		required: [],
		optional: ['summary', 'steps', 'assumptions', 'risks', 'out_of_scope', 'validation_checks']
	},
	{
		name: 'withdraw_plan',
		target: 'plan',
		summary: 'Withdraw the current Plan revision (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Review
	{
		name: 'create_review',
		target: null,
		summary: 'Record an immutable Review of an exact subject revision',
		required: ['subject_id', 'subject_revision', 'outcome', 'summary'],
		optional: ['comments', 'source_refs']
	},
	// Change Request + Authorization
	{
		name: 'create_change',
		target: null,
		summary: 'Create a Change Request with its complete authority-ready package and Plan',
		required: [
			'area_id',
			'title',
			'scope_allowed',
			'targets',
			'risk',
			'acceptance_criteria',
			'plan'
		],
		optional: ['summary', 'scope_prohibited', 'safety']
	},
	{
		name: 'revise_change',
		target: 'change_request',
		summary: 'Replace the authority-ready package (invalidates pinned Authorization)',
		required: ['scope_allowed', 'targets', 'risk', 'acceptance_criteria'],
		optional: ['scope_prohibited', 'safety']
	},
	{
		name: 'authorize_change',
		target: 'change_request',
		summary: 'Grant Authorization pinned to the exact Change + Plan revisions and scope',
		required: [],
		optional: ['conditions', 'expires_at', 'one_time', 'authority_source', 'source_refs']
	},
	{
		name: 'revoke_authorization',
		target: 'authorization',
		summary: 'Revoke an Authorization (requires reason and human authority basis)',
		required: ['reason'],
		optional: ['authority_source']
	},
	{
		name: 'start_change',
		target: 'change_request',
		summary: 'Begin controlled execution (requires valid Authorization, unblocked)',
		required: [],
		optional: []
	},
	{
		name: 'pause_change',
		target: 'change_request',
		summary: 'Pause execution deliberately',
		required: [],
		optional: []
	},
	{
		name: 'resume_change',
		target: 'change_request',
		summary: 'Resume paused execution (authorization rechecked)',
		required: [],
		optional: []
	},
	{
		name: 'succeed_execution',
		target: 'change_request',
		summary: 'Record successful execution (requires result summary; consumes one-time authority)',
		required: ['result_summary'],
		optional: []
	},
	{
		name: 'fail_execution',
		target: 'change_request',
		summary: 'Record execution failure (requires failure summary)',
		required: ['failure_summary'],
		optional: []
	},
	{
		name: 'retry_change',
		target: 'change_request',
		summary: 'Retry failed execution (legal only inside current Authorization)',
		required: [],
		optional: []
	},
	{
		name: 'cancel_change',
		target: 'change_request',
		summary: 'Cancel the Change (requires a reason; preserves history)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'start_verification',
		target: 'change_request',
		summary: 'Begin verifying acceptance criteria (execution must have succeeded)',
		required: [],
		optional: []
	},
	{
		name: 'pass_verification',
		target: 'change_request',
		summary: 'Pass verification (every criterion satisfied with sources, or waived)',
		required: [],
		optional: ['criteria_evidence']
	},
	{
		name: 'fail_verification',
		target: 'change_request',
		summary: 'Fail verification (requires summary of what failed)',
		required: ['summary'],
		optional: []
	},
	{
		name: 'waive_verification',
		target: 'change_request',
		summary: 'Waive verification with authority and rationale (authority-creating)',
		required: ['reason'],
		optional: ['authority_source']
	},
	{
		name: 'start_rollback',
		target: 'change_request',
		summary: 'Begin rolling back an executed Change (history preserved)',
		required: [],
		optional: []
	},
	{
		name: 'complete_rollback',
		target: 'change_request',
		summary: 'Record completed rollback (execution becomes rolled_back)',
		required: ['summary'],
		optional: []
	}
];

export function commandMeta(name: string): Work3CommandMeta | undefined {
	return WORK3_COMMANDS.find((command) => command.name === name);
}
