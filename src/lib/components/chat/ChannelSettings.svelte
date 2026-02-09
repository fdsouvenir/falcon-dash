<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { Session } from '$lib/gateway/types';
	import { models, loadModels, updateSession } from '$lib/stores';

	interface Props {
		session: Session;
		open?: boolean;
	}

	let { session, open = false }: Props = $props();

	const dispatch = createEventDispatcher<{ close: void }>();

	let displayName = $state('');
	let selectedModel = $state('');
	let thinkingLevel = $state('off');

	$effect(() => {
		if (session) {
			displayName = session.displayName;
			selectedModel = session.model || '';
			thinkingLevel = session.thinkingLevel || 'off';
		}
	});

	onMount(() => {
		loadModels();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			dispatch('close');
		}
	}

	function handleBackdropClick() {
		dispatch('close');
	}

	async function handleRename() {
		const trimmed = displayName.trim();
		if (trimmed && trimmed !== session.displayName) {
			await updateSession(session.key, { displayName: trimmed });
		}
	}

	async function handleModelChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const value = target.value;
		selectedModel = value;
		await updateSession(session.key, { model: value || undefined });
	}

	async function setThinkingLevel(level: string) {
		thinkingLevel = level;
		await updateSession(session.key, { thinkingLevel: level });
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="absolute inset-0 z-40 bg-black/30" onclick={handleBackdropClick}></div>

	<!-- Panel -->
	<div
		class="absolute right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-slate-700 bg-slate-800 shadow-xl"
		transition:fly={{ x: 320, duration: 200 }}
	>
		<!-- Panel header -->
		<div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
			<h3 class="text-sm font-semibold text-slate-200">Session Settings</h3>
			<button
				class="cursor-pointer text-slate-400 transition-colors hover:text-slate-200"
				onclick={() => dispatch('close')}
				title="Close settings"
				aria-label="Close settings"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		</div>

		<!-- Panel body -->
		<div class="flex-1 space-y-6 overflow-y-auto px-4 py-4">
			<!-- Session name -->
			<div>
				<label for="session-name" class="mb-1.5 block text-xs font-medium text-slate-400">
					Session Name
				</label>
				<input
					id="session-name"
					type="text"
					bind:value={displayName}
					onblur={handleRename}
					onkeydown={(e) => {
						if (e.key === 'Enter') handleRename();
					}}
					class="w-full rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500"
				/>
			</div>

			<!-- Model selection -->
			<div>
				<label for="model-select" class="mb-1.5 block text-xs font-medium text-slate-400">
					Model
				</label>
				<select
					id="model-select"
					value={selectedModel}
					onchange={handleModelChange}
					class="w-full cursor-pointer rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500"
				>
					<option value="">Default</option>
					{#each $models as model (model.id)}
						<option value={model.id}>{model.name}</option>
					{/each}
				</select>
			</div>

			<!-- Thinking level -->
			<div>
				<span class="mb-1.5 block text-xs font-medium text-slate-400">Thinking</span>
				<div class="flex gap-1">
					{#each ['off', 'on', 'stream'] as level (level)}
						<button
							class="flex-1 cursor-pointer rounded px-3 py-1.5 text-xs font-medium transition-colors {thinkingLevel ===
							level
								? 'bg-blue-600 text-white'
								: 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}"
							onclick={() => setThinkingLevel(level)}
						>
							{level.charAt(0).toUpperCase() + level.slice(1)}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
