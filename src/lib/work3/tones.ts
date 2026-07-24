import type { StatusKey } from '$lib/components/ui/design-tokens.js';

export const TONE_MAPS = {
	task: {
		backlog: 'muted',
		ready: 'info',
		in_progress: 'active',
		waiting: 'warning',
		in_review: 'purple',
		completed: 'active',
		cancelled: 'muted'
	},
	question: {
		open: 'warning',
		answered: 'active',
		withdrawn: 'muted'
	},
	decision: {
		pending: 'warning',
		deferred: 'info',
		decided: 'active',
		withdrawn: 'muted'
	},
	change_execution: {
		not_started: 'muted',
		in_progress: 'info',
		paused: 'warning',
		succeeded: 'active',
		failed: 'danger',
		cancelled: 'muted',
		rolled_back: 'purple'
	},
	change_verification: {
		not_started: 'muted',
		in_progress: 'info',
		passed: 'active',
		failed: 'danger',
		waived: 'warning'
	},
	authorization: {
		valid: 'active',
		expired: 'warning',
		revoked: 'danger',
		consumed: 'muted',
		invalidated: 'danger',
		missing: 'warning'
	},
	project: {
		draft: 'muted',
		planned: 'info',
		active: 'active',
		paused: 'warning',
		completed: 'active',
		cancelled: 'muted'
	},
	project_health: {
		on_track: 'active',
		at_risk: 'warning',
		blocked: 'danger',
		unknown: 'muted'
	},
	phase: {
		planned: 'info',
		active: 'active',
		completed: 'active',
		skipped: 'muted'
	},
	milestone: {
		planned: 'info',
		achieved: 'active',
		cancelled: 'muted'
	},
	schedule: {
		none: 'muted',
		due_soon: 'warning',
		overdue: 'danger',
		achieved: 'active'
	},
	plan: {
		draft: 'muted',
		submitted: 'info',
		superseded: 'purple',
		withdrawn: 'muted'
	},
	review: {
		unreviewed: 'muted',
		approved: 'active',
		changes_requested: 'warning',
		rejected: 'danger',
		commented: 'info'
	},
	finding: {
		current: 'active',
		superseded: 'purple',
		retracted: 'muted'
	},
	automaton: {
		ok: 'active',
		paused: 'muted',
		failing: 'danger',
		unreachable: 'danger',
		deleted: 'muted'
	},
	automaton_lifecycle: {
		active: 'active',
		paused: 'warning',
		deleted: 'muted',
		unknown: 'danger'
	},
	automaton_health: {
		ok: 'active',
		paused: 'muted',
		failing: 'danger',
		unreachable: 'danger',
		unknown: 'muted'
	},
	automaton_run: {
		ok: 'active',
		error: 'danger',
		skipped: 'muted',
		unknown: 'muted'
	},
	priority: {
		low: 'muted',
		normal: 'info',
		medium: 'warning',
		high: 'warning',
		urgent: 'danger'
	}
} as const satisfies Record<string, Record<string, StatusKey>>;

export type ToneType = keyof typeof TONE_MAPS;

export function toneFor(type: string, value: string | null | undefined): StatusKey {
	if (!value) return 'muted';
	const map = TONE_MAPS[type as ToneType] as Record<string, StatusKey> | undefined;
	return map?.[value] ?? 'muted';
}
