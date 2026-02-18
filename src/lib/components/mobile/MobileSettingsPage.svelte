<script lang="ts">
	import MobileSettingsHome from './MobileSettingsHome.svelte';
	import ChannelsPage from './settings/ChannelsPage.svelte';
	import AgentsPage from './settings/AgentsPage.svelte';
	import SkillsPage from './settings/SkillsPage.svelte';
	import ToolsPage from './settings/ToolsPage.svelte';
	import HooksPage from './settings/HooksPage.svelte';
	import AnalyticsPage from './settings/AnalyticsPage.svelte';
	import LogsPage from './settings/LogsPage.svelte';
	import AdvancedPage from './settings/AdvancedPage.svelte';
	import ConfigPage from './settings/ConfigPage.svelte';
	import SubscriptionPage from './settings/SubscriptionPage.svelte';
	import LanguagePage from './settings/LanguagePage.svelte';

	let activeSettingsPage = $state<string | null>(null);

	function goBack() {
		activeSettingsPage = null;
	}
</script>

{#if activeSettingsPage === null}
	<MobileSettingsHome onnavigate={(id) => (activeSettingsPage = id)} />
{:else if activeSettingsPage === 'channels'}
	<ChannelsPage onback={goBack} />
{:else if activeSettingsPage === 'agents'}
	<AgentsPage onback={goBack} />
{:else if activeSettingsPage === 'skills'}
	<SkillsPage onback={goBack} />
{:else if activeSettingsPage === 'tools'}
	<ToolsPage onback={goBack} />
{:else if activeSettingsPage === 'hooks'}
	<HooksPage onback={goBack} />
{:else if activeSettingsPage === 'analytics'}
	<AnalyticsPage onback={goBack} />
{:else if activeSettingsPage === 'logs'}
	<LogsPage onback={goBack} />
{:else if activeSettingsPage === 'advanced'}
	<AdvancedPage onback={goBack} />
{:else if activeSettingsPage === 'config'}
	<ConfigPage onback={goBack} />
{:else if activeSettingsPage === 'subscription'}
	<SubscriptionPage onback={goBack} />
{:else if activeSettingsPage === 'language'}
	<LanguagePage onback={goBack} />
{/if}
