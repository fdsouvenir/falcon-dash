<script lang="ts">
	interface Props {
		sessionToken: string;
		path: string;
		onclose: () => void;
		onedit: (path: string) => void;
		ondeleted: () => void;
	}

	let { sessionToken, path, onclose, onedit, ondeleted }: Props = $props();

	interface EntryDetail {
		title: string;
		username: string;
		password: string;
		url: string;
		notes: string;
		path: string;
	}

	let entry = $state<EntryDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showDeleteConfirm = $state(false);
	let isDeleting = $state(false);

	$effect(() => {
		loadDetail();
	});

	async function loadDetail() {
		loading = true;
		try {
			const res = await fetch(`/api/passwords/${encodeURIComponent(path)}`, {
				headers: { 'x-session-token': sessionToken }
			});
			if (!res.ok) throw new Error('Failed to load entry');
			entry = await res.json();
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		isDeleting = true;
		try {
			const res = await fetch(`/api/passwords/${encodeURIComponent(path)}`, {
				method: 'DELETE',
				headers: { 'x-session-token': sessionToken }
			});
			if (!res.ok) throw new Error('Failed to delete');
			ondeleted();
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isDeleting = false;
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
		<div class="flex items-center gap-2">
			<button onclick={onclose} class="text-gray-400 hover:text-white" aria-label="Back">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
			<h2 class="text-sm font-medium text-white">{entry?.title ?? 'Entry Detail'}</h2>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => onedit(path)}
				class="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600">Edit</button
			>
			<button
				onclick={() => {
					showDeleteConfirm = true;
				}}
				class="rounded bg-red-600/50 px-2 py-1 text-xs text-red-300 hover:bg-red-600">Delete</button
			>
		</div>
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center text-xs text-gray-500">Loading...</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center text-xs text-red-400">{error}</div>
	{:else if entry}
		<div class="flex-1 overflow-y-auto p-4">
			<div class="space-y-4">
				<div>
					<span class="text-[10px] font-medium uppercase tracking-wide text-gray-500">Username</span
					>
					<p class="mt-1 text-xs text-white">{entry.username || '—'}</p>
				</div>
				<div>
					<span class="text-[10px] font-medium uppercase tracking-wide text-gray-500">Password</span
					>
					<p class="mt-1 font-mono text-xs text-white">••••••••</p>
				</div>
				<div>
					<span class="text-[10px] font-medium uppercase tracking-wide text-gray-500">URL</span>
					<p class="mt-1 text-xs text-white">{entry.url || '—'}</p>
				</div>
				{#if entry.notes}
					<div>
						<span class="text-[10px] font-medium uppercase tracking-wide text-gray-500">Notes</span>
						<p class="mt-1 whitespace-pre-wrap text-xs text-gray-300">{entry.notes}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if showDeleteConfirm}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			role="dialog"
			aria-modal="true"
			aria-label="Delete entry confirmation"
			onclick={(e) => {
				if (e.target === e.currentTarget) showDeleteConfirm = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') showDeleteConfirm = false;
			}}
		>
			<div class="w-80 rounded-lg border border-gray-700 bg-gray-800 p-4">
				<h3 class="mb-2 text-sm font-medium text-white">Delete Entry</h3>
				<p class="mb-4 text-xs text-gray-400">
					Are you sure you want to delete <span class="font-medium text-white">{entry?.title}</span
					>?
				</p>
				<div class="flex justify-end gap-2">
					<button
						onclick={() => {
							showDeleteConfirm = false;
						}}
						class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button
					>
					<button
						onclick={handleDelete}
						disabled={isDeleting}
						class="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-500 disabled:opacity-50"
					>
						{isDeleting ? 'Deleting...' : 'Delete'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
