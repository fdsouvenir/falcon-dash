<script lang="ts">
	import { currentGroup, createEntry } from '$lib/stores/vault.js';
	import { addToast } from '$lib/stores/toast.js';

	interface Props {
		onCancel?: () => void;
		onCreated?: (path: string) => void;
	}

	let { onCancel, onCreated }: Props = $props();

	let group = $state('');
	$effect(() => {
		const unsub = currentGroup.subscribe((v) => (group = v));
		return unsub;
	});

	let title = $state('');
	let username = $state('');
	let password = $state('');
	let url = $state('');
	let notes = $state('');
	let generatePassword = $state(false);
	let showPassword = $state(false);
	let saving = $state(false);

	/** Full path = group + title */
	const entryPath = $derived(group ? `${group}/${title.trim()}` : title.trim());

	async function handleSubmit() {
		if (!title.trim()) return;
		saving = true;
		try {
			await createEntry({
				path: entryPath,
				username: username.trim() || undefined,
				password: generatePassword ? undefined : password || undefined,
				url: url.trim() || undefined,
				notes: notes.trim() || undefined
			});
			addToast(`Entry "${title.trim()}" created`, 'success');
			onCreated?.(entryPath);
		} catch (err) {
			addToast(`Failed to create entry: ${(err as Error).message}`, 'error');
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
	<div class="w-full max-w-md rounded-lg border border-surface-border bg-surface-1 shadow-xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-surface-border px-4 py-3">
			<h2 class="text-[length:var(--text-card-title)] font-medium text-white">New Entry</h2>
			<button onclick={onCancel} class="text-status-muted hover:text-white">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Form -->
		<form onsubmit={handleSubmit} class="space-y-4 p-4">
			<!-- Group context -->
			{#if group}
				<div class="rounded-lg bg-surface-3 px-3 py-2 text-[length:var(--text-badge)] text-status-muted">
					Group: <span class="font-mono text-white">{group}</span>
				</div>
			{/if}

			<!-- Title -->
			<div>
				<label for="entry-title" class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted">Title *</label>
				<input
					id="entry-title"
					type="text"
					bind:value={title}
					placeholder="e.g. GitHub API Key"
					required
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
				/>
			</div>

			<!-- Username -->
			<div>
				<label for="entry-username" class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted">Username</label>
				<input
					id="entry-username"
					type="text"
					bind:value={username}
					placeholder="user@example.com"
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
				/>
			</div>

			<!-- Password -->
			<div>
				<div class="mb-1 flex items-center justify-between">
					<label for="entry-password" class="text-[length:var(--text-badge)] font-medium text-status-muted">Password</label>
					<label class="flex cursor-pointer items-center gap-1.5 text-[length:var(--text-badge)] text-status-muted">
						<input
							type="checkbox"
							bind:checked={generatePassword}
							class="rounded border-surface-border"
						/>
						Auto-generate
					</label>
				</div>
				{#if !generatePassword}
					<div class="relative">
						<input
							id="entry-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Enter password"
							class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 pr-9 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-status-muted hover:text-white"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								{#if showPassword}
									<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								{:else}
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								{/if}
							</svg>
						</button>
					</div>
				{:else}
					<div class="rounded-lg border border-surface-border bg-surface-3 px-3 py-2 text-[length:var(--text-badge)] text-status-muted">
						A strong password will be generated automatically.
					</div>
				{/if}
			</div>

			<!-- URL -->
			<div>
				<label for="entry-url" class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted">URL</label>
				<input
					id="entry-url"
					type="url"
					bind:value={url}
					placeholder="https://example.com"
					class="w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
				/>
			</div>

			<!-- Notes -->
			<div>
				<label for="entry-notes" class="mb-1 block text-[length:var(--text-label)] font-medium text-status-muted">Notes</label>
				<textarea
					id="entry-notes"
					bind:value={notes}
					rows="3"
					placeholder="Optional notes"
					class="w-full resize-none rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted/40 focus:border-status-info focus:outline-none"
				></textarea>
			</div>

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
					disabled={saving || !title.trim()}
					class="rounded-lg bg-status-active px-4 py-2 text-[length:var(--text-body)] font-medium text-white hover:opacity-80 disabled:opacity-50"
				>
					{saving ? 'Creating…' : 'Create Entry'}
				</button>
			</div>
		</form>
	</div>
</div>
