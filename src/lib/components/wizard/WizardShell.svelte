<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	interface WizardStep {
		label: string;
		description?: string;
	}

	let {
		title,
		steps,
		currentStep = $bindable(0),
		canProceed = true,
		onComplete,
		children
	}: {
		title: string;
		steps: WizardStep[];
		currentStep: number;
		canProceed?: boolean;
		onComplete?: () => void;
		children: Snippet;
	} = $props();

	function goBack() {
		goto(resolve('/channels'));
	}

	let isLastStep = $derived(currentStep === steps.length - 1);
	let isFirstStep = $derived(currentStep === 0);

	function next() {
		if (isLastStep) {
			onComplete?.();
		} else {
			currentStep++;
		}
	}

	function prev() {
		if (!isFirstStep) {
			currentStep--;
		}
	}
</script>

<div class="flex flex-col gap-5 p-4 sm:p-6">
	<!-- Header with back link -->
	<div class="flex items-center gap-3">
		<button
			onclick={goBack}
			class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
			aria-label="Back to channels"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<div>
			<h1 class="text-lg font-semibold text-white">{title}</h1>
		</div>
	</div>

	<!-- Progress indicator -->
	<div class="flex items-center gap-2">
		{#each steps as step, i (step.label)}
			<div class="flex items-center gap-2">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold {i <
					currentStep
						? 'bg-emerald-600 text-white'
						: i === currentStep
							? 'bg-blue-600 text-white'
							: 'bg-gray-700 text-gray-400'}"
				>
					{#if i < currentStep}
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						{i + 1}
					{/if}
				</div>
				<span
					class="hidden text-xs sm:inline {i === currentStep ? 'text-gray-200' : 'text-gray-500'}"
				>
					{step.label}
				</span>
				{#if i < steps.length - 1}
					<div class="h-px w-4 sm:w-8 {i < currentStep ? 'bg-emerald-600' : 'bg-gray-700'}"></div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Step content -->
	<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 sm:p-6">
		{@render children()}
	</div>

	<!-- Navigation buttons -->
	<div class="flex items-center justify-between">
		<button
			onclick={prev}
			disabled={isFirstStep}
			class="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 disabled:invisible"
		>
			Back
		</button>
		<span class="text-xs text-gray-500">
			Step {currentStep + 1} of {steps.length}
		</span>
		<button
			onclick={next}
			disabled={!canProceed}
			class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 {isLastStep
				? 'bg-emerald-600 text-white hover:bg-emerald-500'
				: 'bg-blue-600 text-white hover:bg-blue-500'}"
		>
			{isLastStep ? 'Complete' : 'Next'}
		</button>
	</div>
</div>
