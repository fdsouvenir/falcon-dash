<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomSheet from '$lib/components/mobile/BottomSheet.svelte';
	import { isMobile } from '$lib/stores/viewport.js';
	import { Button } from '../button/index.js';

	interface Props {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
		busy?: boolean;
		children?: Snippet;
		onconfirm: () => void | Promise<void>;
		oncancel?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		destructive = false,
		busy = false,
		children,
		onconfirm,
		oncancel
	}: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let mobile = $state(false);
	let pending = $state(false);
	const isBusy = $derived(busy || pending);
	const dialogId = $props.id();
	const titleId = `${dialogId}-title`;
	const descriptionId = `${dialogId}-description`;

	$effect(() => isMobile.subscribe((value) => (mobile = value)));

	$effect(() => {
		if (!dialog || mobile) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function cancel() {
		if (isBusy) return;
		open = false;
		oncancel?.();
	}

	async function confirm() {
		if (isBusy) return;
		pending = true;
		try {
			await onconfirm();
			open = false;
		} finally {
			pending = false;
		}
	}

	function backdropClick(event: MouseEvent) {
		if (event.target === dialog) cancel();
	}
</script>

{#snippet content()}
	<div class="space-y-5">
		<div class="space-y-2">
			<h2
				id={titleId}
				class="text-[length:var(--md-sys-typescale-title-large-size)] font-semibold text-on-surface"
			>
				{title}
			</h2>
			<p
				id={descriptionId}
				class="text-[length:var(--text-body)] leading-relaxed text-on-surface-variant"
			>
				{description}
			</p>
		</div>
		{@render children?.()}
		<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<Button variant="ghost" class="touch-target" disabled={isBusy} onclick={cancel}>
				{cancelLabel}
			</Button>
			<Button
				variant={destructive ? 'destructive' : 'default'}
				class="touch-target"
				disabled={isBusy}
				onclick={confirm}
			>
				{isBusy ? 'Working…' : confirmLabel}
			</Button>
		</div>
	</div>
{/snippet}

{#if mobile}
	<BottomSheet {open} onclose={cancel} maxHeight="80dvh" label={title}>
		<div data-slot="confirm-dialog" class="pb-2">
			{@render content()}
		</div>
	</BottomSheet>
{:else}
	<dialog
		bind:this={dialog}
		data-slot="confirm-dialog"
		class="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant bg-surface-container p-0 text-on-surface shadow-none backdrop:bg-black/60"
		aria-labelledby={titleId}
		aria-describedby={descriptionId}
		onclick={backdropClick}
		oncancel={(event) => {
			event.preventDefault();
			cancel();
		}}
		onclose={() => {
			if (open) cancel();
		}}
	>
		<div class="p-5 sm:p-6">
			{@render content()}
		</div>
	</dialog>
{/if}
