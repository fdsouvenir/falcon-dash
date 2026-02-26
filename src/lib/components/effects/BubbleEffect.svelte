<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BubbleEffect } from '$lib/stores/chat.js';

	let {
		name,
		children
	}: {
		name: BubbleEffect | string;
		children: Snippet;
	} = $props();
</script>

<div class="bubble-effect bubble-effect--{name}">
	{@render children()}
</div>

<style>
	.bubble-effect {
		animation-fill-mode: both;
	}

	/* Slam: scale 2x → 1x with bounce + slight screen shake */
	.bubble-effect--slam {
		animation: bubble-slam 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes bubble-slam {
		0% {
			transform: scale(2);
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		50% {
			transform: scale(0.9);
		}
		70% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
		}
	}

	/* Loud: bold text, scale up 1.2x, wobble */
	.bubble-effect--loud {
		font-weight: 700;
		animation: bubble-loud 0.8s ease-out;
	}

	@keyframes bubble-loud {
		0% {
			transform: scale(1.4);
		}
		20% {
			transform: scale(1.2) rotate(-2deg);
		}
		40% {
			transform: scale(1.25) rotate(2deg);
		}
		60% {
			transform: scale(1.2) rotate(-1deg);
		}
		80% {
			transform: scale(1.2) rotate(0.5deg);
		}
		100% {
			transform: scale(1.2) rotate(0deg);
		}
	}

	/* Gentle: slow fade-in from opacity 0 */
	.bubble-effect--gentle {
		animation: bubble-gentle 2s ease-in;
	}

	@keyframes bubble-gentle {
		0% {
			opacity: 0;
			transform: scale(0.95);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Invisible ink: blurred until hover/tap */
	.bubble-effect--invisible-ink {
		filter: blur(8px);
		transition: filter 0.5s ease;
		cursor: pointer;
		user-select: none;
	}

	.bubble-effect--invisible-ink:hover,
	.bubble-effect--invisible-ink:active {
		filter: blur(0);
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.bubble-effect--slam,
		.bubble-effect--loud,
		.bubble-effect--gentle {
			animation: none;
		}

		.bubble-effect--loud {
			font-weight: 700;
		}

		.bubble-effect--invisible-ink {
			filter: none;
		}
	}
</style>
