<script lang="ts">
	import { page } from '$app/stores';

	$: currentPath = $page.url.pathname;

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	const apps = [
		{ href: '/projects', label: 'Projects' },
		{ href: '/files', label: 'Files' },
		{ href: '/jobs', label: 'Agent Jobs' }
	];

	const bottomLinks = [
		{ href: '/settings', label: 'Settings' },
		{ href: '/passwords', label: 'Passwords' }
	];
</script>

<!-- Logo -->
<div class="flex h-14 items-center border-b border-slate-700 px-4">
	<span class="text-lg font-semibold text-slate-100">falcon-dash</span>
</div>

<!-- Channels section -->
<div class="flex-1 overflow-y-auto px-3 py-4">
	<h3 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Channels</h3>
	<ul class="space-y-1">
		<li>
			<span class="block rounded px-2 py-1.5 text-sm text-slate-400">No channels yet</span>
		</li>
	</ul>

	<!-- Apps section -->
	<h3 class="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Apps</h3>
	<ul class="space-y-1">
		{#each apps as app (app.href)}
			<li>
				<a
					href={app.href}
					class="block rounded px-2 py-1.5 text-sm transition-colors"
					class:bg-slate-700={isActive(app.href)}
					class:text-slate-100={isActive(app.href)}
					class:text-slate-300={!isActive(app.href)}
					class:hover:bg-slate-700={!isActive(app.href)}
				>
					{app.label}
				</a>
			</li>
		{/each}
	</ul>
</div>

<!-- Sidebar footer -->
<div class="border-t border-slate-700 px-3 py-3">
	<ul class="space-y-1">
		{#each bottomLinks as link (link.href)}
			<li>
				<a
					href={link.href}
					class="block rounded px-2 py-1.5 text-sm transition-colors"
					class:bg-slate-700={isActive(link.href)}
					class:text-slate-100={isActive(link.href)}
					class:text-slate-300={!isActive(link.href)}
					class:hover:bg-slate-700={!isActive(link.href)}
				>
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
</div>
