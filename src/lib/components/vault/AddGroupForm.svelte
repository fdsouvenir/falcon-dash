<script lang="ts">
	import { currentGroup, vaultGroups, createGroup } from '$lib/stores/vault.js';
	import { addToast } from '$lib/stores/toast.js';

	interface Props {
		onCancel?: () => void;
		onCreated?: () => void;
	}

	let { onCancel, onCreated }: Props = $props();

	let allGroups = $state<string[]>([]);
	let parentGroup = $state('');
	$effect(() => {
		const u1 = vaultGroups.subscribe((v) => (allGroups = v));
		const u2 = currentGroup.subscribe((v) => (parentGroup = v));
		return () => { u1(); u2(); };
	});

	let name = $state('');
	let saving = $state(false);

	/** Full path of the new group */
	const groupPath = $derived(parentGroup ? `${parentGroup}/${name.trim()}` : name.trim());

	async function handleSubmit() {
		if (!name.trim()) return;
		saving = true;
		try {
			await createGroup(groupPath);
			addToast(`Group "${name.trim()}" created`, 'success');
			onCreated?.();
		} catch (err) {
			addToast(`Failed to create group: ${(err as Error).message}`, 'error');
		} finally {
			saving = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onCancel?.();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onkeydown={handleKeydown}
>
	<div class="w-full max-w-sm rounded-lg border border-surface-border bg-surface-1 shadow-xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-surface-border px-4 py-3">
			<h2 class="text-[length:var(--text-body)] font-semibold text-white">New Group</h2>
			<button onclick={onCancel} class="text-status-muted hover:text-white">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Form -->
		<form onsubmit={handleSubmit} class="space-y-4 p-4">
			<!-- Parent group -->
			<div>
				<label for="group-parent" class="mb-1 block text-[length:var(--text-badge)] font-medium text-status-muted">Parent Group</label>
				<select
					id="group-parent"
					bind:value={parentGroup}
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
				>
					<option value="">(Vault root)</option>
					{#each allGroups as g (g)}
						<option value={g}>{g}</option>
					{/each}
				</select>
			</div>

			<!-- Group name -->
			<div>
				<label for="group-name" class="mb-1 block text-[length:var(--text-badge)] font-medium text-status-muted">Group Name *</label>
				<input
					id="group-name"
					type="text"
					bind:value={name}
					placeholder="e.g. Work"
					required
					autofocus
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
				/>
			</div>

			<!-- Path preview -->
			{#if name.trim()}
				<div class="rounded-lg bg-surface-3 px-3 py-2 text-[length:var(--text-badge)] text-status-muted">
					Path: <span class="font-mono text-white">{groupPath}</span>
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg px-4 py-2 text-[length:var(--text-body)] text-status-muted hover:bg-surface-3 hover:text-white"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving || !name.trim()}
					class="rounded-lg bg-status-info px-4 py-2 text-[length:var(--text-body)] font-medium text-white hover:opacity-80 disabled:opacity-50"
				>
					{saving ? 'Creating…' : 'Create Group'}
				</button>
			</div>
		</form>
	</div>
</div>
