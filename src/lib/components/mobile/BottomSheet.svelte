<script module lang="ts">
	let openSheetCount = 0;

	function lockBody() {
		openSheetCount += 1;
		document.body.classList.add('sheet-open');
	}

	function unlockBody() {
		openSheetCount = Math.max(0, openSheetCount - 1);
		if (openSheetCount === 0) document.body.classList.remove('sheet-open');
	}
</script>

<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	let {
		open,
		onclose,
		children,
		maxHeight = '80vh',
		label
	}: {
		open: boolean;
		onclose: () => void;
		children: Snippet;
		maxHeight?: string;
		label: string;
	} = $props();

	let sheetEl: HTMLDivElement | undefined = $state();
	let translateY = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let priorFocus: HTMLElement | null = null;

	const focusableSelector = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	function tabbableElements(): HTMLElement[] {
		if (!sheetEl) return [];
		return Array.from(sheetEl.querySelectorAll<HTMLElement>(focusableSelector)).filter(
			(element) =>
				element.tabIndex >= 0 &&
				!(element instanceof HTMLInputElement && element.type === 'hidden') &&
				!element.closest('[hidden], [aria-hidden="true"]') &&
				element.getClientRects().length > 0
		);
	}

	function handlePointerDown(e: PointerEvent) {
		dragging = true;
		startY = e.clientY;
		translateY = 0;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dy = e.clientY - startY;
		translateY = Math.max(0, dy);
	}

	function handlePointerUp() {
		if (!dragging) return;
		dragging = false;
		if (sheetEl && translateY > sheetEl.offsetHeight * 0.3) {
			onclose();
		}
		translateY = 0;
	}

	function handleBackdropClick() {
		onclose();
	}

	function isTopmostSheet(): boolean {
		const sheets = document.querySelectorAll<HTMLElement>('[data-bottom-sheet="true"]');
		return sheets[sheets.length - 1] === sheetEl;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isTopmostSheet()) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onclose();
			return;
		}
		if (event.key !== 'Tab' || !sheetEl) return;
		const focusable = tabbableElements();
		if (focusable.length === 0) {
			event.preventDefault();
			sheetEl.focus();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (!active || active === sheetEl || !sheetEl.contains(active) || !focusable.includes(active)) {
			event.preventDefault();
			(event.shiftKey ? last : first).focus();
		} else if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function handleFocusin(event: FocusEvent) {
		if (!sheetEl || !isTopmostSheet()) return;
		const target = event.target;
		if (target instanceof Node && sheetEl.contains(target)) return;
		(tabbableElements()[0] ?? sheetEl).focus();
	}

	$effect(() => {
		if (!open) return;
		lockBody();
		priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		document.addEventListener('keydown', handleKeydown, true);
		document.addEventListener('focusin', handleFocusin, true);
		void tick().then(() => {
			const first = tabbableElements()[0];
			(first ?? sheetEl)?.focus();
		});
		return () => {
			unlockBody();
			document.removeEventListener('keydown', handleKeydown, true);
			document.removeEventListener('focusin', handleFocusin, true);
			priorFocus?.focus();
			priorFocus = null;
		};
	});
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/50"
		onclick={handleBackdropClick}
		role="presentation"
	></div>

	<!-- Sheet -->
	<div
		bind:this={sheetEl}
		class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-surface-1"
		style="max-height: {maxHeight}; transform: translateY({translateY}px); transition: {dragging
			? 'none'
			: 'transform 0.2s ease-out'};"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		tabindex="-1"
		data-bottom-sheet="true"
	>
		<!-- Drag handle -->
		<div
			class="flex shrink-0 cursor-grab items-center justify-center py-3 active:cursor-grabbing"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			role="presentation"
		>
			<div class="h-1 w-10 rounded-full bg-surface-3"></div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))]">
			{@render children()}
		</div>
	</div>
{/if}
