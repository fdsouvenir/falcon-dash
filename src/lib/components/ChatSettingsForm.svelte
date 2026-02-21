<script lang="ts">
	let {
		model = '',
		thinkingLevel = 'off',
		verbose = false,
		onModelChange,
		onThinkingChange,
		onToggleVerbose,
		onReset,
		onCompact
	}: {
		model?: string;
		thinkingLevel?: string;
		verbose?: boolean;
		onModelChange: (e: Event) => void;
		onThinkingChange: (e: Event) => void;
		onToggleVerbose: () => void;
		onReset: () => void;
		onCompact: () => void;
	} = $props();
</script>

<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
	<!-- Model override -->
	<div>
		<label for="model-input" class="mb-1 block text-xs text-gray-400">Model</label>
		<input
			id="model-input"
			type="text"
			value={model}
			onchange={onModelChange}
			placeholder="Default model"
			class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
		/>
	</div>

	<!-- Thinking level -->
	<div>
		<label for="thinking-select" class="mb-1 block text-xs text-gray-400">Thinking</label>
		<select
			id="thinking-select"
			value={thinkingLevel}
			onchange={onThinkingChange}
			class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
		>
			<option value="off">Off</option>
			<option value="minimal">Minimal</option>
			<option value="low">Low</option>
			<option value="medium">Medium</option>
			<option value="high">High</option>
			<option value="xhigh">X-High</option>
		</select>
	</div>
</div>

<div class="mt-3 flex items-center justify-between">
	<!-- Verbose toggle -->
	<label class="flex items-center gap-2 text-xs text-gray-400">
		<input type="checkbox" checked={verbose} onchange={onToggleVerbose} class="rounded" />
		Verbose output
	</label>

	<!-- Action buttons -->
	<div class="flex gap-2">
		<button
			onclick={onReset}
			class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
		>
			Reset
		</button>
		<button
			onclick={onCompact}
			class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
		>
			Compact
		</button>
	</div>
</div>
