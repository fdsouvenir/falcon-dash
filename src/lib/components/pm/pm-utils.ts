import { formatRelativeTime as formatRelativeTimeMs } from '$lib/chat/time-utils.js';

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
