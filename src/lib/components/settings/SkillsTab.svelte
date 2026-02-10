<script lang="ts">
	import { call, connection } from '$lib/stores/gateway.js';

	type Skill = {
		key: string;
		name: string;
		description: string;
		version: string;
		enabled: boolean;
		hasApiKey: boolean;
		docs?: string;
	};

	type SkillsStatusResponse = {
		skills: Skill[];
	};

	let skills = $state<Skill[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let expandedSkill = $state<string | null>(null);
	let apiKeyModalSkill = $state<string | null>(null);
	let apiKeyInput = $state('');
	let apiKeyLoading = $state(false);
	let installModalOpen = $state(false);
	let installName = $state('');
	let installId = $state('');
	let installLoading = $state(false);

	async function loadSkills() {
		loading = true;
		error = null;
		try {
			const response = await call<SkillsStatusResponse>('skills.status');
			skills = response.skills;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load skills';
		} finally {
			loading = false;
		}
	}

	async function toggleEnabled(skill: Skill) {
		const originalEnabled = skill.enabled;
		skill.enabled = !skill.enabled;

		try {
			await call('skills.update', { skillKey: skill.key, enabled: skill.enabled });
		} catch (e) {
			skill.enabled = originalEnabled;
			error = e instanceof Error ? e.message : 'Failed to update skill';
		}
	}

	function openApiKeyModal(skillKey: string) {
		apiKeyModalSkill = skillKey;
		apiKeyInput = '';
	}

	function closeApiKeyModal() {
		apiKeyModalSkill = null;
		apiKeyInput = '';
		apiKeyLoading = false;
	}

	async function saveApiKey() {
		if (!apiKeyModalSkill || !apiKeyInput.trim()) return;

		apiKeyLoading = true;
		error = null;

		try {
			await call('skills.update', { skillKey: apiKeyModalSkill, apiKey: apiKeyInput });
			const skill = skills.find((s) => s.key === apiKeyModalSkill);
			if (skill) {
				skill.hasApiKey = true;
			}
			closeApiKeyModal();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save API key';
		} finally {
			apiKeyLoading = false;
		}
	}

	function openInstallModal() {
		installModalOpen = true;
		installName = '';
		installId = '';
	}

	function closeInstallModal() {
		installModalOpen = false;
		installName = '';
		installId = '';
		installLoading = false;
	}

	async function installSkill() {
		if (!installName.trim()) return;

		installLoading = true;
		error = null;

		try {
			const params: { name: string; installId?: string; timeoutMs: number } = {
				name: installName,
				timeoutMs: 120000
			};
			if (installId.trim()) {
				params.installId = installId;
			}

			await call('skills.install', params);
			closeInstallModal();
			await loadSkills();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to install skill';
		} finally {
			installLoading = false;
		}
	}

	function toggleExpanded(skillKey: string) {
		expandedSkill = expandedSkill === skillKey ? null : skillKey;
	}

	let connectionState = $state('DISCONNECTED');
	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState === 'READY') loadSkills();
	});
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<div class="text-xs font-medium text-gray-400">Skills Management</div>
		<button
			onclick={openInstallModal}
			class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
		>
			Install Skill
		</button>
	</div>

	{#if error}
		<div class="rounded bg-red-900/20 p-2 text-xs text-red-400">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="text-xs text-gray-400">Loading skills...</div>
	{:else if skills.length === 0}
		<div class="text-xs text-gray-500">No skills available</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each skills as skill (skill.key)}
				<div class="rounded border border-gray-700 bg-gray-800/50 p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-200">{skill.name}</span>
								<span class="text-xs text-gray-500">v{skill.version}</span>
								{#if skill.hasApiKey}
									<span class="rounded bg-green-900/30 px-1.5 py-0.5 text-xs text-green-400">
										API Key Set
									</span>
								{/if}
							</div>
							<div class="mt-1 text-xs text-gray-400">{skill.description}</div>
						</div>
						<div class="flex items-center gap-2">
							<button
								onclick={() => openApiKeyModal(skill.key)}
								class="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
							>
								API Key
							</button>
							<label class="flex items-center gap-1.5">
								<input
									type="checkbox"
									checked={skill.enabled}
									onchange={() => toggleEnabled(skill)}
									class="rounded"
								/>
								<span class="text-xs text-gray-400">Enabled</span>
							</label>
						</div>
					</div>

					{#if skill.docs}
						<button
							onclick={() => toggleExpanded(skill.key)}
							class="mt-2 text-xs text-blue-400 hover:text-blue-300"
						>
							{expandedSkill === skill.key ? 'Hide' : 'Show'} Details
						</button>

						{#if expandedSkill === skill.key}
							<div class="mt-2 rounded bg-gray-900/50 p-2 text-xs text-gray-300">
								{skill.docs}
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- API Key Modal -->
{#if apiKeyModalSkill}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
		onclick={closeApiKeyModal}
	>
		<div
			class="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-4"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-3 text-sm font-medium text-gray-200">Set API Key</h3>
			<input
				type="password"
				bind:value={apiKeyInput}
				placeholder="Enter API key"
				class="mb-3 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
			/>
			<div class="flex justify-end gap-2">
				<button
					onclick={closeApiKeyModal}
					disabled={apiKeyLoading}
					class="rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={saveApiKey}
					disabled={apiKeyLoading || !apiKeyInput.trim()}
					class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{apiKeyLoading ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Install Skill Modal -->
{#if installModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
		onclick={closeInstallModal}
	>
		<div
			class="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-4"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-3 text-sm font-medium text-gray-200">Install Skill</h3>
			<div class="mb-3">
				<label class="mb-1 block text-xs text-gray-400">Skill Name *</label>
				<input
					type="text"
					bind:value={installName}
					placeholder="e.g., @modelcontextprotocol/server-brave-search"
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
				/>
			</div>
			<div class="mb-3">
				<label class="mb-1 block text-xs text-gray-400">Install ID (optional)</label>
				<input
					type="text"
					bind:value={installId}
					placeholder="Custom identifier"
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
				/>
			</div>
			<div class="flex justify-end gap-2">
				<button
					onclick={closeInstallModal}
					disabled={installLoading}
					class="rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={installSkill}
					disabled={installLoading || !installName.trim()}
					class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{installLoading ? 'Installing...' : 'Install'}
				</button>
			</div>
		</div>
	</div>
{/if}
