<script lang="ts">
	interface Blocker {
		id?: string;
		reason?: string;
		resolution_condition?: string;
		severity?: string;
	}

	interface Props {
		blockers: Blocker[];
	}

	let { blockers }: Props = $props();
</script>

{#if blockers.length}
	<aside
		class="rounded-[var(--md-sys-shape-corner-medium)] border border-status-danger/45 bg-status-danger-bg px-4 py-3 text-status-danger"
		aria-label="Active blockers"
	>
		<p class="font-semibold">Blocked</p>
		<ul class="mt-2 divide-y divide-status-danger/20">
			{#each blockers as blocker, index (blocker.id ?? index)}
				<li class="py-2 first:pt-0 last:pb-0">
					<p class="text-[length:var(--text-body)]">{blocker.reason ?? 'Active blocker'}</p>
					{#if blocker.resolution_condition}
						<p class="mt-1 text-[length:var(--text-label)]">
							Clears when: {blocker.resolution_condition}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</aside>
{/if}
