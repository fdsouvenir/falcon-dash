import { readable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Reactive store that tracks whether the viewport is mobile-sized (≤767px).
 * Uses matchMedia so it only fires on threshold crossings, not every pixel.
 */
export const isMobile = readable(false, (set) => {
	if (!browser) return;

	const mql = window.matchMedia('(max-width: 767px)');
	set(mql.matches);

	function onChange(e: MediaQueryListEvent) {
		set(e.matches);
	}

	mql.addEventListener('change', onChange);
	return () => mql.removeEventListener('change', onChange);
});
