<script lang="ts">
	import { page } from '$app/stores';
	import { keyboardVisible } from '$lib/stores/viewport.js';

	let { hidden = false }: { onmore?: () => void; hidden?: boolean } = $props();

	let pathname = $state('/');
	let kbVisible = $state(false);

	$effect(() => {
		const unsub = page.subscribe((p) => {
			pathname = p.url.pathname;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = keyboardVisible.subscribe((v) => {
			kbVisible = v;
		});
		return unsub;
	});

	function isActive(path: string): boolean {
		return pathname.startsWith(path);
	}

	const tabs = [
		{
			label: 'Work',
			href: '/work',
			path: 'M9 3.75h6m-7.5 3h9a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 18.75V8.25a1.5 1.5 0 011.5-1.5zM9 11.25h6M9 15h4.5'
		},
		{
			label: 'Vault',
			href: '/passwords',
			path: 'M8.25 10.5V8.25a3.75 3.75 0 017.5 0v2.25m-9 0h10.5v9H6.75v-9z'
		},
		{
			label: 'Channels',
			href: '/channels',
			path: 'M7.5 8.25h9m-9 3H12m-7.5 6.75V5.25h15v9.75H12L7.5 18z'
		},
		{
			label: 'Labs',
			href: '/settings',
			path: 'M9.75 3.75h4.5m-3 0v5.25l-4.5 7.5a2.25 2.25 0 001.95 3.375h6.6a2.25 2.25 0 001.95-3.375l-4.5-7.5V3.75'
		}
	];
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static local routes -->
{#if !kbVisible && !hidden}
	<nav
		class="grid shrink-0 grid-cols-4 border-t border-outline-variant bg-surface-container-lowest pb-[var(--safe-bottom)]"
	>
		{#each tabs as tab (tab.label)}
			<a
				href={tab.href}
				class="touch-target flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] {isActive(
					tab.href
				)
					? 'text-primary'
					: 'text-on-surface-variant'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d={tab.path} />
				</svg>
				<span>{tab.label}</span>
			</a>
		{/each}
	</nav>
{/if}
