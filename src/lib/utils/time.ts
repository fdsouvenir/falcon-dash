/**
 * Format a timestamp as relative time (e.g., "2m ago", "3h ago").
 */
export function formatRelativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp;
	if (diff < 0) return 'just now';
	if (diff < 60000) return 'just now';
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
	if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
	return new Date(timestamp).toLocaleDateString();
}

/**
 * Format a future timestamp as a countdown (e.g., "in 3h 12m", "in 2d").
 */
export function formatCountdown(timestamp: number): string {
	const diff = timestamp - Date.now();
	if (diff <= 0) return 'now';
	if (diff < 60000) return 'in <1m';
	if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
	if (diff < 86400000) {
		const h = Math.floor(diff / 3600000);
		const m = Math.floor((diff % 3600000) / 60000);
		return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
	}
	if (diff < 604800000) return `in ${Math.floor(diff / 86400000)}d`;
	return new Date(timestamp).toLocaleDateString();
}

/**
 * Format a timestamp as an absolute date/time string.
 */
export function formatAbsoluteTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

/**
 * Format a timestamp for message display — shows time only for today,
 * date + time for older messages.
 */
export function formatMessageTime(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	if (isToday) {
		return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}
	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
