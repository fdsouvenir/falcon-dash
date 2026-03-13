<script lang="ts">
	import {
		vaultLoading,
		vaultError,
		vaultEntries,
		vaultSubGroups,
		currentGroup,
		vaultGroups,
		loadEntries,
		type VaultEntryStub
	} from '$lib/stores/vault.js';

	interface Props {
		onselect?: (path: string) => void;
		onadd?: () => void;
		onaddgroup?: () => void;
	}

	let { onselect, onadd, onaddgroup }: Props = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let entries = $state<VaultEntryStub[]>([]);
	let subGroups = $state<string[]>([]);
	let group = $state('');
	let allGroups = $state<string[]>([]);

	$effect(() => {
		const u1 = vaultLoading.subscribe((v) => (loading = v));
		const u2 = vaultError.subscribe((v) => (error = v));
		const u3 = vaultEntries.subscribe((v) => (entries = v));
		const u4 = vaultSubGroups.subscribe((v) => (subGroups = v));
		const u5 = currentGroup.subscribe((v) => (group = v));
		const u6 = vaultGroups.subscribe((v) => (allGroups = v));
		return () => {
			u1();
			u2();
			u3();
			u4();
			u5();
			u6();
		};
	});

	/** Breadcrumb parts for the current group path. */
	const breadcrumbs = $derived.by(() => {
		if (!group) return [];
		const parts = group.split('/');
		return parts.map((name, i) => ({
			name,
			path: parts.slice(0, i + 1).join('/')
		}));
	});

	function navigateToGroup(g: string) {
		loadEntries(g || undefined);
	}

	function navigateUp() {
		if (!group) return;
		const parts = group.split('/');
		parts.pop();
		loadEntries(parts.join('/') || undefined);
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header bar -->
	<div class="border-b border-surface-border px-4 py-3">
		<!-- Breadcrumb -->
		<div
			class="mb-2 flex min-h-[24px] items-center gap-1 text-[length:var(--text-label)] text-status-muted"
		>
			<button
				onclick={() => navigateToGroup('')}
				class="hover:text-white {!group ? 'font-semibold text-white' : ''}"
			>
				Vault
			</button>
			{#each breadcrumbs as crumb, i (crumb.path)}
				<span>/</span>
				<button
					onclick={() => navigateToGroup(crumb.path)}
					class="hover:text-white {i === breadcrumbs.length - 1 ? 'font-semibold text-white' : ''}"
				>
					{crumb.name}
				</button>
			{/each}
		</div>

		<!-- Actions row -->
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				{#if group}
					<button
						onclick={navigateUp}
						class="flex items-center gap-1 rounded px-1.5 py-1 text-[length:var(--text-label)] text-status-muted hover:bg-surface-3 hover:text-white"
					>
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
						Up
					</button>
				{/if}
				<span class="text-[length:var(--text-label)] text-status-muted">
					{entries.length}
					{entries.length === 1 ? 'entry' : 'entries'}
					{#if subGroups.length > 0}, {subGroups.length}
						{subGroups.length === 1 ? 'group' : 'groups'}{/if}
				</span>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<button
					onclick={onaddgroup}
					class="rounded-lg bg-surface-3 px-3 py-1.5 text-[length:var(--text-badge)] font-medium text-white hover:opacity-80"
				>
					+ New Group
				</button>
				<button
					onclick={onadd}
					class="rounded-lg bg-status-info px-3 py-1.5 text-[length:var(--text-badge)] font-medium text-white hover:opacity-80"
				>
					+ New Entry
				</button>
			</div>
		</div>
	</div>

	<!-- Group picker -->
	{#if allGroups.length > 0}
		<div class="border-b border-surface-border px-3 py-2">
			<div class="flex flex-wrap gap-1">
				<button
					onclick={() => navigateToGroup('')}
					class="rounded-full px-2.5 py-1 text-[length:var(--text-badge)] font-medium transition-all duration-150 {!group
						? 'bg-surface-3 text-white'
						: 'text-status-muted hover:text-white'}"
				>
					All
				</button>
				{#each allGroups as g (g)}
					<button
						onclick={() => navigateToGroup(g)}
						class="rounded-full px-2.5 py-1 text-[length:var(--text-badge)] font-medium transition-all duration-150 {group ===
						g
							? 'bg-surface-3 text-white'
							: 'text-status-muted hover:text-white'}"
					>
						{g.split('/').pop()}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center gap-2 p-6 text-[length:var(--text-body)] text-status-muted">
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-surface-border border-t-status-info"
				></div>
				Loading...
			</div>
		{:else if error}
			<div class="m-4 rounded-lg border border-status-danger/30 bg-status-danger-bg p-3">
				<p class="text-[length:var(--text-body)] text-status-danger">{error}</p>
			</div>
		{:else}
			<!-- Sub-groups -->
			{#each subGroups as g (g)}
				<button
					onclick={() => navigateToGroup(g)}
					class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-3/30"
				>
					<svg
						class="h-4 w-4 shrink-0 text-status-warning"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
						/>
					</svg>
					<span class="text-[length:var(--text-body)] text-white/90">{g.split('/').pop()}</span>
					<svg
						class="ml-auto h-3.5 w-3.5 text-status-muted"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{/each}

			<!-- Entries -->
			{#each entries as entry (entry.path)}
				<button
					onclick={() => onselect?.(entry.path)}
					class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-3/30"
				>
					<svg
						class="h-4 w-4 shrink-0 text-status-info"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
						/>
					</svg>
					<span class="min-w-0 flex-1 truncate text-[length:var(--text-body)] text-white/90"
						>{entry.title}</span
					>
					<svg
						class="h-3.5 w-3.5 shrink-0 text-status-muted"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{/each}

			{#if subGroups.length === 0 && entries.length === 0}
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<svg
						class="mb-3 h-10 w-10 text-status-muted/40"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
						/>
					</svg>
					<p class="text-[length:var(--text-body)] text-status-muted">No entries in this group</p>
					<button
						onclick={onadd}
						class="mt-3 rounded-lg bg-status-info-bg px-3 py-1.5 text-[length:var(--text-badge)] text-status-info hover:opacity-80"
					>
						Add first entry
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
