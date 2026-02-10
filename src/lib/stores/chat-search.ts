import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { call } from '$lib/stores/gateway.js';

export interface SearchResult {
	messageId: string;
	sessionKey: string;
	sessionName: string;
	content: string;
	role: string;
	timestamp: number;
	highlight: string;
}

const _searchResults: Writable<SearchResult[]> = writable([]);
const _isSearching: Writable<boolean> = writable(false);
const _searchQuery: Writable<string> = writable('');

export const searchResults: Readable<SearchResult[]> = readonly(_searchResults);
export const isSearching: Readable<boolean> = readonly(_isSearching);
export const chatSearchQuery: Readable<string> = readonly(_searchQuery);

/** Search across all chats */
export async function searchAllChats(query: string): Promise<void> {
	if (!query.trim()) {
		_searchResults.set([]);
		return;
	}
	_searchQuery.set(query);
	_isSearching.set(true);
	try {
		const result = await call<{ results: SearchResult[] }>('chat.search', { query });
		_searchResults.set(result.results ?? []);
	} catch {
		_searchResults.set([]);
	} finally {
		_isSearching.set(false);
	}
}

/** Search within a specific session */
export async function searchInSession(sessionKey: string, query: string): Promise<void> {
	if (!query.trim()) {
		_searchResults.set([]);
		return;
	}
	_searchQuery.set(query);
	_isSearching.set(true);
	try {
		const result = await call<{ results: SearchResult[] }>('chat.search', {
			sessionKey,
			query
		});
		_searchResults.set(result.results ?? []);
	} catch {
		_searchResults.set([]);
	} finally {
		_isSearching.set(false);
	}
}

export function clearSearch(): void {
	_searchResults.set([]);
	_searchQuery.set('');
	_isSearching.set(false);
}
