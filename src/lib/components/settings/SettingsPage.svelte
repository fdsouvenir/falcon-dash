<script lang="ts">
	import { page } from '$app/state';
	import PreferencesTab from './PreferencesTab.svelte';
	import InformationTab from './InformationTab.svelte';
	import AboutTab from './AboutTab.svelte';
	import ConfigEditor from './ConfigEditor.svelte';
	import DeviceManagement from './DeviceManagement.svelte';
	import LiveLogs from './LiveLogs.svelte';
	import ExecApprovals from './ExecApprovals.svelte';
	import UserTab from './UserTab.svelte';
	import AgentsTab from './AgentsTab.svelte';
	import WorkspaceFiles from './WorkspaceFiles.svelte';
	import CanvasDiagnosticsTab from './CanvasDiagnosticsTab.svelte';
	import GatewayControlTab from './GatewayControlTab.svelte';
	import TerminalTab from './TerminalTab.svelte';

	const tabs = [
		{ id: 'user', label: 'User' },
		{ id: 'agents', label: 'Agents' },
		{ id: 'preferences', label: 'Preferences' },
		{ id: 'information', label: 'Information' },
		{ id: 'config', label: 'Config' },
		{ id: 'devices', label: 'Devices' },
		{ id: 'logs', label: 'Logs' },
		{ id: 'approvals', label: 'Approvals' },
		{ id: 'workspace', label: 'Workspace' },
		{ id: 'canvas', label: 'Canvas' },
		{ id: 'gateway-control', label: 'Gateway Control' },
		{ id: 'terminal', label: 'Terminal' },
		{ id: 'about', label: 'About' }
	] as const;

	type SettingsTabId = (typeof tabs)[number]['id'];

	function isSettingsTabId(value: string | null): value is SettingsTabId {
		return tabs.some((tab) => tab.id === value);
	}

	let activeTab = $derived.by<SettingsTabId>(() => {
		const tab = page.url.searchParams.get('tab');
		return isSettingsTabId(tab) ? tab : 'user';
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
			{#if activeTab === 'user'}
				<UserTab />
			{:else if activeTab === 'agents'}
				<AgentsTab />
			{:else if activeTab === 'preferences'}
				<PreferencesTab />
			{:else if activeTab === 'information'}
				<InformationTab />
			{:else if activeTab === 'config'}
				<ConfigEditor />
			{:else if activeTab === 'devices'}
				<DeviceManagement />
			{:else if activeTab === 'logs'}
				<LiveLogs />
			{:else if activeTab === 'approvals'}
				<ExecApprovals />
			{:else if activeTab === 'workspace'}
				<WorkspaceFiles />
			{:else if activeTab === 'canvas'}
				<CanvasDiagnosticsTab />
			{:else if activeTab === 'gateway-control'}
				<GatewayControlTab />
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
