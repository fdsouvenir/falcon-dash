<script lang="ts">
	let {
		existingNames = [],
		onconfirm,
		oncancel
	}: {
		agentId: string;
		existingNames: string[];
		onconfirm: (name: string, description?: string) => void;
		oncancel: () => void;
	} = $props();

	let name = $state('');
	let description = $state('');
	let error = $state('');

	function sanitizeName(input: string): string {
		return input
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		name = sanitizeName(input.value);
		error = '';
	}

	function handleSubmit() {
		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Channel name is required';
			return;
		}
		if (existingNames.includes(trimmed)) {
			error = 'A channel with this name already exists';
			return;
		}
		onconfirm(trimmed, description.trim() || undefined);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		}
		if (e.key === 'Escape') {
			oncancel();
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={(e) => {
		if (e.target === e.currentTarget) oncancel();
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') oncancel();
	}}
	role="dialog"
	aria-modal="true"
	aria-label="Create channel"
>
	<div class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl">
		<h3 class="mb-3 text-sm font-medium text-white">Create Channel</h3>

		<div class="mb-3">
			<label class="mb-1 block text-xs text-gray-400" for="channel-name">Channel name</label>
			<div class="relative">
				<span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500">#</span>
				<!-- eslint-disable-next-line svelte/no-autofocus -- dialog needs immediate focus -->
				<input
					id="channel-name"
					type="text"
					value={name}
					oninput={handleInput}
					onkeydown={handleKeydown}
					placeholder="new-channel"
					autofocus
					class="w-full rounded border border-gray-600 bg-gray-900 py-1.5 pl-6 pr-3 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
				/>
			</div>
			{#if error}
				<p class="mt-1 text-xs text-red-400">{error}</p>
			{/if}
		</div>

		<div class="mb-4">
			<label class="mb-1 block text-xs text-gray-400" for="channel-desc"
				>Description (optional)</label
			>
			<input
				id="channel-desc"
				type="text"
				bind:value={description}
				onkeydown={handleKeydown}
				placeholder="What's this channel about?"
				class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			/>
		</div>

		<div class="flex justify-end gap-2">
			<button
				onclick={oncancel}
				class="rounded px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
			>
				Cancel
			</button>
			<button
				onclick={handleSubmit}
				disabled={!name.trim()}
				class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
			>
				Create
			</button>
		</div>
	</div>
</div>
