<script lang="ts">
	import { onMount } from 'svelte';
	import RenderedContent from '$lib/components/chat/RenderedContent.svelte';
	import { highlighterManager } from '$lib/utils/markdown/highlighter';

	export let content: string;
	export let filename: string;

	const extensionToLang: Record<string, string> = {
		'.ts': 'typescript',
		'.tsx': 'tsx',
		'.js': 'javascript',
		'.jsx': 'jsx',
		'.py': 'python',
		'.go': 'go',
		'.rs': 'rust',
		'.java': 'java',
		'.json': 'json',
		'.yaml': 'yaml',
		'.yml': 'yaml',
		'.html': 'html',
		'.css': 'css',
		'.svelte': 'svelte',
		'.sh': 'bash',
		'.bash': 'bash',
		'.zsh': 'bash',
		'.sql': 'sql',
		'.diff': 'diff'
	};

	function getExtension(name: string): string {
		const dot = name.lastIndexOf('.');
		return dot >= 0 ? name.slice(dot).toLowerCase() : '';
	}

	function getLanguageFromFilename(name: string): string | null {
		const ext = getExtension(name);
		if (ext === '.md') return null;
		return extensionToLang[ext] ?? null;
	}

	let highlighterReady = highlighterManager.isReady();

	$: ext = getExtension(filename);
	$: isMarkdown = ext === '.md';
	$: language = getLanguageFromFilename(filename);
	$: highlightedHtml =
		language && highlighterReady ? highlighterManager.highlight(content, language) : '';

	onMount(() => {
		if (!highlighterManager.isReady()) {
			highlighterManager.init().then(() => {
				highlighterReady = true;
			});
		}
	});
</script>

<div class="file-preview">
	{#if isMarkdown}
		<RenderedContent {content} isStreaming={false} />
	{:else if language && highlightedHtml}
		<div class="overflow-x-auto">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html highlightedHtml}
		</div>
	{:else}
		<pre class="whitespace-pre-wrap text-sm text-slate-300">{content}</pre>
	{/if}
</div>

<style>
	.file-preview :global(.shiki) {
		background-color: rgb(15 23 42) !important;
	}
	.file-preview :global(pre) {
		padding: 0.75rem 1rem;
		overflow-x: auto;
		margin: 0;
	}
	.file-preview :global(pre code) {
		font-size: 0.85em;
	}
</style>
