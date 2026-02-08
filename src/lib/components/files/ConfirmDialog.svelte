<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let title: string;
	export let message: string;
	export let confirmLabel: string = 'Confirm';
	export let open: boolean;

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();

	let dialogEl: HTMLDivElement;

	function handleConfirm(): void {
		dispatch('confirm');
	}

	function handleCancel(): void {
		dispatch('cancel');
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			handleCancel();
		}
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
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
		const btn = dialogEl.querySelector<HTMLElement>('button');
		if (btn) btn.focus();
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
			class="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-dialog-title"
		>
			<h3 id="confirm-dialog-title" class="text-lg font-medium text-slate-100">{title}</h3>
			<p class="mt-2 text-sm text-slate-400">{message}</p>
			<div class="mt-6 flex justify-end space-x-3">
				<button
					on:click={handleCancel}
					class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
				>
					Cancel
				</button>
				<button
					on:click={handleConfirm}
					class="rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
