import { browser } from '$app/environment';
import { readonly, writable, get } from 'svelte/store';
import {
	applyTheme,
	getThemeConfig,
	listenToSystemTheme,
	setThemeConfig,
	type ThemeMode
} from '$lib/theme/theme-manager.js';

export type TextSize = 'comfortable' | 'large' | 'extra-large';

export interface FalconPreferences {
	theme: ThemeMode;
	notificationsEnabled: boolean;
	soundEnabled: boolean;
	compactMode: boolean;
	textSize: TextSize;
}

const STORAGE_KEY = 'falcon-dash-preferences';
const textSizes = new Set<TextSize>(['comfortable', 'large', 'extra-large']);
const themeModes = new Set<ThemeMode>(['dark', 'light', 'system']);

export const defaultPreferences: FalconPreferences = {
	theme: 'system',
	notificationsEnabled: true,
	soundEnabled: true,
	compactMode: false,
	textSize: 'comfortable'
};

function hasStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

function hasDocument(): boolean {
	return typeof document !== 'undefined';
}

function normalizePreferences(value: Partial<FalconPreferences> | null): FalconPreferences {
	return {
		...defaultPreferences,
		...value,
		theme: value?.theme && themeModes.has(value.theme) ? value.theme : defaultPreferences.theme,
		textSize:
			value?.textSize && textSizes.has(value.textSize)
				? value.textSize
				: defaultPreferences.textSize
	};
}

export function loadPreferences(): FalconPreferences {
	if (!hasStorage()) return defaultPreferences;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return defaultPreferences;
		return normalizePreferences(JSON.parse(stored) as Partial<FalconPreferences>);
	} catch {
		return defaultPreferences;
	}
}

function savePreferences(value: FalconPreferences): void {
	if (!hasStorage()) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function applyDisplayPreferences(
	value: Pick<FalconPreferences, 'compactMode' | 'textSize'>
) {
	if (!hasDocument()) return;
	const root = document.documentElement;
	root.classList.toggle('compact', value.compactMode);
	root.setAttribute('data-text-size', value.textSize);
}

const preferencesStore = writable<FalconPreferences>(loadPreferences());

export const preferences = readonly(preferencesStore);

export function updatePreferences(partial: Partial<FalconPreferences>): FalconPreferences {
	let next = defaultPreferences;
	preferencesStore.update((current) => {
		next = normalizePreferences({ ...current, ...partial });
		savePreferences(next);
		applyDisplayPreferences(next);
		return next;
	});
	return next;
}

export function setThemePreference(theme: ThemeMode): void {
	const next = updatePreferences({ theme });
	const config = getThemeConfig();
	setThemeConfig({ mode: next.theme, accent: config.accent });
}

export function setTextSizePreference(textSize: TextSize): void {
	updatePreferences({ textSize });
}

export function setCompactModePreference(compactMode: boolean): void {
	updatePreferences({ compactMode });
}

export function setNotificationsPreference(notificationsEnabled: boolean): void {
	updatePreferences({ notificationsEnabled });
}

export function setSoundPreference(soundEnabled: boolean): void {
	updatePreferences({ soundEnabled });
}

export function initDisplayPreferences(): () => void {
	if (!browser) return () => {};

	const initial = loadPreferences();
	preferencesStore.set(initial);
	applyDisplayPreferences(initial);

	const config = getThemeConfig();
	applyTheme({ mode: initial.theme, accent: config.accent });

	const unsubscribeStore = preferencesStore.subscribe((value) => {
		applyDisplayPreferences(value);
	});
	const unsubscribeTheme = listenToSystemTheme(() => {
		const value = get(preferencesStore);
		if (value.theme !== 'system') return;
		const currentConfig = getThemeConfig();
		applyTheme({ mode: 'system', accent: currentConfig.accent });
	});

	return () => {
		unsubscribeStore();
		unsubscribeTheme();
	};
}
