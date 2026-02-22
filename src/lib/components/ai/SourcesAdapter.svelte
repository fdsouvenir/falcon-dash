<script lang="ts">
	import {
		Sources,
		SourcesTrigger,
		SourcesContent,
		Source
	} from '$lib/components/ai-elements/sources/index.js';
	import type { SourceInfo } from '$lib/stores/chat.js';

	let { sources = [] }: { sources: SourceInfo[] } = $props();

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external source URLs, not SvelteKit routes -->
{#if sources.length > 0}
	<Sources>
		<SourcesTrigger count={sources.length} />
		<SourcesContent>
			{#each sources as source (source.url)}
				<Source href={source.url} title={source.title || getDomain(source.url)}>
					<span class="flex items-center gap-2">
						<span class="block font-medium">{source.title || getDomain(source.url)}</span>
						<span class="text-muted-foreground">{getDomain(source.url)}</span>
					</span>
				</Source>
			{/each}
		</SourcesContent>
	</Sources>
{/if}
