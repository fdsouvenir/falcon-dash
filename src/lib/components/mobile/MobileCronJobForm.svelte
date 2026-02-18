<script lang="ts">
	import {
		createCronJob,
		updateCronJob,
		type CronJob,
		type CronJobInput
	} from '$lib/stores/cron.js';
	import { describeCron, CRON_PRESETS } from '$lib/cron-utils.js';

	let { job = null, onback }: { job: CronJob | null; onback: () => void } = $props();

	let name = $state(job?.name ?? '');
	let description = $state(job?.description ?? '');
	let scheduleType = $state<'cron' | 'interval' | 'one-shot'>(job?.scheduleType ?? 'cron');
	let schedule = $state(job?.schedule ?? '*/5 * * * *');
	let payloadType = $state<'system-event' | 'agent-turn'>(
		(job?.payloadType as 'system-event' | 'agent-turn') ?? 'system-event'
	);
	let sessionTarget = $state(job?.sessionTarget ?? '');
	let showAdvanced = $state(false);
	let saving = $state(false);

	let cronPreview = $derived(scheduleType === 'cron' ? describeCron(schedule) : '');

	function selectPreset(value: string) {
		schedule = value;
	}

	async function handleSave() {
		if (!name.trim()) return;
		saving = true;
		const input: CronJobInput = {
			name: name.trim(),
			description: description.trim() || undefined,
			scheduleType,
			schedule,
			payloadType,
			sessionTarget: sessionTarget.trim() || undefined
		};
		let ok: boolean;
		if (job) {
			ok = await updateCronJob(job.id, input);
		} else {
			ok = await createCronJob(input);
		}
		saving = false;
		if (ok) onback();
	}
</script>

<div class="flex h-full flex-col bg-gray-950">
	<!-- Header -->
	<header class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
		<button onclick={onback} class="flex min-h-[44px] min-w-[44px] items-center justify-center">
			<svg
				class="h-5 w-5 text-gray-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<h1 class="text-base font-semibold text-white">{job ? 'Edit Job' : 'New Job'}</h1>
	</header>

	<!-- Form -->
	<div class="flex-1 overflow-y-auto p-4">
		<div class="space-y-4">
			<!-- Name -->
			<div>
				<label for="job-name" class="mb-1 block text-sm font-medium text-gray-300">Name</label>
				<input
					id="job-name"
					type="text"
					bind:value={name}
					placeholder="My cron job"
					class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="job-desc" class="mb-1 block text-sm font-medium text-gray-300"
					>Description</label
				>
				<input
					id="job-desc"
					type="text"
					bind:value={description}
					placeholder="Optional description"
					class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Schedule Type -->
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-300">Schedule Type</label>
				<div class="grid grid-cols-3 gap-2">
					{#each ['cron', 'interval', 'one-shot'] as st (st)}
						<button
							onclick={() => (scheduleType = st as 'cron' | 'interval' | 'one-shot')}
							class="min-h-[44px] rounded-lg border text-sm font-medium transition-colors {scheduleType ===
							st
								? 'border-blue-500 bg-blue-600/20 text-blue-400'
								: 'border-gray-700 bg-gray-900 text-gray-400 active:bg-gray-800'}"
						>
							{st === 'one-shot' ? 'One-shot' : st.charAt(0).toUpperCase() + st.slice(1)}
						</button>
					{/each}
				</div>
			</div>

			<!-- Cron presets -->
			{#if scheduleType === 'cron'}
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-300">Presets</label>
					<div class="grid grid-cols-2 gap-2">
						{#each CRON_PRESETS as preset (preset.value)}
							<button
								onclick={() => selectPreset(preset.value)}
								class="min-h-[44px] rounded-lg border px-3 py-2 text-left text-xs transition-colors {schedule ===
								preset.value
									? 'border-blue-500 bg-blue-600/20 text-blue-400'
									: 'border-gray-700 bg-gray-900 text-gray-400 active:bg-gray-800'}"
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Schedule input -->
			<div>
				<label for="job-schedule" class="mb-1 block text-sm font-medium text-gray-300">
					{scheduleType === 'cron'
						? 'Cron Expression'
						: scheduleType === 'interval'
							? 'Interval'
							: 'Schedule'}
				</label>
				<input
					id="job-schedule"
					type="text"
					bind:value={schedule}
					placeholder={scheduleType === 'cron' ? '*/5 * * * *' : '30s'}
					class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
				/>
				{#if cronPreview && cronPreview !== schedule}
					<p class="mt-1 text-xs text-gray-500">{cronPreview}</p>
				{/if}
			</div>

			<!-- Advanced -->
			<button
				onclick={() => (showAdvanced = !showAdvanced)}
				class="flex w-full items-center gap-2 text-sm text-gray-400"
			>
				<svg
					class="h-4 w-4 transition-transform {showAdvanced ? 'rotate-90' : ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
				Advanced
			</button>

			{#if showAdvanced}
				<div class="space-y-4 border-l-2 border-gray-800 pl-3">
					<!-- Payload type -->
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-300">Payload Type</label>
						<div class="grid grid-cols-2 gap-2">
							<button
								onclick={() => (payloadType = 'system-event')}
								class="min-h-[44px] rounded-lg border text-sm font-medium transition-colors {payloadType ===
								'system-event'
									? 'border-blue-500 bg-blue-600/20 text-blue-400'
									: 'border-gray-700 bg-gray-900 text-gray-400 active:bg-gray-800'}"
							>
								System Event
							</button>
							<button
								onclick={() => (payloadType = 'agent-turn')}
								class="min-h-[44px] rounded-lg border text-sm font-medium transition-colors {payloadType ===
								'agent-turn'
									? 'border-blue-500 bg-blue-600/20 text-blue-400'
									: 'border-gray-700 bg-gray-900 text-gray-400 active:bg-gray-800'}"
							>
								Agent Turn
							</button>
						</div>
					</div>

					<!-- Session target -->
					<div>
						<label for="job-session" class="mb-1 block text-sm font-medium text-gray-300"
							>Session Target</label
						>
						<input
							id="job-session"
							type="text"
							bind:value={sessionTarget}
							placeholder="Optional session key"
							class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Save button -->
	<div class="border-t border-gray-700 p-4 pb-[calc(1rem+var(--safe-bottom))]">
		<button
			onclick={handleSave}
			disabled={!name.trim() || saving}
			class="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors active:bg-blue-700 disabled:opacity-50"
		>
			{saving ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
		</button>
	</div>
</div>
