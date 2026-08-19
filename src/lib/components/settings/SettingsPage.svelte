<script lang="ts">
	import { page } from '$app/state';
	import PreferencesTab from './PreferencesTab.svelte';
	import InformationTab from './InformationTab.svelte';
	import AboutTab from './AboutTab.svelte';
	import WorkspaceFiles from './WorkspaceFiles.svelte';
	import TerminalTab from './TerminalTab.svelte';

	const tabs = [
		{ id: 'preferences', label: 'Preferences' },
		{ id: 'information', label: 'Information' },
		{ id: 'workspace', label: 'Workspace' },
		{ id: 'terminal', label: 'Terminal' },
		{ id: 'about', label: 'About' }
	] as const;

	type SettingsTabId = (typeof tabs)[number]['id'];

	function isSettingsTabId(value: string | null): value is SettingsTabId {
		return tabs.some((tab) => tab.id === value);
	}

	let activeTab = $derived.by<SettingsTabId>(() => {
		const tab = page.url.searchParams.get('tab');
		return isSettingsTabId(tab) ? tab : 'preferences';
	});
</script>

<div class="flex h-full flex-col">
	<!-- Tab bar -->
	<div class="border-b border-surface-border bg-surface-1">
		<form method="GET" action="/settings" class="flex overflow-x-auto px-4">
			{#each tabs as tab (tab.id)}
				<button
					type="submit"
					name="tab"
					value={tab.id}
					class="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab ===
					tab.id
						? 'border-blue-500 text-blue-400'
						: 'border-transparent text-status-muted hover:border-surface-border hover:text-white/80'}"
				>
					{tab.label}
				</button>
			{/each}
		</form>
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{#key activeTab}
			{#if activeTab === 'preferences'}
				<PreferencesTab />
			{:else if activeTab === 'information'}
				<InformationTab />
			{:else if activeTab === 'workspace'}
				<WorkspaceFiles />
			{:else if activeTab === 'terminal'}
				<TerminalTab />
			{:else if activeTab === 'about'}
				<AboutTab />
			{:else}
				<PreferencesTab />
			{/if}
		{/key}
	</div>
</div>
