import { resolve } from '$app/paths';

const labelByType: Record<string, string> = {
	task: 'Task',
	question: 'Question',
	open_question: 'Question',
	decision: 'Decision',
	change: 'Change',
	change_request: 'Change',
	finding: 'Finding',
	automaton: 'Automation',
	automation: 'Automation',
	project: 'Project',
	phase: 'Phase',
	milestone: 'Milestone',
	plan: 'Plan',
	review: 'Review',
	authorization: 'Authorization',
	blocker: 'Blocker'
};

export function typeLabel(type: string): string {
	return labelByType[type] ?? humanize(type);
}

export function workHref(type: string, id: string): string {
	if (type === 'task') return resolve('/work/tasks/[id]', { id });
	if (type === 'question' || type === 'open_question') {
		return resolve('/work/questions/[id]', { id });
	}
	if (type === 'decision') return resolve('/work/decisions/[id]', { id });
	if (type === 'change' || type === 'change_request') {
		return resolve('/work/changes/[id]', { id });
	}
	if (type === 'finding') return resolve('/work/findings/[id]', { id });
	if (type === 'automaton' || type === 'automation') {
		return resolve('/work/automations/[id]', { id });
	}
	if (type === 'project') return resolve('/work/projects/[id]', { id });
	return resolve(`/work/browse?type=${encodeURIComponent(type)}&q=${encodeURIComponent(id)}`);
}

function humanize(value: string): string {
	return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
