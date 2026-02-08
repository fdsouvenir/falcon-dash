/**
 * Relative and full timestamp formatting utilities for chat messages.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Format a timestamp as a relative string (e.g., "2m ago", "3h ago") */
export function formatRelativeTime(timestamp: number, now?: number): string {
	if (now === undefined) now = Date.now();
	const diff = now - timestamp;

	if (diff < 0) return 'just now';
	if (diff < MINUTE) return 'just now';
	if (diff < HOUR) {
		const mins = Math.floor(diff / MINUTE);
		return `${mins}m ago`;
	}
	if (diff < DAY) {
		const hours = Math.floor(diff / HOUR);
		return `${hours}h ago`;
	}
	const days = Math.floor(diff / DAY);
	if (days === 1) return '1d ago';
	if (days < 30) return `${days}d ago`;
	return formatFullTimestamp(timestamp);
}

/** Format a timestamp as a full date/time string */
export function formatFullTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleString();
}
