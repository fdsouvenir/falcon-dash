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
	todo: 'border-l-gray-500',
	in_progress: 'border-l-blue-500',
	review: 'border-l-amber-500',
	done: 'border-l-green-500',
	cancelled: 'border-l-red-500',
	archived: 'border-l-gray-700'
};

/** Small dot background color classes keyed by status. */
export const STATUS_DOT: Record<string, string> = {
	todo: 'bg-gray-500',
	in_progress: 'bg-blue-500',
	review: 'bg-amber-500',
	done: 'bg-green-500',
	cancelled: 'bg-red-500',
	archived: 'bg-gray-700'
};

/** Badge classes (bg + text) keyed by status, for detail view headers. */
export const STATUS_BADGE: Record<string, string> = {
	todo: 'bg-gray-600 text-gray-200',
	in_progress: 'bg-blue-600 text-blue-100',
	review: 'bg-amber-600 text-amber-100',
	done: 'bg-green-600 text-green-100',
	cancelled: 'bg-red-600 text-red-100',
	archived: 'bg-gray-700 text-gray-400'
};

/** Returns a priority dot indicator for high/urgent, or null for normal/low. */
export function getPriorityIndicator(
	priority: string | null
): { dot: string; pulse: boolean; label: string } | null {
	if (priority === 'urgent') return { dot: 'bg-red-500', pulse: true, label: 'urgent' };
	if (priority === 'high') return { dot: 'bg-orange-400', pulse: false, label: 'high' };
	return null;
}

/** Returns a labeled priority badge with classes. Always returns a value (normal shows as dash). */
export function getPriorityBadge(priority: string | null): { classes: string; label: string } {
	if (priority === 'urgent') return { classes: 'bg-red-500/20 text-red-400', label: 'urgent' };
	if (priority === 'high') return { classes: 'bg-orange-400/20 text-orange-300', label: 'high' };
	return { classes: 'text-gray-600', label: '\u2014' };
}

/** Format a status string for display (replace underscores with spaces). */
export function formatStatusLabel(status: string): string {
	return status.replace('_', ' ');
}

/** Translucent pill classes keyed by status, for inline row use. */
export const STATUS_PILL: Record<string, string> = {
	todo: 'bg-gray-500/15 text-gray-400',
	in_progress: 'bg-blue-500/15 text-blue-400',
	review: 'bg-amber-500/15 text-amber-400',
	done: 'bg-green-500/15 text-green-400',
	cancelled: 'bg-red-500/15 text-red-400',
	archived: 'bg-gray-700/15 text-gray-500'
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
	if (priority === 'urgent') return { classes: 'bg-red-500/20 text-red-400', label: 'urgent' };
	if (priority === 'high') return { classes: 'bg-orange-400/20 text-orange-300', label: 'high' };
	return null;
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
		return { text: `${abs}d overdue`, color: 'text-red-400' };
	}
	if (diffDays === 0) return { text: 'today', color: 'text-amber-400' };
	if (diffDays === 1) return { text: 'tomorrow', color: 'text-amber-400' };
	if (diffDays <= 7) return { text: `in ${diffDays}d`, color: 'text-amber-400' };
	const month = due.toLocaleString('en-US', { month: 'short' });
	return { text: `${month} ${due.getDate()}`, color: 'text-gray-500' };
}
