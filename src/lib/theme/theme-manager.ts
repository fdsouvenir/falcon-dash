export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'red';

const STORAGE_KEY = 'falcon-dash-theme';

export interface ThemeConfig {
	mode: ThemeMode;
	accent: AccentColor;
}

export function getThemeConfig(): ThemeConfig {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored);
	} catch {
		/* ignore */
	}
	return { mode: 'dark', accent: 'blue' };
}

export function setThemeConfig(config: ThemeConfig): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	applyTheme(config);
}

export function applyTheme(config: ThemeConfig): void {
	const root = document.documentElement;
	const isDark =
		config.mode === 'dark' ||
		(config.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

	root.classList.toggle('dark', isDark);
	root.classList.toggle('light', !isDark);
	root.setAttribute('data-accent', config.accent);

	// CSS custom properties for accent
	const accents: Record<AccentColor, string> = {
		blue: '#3b82f6',
		purple: '#8b5cf6',
		green: '#10b981',
		orange: '#f59e0b',
		red: '#ef4444'
	};
	root.style.setProperty('--accent-color', accents[config.accent]);
}

export function listenToSystemTheme(onChange: () => void): () => void {
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	mq.addEventListener('change', onChange);
	return () => mq.removeEventListener('change', onChange);
}
