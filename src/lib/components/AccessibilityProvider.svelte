<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	let announceText = $state('');
	let focusTrapActive = $state(false);
	let focusableElements: HTMLElement[] = $state([]);
	let firstFocusable: HTMLElement | null = $state(null);
	let lastFocusable: HTMLElement | null = $state(null);

	function announce(text: string) {
		announceText = text;
		setTimeout(() => {
			announceText = '';
		}, 1000);
	}

	function enableFocusTrap(container: HTMLElement) {
		focusTrapActive = true;
		const focusableSelectors =
			'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
		focusableElements = Array.from(container.querySelectorAll(focusableSelectors));
		firstFocusable = focusableElements[0] || null;
		lastFocusable = focusableElements[focusableElements.length - 1] || null;

		if (firstFocusable) {
			firstFocusable.focus();
		}
	}

	function disableFocusTrap() {
		focusTrapActive = false;
		focusableElements = [];
		firstFocusable = null;
		lastFocusable = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!focusTrapActive) return;

		if (e.key === 'Tab') {
			if (e.shiftKey) {
				// Shift+Tab
				if (document.activeElement === firstFocusable && lastFocusable) {
					e.preventDefault();
					lastFocusable.focus();
				}
			} else {
				// Tab
				if (document.activeElement === lastFocusable && firstFocusable) {
					e.preventDefault();
					firstFocusable.focus();
				}
			}
		}

		if (e.key === 'Escape') {
			disableFocusTrap();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	// Expose utilities globally
	if (typeof window !== 'undefined') {
		(window as unknown as { a11y: typeof a11yUtils }).a11y = {
			announce,
			enableFocusTrap,
			disableFocusTrap
		};
	}

	const a11yUtils = {
		announce,
		enableFocusTrap,
		disableFocusTrap
	};
</script>

<div class="accessibility-provider">
	<!-- Skip to content link -->
	<a
		href="#main-content"
		class="focus-visible sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
	>
		Skip to content
	</a>

	<!-- Live region for announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announceText}
	</div>

	<!-- Main content -->
	<div id="main-content">
		{@render children()}
	</div>
</div>

<style>
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	:global(.focus-visible:focus) {
		outline: 2px solid theme('colors.blue.600');
		outline-offset: 2px;
	}

	:global(.focus-visible:focus:not(:focus-visible)) {
		outline: none;
	}
</style>
