<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import WorkspaceTab from '$lib/components/settings/WorkspaceTab.svelte';
	import InformationTab from '$lib/components/settings/InformationTab.svelte';
	import SkillsTab from '$lib/components/settings/SkillsTab.svelte';
	import SecurityTab from '$lib/components/settings/SecurityTab.svelte';
	import DashboardTab from '$lib/components/settings/DashboardTab.svelte';
	import AdvancedTab from '$lib/components/settings/AdvancedTab.svelte';
	import AboutTab from '$lib/components/settings/AboutTab.svelte';

	type SettingsTab =
		| 'workspace'
		| 'information'
		| 'skills'
		| 'security'
		| 'dashboard'
		| 'advanced'
		| 'about';

	interface TabDef {
		id: SettingsTab;
		label: string;
	}

	const tabs: TabDef[] = [
		{ id: 'workspace', label: 'Workspace' },
		{ id: 'information', label: 'Information' },
		{ id: 'skills', label: 'Skills' },
		{ id: 'security', label: 'Security' },
		{ id: 'dashboard', label: 'Dashboard' },
		{ id: 'advanced', label: 'Advanced' },
		{ id: 'about', label: 'About' }
	];

	const validTabIds = new Set<string>(tabs.map((t) => t.id));

	let activeTab: SettingsTab = 'workspace';

	function parseTabFromHash(): SettingsTab {
		const hash = $page.url.hash.replace('#', '');
		if (validTabIds.has(hash)) return hash as SettingsTab;
		return 'workspace';
	}

	function switchTab(tab: SettingsTab): void {
		activeTab = tab;
		const url = new URL($page.url);
		url.hash = tab === 'workspace' ? '' : tab;
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	onMount(() => {
		activeTab = parseTabFromHash();

		function onHashChange(): void {
			activeTab = parseTabFromHash();
		}

		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	});
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-b border-slate-700 px-6 py-4">
		<h1 class="text-lg font-semibold text-slate-100">Settings</h1>
	</div>

	<!-- Tab bar -->
	<div class="overflow-x-auto border-b border-slate-700">
		<div class="flex min-w-max">
			{#each tabs as tab (tab.id)}
				<button
					on:click={() => switchTab(tab.id)}
					class="whitespace-nowrap px-5 py-3 text-sm font-medium transition-colors {activeTab ===
					tab.id
						? 'border-b-2 border-blue-500 text-slate-100'
						: 'text-slate-400 hover:text-slate-200'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-hidden">
		{#if activeTab === 'workspace'}
			<WorkspaceTab />
		{:else if activeTab === 'information'}
			<InformationTab />
		{:else if activeTab === 'skills'}
			<SkillsTab />
		{:else if activeTab === 'security'}
			<SecurityTab />
		{:else if activeTab === 'dashboard'}
			<DashboardTab />
		{:else if activeTab === 'advanced'}
			<AdvancedTab />
		{:else if activeTab === 'about'}
			<AboutTab />
		{/if}
	</div>
</div>
