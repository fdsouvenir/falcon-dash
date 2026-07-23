<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const destinations = [
		{ href: resolve('/work3'), label: 'Mission Control', exact: true },
		{ href: resolve('/work3/projects'), label: 'Projects', exact: false },
		{ href: resolve('/work3/needs-resolution'), label: 'Needs Resolution', exact: false },
		{ href: resolve('/work3/automata'), label: 'Automata', exact: false },
		{ href: resolve('/work3/browse'), label: 'Browse', exact: false }
	];

	function isActive(destination: { href: string; exact: boolean }): boolean {
		return destination.exact
			? page.url.pathname === destination.href
			: page.url.pathname.startsWith(destination.href);
	}
</script>

<nav class="flex flex-wrap gap-1 overflow-x-auto border-b border-surface-border pb-2">
	{#each destinations as destination (destination.href)}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefs come from resolve() above -->
		<a
			href={destination.href}
			class="whitespace-nowrap rounded px-3 py-1.5 text-sm {isActive(destination)
				? 'bg-blue-950/60 font-medium text-blue-300'
				: 'text-white/70 hover:bg-surface-2'}"
		>
			{destination.label}
		</a>
	{/each}
</nav>
