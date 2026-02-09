import { writable, get } from 'svelte/store';

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'falcon-dash:preferences';

function getStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const prefs = JSON.parse(stored);
			if (prefs.theme === 'dark' || prefs.theme === 'light' || prefs.theme === 'system') {
				return prefs.theme;
			}
		}
	} catch {
		// Invalid stored prefs
	}
	return 'dark';
}

function getEffectiveMode(theme: Theme): 'dark' | 'light' {
	if (theme === 'system') {
		if (typeof window !== 'undefined') {
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return 'dark';
	}
	return theme;
}

function applyToDOM(mode: 'dark' | 'light'): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (mode === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}

export const theme = writable<Theme>('dark');
export const effectiveMode = writable<'dark' | 'light'>('dark');

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

export function initTheme(): void {
	const stored = getStoredTheme();
	theme.set(stored);
	const mode = getEffectiveMode(stored);
	effectiveMode.set(mode);
	applyToDOM(mode);

	// Listen for OS preference changes when in system mode
	if (typeof window !== 'undefined') {
		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaListener = (e: MediaQueryListEvent) => {
			if (get(theme) === 'system') {
				const newMode = e.matches ? 'dark' : 'light';
				effectiveMode.set(newMode);
				applyToDOM(newMode);
			}
		};
		mediaQuery.addEventListener('change', mediaListener);
	}
}

export function setTheme(value: Theme): void {
	theme.set(value);
	const mode = getEffectiveMode(value);
	effectiveMode.set(mode);
	applyToDOM(mode);
	saveThemePreference(value);
}

function saveThemePreference(value: Theme): void {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		const prefs = stored ? JSON.parse(stored) : {};
		prefs.theme = value;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Storage unavailable
	}
}

export function destroyTheme(): void {
	if (mediaQuery && mediaListener) {
		mediaQuery.removeEventListener('change', mediaListener);
		mediaQuery = null;
		mediaListener = null;
	}
}
