import type { WorkItem, WorkQueue } from './work-ui.js';

const WORK_DATA_CACHE_TTL_MS = 15_000;

type CacheEntry<T> = {
	expiresAt: number;
	value: T;
};

const itemResponseCache = new Map<string, CacheEntry<WorkItem[]>>();
const itemRequestCache = new Map<string, Promise<WorkItem[]>>();
const singleItemResponseCache = new Map<number, CacheEntry<WorkItem>>();
const singleItemRequestCache = new Map<number, Promise<WorkItem>>();
const queueResponseCache = new Map<string, CacheEntry<WorkQueue>>();
const queueRequestCache = new Map<string, Promise<WorkQueue>>();

export async function loadCachedWorkItems(url: string): Promise<WorkItem[]> {
	const cached = getFreshCacheEntry(itemResponseCache, url);
	if (cached) return cached;
	const inFlight = itemRequestCache.get(url);
	if (inFlight) return inFlight;
	const request = fetch(url)
		.then(async (response) => {
			if (!response.ok) throw new Error(`Items request failed: ${response.status}`);
			const json = await response.json();
			const items = (json.items ?? []) as WorkItem[];
			itemResponseCache.set(url, cacheEntry(items));
			return items;
		})
		.finally(() => itemRequestCache.delete(url));
	itemRequestCache.set(url, request);
	return request;
}

export async function loadCachedWorkItem(itemId: number): Promise<WorkItem> {
	const cached = getFreshCacheEntry(singleItemResponseCache, itemId);
	if (cached) return cached;
	const inFlight = singleItemRequestCache.get(itemId);
	if (inFlight) return inFlight;
	const request = fetch(`/api/work/items/${itemId}`)
		.then(async (response) => {
			if (!response.ok) throw new Error(`Item request failed: ${response.status}`);
			const item = (await response.json()) as WorkItem;
			singleItemResponseCache.set(itemId, cacheEntry(item));
			return item;
		})
		.finally(() => singleItemRequestCache.delete(itemId));
	singleItemRequestCache.set(itemId, request);
	return request;
}

export async function loadCachedWorkQueue(): Promise<WorkQueue> {
	const cacheKey = 'queue';
	const cached = getFreshCacheEntry(queueResponseCache, cacheKey);
	if (cached) return cached;
	const inFlight = queueRequestCache.get(cacheKey);
	if (inFlight) return inFlight;
	const request = fetch('/api/work/queue')
		.then(async (response) => {
			if (!response.ok) throw new Error(`Queue request failed: ${response.status}`);
			const json = await response.json();
			const queue = (json.queue ?? null) as WorkQueue;
			queueResponseCache.set(cacheKey, cacheEntry(queue));
			return queue;
		})
		.finally(() => queueRequestCache.delete(cacheKey));
	queueRequestCache.set(cacheKey, request);
	return request;
}

export function clearWorkDataCache(itemId?: number): void {
	itemResponseCache.clear();
	itemRequestCache.clear();
	queueResponseCache.clear();
	queueRequestCache.clear();
	if (itemId) {
		singleItemResponseCache.delete(itemId);
		singleItemRequestCache.delete(itemId);
	} else {
		singleItemResponseCache.clear();
		singleItemRequestCache.clear();
	}
}

function cacheEntry<T>(value: T): CacheEntry<T> {
	return {
		expiresAt: Date.now() + WORK_DATA_CACHE_TTL_MS,
		value
	};
}

function getFreshCacheEntry<K, V>(cache: Map<K, CacheEntry<V>>, key: K): V | null {
	const cached = cache.get(key);
	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) {
		cache.delete(key);
		return null;
	}
	return cached.value;
}
