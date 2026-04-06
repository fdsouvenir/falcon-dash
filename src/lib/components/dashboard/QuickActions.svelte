<script lang="ts">
	import { resolve } from '$app/paths';

	const actions = [
		{
			label: 'Approvals',
			description: 'Review pending operator requests',
			href: '/approvals',
			icon: 'approvals',
			color: 'text-status-warning'
		},
		{
			label: 'Channels',
			description: 'Configure and repair chat',
			href: '/channels',
			icon: 'channels',
			color: 'text-status-purple'
		},
		{
			label: 'Projects',
			description: 'Track active work',
			href: '/projects',
			icon: 'projects',
			color: 'text-status-info'
		},
		{
			label: 'Jobs',
			description: 'Run and monitor schedules',
			href: '/jobs',
			icon: 'jobs',
			color: 'text-status-warning'
		},
		{
			label: 'Passwords',
			description: 'Open the vault manager',
			href: '/passwords',
			icon: 'passwords',
			color: 'text-status-active'
		},
		{
			label: 'Documents',
			description: 'Browse workspace docs',
			href: '/documents',
			icon: 'documents',
			color: 'text-status-info'
		},
		{
			label: 'Settings',
			description: 'Gateway and agent setup',
			href: '/settings',
			icon: 'settings',
			color: 'text-status-muted'
		}
	] as const;
</script>

<div
	class="grid grid-cols-2 gap-[var(--space-card-gap)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
>
	{#each actions as action (action.href)}
		<a
			href={resolve(action.href)}
			class="group rounded-2xl border border-surface-border bg-surface-1/60 px-3.5 py-3.5 transition-colors hover:border-white/15 hover:bg-surface-1"
		>
			<div class="mb-1.5 {action.color}">
				<svg
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					{#if action.icon === 'channels'}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
						/>
					{:else if action.icon === 'approvals'}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0119.5 12.75v6A2.25 2.25 0 0117.25 21h-10.5A2.25 2.25 0 014.5 18.75v-6A2.25 2.25 0 016.75 10.5z"
						/>
					{:else if action.icon === 'projects'}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					{:else if action.icon === 'jobs'}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					{:else if action.icon === 'passwords'}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
						/>
					{:else if action.icon === 'documents'}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
						/>
					{:else if action.icon === 'settings'}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					{/if}
				</svg>
			</div>
			<p class="text-[length:var(--text-body)] font-medium text-white">{action.label}</p>
			<p class="mt-1 text-[length:var(--text-badge)] leading-5 text-status-muted">
				{action.description}
			</p>
		</a>
	{/each}
</div>
