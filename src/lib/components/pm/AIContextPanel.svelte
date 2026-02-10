<script lang="ts">
	import { getAIProjectContext, getAIDashboardContext } from '$lib/stores/pm-operations.js';

	interface Props {
		projectId?: number;
	}

	let { projectId }: Props = $props();

	let markdown = $state('');
	let generatedAt = $state(0);
	let stats = $state<Record<string, number>>({});
	let loading = $state(false);
	let error = $state<string | null>(null);

	let mode = $derived(projectId !== undefined ? 'project' : 'dashboard');

	async function loadContext() {
		loading = true;
		error = null;

		try {
			if (mode === 'project' && projectId !== undefined) {
				const result = await getAIProjectContext(projectId);
				markdown = result.markdown;
				generatedAt = result.generated_at;
				stats = {};
			} else {
				const result = await getAIDashboardContext();
				markdown = result.markdown;
				generatedAt = result.generated_at;
				stats = result.stats;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load context';
			console.error('Error loading AI context:', err);
		} finally {
			loading = false;
		}
	}

	function markdownToHtml(md: string): string {
		let html = md;

		// Code blocks
		html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

		// Headers
		html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
		html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
		html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

		// Bold
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

		// Lists
		html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
		html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

		// Paragraphs
		html = html.replace(/\n\n/g, '</p><p>');
		html = '<p>' + html + '</p>';

		// Clean up empty paragraphs
		html = html.replace(/<p><\/p>/g, '');
		html = html.replace(/<p>(<[hup])/g, '$1');
		html = html.replace(/(<\/[hup]>)<\/p>/g, '$1');

		return html;
	}

	function formatTimestamp(ts: number): string {
		if (!ts) return 'Never';
		const date = new Date(ts);
		return date.toLocaleString();
	}

	$effect(() => {
		loadContext();
	});
</script>

<div class="ai-context-panel flex h-full flex-col rounded-lg border border-gray-700 bg-gray-800">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
		<h2 class="text-lg font-semibold text-white">
			AI Context — {mode === 'project' ? 'Project' : 'Dashboard'}
		</h2>
		<button
			onclick={loadContext}
			disabled={loading}
			class="rounded p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
			aria-label="Refresh context"
		>
			<svg
				class="h-5 w-5 {loading ? 'animate-spin' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
		</button>
	</div>

	<!-- Metadata bar -->
	<div class="flex items-center gap-4 border-b border-gray-700 px-4 py-2 text-sm text-gray-400">
		<div>Generated: {formatTimestamp(generatedAt)}</div>
		{#if Object.keys(stats).length > 0}
			<div class="flex gap-2">
				{#each Object.entries(stats) as [key, value]}
					<span class="rounded-full bg-gray-700 px-2 py-1 text-xs text-gray-300">
						{key}: {value}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="relative flex-1 overflow-auto">
		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
				></div>
			</div>
		{/if}

		{#if error}
			<div class="p-4">
				<div class="rounded-lg border border-red-800 bg-red-900 bg-opacity-20 p-4 text-red-400">
					<div class="font-semibold">Error</div>
					<div class="text-sm">{error}</div>
				</div>
			</div>
		{:else if markdown}
			<div class="prose prose-invert max-w-none p-4">
				{@html markdownToHtml(markdown)}
			</div>
		{:else if !loading}
			<div class="p-4 text-center text-gray-500">
				No context available. Click refresh to generate.
			</div>
		{/if}
	</div>
</div>

<style>
	.prose {
		color: #e5e7eb;
	}

	.prose h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin-top: 1.5rem;
		margin-bottom: 1rem;
		color: #f9fafb;
	}

	.prose h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 1.25rem;
		margin-bottom: 0.75rem;
		color: #f3f4f6;
	}

	.prose h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: #f3f4f6;
	}

	.prose p {
		margin-bottom: 1rem;
		line-height: 1.6;
	}

	.prose ul {
		margin-bottom: 1rem;
		padding-left: 1.5rem;
		list-style-type: disc;
	}

	.prose li {
		margin-bottom: 0.25rem;
		line-height: 1.6;
	}

	.prose strong {
		font-weight: 600;
		color: #f9fafb;
	}

	.prose pre {
		background-color: #1f2937;
		border: 1px solid #374151;
		border-radius: 0.375rem;
		padding: 1rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}

	.prose code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.875rem;
		color: #93c5fd;
	}
</style>
