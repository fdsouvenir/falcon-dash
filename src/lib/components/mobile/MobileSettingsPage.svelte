<script lang="ts">
	import MobileSettingsHome from './MobileSettingsHome.svelte';
	import ChannelsPage from './settings/ChannelsPage.svelte';
	import AgentsPage from './settings/AgentsPage.svelte';
	import SkillsPage from './settings/SkillsPage.svelte';
	import ToolsPage from './settings/ToolsPage.svelte';
	import AnalyticsPage from './settings/AnalyticsPage.svelte';
	import LogsPage from './settings/LogsPage.svelte';
	import AdvancedPage from './settings/AdvancedPage.svelte';
	import SubscriptionPage from './settings/SubscriptionPage.svelte';

	let activeSettingsPage = $state<string | null>(null);

	function goBack() {
		activeSettingsPage = null;
	}
</script>

{#if activeSettingsPage === null}
	<MobileSettingsHome onnavigate={(id) => (activeSettingsPage = id)} />
{:else if activeSettingsPage === 'user'}
	<div class="flex h-full flex-col bg-gray-950">
		<div class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
			<button
				onclick={goBack}
				class="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-gray-400"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<h2 class="text-sm font-semibold text-white">User</h2>
		</div>
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-gray-500">Coming soon</p>
		</div>
	</div>
{:else if activeSettingsPage === 'channels'}
	<ChannelsPage onback={goBack} />
{:else if activeSettingsPage === 'agents'}
	<AgentsPage onback={goBack} />
{:else if activeSettingsPage === 'skills'}
	<SkillsPage onback={goBack} />
{:else if activeSettingsPage === 'tools'}
	<ToolsPage onback={goBack} />
{:else if activeSettingsPage === 'dashboard'}
	<div class="flex h-full flex-col bg-gray-950">
		<div class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
			<button
				onclick={goBack}
				class="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-gray-400"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<h2 class="text-sm font-semibold text-white">Dashboard</h2>
		</div>
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-gray-500">Coming soon</p>
		</div>
	</div>
{:else if activeSettingsPage === 'analytics'}
	<AnalyticsPage onback={goBack} />
{:else if activeSettingsPage === 'logs'}
	<LogsPage onback={goBack} />
{:else if activeSettingsPage === 'advanced'}
	<AdvancedPage onback={goBack} />
{:else if activeSettingsPage === 'subscription'}
	<SubscriptionPage onback={goBack} />
{/if}
