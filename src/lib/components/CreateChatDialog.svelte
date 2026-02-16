<script lang="ts">
	let { onconfirm, oncancel }: { onconfirm: (name: string) => void; oncancel: () => void } =
		$props();

	let name = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		inputEl?.focus();
	});

	function submit() {
		onconfirm(name.trim());
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
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
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	aria-label="Create new chat"
>
	<div class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl">
		<h3 class="mb-3 text-sm font-medium text-white">New Chat</h3>
		<input
			bind:this={inputEl}
			bind:value={name}
			type="text"
			placeholder="New Chat"
			class="mb-4 w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
			onkeydown={handleKeydown}
		/>
		<div class="flex justify-end gap-2">
			<button
				onclick={oncancel}
				class="rounded px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
			>
				Cancel
			</button>
			<button
				onclick={submit}
				class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
			>
				Create
			</button>
		</div>
	</div>
</div>
