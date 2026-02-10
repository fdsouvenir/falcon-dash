<script lang="ts">
	import { onMount } from 'svelte';
	import { ensureA2UILoaded, type A2UIHostElement } from '$lib/canvas/a2ui-bridge.js';
	import { call } from '$lib/stores/gateway.js';

	interface Props {
		messages: unknown[];
		surfaceId: string;
	}

	let { messages = $bindable(), surfaceId }: Props = $props();

	let hostElement: A2UIHostElement | null = $state(null);

	onMount(async () => {
		await ensureA2UILoaded();
		if (hostElement) {
			hostElement.applyMessages(messages);
		}
	});

	$effect(() => {
		if (hostElement && messages) {
			hostElement.applyMessages(messages);
		}
	});

	async function handleAction(actionId: string, payload: Record<string, unknown>) {
		await call('canvas.action', { surfaceId, actionId, payload });
	}
</script>

<div class="inline-a2ui-wrapper">
	<openclaw-a2ui-host bind:this={hostElement}></openclaw-a2ui-host>
</div>

<style>
	.inline-a2ui-wrapper {
		width: 100%;
		margin: 0.5rem 0;
	}
</style>
