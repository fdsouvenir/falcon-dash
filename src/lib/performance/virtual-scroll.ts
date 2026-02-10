export interface VirtualScrollOptions {
	itemHeight: number;
	containerHeight: number;
	overscan?: number;
}

export interface VirtualScrollResult {
	visibleItems: Array<{ index: number; offset: number }>;
	totalHeight: number;
	startIndex: number;
	endIndex: number;
}

export function calculateVisibleItems(
	totalItems: number,
	scrollTop: number,
	options: VirtualScrollOptions
): VirtualScrollResult {
	const { itemHeight, containerHeight, overscan = 5 } = options;
	const totalHeight = totalItems * itemHeight;
	const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
	const endIndex = Math.min(
		totalItems - 1,
		Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
	);

	const visibleItems = [];
	for (let i = startIndex; i <= endIndex; i++) {
		visibleItems.push({ index: i, offset: i * itemHeight });
	}

	return { visibleItems, totalHeight, startIndex, endIndex };
}

// Lazy component loader
export function lazyLoad<T>(loader: () => Promise<{ default: T }>): () => Promise<T> {
	let cached: T | null = null;
	return async () => {
		if (cached) return cached;
		const module = await loader();
		cached = module.default;
		return cached;
	};
}
