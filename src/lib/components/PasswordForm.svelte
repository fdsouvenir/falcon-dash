<script lang="ts">
	interface Props {
		sessionToken: string;
		editPath?: string | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let { sessionToken, editPath = null, onclose, onsaved }: Props = $props();

	let title = $state('');
	let username = $state('');
	let password = $state('');
	let url = $state('');
	let notes = $state('');
	let showPassword = $state(false);
	let isSaving = $state(false);
	let error = $state<string | null>(null);
	let isLoading = $state(false);

	interface CustomAttr {
		key: string;
		value: string;
	}

	let customAttributes = $state<CustomAttr[]>([]);
	let removedAttributes = $state<string[]>([]);

	const isEdit = !!editPath;

	// Load existing entry if editing
	$effect(() => {
		if (editPath) {
			loadEntry(editPath);
		}
	});

	async function loadEntry(path: string) {
		isLoading = true;
		try {
			const res = await fetch(`/api/passwords/${encodeURIComponent(path)}`, {
				headers: { 'x-session-token': sessionToken }
			});
			if (!res.ok) throw new Error('Failed to load entry');
			const data = await res.json();
			title = data.title ?? '';
			username = data.username ?? '';
			password = data.password ?? '';
			url = data.url ?? '';
			notes = data.notes ?? '';
			if (data.customAttributes) {
				customAttributes = Object.entries(data.customAttributes as Record<string, string>).map(
					([key, value]) => ({ key, value })
				);
			}
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		if (!title.trim()) return;
		isSaving = true;
		error = null;

		const path = editPath ?? title.trim();
		const attrs: Record<string, string> = {};
		for (const attr of customAttributes) {
			const k = attr.key.trim();
			if (k) attrs[k] = attr.value;
		}

		try {
			const res = await fetch(`/api/passwords/${encodeURIComponent(path)}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'x-session-token': sessionToken
				},
				body: JSON.stringify({
					title: title.trim(),
					username: username.trim(),
					password,
					url: url.trim(),
					notes: notes.trim(),
					customAttributes: Object.keys(attrs).length > 0 ? attrs : undefined,
					removedAttributes: removedAttributes.length > 0 ? removedAttributes : undefined
				})
			});
			if (!res.ok) throw new Error('Failed to save entry');
			onsaved();
			onclose();
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isSaving = false;
		}
	}

	function generatePassword() {
		const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
		const array = new Uint8Array(20);
		crypto.getRandomValues(array);
		password = Array.from(array, (b) => chars[b % chars.length]).join('');
	}

	function addAttribute() {
		customAttributes.push({ key: '', value: '' });
	}

	function removeAttr(index: number) {
		const attr = customAttributes[index];
		if (attr.key.trim() && isEdit) {
			removedAttributes.push(attr.key.trim());
		}
		customAttributes.splice(index, 1);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={onclose}
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
	}}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="max-h-[80vh] w-96 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 p-5"
		onclick={(e) => e.stopPropagation()}
	>
		<h3 class="mb-4 text-sm font-medium text-white">{isEdit ? 'Edit Entry' : 'New Entry'}</h3>

		{#if isLoading}
			<p class="text-xs text-gray-500">Loading...</p>
		{:else}
			{#if error}
				<div
					class="mb-3 rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-300"
				>
					{error}
				</div>
			{/if}

			<div class="space-y-3">
				<div>
					<label class="mb-1 block text-xs text-gray-400">Title</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={title}
						placeholder="Entry title"
						autofocus
						class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs text-gray-400">Username</label>
					<input
						type="text"
						bind:value={username}
						placeholder="Username or email"
						class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs text-gray-400">Password</label>
					<div class="flex gap-1">
						<input
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Password"
							class="flex-1 rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						/>
						<button
							onclick={() => {
								showPassword = !showPassword;
							}}
							class="rounded border border-gray-600 bg-gray-900 px-2 text-xs text-gray-400 hover:text-white"
							title={showPassword ? 'Hide' : 'Show'}
						>
							{showPassword ? '🙈' : '👁️'}
						</button>
						<button
							onclick={generatePassword}
							class="rounded border border-gray-600 bg-gray-900 px-2 text-xs text-gray-400 hover:text-white"
							title="Generate password"
						>
							🎲
						</button>
					</div>
				</div>
				<div>
					<label class="mb-1 block text-xs text-gray-400">URL</label>
					<input
						type="text"
						bind:value={url}
						placeholder="https://..."
						class="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs text-gray-400">Notes</label>
					<textarea
						bind:value={notes}
						placeholder="Additional notes"
						rows="3"
						class="w-full resize-none rounded border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					></textarea>
				</div>

				<!-- Custom Attributes -->
				<div class="border-t border-gray-700 pt-3">
					<div class="mb-2 flex items-center justify-between">
						<label class="text-xs text-gray-400">Custom Attributes</label>
						<button
							onclick={addAttribute}
							class="rounded px-2 py-0.5 text-xs text-blue-400 hover:text-blue-300"
						>
							+ Add
						</button>
					</div>
					{#each customAttributes as attr, i (i)}
						<div class="mb-2 flex gap-1">
							<input
								type="text"
								bind:value={attr.key}
								placeholder="Key"
								class="w-1/3 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
							/>
							<input
								type="text"
								bind:value={attr.value}
								placeholder="Value"
								class="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
							/>
							<button
								onclick={() => removeAttr(i)}
								class="rounded px-1.5 text-xs text-red-400 hover:text-red-300"
								title="Remove attribute"
							>
								✕
							</button>
						</div>
					{/each}
				</div>
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button onclick={onclose} class="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
					>Cancel</button
				>
				<button
					onclick={handleSave}
					disabled={!title.trim() || isSaving}
					class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
				>
					{isSaving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
				</button>
			</div>
		{/if}
	</div>
</div>
