import { createHighlighter, type Highlighter } from 'shiki';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';

let highlighter: Highlighter | null = null;
let initPromise: Promise<Highlighter> | null = null;

const COMMON_LANGS = [
	'javascript',
	'typescript',
	'python',
	'bash',
	'shell',
	'json',
	'html',
	'css',
	'markdown',
	'yaml',
	'toml',
	'sql',
	'rust',
	'go',
	'java',
	'c',
	'cpp',
	'ruby',
	'php',
	'swift',
	'kotlin',
	'diff',
	'text'
];

async function getHighlighter(): Promise<Highlighter> {
	if (highlighter) return highlighter;
	if (initPromise) return initPromise;
	initPromise = createHighlighter({
		themes: ['github-dark'],
		langs: COMMON_LANGS,
		engine: createJavaScriptRegexEngine()
	});
	highlighter = await initPromise;
	return highlighter;
}

/**
 * Highlight code with Shiki. Returns HTML string.
 * Falls back to plain <pre><code> on failure.
 */
export async function highlightCode(code: string, lang?: string): Promise<string> {
	try {
		const hl = await getHighlighter();
		const resolvedLang = lang && COMMON_LANGS.includes(lang) ? lang : 'text';
		return hl.codeToHtml(code, { lang: resolvedLang, theme: 'github-dark' });
	} catch {
		const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return `<pre><code>${escaped}</code></pre>`;
	}
}

/**
 * Check if highlighter is ready (for sync contexts).
 */
export function isHighlighterReady(): boolean {
	return highlighter !== null;
}

/**
 * Pre-load the highlighter (call early in app lifecycle).
 */
export async function preloadHighlighter(): Promise<void> {
	await getHighlighter();
}
