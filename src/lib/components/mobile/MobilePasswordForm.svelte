<script lang="ts">
	interface Props {
		sessionToken: string;
		editPath?: string | null;
		onback: () => void;
		onsaved: () => void;
	}

	let { sessionToken, editPath = null, onback, onsaved }: Props = $props();

	let title = $state('');
	let username = $state('');
	let password = $state('');
	let url = $state('');
	let notes = $state('');
	let showPassword = $state(false);
	let isSaving = $state(false);
	let error = $state<string | null>(null);
	let isLoading = $state(false);

	const isEdit = !!editPath;

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
					notes: notes.trim()
				})
			});
			if (!res.ok) throw new Error('Failed to save entry');
			onsaved();
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
</script>

<div class="flex h-full flex-col bg-gray-950">
	<!-- Header -->
	<div class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
		<button onclick={onback} class="min-h-[44px] min-w-[44px] text-gray-400 active:text-white">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<h1 class="text-base font-semibold text-white">{isEdit ? 'Edit Entry' : 'New Entry'}</h1>
	</div>

	{#if isLoading}
		<div class="flex flex-1 items-center justify-center text-sm text-gray-500">Loading...</div>
	{:else}
		<div class="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
			{#if error}
				<div
					class="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300"
				>
					{error}
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label class="mb-1.5 block text-sm text-gray-400">Title</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={title}
						placeholder="Entry title"
						autofocus={!isEdit}
						class="min-h-[44px] w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label class="mb-1.5 block text-sm text-gray-400">Username</label>
					<input
						type="text"
						bind:value={username}
						placeholder="Username or email"
						class="min-h-[44px] w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label class="mb-1.5 block text-sm text-gray-400">Password</label>
					<div class="flex gap-2">
						<input
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Password"
							class="min-h-[44px] flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						/>
						<button
							onclick={() => {
								showPassword = !showPassword;
							}}
							class="min-h-[44px] rounded-lg border border-gray-700 bg-gray-900 px-3 text-gray-400 active:bg-gray-800"
							title={showPassword ? 'Hide' : 'Show'}
						>
							{#if showPassword}
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
									/>
								</svg>
							{:else}
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							{/if}
						</button>
						<button
							onclick={generatePassword}
							class="min-h-[44px] rounded-lg border border-gray-700 bg-gray-900 px-3 text-gray-400 active:bg-gray-800"
							title="Generate password"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
						</button>
					</div>
				</div>

				<div>
					<label class="mb-1.5 block text-sm text-gray-400">URL</label>
					<input
						type="text"
						bind:value={url}
						placeholder="https://..."
						class="min-h-[44px] w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label class="mb-1.5 block text-sm text-gray-400">Notes</label>
					<textarea
						bind:value={notes}
						placeholder="Additional notes"
						rows="4"
						class="w-full resize-none rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
					></textarea>
				</div>
			</div>

			<button
				onclick={handleSave}
				disabled={!title.trim() || isSaving}
				class="mt-6 min-h-[44px] w-full rounded-lg bg-blue-600 text-sm font-medium text-white active:bg-blue-700 disabled:opacity-50"
			>
				{isSaving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
			</button>
		</div>
	{/if}
</div>
