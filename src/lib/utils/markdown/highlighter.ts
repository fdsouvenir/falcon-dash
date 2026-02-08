import { type HighlighterGeneric, type BundledLanguage, type BundledTheme } from 'shiki';

const PRELOADED_LANGUAGES: BundledLanguage[] = [
	'javascript',
	'typescript',
	'python',
	'bash',
	'json',
	'html',
	'css',
	'svelte',
	'go',
	'rust',
	'java',
	'sql',
	'yaml',
	'diff',
	'markdown',
	'jsx',
	'tsx'
];

const THEME: BundledTheme = 'github-dark';

class HighlighterManager {
	private highlighter: HighlighterGeneric<BundledLanguage, BundledTheme> | null = null;
	private initPromise: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.highlighter) return;
		if (this.initPromise) return this.initPromise;
		this.initPromise = this.doInit();
		return this.initPromise;
	}

	private async doInit(): Promise<void> {
		const { createHighlighter } = await import('shiki');
		this.highlighter = await createHighlighter({
			themes: [THEME],
			langs: PRELOADED_LANGUAGES
		});
	}

	isReady(): boolean {
		return this.highlighter !== null;
	}

	highlight(code: string, lang: string): string {
		if (!this.highlighter) return '';
		try {
			return this.highlighter.codeToHtml(code, { lang, theme: THEME });
		} catch {
			// Unknown language — fall back to plain text
			return this.highlighter.codeToHtml(code, { lang: 'text', theme: THEME });
		}
	}
}

export const highlighterManager = new HighlighterManager();
