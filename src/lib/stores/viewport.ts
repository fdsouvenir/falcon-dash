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

/** Tracks `window.visualViewport.height`, falling back to `window.innerHeight`. */
export const viewportHeight = readable(browser ? window.innerHeight : 0, (set) => {
	if (!browser) return;

	const vv = window.visualViewport;
	if (!vv) return;

	function onResize() {
		set(vv!.height);
	}

	set(vv.height);
	vv.addEventListener('resize', onResize);
	return () => vv.removeEventListener('resize', onResize);
});

/** True when the virtual keyboard is likely open (visual viewport >150px smaller than layout). */
export const keyboardVisible = readable(false, (set) => {
	if (!browser) return;

	const vv = window.visualViewport;
	if (!vv) return;

	function onResize() {
		set(window.innerHeight - vv!.height > 150);
	}

	onResize();
	vv.addEventListener('resize', onResize);
	return () => vv.removeEventListener('resize', onResize);
});
