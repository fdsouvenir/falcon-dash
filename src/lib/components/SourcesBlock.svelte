<script lang="ts">
	import { ExternalLink, Globe } from 'lucide-svelte';
	import type { SourceInfo } from '$lib/stores/chat.js';

	let { sources = [] }: { sources: SourceInfo[] } = $props();

	let expanded = $state(false);

	function toggle() {
		expanded = !expanded;
	}

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	let isPill = $derived(sources.length <= 2);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external source URLs, not SvelteKit routes -->
{#if sources.length > 0}
	{#if isPill}
		<!-- Compact pill style for 1-2 sources -->
		<div class="mb-2 flex flex-wrap gap-1.5">
			{#each sources as source (source.url)}
				<a
					href={source.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
				>
					<Globe class="h-3 w-3 shrink-0" />
					<span class="max-w-[200px] truncate">{source.title || getDomain(source.url)}</span>
					<ExternalLink class="h-3 w-3 shrink-0 text-gray-600" />
				</a>
			{/each}
		</div>
	{:else}
		<!-- Collapsible list for 3+ sources -->
		<div class="mb-2 rounded-lg border border-gray-700 bg-gray-900">
			<button
				onclick={toggle}
				class="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-gray-400 transition-colors hover:text-gray-200 md:py-2"
				aria-expanded={expanded}
			>
				<svg
					class="h-4 w-4 transition-transform md:h-3.5 md:w-3.5 {expanded ? 'rotate-90' : ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				<Globe class="h-3.5 w-3.5" />
				<span class="text-xs font-medium">Used {sources.length} sources</span>
			</button>

			{#if expanded}
				<div class="border-t border-gray-700 px-3 py-2">
					<ul class="space-y-1">
						{#each sources as source (source.url)}
							<li>
								<a
									href={source.url}
									target="_blank"
									rel="noopener noreferrer"
									class="group flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-gray-800"
								>
									<Globe class="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" />
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-1.5">
											<span
												class="truncate text-xs font-medium text-gray-300 group-hover:text-gray-100"
											>
												{source.title || getDomain(source.url)}
											</span>
											<ExternalLink
												class="h-3 w-3 shrink-0 text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
											/>
										</div>
										<span class="text-xs text-gray-600">{getDomain(source.url)}</span>
										{#if source.snippet}
											<p class="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500">
												{source.snippet}
											</p>
										{/if}
									</div>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
{/if}
