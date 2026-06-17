<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	interface Props {
		eyebrow: string;
		title: string;
		description: string;
		active?: string;
		children?: Snippet;
	}

	let { eyebrow, title, description, active = '', children }: Props = $props();

	const navItems = [
		{ label: 'Shell', href: '/' },
		{ label: 'Work', href: '/work' },
		{ label: 'Vault', href: '/passwords' },
		{ label: 'Channels', href: '/channels' },
		{ label: 'Labs', href: '/settings', status: 'Advanced' }
	] as const;

	type NavItem = (typeof navItems)[number];

	function isActive(item: NavItem): boolean {
		if (active) return item.label.toLowerCase() === active.toLowerCase();
		if (item.href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(item.href);
	}
</script>

<div class="flex min-h-full flex-col bg-surface-0 text-white">
	<header class="shrink-0 border-b border-surface-border bg-surface-1">
		<div class="px-4 py-3 sm:px-5">
			<nav class="flex flex-wrap items-center gap-1" aria-label="Falcon Dash modules">
				{#each navItems as item (item.label)}
					<a
						href={resolve(item.href)}
						class="inline-flex min-h-8 items-center gap-2 border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition {isActive(
							item
						)
							? 'border-white bg-white text-black'
							: 'border-surface-border bg-surface-2 text-white/70 hover:border-white/40 hover:text-white'}"
					>
						{item.label}
						{#if 'status' in item}
							<span class="font-mono text-[10px] opacity-70">{item.status}</span>
						{/if}
					</a>
				{/each}
			</nav>
		</div>
		<div class="border-t border-surface-border px-4 py-4 sm:px-5">
			<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div class="max-w-4xl">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-status-muted">
						{eyebrow}
					</p>
					<h1 class="mt-1 text-2xl font-semibold tracking-normal text-white sm:text-3xl">
						{title}
					</h1>
					<p class="mt-2 max-w-3xl text-sm leading-6 text-white/68">{description}</p>
				</div>
			</div>
		</div>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{@render children?.()}
	</div>
</div>
