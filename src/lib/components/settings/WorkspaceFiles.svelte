<script lang="ts">
	import MarkdownRenderer from '../MarkdownRenderer.svelte';
	import * as Avatar from '$lib/components/ui/avatar/index.js';

	interface AgentEntry {
		id: string;
		workspace: string;
		identity?: { name: string; emoji?: string; theme?: string };
	}

	const TABS = [
		{ path: 'SOUL.md', label: 'Soul' },
		{ path: 'AGENTS.md', label: 'Agents' },
		{ path: 'IDENTITY.md', label: 'Identity' },
		{ path: 'MEMORY.md', label: 'Memory' }
	];

	let agents = $state<AgentEntry[]>([]);
	let selectedAgentId = $state('');
	let loadingAgents = $state(true);

	let activeTab = $state(TABS[0].path);
	let fileContent = $state('');
	let fileExists = $state(false);
	let loadingContent = $state(true);
	let isEditing = $state(false);
	let editContent = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	async function fetchAgents() {
		loadingAgents = true;
		try {
			const res = await fetch('/api/agents');
			if (!res.ok) throw new Error('Failed to load agents');
			const data = await res.json();
			agents = data.agents;
			if (agents.length > 0 && !selectedAgentId) {
				selectedAgentId = agents[0].id;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load agents';
		} finally {
			loadingAgents = false;
		}
	}

	function agentDisplayName(agent: AgentEntry): string {
		return agent.identity?.name || agent.id;
	}

	function agentInitial(agent: AgentEntry): string {
		const name = agentDisplayName(agent);
		return name.charAt(0).toUpperCase();
	}

	async function loadTab(path: string, agentId: string) {
		if (!agentId) return;
		loadingContent = true;
		fileContent = '';
		fileExists = false;
		isEditing = false;
		error = null;
		try {
			const params = new URLSearchParams({ path, agentId });
			const res = await fetch(`/api/workspace-file?${params}`);
			if (res.status === 404) {
				fileExists = false;
			} else if (!res.ok) {
				throw new Error(await res.text());
			} else {
				const data: { content: string; hash: string } = await res.json();
				fileContent = data.content;
				fileExists = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load file';
		} finally {
			loadingContent = false;
		}
	}

	function selectTab(path: string) {
		activeTab = path;
		loadTab(path, selectedAgentId);
	}

	function selectAgent(agentId: string) {
		selectedAgentId = agentId;
		isEditing = false;
		loadTab(activeTab, agentId);
	}

	function startEditing() {
		editContent = fileContent;
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
		editContent = '';
	}

	async function saveFile() {
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/workspace-file', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: activeTab, content: editContent, agentId: selectedAgentId })
			});
			if (!res.ok) throw new Error(await res.text());
			fileContent = editContent;
			fileExists = true;
			isEditing = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save file';
		} finally {
			saving = false;
		}
	}

	async function createFile() {
		saving = true;
		error = null;
		try {
			const template = `# ${activeTab.replace('.md', '')}\n\n`;
			const res = await fetch('/api/workspace-file', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: activeTab, content: template, agentId: selectedAgentId })
			});
			if (!res.ok) throw new Error(await res.text());
			fileContent = template;
			fileExists = true;
			editContent = template;
			isEditing = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create file';
		} finally {
			saving = false;
		}
	}

	// Fetch agents on mount, then load first tab
	$effect(() => {
		fetchAgents();
	});

	// Load tab when selectedAgentId becomes available
	$effect(() => {
		if (selectedAgentId) {
			loadTab(activeTab, selectedAgentId);
		}
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Agent Picker -->
	{#if loadingAgents}
		<div class="border-b border-gray-700/50 px-4 py-3">
			<div class="text-sm text-gray-500">Loading agents...</div>
		</div>
	{:else if agents.length > 1}
		<div class="flex gap-2 overflow-x-auto border-b border-gray-700/50 px-4 py-3">
			{#each agents as agent (agent.id)}
				<button
					onclick={() => selectAgent(agent.id)}
					class="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors {selectedAgentId ===
					agent.id
						? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
						: 'border-gray-700/50 text-gray-400 hover:border-gray-600'}"
				>
					<Avatar.Root class="h-5 w-5 rounded-lg text-xs">
						<Avatar.Fallback class="rounded-lg bg-gray-700 text-[10px]">
							{agent.identity?.emoji || agentInitial(agent)}
						</Avatar.Fallback>
					</Avatar.Root>
					{agentDisplayName(agent)}
				</button>
			{/each}
		</div>
	{/if}

	<!-- File Tabs -->
	<div class="flex border-b border-gray-700/50">
		{#each TABS as tab (tab.path)}
			<button
				onclick={() => selectTab(tab.path)}
				class="flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors {activeTab ===
				tab.path
					? 'border-blue-500 text-blue-400'
					: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if error}
		<div
			class="flex items-center gap-2 border-b border-red-800/50 bg-red-950/40 px-4 py-2 text-sm text-red-300"
		>
			<span class="flex-1">{error}</span>
			<button
				onclick={() => {
					error = null;
				}}
				class="text-xs text-red-400 hover:text-red-200"
			>
				Dismiss
			</button>
		</div>
	{/if}

	<!-- Toolbar -->
	{#if !loadingContent && fileExists}
		<div class="flex items-center justify-between border-b border-gray-700/50 px-4 py-2">
			<span class="text-xs text-gray-500">{activeTab}</span>
			<div class="flex items-center gap-2">
				{#if isEditing}
					<button
						onclick={cancelEditing}
						class="rounded px-3 py-1 text-xs text-gray-400 transition-colors hover:text-white"
					>
						Cancel
					</button>
					<button
						onclick={saveFile}
						disabled={saving}
						class="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
				{:else}
					<button
						onclick={startEditing}
						class="rounded bg-gray-700 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
					>
						Edit
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-y-auto">
		{#if loadingContent}
			<div class="flex items-center justify-center py-12 text-sm text-gray-500">Loading...</div>
		{:else if !fileExists}
			<div class="flex flex-col items-center justify-center gap-4 py-16">
				<div class="text-center">
					<p class="text-sm text-gray-400">
						<span class="font-medium text-gray-300">{activeTab}</span> doesn't exist yet
					</p>
					<p class="mt-1 text-xs text-gray-500">Create it to start configuring your agent</p>
				</div>
				<button
					onclick={createFile}
					disabled={saving}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
				>
					{saving ? 'Creating...' : 'Create File'}
				</button>
			</div>
		{:else if isEditing}
			<textarea
				bind:value={editContent}
				class="h-full w-full resize-none bg-gray-950 p-4 font-mono text-sm leading-relaxed text-gray-300 focus:outline-none"
				spellcheck="false"
			></textarea>
		{:else}
			<div class="p-4">
				<MarkdownRenderer content={fileContent} />
			</div>
		{/if}
	</div>
</div>
