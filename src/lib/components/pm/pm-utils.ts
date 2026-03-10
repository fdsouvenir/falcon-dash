import { formatRelativeTime as formatRelativeTimeMs } from '$lib/utils/time.js';

/**
 * Format a unix-seconds timestamp as relative time.
 * Wraps the chat time-utils function which expects milliseconds.
 */
export function formatRelativeTime(unixSeconds: number): string {
	return formatRelativeTimeMs(unixSeconds * 1000);
}

/** Left border color classes keyed by project/task status. */
export const STATUS_BORDER: Record<string, string> = {
	todo: 'border-l-status-info',
	in_progress: 'border-l-status-active',
	review: 'border-l-status-warning',
	done: 'border-l-status-active',
	cancelled: 'border-l-status-danger',
	archived: 'border-l-status-muted'
};

/** Small dot background color classes keyed by status. */
export const STATUS_DOT: Record<string, string> = {
	todo: 'bg-status-info',
	in_progress: 'bg-status-active',
	review: 'bg-status-warning',
	done: 'bg-status-active',
	cancelled: 'bg-status-danger',
	archived: 'bg-status-muted'
};

/** Badge classes (bg + text) keyed by status, for detail view headers. */
export const STATUS_BADGE: Record<string, string> = {
	todo: 'bg-status-info-bg text-status-info',
	in_progress: 'bg-status-active-bg text-status-active',
	review: 'bg-status-warning-bg text-status-warning',
	done: 'bg-status-active-bg text-status-active',
	cancelled: 'bg-status-danger-bg text-status-danger',
	archived: 'bg-status-muted-bg text-status-muted'
};

/** Returns a priority dot indicator for high/urgent, or null for normal/low. */
export function getPriorityIndicator(
	priority: string | null
): { dot: string; pulse: boolean; label: string } | null {
	if (priority === 'urgent') return { dot: 'bg-status-danger', pulse: true, label: 'urgent' };
	if (priority === 'high') return { dot: 'bg-status-danger', pulse: false, label: 'high' };
	return null;
}

/** Returns a labeled priority badge with classes. Always returns a value (normal shows as dash). */
export function getPriorityBadge(priority: string | null): { classes: string; label: string } {
	if (priority === 'urgent')
		return { classes: 'bg-status-danger-bg text-status-danger', label: 'urgent' };
	if (priority === 'high')
		return { classes: 'bg-status-danger-bg text-status-danger', label: 'high' };
	return { classes: 'text-status-muted', label: '\u2014' };
}

/** Format a status string for display (replace underscores with spaces). */
export function formatStatusLabel(status: string): string {
	return status.replace('_', ' ');
}

/** Translucent pill classes keyed by status, for inline row use. */
export const STATUS_PILL: Record<string, string> = {
	todo: 'bg-status-info-bg text-status-info',
	in_progress: 'bg-status-active-bg text-status-active',
	review: 'bg-status-warning-bg text-status-warning',
	done: 'bg-status-active-bg text-status-active',
	cancelled: 'bg-status-danger-bg text-status-danger',
	archived: 'bg-status-muted-bg text-status-muted'
};

/** Returns translucent pill styling + label for a status. */
export function getStatusPill(status: string): { classes: string; label: string } {
	return {
		classes: STATUS_PILL[status] || STATUS_PILL.todo,
		label: formatStatusLabel(status)
	};
}

/** Returns a labeled priority tag for high/urgent, or null for normal/low. */
export function getPriorityTag(priority: string | null): { classes: string; label: string } | null {
	if (priority === 'urgent')
		return { classes: 'bg-status-danger-bg text-status-danger', label: 'urgent' };
	if (priority === 'high')
		return { classes: 'bg-status-danger-bg text-status-danger', label: 'high' };
	return null;
}

/** Plan status formatting and styling utilities. */
export function formatPlanStatusLabel(status: string): string {
	return status.replace('_', ' ');
}

export function getPlanStatusPill(status: string): { classes: string; label: string } {
	const statusMap: Record<string, string> = {
		planning: 'bg-status-info-bg text-status-info',
		assigned: 'bg-status-purple-bg text-status-purple',
		in_progress: 'bg-status-active-bg text-status-active',
		needs_review: 'bg-status-warning-bg text-status-warning',
		complete: 'bg-status-active-bg text-status-active',
		cancelled: 'bg-status-muted-bg text-status-muted'
	};

	return {
		classes: statusMap[status] || statusMap.planning,
		label: formatPlanStatusLabel(status)
	};
}

/**
 * Smart due date formatting with urgency coloring.
 * Returns null when no due date is set.
 */
export function formatDueDate(dueDateStr: string | null): { text: string; color: string } | null {
	if (!dueDateStr) return null;
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const due = new Date(dueDateStr + 'T00:00:00');
	const diffMs = due.getTime() - now.getTime();
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays < 0) {
		const abs = Math.abs(diffDays);
		return { text: `${abs}d overdue`, color: 'text-status-danger' };
	}
	if (diffDays === 0) return { text: 'today', color: 'text-status-warning' };
	if (diffDays === 1) return { text: 'tomorrow', color: 'text-status-warning' };
	if (diffDays <= 7) return { text: `in ${diffDays}d`, color: 'text-status-warning' };
	const month = due.toLocaleString('en-US', { month: 'short' });
	return { text: `${month} ${due.getDate()}`, color: 'text-status-muted' };
}
