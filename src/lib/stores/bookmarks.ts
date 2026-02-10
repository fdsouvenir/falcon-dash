import { writable, readonly, type Readable } from 'svelte/store';

const _bookmarks = writable<Set<string>>(new Set());

export const bookmarks: Readable<Set<string>> = readonly(_bookmarks);

export function toggleBookmark(messageId: string): void {
	_bookmarks.update((set) => {
		const updated = new Set(set);
		if (updated.has(messageId)) {
			updated.delete(messageId);
		} else {
			updated.add(messageId);
		}
		return updated;
	});
}

export function isBookmarked(messageId: string): boolean {
	let result = false;
	_bookmarks.subscribe((set) => {
		result = set.has(messageId);
	})();
	return result;
}

export function getBookmarks(): string[] {
	let result: string[] = [];
	_bookmarks.subscribe((set) => {
		result = [...set];
	})();
	return result;
}
