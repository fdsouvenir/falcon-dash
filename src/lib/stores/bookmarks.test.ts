import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('bookmarks store', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('starts empty', async () => {
		const { bookmarks } = await import('./bookmarks.js');
		let value: Set<string> = new Set();
		bookmarks.subscribe((v) => {
			value = v;
		})();
		expect(value.size).toBe(0);
	});

	it('toggleBookmark adds a bookmark', async () => {
		const { bookmarks, toggleBookmark } = await import('./bookmarks.js');
		let value: Set<string> = new Set();
		const unsubscribe = bookmarks.subscribe((v) => {
			value = v;
		});

		toggleBookmark('msg-1');
		expect(value.size).toBe(1);
		expect(value.has('msg-1')).toBe(true);
		unsubscribe();
	});

	it('toggleBookmark removes existing bookmark', async () => {
		const { bookmarks, toggleBookmark } = await import('./bookmarks.js');
		let value: Set<string> = new Set();
		const unsubscribe = bookmarks.subscribe((v) => {
			value = v;
		});

		toggleBookmark('msg-1');
		expect(value.has('msg-1')).toBe(true);

		toggleBookmark('msg-1');
		expect(value.has('msg-1')).toBe(false);
		expect(value.size).toBe(0);
		unsubscribe();
	});

	it('isBookmarked returns correct state', async () => {
		const { toggleBookmark, isBookmarked } = await import('./bookmarks.js');

		expect(isBookmarked('msg-1')).toBe(false);

		toggleBookmark('msg-1');
		expect(isBookmarked('msg-1')).toBe(true);

		toggleBookmark('msg-1');
		expect(isBookmarked('msg-1')).toBe(false);
	});

	it('getBookmarks returns all bookmarked IDs', async () => {
		const { toggleBookmark, getBookmarks } = await import('./bookmarks.js');

		expect(getBookmarks()).toHaveLength(0);

		toggleBookmark('msg-1');
		toggleBookmark('msg-2');
		toggleBookmark('msg-3');

		const result = getBookmarks();
		expect(result).toHaveLength(3);
		expect(result).toContain('msg-1');
		expect(result).toContain('msg-2');
		expect(result).toContain('msg-3');
	});
});
