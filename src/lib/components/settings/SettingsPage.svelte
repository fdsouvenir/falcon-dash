<script lang="ts">
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
		{ id: 'user', label: 'User', component: UserTab },
		{ id: 'agents', label: 'Agents', component: AgentsTab },
		{ id: 'preferences', label: 'Preferences', component: PreferencesTab },
		{ id: 'information', label: 'Information', component: InformationTab },
		{ id: 'config', label: 'Config', component: ConfigEditor },
		{ id: 'devices', label: 'Devices', component: DeviceManagement },
		{ id: 'logs', label: 'Logs', component: LiveLogs },
		{ id: 'approvals', label: 'Approvals', component: ExecApprovals },
		{ id: 'workspace', label: 'Workspace', component: WorkspaceFiles },
		{ id: 'canvas', label: 'Canvas', component: CanvasDiagnosticsTab },
		{ id: 'gateway-control', label: 'Gateway Control', component: GatewayControlTab },
		{ id: 'terminal', label: 'Terminal', component: TerminalTab },
		{ id: 'about', label: 'About', component: AboutTab }
	] as const;

	let activeTab = $state<string>('user');

	function selectTab(id: string) {
		activeTab = id;
	}

	let activeComponent = $derived(tabs.find((t) => t.id === activeTab)?.component ?? PreferencesTab);
</script>

<div class="flex h-full flex-col">
	<!-- Tab bar -->
	<div class="border-b border-gray-700 bg-gray-900">
		<div class="flex overflow-x-auto px-4">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => selectTab(tab.id)}
					class="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab ===
					tab.id
						? 'border-blue-500 text-blue-400'
						: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{#key activeTab}
			<svelte:component this={activeComponent} />
		{/key}
	</div>
</div>
