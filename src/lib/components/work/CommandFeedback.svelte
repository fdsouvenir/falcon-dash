<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { commandLabel } from '$lib/work3/labels.js';

	interface ErrorShape {
		code?: string;
		message?: string;
		details?: Record<string, unknown>;
		alternatives?: string[];
	}

	interface FeedbackShape {
		ok?: boolean;
		noop?: boolean;
		command?: string;
		error?: ErrorShape;
		current_version?: number | null;
	}

	interface Props {
		form?: FeedbackShape | null;
	}

	let { form = null }: Props = $props();

	const missing = $derived(
		Array.isArray(form?.error?.details?.missing) ? (form?.error?.details?.missing as string[]) : []
	);
</script>

{#if form?.error}
	<div
		class="space-y-2 rounded-[var(--md-sys-shape-corner-medium)] border border-status-danger/40 bg-status-danger-bg px-4 py-3 text-[length:var(--text-body)] text-status-danger"
		role="alert"
		data-command-feedback="error"
	>
		<p>
			<span class="font-mono text-[length:var(--text-label)]">{form.error.code}</span>
			— {form.error.message ?? 'The command could not be applied.'}
		</p>
		{#if missing.length}
			<p class="text-[length:var(--text-label)]">
				Still needed: {missing.join(', ').replaceAll('_', ' ')}
			</p>
		{/if}
		{#if form.error.code === 'version_conflict'}
			<div class="space-y-1 text-[length:var(--text-label)]">
				<p>
					This item changed while you were editing{form.current_version
						? ` (now v${form.current_version})`
						: ''}. Your input is preserved.
				</p>
				<button
					type="button"
					class="falcon-focus touch-target font-semibold underline underline-offset-4"
					onclick={() => invalidateAll()}
				>
					Refresh current state, then review and reapply
				</button>
			</div>
		{/if}
		{#if form.error.alternatives?.length}
			<p class="text-[length:var(--text-label)]">
				Available instead:
				{form.error.alternatives.map(commandLabel).join(' · ')}
			</p>
		{/if}
	</div>
{:else if form?.ok}
	<div
		class="rounded-[var(--md-sys-shape-corner-medium)] border border-status-active/40 bg-status-active-bg px-4 py-3 text-[length:var(--text-body)] text-status-active"
		role="status"
		data-command-feedback="success"
	>
		{commandLabel(form.command ?? 'Command')}
		{form.noop ? 'was already satisfied — no changes were needed.' : 'was applied.'}
	</div>
{/if}
