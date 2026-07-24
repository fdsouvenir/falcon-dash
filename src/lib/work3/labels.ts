import { commandMeta, WORK3_COMMANDS } from '$lib/work3-shared/commands.js';

const commandLabels: Record<string, string> = {
	ready_task: 'Mark ready',
	start_task: 'Start work',
	wait_task: 'Mark waiting',
	resume_task: 'Resume work',
	submit_task_for_review: 'Submit for review',
	accept_task: 'Accept output',
	complete_task: 'Complete task',
	cancel_task: 'Cancel task',
	reopen_task: 'Reopen task',
	update_task: 'Edit task',
	answer_question: 'Answer question',
	revise_answer: 'Revise answer',
	withdraw_question: 'Withdraw question',
	reopen_question: 'Reopen question',
	decide: 'Record decision',
	defer_decision: 'Defer decision',
	resume_decision: 'Resume decision',
	withdraw_decision: 'Withdraw decision',
	revise_decision_package: 'Revise decision package',
	supersede_decision: 'Supersede decision',
	start_change: 'Start execution',
	pause_change: 'Pause execution',
	resume_change: 'Resume execution',
	succeed_change: 'Mark execution successful',
	fail_change: 'Mark execution failed',
	cancel_change: 'Cancel change',
	start_verification: 'Start verification',
	pass_verification: 'Pass verification',
	fail_verification: 'Fail verification',
	waive_verification: 'Waive verification',
	start_rollback: 'Start rollback',
	complete_rollback: 'Complete rollback',
	retract_finding: 'Retract finding',
	supersede_finding: 'Supersede finding',
	revoke_authorization: 'Revoke authorization',
	withdraw_plan: 'Withdraw plan',
	create_phase: 'Add phase',
	create_milestone: 'Add milestone',
	set_current_next_item: 'Set current next item',
	waive_completion_criterion: 'Waive criterion',
	achieve_milestone: 'Mark milestone achieved',
	delete_automaton: 'Delete automaton',
	restore_automaton: 'Restore automaton'
};

const destructiveCommands = new Set([
	'cancel_task',
	'invalidate_blocker',
	'withdraw_question',
	'withdraw_decision',
	'cancel_change',
	'fail_execution',
	'fail_verification',
	'waive_verification',
	'retract_finding',
	'withdraw_plan',
	'revoke_authorization',
	'cancel_project',
	'archive_project',
	'skip_phase',
	'cancel_milestone',
	'waive_completion_criterion',
	'delete_automaton'
]);

const confirmationCommands = new Set([
	...destructiveCommands,
	'resolve_blocker',
	'answer_question',
	'revise_answer',
	'decide',
	'supersede_decision',
	'supersede_finding',
	'submit_plan',
	'create_review',
	'authorize_change',
	'start_change',
	'pause_change',
	'resume_change',
	'succeed_execution',
	'fail_execution',
	'retry_change',
	'start_verification',
	'pass_verification',
	'start_rollback',
	'complete_rollback',
	'accept_task',
	'complete_task',
	'complete_project',
	'complete_phase',
	'achieve_milestone',
	'activate_automaton',
	'pause_automaton',
	'update_automaton',
	'restore_automaton'
]);

export type FieldKind = 'input' | 'textarea' | 'datetime-local' | 'select' | 'json';

export interface FieldHint {
	kind: FieldKind;
	monospace?: boolean;
	options?: Array<{ value: string; label: string }>;
	placeholder?: string;
}

const jsonFields = new Set([
	'source_refs',
	'options',
	'steps',
	'criteria_evidence',
	'completion_criteria',
	'scope_included',
	'scope_excluded',
	'targets',
	'comments',
	'conditions',
	'validation_checks',
	'policies',
	'payload',
	'patch',
	'delivery',
	'authority_source'
]);

const textareaPattern =
	/(reason|summary|answer|rationale|context|impact|outcome|scope|risk|safety|condition|conclusion|significance|question|prompt|stakes|recommendation|description)/;

export function commandLabel(command: string): string {
	return commandLabels[command] ?? humanize(command);
}

export function commandSummary(command: string): string {
	return commandMeta(command)?.summary ?? commandLabel(command);
}

export function isDestructive(command: string): boolean {
	return destructiveCommands.has(command);
}

export function requiresConfirmation(command: string): boolean {
	return confirmationCommands.has(command);
}

export function fieldLabel(field: string): string {
	const labels: Record<string, string> = {
		area_id: 'Area',
		project_id: 'Project',
		phase_id: 'Phase',
		item_id: 'Work item',
		work_id: 'Work item',
		option_id: 'Option',
		source_refs: 'Sources',
		authority_source: 'Authority source',
		criteria_evidence: 'Criteria evidence',
		resume_condition: 'Resume when',
		waiting_on: 'Waiting on',
		target_at: 'Target date',
		needed_by: 'Needed by',
		due_at: 'Due date'
	};
	return labels[field] ?? humanize(field);
}

export function fieldHint(field: string): FieldHint {
	if (jsonFields.has(field)) {
		return {
			kind: 'json',
			monospace: true,
			placeholder:
				field === 'source_refs'
					? '[]'
					: field === 'authority_source'
						? '{"kind":"human_statement","ref":"...","summary":"..."}'
						: undefined
		};
	}
	if (field === 'priority') {
		return {
			kind: 'select',
			options: ['low', 'normal', 'high', 'urgent'].map((value) => ({
				value,
				label: humanize(value)
			}))
		};
	}
	if (field === 'confidence') {
		return {
			kind: 'select',
			options: ['tentative', 'supported', 'confirmed'].map((value) => ({
				value,
				label: humanize(value)
			}))
		};
	}
	if (field.endsWith('_at') || field.endsWith('_until') || field === 'until') {
		return { kind: 'datetime-local' };
	}
	if (textareaPattern.test(field)) return { kind: 'textarea' };
	return { kind: 'input' };
}

export function allCommandsHaveLabels(): boolean {
	return WORK3_COMMANDS.every((command) => commandLabel(command.name).length > 0);
}

function humanize(value: string): string {
	return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
