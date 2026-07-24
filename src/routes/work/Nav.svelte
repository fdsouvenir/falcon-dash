<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const destinations = [
		{ href: resolve('/work'), label: 'Work', exact: true },
		{ href: resolve('/work/projects'), label: 'Projects', exact: false },
		{ href: resolve('/work/needs-resolution'), label: 'Needs Resolution', exact: false },
		{ href: resolve('/work/automations'), label: 'Automations', exact: false },
		{ href: resolve('/work/browse'), label: 'Browse', exact: false }
	];

	function isActive(destination: { href: string; exact: boolean }): boolean {
		return destination.exact
			? page.url.pathname === destination.href
			: page.url.pathname.startsWith(destination.href);
	}
</script>

<nav
	class="flex gap-1 overflow-x-auto rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container p-1 shadow-none"
	aria-label="Work destinations"
>
	{#each destinations as destination (destination.href)}
		<a
			href={destination.href}
			aria-current={isActive(destination) ? 'page' : undefined}
			class="falcon-focus touch-target inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--md-sys-shape-corner-medium)] px-3 py-2 text-[length:var(--text-body)] {isActive(
				destination
			)
				? 'bg-primary font-semibold text-primary-foreground'
				: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}"
		>
			{destination.label}
		</a>
	{/each}
</nav>
