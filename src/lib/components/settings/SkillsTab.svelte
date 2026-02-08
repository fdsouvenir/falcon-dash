<script lang="ts">
	import { onMount } from 'svelte';
	import { skills, loadSkills, enableSkill, disableSkill, patchConfig } from '$lib/stores';
	import type { SkillEntry } from '$lib/types/settings';

	let loading = true;
	let error = '';
	let expandedSkillId: string | null = null;
	let editingSkillId: string | null = null;
	let editConfigJson = '';
	let editConfigError = '';
	let saving = false;
	let toastMessage = '';
	let toastType: 'success' | 'error' = 'success';
	let toastTimeout: ReturnType<typeof setTimeout> | undefined;

	function showToast(message: string, type: 'success' | 'error'): void {
		if (toastTimeout) clearTimeout(toastTimeout);
		toastMessage = message;
		toastType = type;
		toastTimeout = setTimeout(() => {
			toastMessage = '';
		}, 3000);
	}

	function hasMissingConfig(skill: SkillEntry): boolean {
		if (!skill.requiredConfig || skill.requiredConfig.length === 0) return false;
		const config = skill.config ?? {};
		return skill.requiredConfig.some(
			(key) => config[key] === undefined || config[key] === null || config[key] === ''
		);
	}

	function getMissingKeys(skill: SkillEntry): string[] {
		if (!skill.requiredConfig || skill.requiredConfig.length === 0) return [];
		const config = skill.config ?? {};
		return skill.requiredConfig.filter(
			(key) => config[key] === undefined || config[key] === null || config[key] === ''
		);
	}

	function toggleExpand(skillId: string): void {
		if (expandedSkillId === skillId) {
			expandedSkillId = null;
			editingSkillId = null;
		} else {
			expandedSkillId = skillId;
			editingSkillId = null;
		}
	}

	function startEditConfig(skill: SkillEntry): void {
		editingSkillId = skill.id;
		editConfigJson = JSON.stringify(skill.config ?? {}, null, '\t');
		editConfigError = '';
	}

	function cancelEditConfig(): void {
		editingSkillId = null;
		editConfigJson = '';
		editConfigError = '';
	}

	async function saveSkillConfig(skill: SkillEntry): Promise<void> {
		editConfigError = '';
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(editConfigJson);
		} catch {
			editConfigError = 'Invalid JSON';
			return;
		}

		saving = true;
		try {
			await patchConfig({
				key: `skills.entries.${skill.id}.config`,
				value: parsed
			});
			await loadSkills();
			editingSkillId = null;
			editConfigJson = '';
			showToast(`Configuration saved for ${skill.name}`, 'success');
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to save configuration';
			showToast(msg, 'error');
		} finally {
			saving = false;
		}
	}

	async function handleToggle(skill: SkillEntry): Promise<void> {
		try {
			if (skill.enabled) {
				await disableSkill(skill.id);
				showToast(`${skill.name} disabled`, 'success');
			} else {
				await enableSkill(skill.id);
				showToast(`${skill.name} enabled`, 'success');
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to toggle skill';
			showToast(msg, 'error');
		}
	}

	onMount(async () => {
		try {
			await loadSkills();
		} catch {
			error = 'Failed to load skills';
		} finally {
			loading = false;
		}
	});
</script>

<div class="space-y-4 overflow-y-auto p-6">
	{#if toastMessage}
		<div
			class="fixed right-4 top-4 z-50 rounded-lg px-4 py-2 text-sm shadow-lg {toastType ===
			'success'
				? 'bg-green-600 text-white'
				: 'bg-red-600 text-white'}"
		>
			{toastMessage}
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<p class="text-sm text-slate-400">Loading skills...</p>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-800/50 bg-red-900/20 p-4">
			<p class="text-sm text-red-400">{error}</p>
		</div>
	{:else if $skills.length === 0}
		<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-center">
			<p class="text-sm text-slate-400">No skills installed.</p>
			<p class="mt-1 text-xs text-slate-500">
				Skills extend agent capabilities. Install skills via the gateway configuration.
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each $skills as skill (skill.id)}
				<div class="rounded-lg border border-slate-700 bg-slate-800/50">
					<!-- Skill header row -->
					<div class="flex items-center gap-3 px-4 py-3">
						<!-- Expand toggle -->
						<button
							on:click={() => toggleExpand(skill.id)}
							class="flex-shrink-0 text-slate-400 transition-colors hover:text-slate-200"
							aria-label={expandedSkillId === skill.id
								? 'Collapse configuration'
								: 'Expand configuration'}
						>
							<svg
								class="h-4 w-4 transition-transform {expandedSkillId === skill.id
									? 'rotate-90'
									: ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</button>

						<!-- Skill info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-slate-200">{skill.name}</span>
								<span class="text-xs text-slate-500">v{skill.version}</span>
								{#if hasMissingConfig(skill)}
									<span
										class="rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400"
										title="Missing required configuration: {getMissingKeys(skill).join(', ')}"
									>
										Config needed
									</span>
								{/if}
							</div>
							{#if skill.description}
								<p class="mt-0.5 truncate text-xs text-slate-400">{skill.description}</p>
							{/if}
						</div>

						<!-- Enable/disable toggle -->
						<button
							on:click={() => handleToggle(skill)}
							class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors {skill.enabled
								? 'bg-blue-600'
								: 'bg-slate-600'}"
							role="switch"
							aria-checked={skill.enabled}
							aria-label="{skill.enabled ? 'Disable' : 'Enable'} {skill.name}"
						>
							<span
								class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform {skill.enabled
									? 'translate-x-4'
									: 'translate-x-0.5'}"
							></span>
						</button>
					</div>

					<!-- Expanded config section -->
					{#if expandedSkillId === skill.id}
						<div class="border-t border-slate-700 px-4 py-3">
							{#if editingSkillId === skill.id}
								<!-- Config editor -->
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<label for="skill-config-{skill.id}" class="text-xs font-medium text-slate-400">
											Configuration (JSON)
										</label>
										{#if editConfigError}
											<span class="text-xs text-red-400">{editConfigError}</span>
										{/if}
									</div>
									<textarea
										id="skill-config-{skill.id}"
										bind:value={editConfigJson}
										class="h-40 w-full resize-y rounded border border-slate-600 bg-slate-900 p-3 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
										spellcheck="false"
									></textarea>
									<div class="flex gap-2">
										<button
											on:click={() => saveSkillConfig(skill)}
											disabled={saving}
											class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
										>
											{saving ? 'Saving...' : 'Save'}
										</button>
										<button
											on:click={cancelEditConfig}
											class="rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-600"
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<!-- Config display -->
								<div class="space-y-3">
									{#if skill.config && Object.keys(skill.config).length > 0}
										<div>
											<h4 class="mb-1.5 text-xs font-medium text-slate-400">Configuration</h4>
											<div class="space-y-1">
												{#each Object.entries(skill.config) as [key, value]}
													<div class="flex items-baseline justify-between gap-4 text-xs">
														<span class="text-slate-400">{key}</span>
														<span class="truncate text-right font-mono text-slate-300">
															{#if typeof value === 'string' && value.length > 8 && (key
																	.toLowerCase()
																	.includes('key') || key.toLowerCase().includes('secret') || key
																		.toLowerCase()
																		.includes('token'))}
																{value.slice(0, 4)}{'•'.repeat(4)}{value.slice(-4)}
															{:else}
																{JSON.stringify(value)}
															{/if}
														</span>
													</div>
												{/each}
											</div>
										</div>
									{:else}
										<p class="text-xs text-slate-500">No configuration set.</p>
									{/if}

									{#if hasMissingConfig(skill)}
										<div class="rounded border border-yellow-800/30 bg-yellow-900/10 px-3 py-2">
											<p class="text-xs text-yellow-400">
												Missing required configuration:
												<span class="font-mono">
													{getMissingKeys(skill).join(', ')}
												</span>
											</p>
										</div>
									{/if}

									<button
										on:click={() => startEditConfig(skill)}
										class="rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-600"
									>
										Edit Configuration
									</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
