<script lang="ts">
	import SkillsTab from '$lib/components/settings/SkillsTab.svelte';
</script>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-border px-4 py-4 sm:px-6">
		<h1 class="text-xl font-bold text-white">Skills</h1>
		<p class="text-sm text-status-muted">Manage agent skills and integrations</p>
	</div>
	<div class="flex-1 overflow-y-auto p-4 sm:p-6">
		<SkillsTab />
	</div>
</div>
