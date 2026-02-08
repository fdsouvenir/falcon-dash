<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type {
		CronJob,
		CronScheduleType,
		CronAddParams,
		CronEditParams
	} from '$lib/gateway/types';

	export let open: boolean;
	export let job: CronJob | null = null;

	const dispatch = createEventDispatcher<{
		save: { params: CronAddParams | CronEditParams };
		cancel: void;
	}>();

	let name = '';
	let scheduleType: CronScheduleType = 'cron';
	let schedule = '';
	let prompt = '';
	let enabled = true;
	let submitted = false;

	let dialogEl: HTMLDivElement;

	const placeholders: Record<CronScheduleType, string> = {
		cron: '*/5 * * * *',
		interval: '300',
		oneshot: '2026-02-15T12:00'
	};

	$: if (open) {
		resetForm();
	}

	$: nameError = submitted && !name.trim();
	$: scheduleError = submitted && !schedule.trim();
	$: promptError = submitted && !prompt.trim();
	$: isValid = name.trim() && schedule.trim() && prompt.trim();

	function resetForm(): void {
		submitted = false;
		if (job) {
			name = job.name;
			scheduleType = job.scheduleType;
			schedule = job.schedule;
			prompt = job.payload.prompt;
			enabled = job.enabled;
		} else {
			name = '';
			scheduleType = 'cron';
			schedule = '';
			prompt = '';
			enabled = true;
		}
	}

	function handleSubmit(): void {
		submitted = true;
		if (!isValid) return;

		if (job) {
			const params: CronEditParams = {
				jobId: job.id,
				name: name.trim(),
				schedule: schedule.trim(),
				scheduleType,
				payload: { type: 'agent', prompt: prompt.trim() },
				enabled
			};
			dispatch('save', { params });
		} else {
			const params: CronAddParams = {
				name: name.trim(),
				schedule: schedule.trim(),
				scheduleType,
				payload: { type: 'agent', prompt: prompt.trim() },
				enabled
			};
			dispatch('save', { params });
		}
	}

	function handleCancel(): void {
		dispatch('cancel');
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			handleCancel();
		}
	}

	function trapFocus(event: KeyboardEvent): void {
		if (!open || event.key !== 'Tab' || !dialogEl) return;

		const focusable = dialogEl.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey) {
			if (document.activeElement === first) {
				event.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		handleKeydown(event);
		trapFocus(event);
	}

	$: if (open && dialogEl) {
		const input = dialogEl.querySelector<HTMLElement>('input');
		if (input) input.focus();
	}
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		on:click={handleBackdropClick}
	>
		<div
			bind:this={dialogEl}
			class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="cron-form-title"
		>
			<h3 id="cron-form-title" class="mb-4 text-lg font-medium text-slate-100">
				{job ? 'Edit Cron Job' : 'New Cron Job'}
			</h3>

			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<!-- Name -->
				<div>
					<label for="cron-name" class="mb-1 block text-sm font-medium text-slate-300">
						Name
					</label>
					<input
						id="cron-name"
						type="text"
						bind:value={name}
						class="w-full rounded border px-3 py-2 text-sm text-slate-200 focus:outline-none {nameError
							? 'border-red-500 bg-slate-900 focus:border-red-500'
							: 'border-slate-600 bg-slate-900 focus:border-blue-500'}"
						placeholder="Daily report"
					/>
					{#if nameError}
						<p class="mt-1 text-xs text-red-400">Name is required</p>
					{/if}
				</div>

				<!-- Schedule Type -->
				<div>
					<label for="cron-type" class="mb-1 block text-sm font-medium text-slate-300">
						Schedule Type
					</label>
					<select
						id="cron-type"
						bind:value={scheduleType}
						class="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
					>
						<option value="cron">Cron Expression</option>
						<option value="interval">Interval (seconds)</option>
						<option value="oneshot">One-shot</option>
					</select>
				</div>

				<!-- Schedule Value -->
				<div>
					<label for="cron-schedule" class="mb-1 block text-sm font-medium text-slate-300">
						Schedule
					</label>
					<input
						id="cron-schedule"
						type="text"
						bind:value={schedule}
						class="w-full rounded border px-3 py-2 text-sm text-slate-200 focus:outline-none {scheduleError
							? 'border-red-500 bg-slate-900 focus:border-red-500'
							: 'border-slate-600 bg-slate-900 focus:border-blue-500'}"
						placeholder={placeholders[scheduleType]}
					/>
					{#if scheduleError}
						<p class="mt-1 text-xs text-red-400">Schedule is required</p>
					{/if}
				</div>

				<!-- Payload Prompt -->
				<div>
					<label for="cron-prompt" class="mb-1 block text-sm font-medium text-slate-300">
						Prompt
					</label>
					<textarea
						id="cron-prompt"
						bind:value={prompt}
						rows="4"
						class="w-full rounded border px-3 py-2 text-sm text-slate-200 focus:outline-none {promptError
							? 'border-red-500 bg-slate-900 focus:border-red-500'
							: 'border-slate-600 bg-slate-900 focus:border-blue-500'}"
						placeholder="Run the daily status report..."
					/>
					{#if promptError}
						<p class="mt-1 text-xs text-red-400">Prompt is required</p>
					{/if}
				</div>

				<!-- Enabled -->
				<div class="flex items-center space-x-2">
					<input
						id="cron-enabled"
						type="checkbox"
						bind:checked={enabled}
						class="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
					/>
					<label for="cron-enabled" class="text-sm text-slate-300">Enabled</label>
				</div>

				<!-- Actions -->
				<div class="flex justify-end space-x-3 pt-2">
					<button
						type="button"
						on:click={handleCancel}
						class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
					>
						{job ? 'Save Changes' : 'Create Job'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
