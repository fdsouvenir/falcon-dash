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
	let installRegistry = $state('');
	let installLoading = $state(false);
	let searchQuery = $state('');
	let skillErrors = $state<Record<string, string>>({});
	let uninstallConfirmSkill = $state<string | null>(null);
	let uninstallLoading = $state(false);
	let refreshing = $state(false);

	let filteredSkills = $derived(
		searchQuery.trim()
			? skills.filter((s) => {
					const q = searchQuery.toLowerCase();
					return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
				})
			: skills
	);

	async function loadSkills() {
		loading = true;
		error = null;
		skillErrors = {};
		try {
			const response = await call<SkillsStatusResponse>('skills.status');
			skills = response.skills;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load skills';
		} finally {
			loading = false;
		}
	}

	async function refreshSkills() {
		refreshing = true;
		error = null;
		skillErrors = {};
		try {
			const response = await call<SkillsStatusResponse>('skills.status');
			skills = response.skills;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load skills';
		} finally {
			refreshing = false;
		}
	}

	async function toggleEnabled(skill: Skill) {
		const originalEnabled = skill.enabled;
		skill.enabled = !skill.enabled;
		delete skillErrors[skill.key];

		try {
			await call('skills.update', { skillKey: skill.key, enabled: skill.enabled });
		} catch (e) {
			skill.enabled = originalEnabled;
			skillErrors[skill.key] = e instanceof Error ? e.message : 'Failed to update skill';
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
		delete skillErrors[apiKeyModalSkill];

		try {
			await call('skills.update', { skillKey: apiKeyModalSkill, apiKey: apiKeyInput });
			const skill = skills.find((s) => s.key === apiKeyModalSkill);
			if (skill) {
				skill.hasApiKey = true;
			}
			closeApiKeyModal();
		} catch (e) {
			if (apiKeyModalSkill) {
				skillErrors[apiKeyModalSkill] = e instanceof Error ? e.message : 'Failed to save API key';
			}
		} finally {
			apiKeyLoading = false;
		}
	}

	function openInstallModal() {
		installModalOpen = true;
		installName = '';
		installId = '';
		installRegistry = '';
	}

	function closeInstallModal() {
		installModalOpen = false;
		installName = '';
		installId = '';
		installRegistry = '';
		installLoading = false;
	}

	async function installSkill() {
		if (!installName.trim()) return;

		installLoading = true;
		error = null;

		try {
			const params: { name: string; installId?: string; registry?: string; timeoutMs: number } = {
				name: installName,
				timeoutMs: 120000
			};
			if (installId.trim()) {
				params.installId = installId;
			}
			if (installRegistry.trim()) {
				params.registry = installRegistry;
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

	async function uninstallSkill(skillKey: string) {
		uninstallLoading = true;
		delete skillErrors[skillKey];

		try {
			await call('skills.uninstall', { skillKey });
			skills = skills.filter((s) => s.key !== skillKey);
			uninstallConfirmSkill = null;
		} catch (e) {
			skillErrors[skillKey] = e instanceof Error ? e.message : 'Failed to uninstall skill';
			uninstallConfirmSkill = null;
		} finally {
			uninstallLoading = false;
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
		<div class="flex items-center gap-2">
			<div class="text-xs font-medium text-gray-400">Skills Management</div>
			<button
				onclick={refreshSkills}
				disabled={refreshing}
				class="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-50"
				title="Refresh skills"
			>
				<svg
					class="h-3.5 w-3.5 {refreshing ? 'animate-spin' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
			</button>
		</div>
		<button
			onclick={openInstallModal}
			class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
		>
			Install Skill
		</button>
	</div>

	{#if !loading && skills.length > 0}
		<div class="relative">
			<svg
				class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Filter skills..."
				class="w-full rounded border border-gray-700 bg-gray-900 py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none"
			/>
		</div>
	{/if}

	{#if error}
		<div class="rounded bg-red-900/20 p-2 text-xs text-red-400">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="flex flex-col gap-2">
			{#each [1, 2, 3] as _i (_i)}
				<div class="animate-pulse rounded border border-gray-700 bg-gray-800/50 p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<div class="h-4 w-28 rounded bg-gray-700"></div>
								<div class="h-3 w-10 rounded bg-gray-700"></div>
							</div>
							<div class="mt-2 h-3 w-48 rounded bg-gray-700"></div>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-6 w-16 rounded bg-gray-700"></div>
							<div class="h-4 w-4 rounded bg-gray-700"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if skills.length === 0}
		<div class="flex flex-col items-center gap-3 rounded border border-dashed border-gray-700 py-8">
			<svg class="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
				/>
			</svg>
			<div class="text-xs text-gray-500">No skills installed</div>
			<button
				onclick={openInstallModal}
				class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
			>
				Install Your First Skill
			</button>
		</div>
	{:else if filteredSkills.length === 0}
		<div class="py-4 text-center text-xs text-gray-500">
			No skills match "{searchQuery}"
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each filteredSkills as skill (skill.key)}
				<div class="rounded border border-gray-700 bg-gray-800/50 p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span
									class="h-2 w-2 flex-shrink-0 rounded-full {skill.enabled
										? skill.hasApiKey || !skill.description.toLowerCase().includes('api')
											? 'bg-green-400'
											: 'bg-yellow-400'
										: 'bg-red-400'}"
									title={skill.enabled
										? skill.hasApiKey || !skill.description.toLowerCase().includes('api')
											? 'Enabled'
											: 'Enabled (may need API key)'
										: 'Disabled'}
								></span>
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
							{#if uninstallConfirmSkill === skill.key}
								<button
									onclick={() => uninstallSkill(skill.key)}
									disabled={uninstallLoading}
									class="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
								>
									{uninstallLoading ? 'Removing...' : 'Confirm'}
								</button>
								<button
									onclick={() => (uninstallConfirmSkill = null)}
									disabled={uninstallLoading}
									class="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
								>
									Cancel
								</button>
							{:else}
								<button
									onclick={() => (uninstallConfirmSkill = skill.key)}
									class="rounded bg-gray-700 px-2 py-1 text-xs text-red-400 hover:bg-gray-600"
									title="Uninstall skill"
								>
									Uninstall
								</button>
							{/if}
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

					{#if skillErrors[skill.key]}
						<div class="mt-2 rounded bg-red-900/20 px-2 py-1 text-xs text-red-400">
							{skillErrors[skill.key]}
						</div>
					{/if}

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
		role="presentation"
		onclick={closeApiKeyModal}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeApiKeyModal();
		}}
	>
		<div
			class="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-4"
			role="dialog"
			aria-labelledby="api-key-modal-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h3 id="api-key-modal-title" class="mb-3 text-sm font-medium text-gray-200">Set API Key</h3>
			<label for="api-key-input" class="sr-only">API Key</label>
			<input
				id="api-key-input"
				type="password"
				bind:value={apiKeyInput}
				placeholder="Enter API key"
				class="mb-3 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
			/>
			{#if skillErrors[apiKeyModalSkill]}
				<div class="mb-3 rounded bg-red-900/20 px-2 py-1 text-xs text-red-400">
					{skillErrors[apiKeyModalSkill]}
				</div>
			{/if}
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
		role="presentation"
		onclick={closeInstallModal}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeInstallModal();
		}}
	>
		<div
			class="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-4"
			role="dialog"
			aria-labelledby="install-skill-modal-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h3 id="install-skill-modal-title" class="mb-1 text-sm font-medium text-gray-200">
				Install Skill
			</h3>
			<p class="mb-3 text-xs text-gray-500">
				Skills are npm packages. Enter the full package name to install.
			</p>
			<div class="mb-3">
				<label for="install-name-input" class="mb-1 block text-xs text-gray-400">Skill Name *</label
				>
				<input
					id="install-name-input"
					type="text"
					bind:value={installName}
					placeholder="e.g., @modelcontextprotocol/server-brave-search"
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
				/>
				<div class="mt-1 text-xs text-gray-600">Scoped packages use @scope/package-name format</div>
			</div>
			<div class="mb-3">
				<label for="install-id-input" class="mb-1 block text-xs text-gray-400"
					>Install ID (optional)</label
				>
				<input
					id="install-id-input"
					type="text"
					bind:value={installId}
					placeholder="Custom identifier for this installation"
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
				/>
			</div>
			<div class="mb-3">
				<label for="install-registry-input" class="mb-1 block text-xs text-gray-400"
					>Registry URL (optional)</label
				>
				<input
					id="install-registry-input"
					type="text"
					bind:value={installRegistry}
					placeholder="https://registry.npmjs.org"
					class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200"
				/>
				<div class="mt-1 text-xs text-gray-600">Leave blank for default npm registry</div>
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
