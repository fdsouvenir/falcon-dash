<script lang="ts">
	let {
		oncreate,
		oncancel
	}: {
		oncreate: (poll: {
			question: string;
			options: string[];
			maxSelections?: number;
			duration?: number;
		}) => void;
		oncancel: () => void;
	} = $props();

	let question = $state('');
	let options = $state(['', '']);
	let multiSelect = $state(false);
	let duration = $state<number | undefined>(undefined);
	let questionInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		questionInput?.focus();
	});

	function addOption() {
		if (options.length < 10) {
			options = [...options, ''];
		}
	}

	function removeOption(index: number) {
		if (options.length > 2) {
			options = options.filter((_, i) => i !== index);
		}
	}

	function updateOption(index: number, value: string) {
		options = options.map((o, i) => (i === index ? value : o));
	}

	function submit() {
		const trimmedQuestion = question.trim();
		const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
		if (!trimmedQuestion || trimmedOptions.length < 2) return;

		oncreate({
			question: trimmedQuestion,
			options: trimmedOptions,
			maxSelections: multiSelect ? trimmedOptions.length : 1,
			duration
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			oncancel();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			oncancel();
		}
	}

	let canSubmit = $derived(() => {
		const trimmedQuestion = question.trim();
		const validOptions = options.filter((o) => o.trim().length > 0);
		return trimmedQuestion.length > 0 && validOptions.length >= 2;
	});

	const DURATION_OPTIONS = [
		{ label: 'No time limit', value: undefined },
		{ label: '1 hour', value: 3600 },
		{ label: '4 hours', value: 14400 },
		{ label: '12 hours', value: 43200 },
		{ label: '24 hours', value: 86400 }
	];
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	aria-label="Create poll"
>
	<div
		class="w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl"
	>
		<h3 class="mb-3 text-sm font-medium text-white">Create Poll</h3>

		<!-- Question -->
		<input
			bind:this={questionInput}
			bind:value={question}
			type="text"
			placeholder="Ask a question..."
			class="mb-3 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					if (canSubmit()) submit();
				}
			}}
		/>

		<!-- Options -->
		<div class="mb-3 space-y-2">
			{#each options as option, i (i)}
				<div class="flex items-center gap-2">
					<span class="w-5 text-center text-xs text-gray-500">{i + 1}</span>
					<input
						value={option}
						oninput={(e) => updateOption(i, (e.target as HTMLInputElement).value)}
						type="text"
						placeholder={`Option ${i + 1}`}
						class="flex-1 rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
					{#if options.length > 2}
						<button
							onclick={() => removeOption(i)}
							class="rounded p-1 text-gray-500 transition-colors hover:text-red-400"
							aria-label="Remove option"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					{/if}
				</div>
			{/each}
		</div>

		{#if options.length < 10}
			<button
				onclick={addOption}
				class="mb-3 flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add option
			</button>
		{/if}

		<!-- Settings -->
		<div class="mb-4 flex flex-wrap items-center gap-4">
			<label class="flex items-center gap-2 text-xs text-gray-400">
				<input
					type="checkbox"
					bind:checked={multiSelect}
					class="rounded border-gray-600 bg-gray-900"
				/>
				Allow multiple selections
			</label>
			<select
				bind:value={duration}
				class="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
			>
				{#each DURATION_OPTIONS as opt (opt.label)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<!-- Actions -->
		<div class="flex justify-end gap-2">
			<button
				onclick={oncancel}
				class="rounded px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
			>
				Cancel
			</button>
			<button
				onclick={submit}
				disabled={!canSubmit()}
				class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Create Poll
			</button>
		</div>
	</div>
</div>
