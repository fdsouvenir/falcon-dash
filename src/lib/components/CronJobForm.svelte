<script lang="ts">
	import {
		createCronJob,
		updateCronJob,
		type CronJob,
		type CronJobInput
	} from '$lib/stores/cron.js';
	import { describeCron, CRON_PRESETS } from '$lib/cron-utils.js';

	interface Props {
		job?: CronJob | null;
		onclose: () => void;
	}

	let { job = null, onclose }: Props = $props();

	let name = $state(job?.name ?? '');
	let description = $state(job?.description ?? '');
	let scheduleType = $state<CronJobInput['scheduleType']>(job?.scheduleType ?? 'cron');
	let schedule = $state(job?.schedule ?? '');
	let payloadType = $state<CronJobInput['payloadType']>(
		(job?.payloadType as CronJobInput['payloadType']) ?? 'system-event'
	);
	let sessionTarget = $state(job?.sessionTarget ?? '');
	let isSaving = $state(false);

	const isEdit = !!job;

	let schedulePreview = $derived(
		scheduleType === 'cron' && schedule.trim() ? describeCron(schedule.trim()) : ''
	);

	function applyPreset(value: string) {
		schedule = value;
	}

	async function handleSubmit() {
		if (!name.trim() || !schedule.trim()) return;
		isSaving = true;

		const input: CronJobInput = {
			name: name.trim(),
			description: description.trim() || undefined,
			scheduleType,
			schedule: schedule.trim(),
			payloadType,
			sessionTarget: sessionTarget.trim() || undefined
		};

		let success: boolean;
		if (isEdit && job) {
			success = await updateCronJob(job.id, input);
		} else {
			success = await createCronJob(input);
		}

		isSaving = false;
		if (success) onclose();
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	role="dialog"
	aria-modal="true"
	aria-label={isEdit ? 'Edit job' : 'Create job'}
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose();
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
	}}
>
	<div class="w-96 rounded-lg border border-surface-border bg-surface-2 p-5">
		<h3 class="mb-4 text-[length:var(--text-card-title)] font-medium text-white">
			{isEdit ? 'Edit Job' : 'Create Job'}
		</h3>

		<div class="space-y-3">
			<!-- Name -->
			<div>
				<label class="mb-1 block text-[length:var(--text-label)] text-status-muted">Name</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={name}
					placeholder="Job name"
					autofocus
					class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>
			</div>

			<!-- Description -->
			<div>
				<label class="mb-1 block text-[length:var(--text-label)] text-status-muted">Description</label>
				<input
					type="text"
					bind:value={description}
					placeholder="Optional description"
					class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>
			</div>

			<!-- Schedule Type -->
			<div>
				<label class="mb-1 block text-[length:var(--text-label)] text-status-muted">Schedule Type</label>
				<select
					bind:value={scheduleType}
					class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
				>
					<option value="cron">Cron Expression</option>
					<option value="interval">Interval</option>
					<option value="one-shot">One-Shot</option>
				</select>
			</div>

			<!-- Schedule -->
			<div>
				<label class="mb-1 block text-[length:var(--text-label)] text-status-muted">
					{scheduleType === 'cron'
						? 'Cron Expression'
						: scheduleType === 'interval'
							? 'Interval (e.g. 5m, 1h)'
							: 'Run At (ISO timestamp)'}
				</label>

				{#if scheduleType === 'cron'}
					<!-- Preset buttons -->
					<div class="mb-2 flex flex-wrap gap-1">
						{#each CRON_PRESETS as preset (preset.value)}
							<button
								type="button"
								onclick={() => applyPreset(preset.value)}
								class="rounded border border-surface-border bg-surface-3 px-2 py-1 text-[length:var(--text-badge)] text-white/70 hover:border-status-info hover:text-white"
							>
								{preset.label}
							</button>
						{/each}
					</div>
				{/if}

				<input
					type="text"
					bind:value={schedule}
					placeholder={scheduleType === 'cron'
						? '*/5 * * * *'
						: scheduleType === 'interval'
							? '5m'
							: '2026-01-01T00:00:00Z'}
					class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>

				{#if schedulePreview && schedulePreview !== schedule.trim()}
					<div class="mt-1 text-[length:var(--text-badge)] text-status-muted">
						→ {schedulePreview}
					</div>
				{/if}
			</div>

			<!-- Payload Type -->
			<div>
				<label class="mb-1 block text-[length:var(--text-label)] text-status-muted">Payload Type</label>
				<select
					bind:value={payloadType}
					class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
				>
					<option value="system-event">System Event</option>
					<option value="agent-turn">Agent Turn</option>
				</select>
			</div>

			<!-- Session Target -->
			<div>
				<label class="mb-1 block text-[length:var(--text-label)] text-status-muted">
					Session Target (optional)
				</label>
				<input
					type="text"
					bind:value={sessionTarget}
					placeholder="Session key"
					class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>
			</div>
		</div>

		<!-- Actions -->
		<div class="mt-4 flex justify-end gap-2">
			<button
				onclick={onclose}
				class="rounded px-3 py-1.5 text-[length:var(--text-badge)] font-medium text-status-muted hover:text-white"
			>
				Cancel
			</button>
			<button
				onclick={handleSubmit}
				disabled={!name.trim() || !schedule.trim() || isSaving}
				class="rounded bg-status-info px-3 py-1.5 text-[length:var(--text-badge)] font-semibold text-white hover:opacity-80 disabled:opacity-50"
			>
				{isSaving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
			</button>
		</div>
	</div>
</div>
