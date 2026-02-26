<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { PollData } from '$lib/stores/chat.js';

	let {
		poll,
		messageId,
		onvote
	}: {
		poll: PollData;
		messageId: string;
		onvote: (messageId: string, optionIndices: number[]) => void;
	} = $props();

	let selectedIndices = new SvelteSet<number>();

	// Initialize selected indices from already-voted options
	$effect(() => {
		selectedIndices.clear();
		poll.options.forEach((opt, i) => {
			if (opt.votedBySelf) selectedIndices.add(i);
		});
	});

	function toggleOption(index: number) {
		if (poll.closed) return;

		const next = new SvelteSet(selectedIndices);

		if (poll.maxSelections === 1) {
			// Single select: toggle or switch
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.clear();
				next.add(index);
			}
		} else {
			// Multi select
			if (next.has(index)) {
				next.delete(index);
			} else if (next.size < poll.maxSelections) {
				next.add(index);
			}
		}

		selectedIndices = next;
		onvote(messageId, Array.from(next));
	}

	function getPercentage(votes: number): number {
		if (poll.totalVotes === 0) return 0;
		return Math.round((votes / poll.totalVotes) * 100);
	}
</script>

<div class="my-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
	<!-- Question -->
	<div class="mb-2 flex items-start gap-2">
		<svg
			class="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
			/>
		</svg>
		<span class="text-sm font-medium text-white">{poll.question}</span>
	</div>

	<!-- Options -->
	<div class="space-y-1.5">
		{#each poll.options as option, i (i)}
			{@const pct = getPercentage(option.votes)}
			{@const isSelected = selectedIndices.has(i) || option.votedBySelf}
			<button
				onclick={() => toggleOption(i)}
				disabled={poll.closed}
				class="group relative flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors {isSelected
					? 'border-blue-500/50 bg-blue-500/10 text-white'
					: 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-600 hover:bg-gray-900'} {poll.closed
					? 'cursor-default'
					: 'cursor-pointer'}"
			>
				<!-- Progress bar background -->
				<div
					class="absolute inset-0 rounded-md transition-all duration-300 {isSelected
						? 'bg-blue-500/15'
						: 'bg-gray-700/20'}"
					style="width: {pct}%"
				></div>

				<!-- Content -->
				<div class="relative flex flex-1 items-center gap-2">
					<!-- Selection indicator -->
					<span
						class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border {isSelected
							? 'border-blue-400 bg-blue-500'
							: 'border-gray-600'}"
					>
						{#if isSelected}
							<svg class="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						{/if}
					</span>

					<span class="flex-1">{option.text}</span>

					<!-- Vote count & percentage -->
					<span class="text-xs text-gray-500">
						{option.votes}{poll.totalVotes > 0 ? ` (${pct}%)` : ''}
					</span>
				</div>
			</button>
		{/each}
	</div>

	<!-- Footer -->
	<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
		<span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
		{#if poll.maxSelections > 1}
			<span class="text-gray-600">|</span>
			<span>Select up to {poll.maxSelections}</span>
		{/if}
		{#if poll.closed}
			<span class="text-gray-600">|</span>
			<span class="text-yellow-500">Closed</span>
		{/if}
	</div>
</div>
