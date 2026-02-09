<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';

	interface Props {
		title: string;
		message: string;
		confirmLabel?: string;
		open: boolean;
	}

	let { title, message, confirmLabel = 'Confirm', open }: Props = $props();

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

	$effect(() => {
		if (open && dialogEl) {
			const btn = dialogEl.querySelector<HTMLElement>('button');
			if (btn) btn.focus();
		}
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<!-- Desktop: centered modal -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 hidden items-center justify-center bg-black/60 md:flex"
		onclick={handleBackdropClick}
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
					onclick={handleCancel}
					class="min-h-[44px] rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500"
				>
					Cancel
				</button>
				<button
					onclick={handleConfirm}
					class="min-h-[44px] rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-blue-500"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>

	<!-- Mobile: bottom sheet -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/50 md:hidden"
		onclick={handleBackdropClick}
		transition:fade={{ duration: 200 }}
	></div>
	<div
		class="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-slate-800 p-4 md:hidden"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		transition:fly={{ y: 300, duration: 200 }}
	>
		<div class="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-600"></div>
		<h3 class="text-lg font-medium text-slate-100">{title}</h3>
		<p class="mt-2 text-sm text-slate-400">{message}</p>
		<div class="mt-5 space-y-2">
			<button
				onclick={handleConfirm}
				class="min-h-[44px] w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-blue-500"
			>
				{confirmLabel}
			</button>
			<button
				onclick={handleCancel}
				class="min-h-[44px] w-full rounded-lg bg-slate-700 px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}
