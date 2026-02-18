<script lang="ts">
	import { copyWithAutoClear } from '$lib/passwords/clipboard.js';
	import { addToast } from '$lib/stores/toast.js';
	import BottomSheet from './BottomSheet.svelte';

	interface Props {
		sessionToken: string;
		path: string;
		onback: () => void;
		onedit: (path: string) => void;
		ondeleted: () => void;
	}

	let { sessionToken, path, onback, onedit, ondeleted }: Props = $props();

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
	let showPassword = $state(false);
	let showDeleteSheet = $state(false);
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

	async function handleCopy(text: string) {
		await copyWithAutoClear(text);
		addToast('Copied to clipboard', 'success');
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
			showDeleteSheet = false;
		}
	}
</script>

<div class="flex h-full flex-col bg-gray-950">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
		<div class="flex items-center gap-3">
			<button onclick={onback} class="min-h-[44px] min-w-[44px] text-gray-400 active:text-white">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
			<h1 class="truncate text-base font-semibold text-white">
				{entry?.title ?? 'Entry Detail'}
			</h1>
		</div>
		<button
			onclick={() => onedit(path)}
			class="min-h-[44px] rounded-lg bg-gray-800 px-3 text-sm text-gray-300 active:bg-gray-700"
		>
			Edit
		</button>
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center text-sm text-gray-500">Loading...</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center text-sm text-red-400">{error}</div>
	{:else if entry}
		<div class="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
			<div class="space-y-3">
				<!-- Username -->
				{#if entry.username}
					<div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
							Username
						</div>
						<div class="flex items-center justify-between gap-2">
							<p class="min-w-0 truncate text-sm text-white">{entry.username}</p>
							<button
								onclick={() => handleCopy(entry!.username)}
								class="shrink-0 rounded-lg bg-gray-800 p-2 text-gray-400 active:bg-gray-700"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/if}

				<!-- Password -->
				<div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
					<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Password</div>
					<div class="flex items-center justify-between gap-2">
						<p class="min-w-0 truncate font-mono text-sm text-white">
							{showPassword ? entry.password : '••••••••'}
						</p>
						<div class="flex shrink-0 gap-1">
							<button
								onclick={() => {
									showPassword = !showPassword;
								}}
								class="rounded-lg bg-gray-800 p-2 text-gray-400 active:bg-gray-700"
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
								onclick={() => handleCopy(entry!.password)}
								class="rounded-lg bg-gray-800 p-2 text-gray-400 active:bg-gray-700"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>

				<!-- URL -->
				{#if entry.url}
					<div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">URL</div>
						<div class="flex items-center justify-between gap-2">
							<p class="min-w-0 truncate text-sm text-blue-400">{entry.url}</p>
							<div class="flex shrink-0 gap-1">
								<button
									onclick={() => handleCopy(entry!.url)}
									class="rounded-lg bg-gray-800 p-2 text-gray-400 active:bg-gray-700"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
										/>
									</svg>
								</button>
								<button
									onclick={() => window.open(entry!.url, '_blank', 'noopener,noreferrer')}
									class="rounded-lg bg-gray-800 p-2 text-gray-400 active:bg-gray-700"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										/>
									</svg>
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Notes -->
				{#if entry.notes}
					<div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
						<div class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Notes</div>
						<p class="whitespace-pre-wrap text-sm text-gray-300">{entry.notes}</p>
					</div>
				{/if}
			</div>

			<!-- Delete button -->
			<button
				onclick={() => {
					showDeleteSheet = true;
				}}
				class="mt-6 min-h-[44px] w-full rounded-lg bg-red-600 text-sm font-medium text-white active:bg-red-700"
			>
				Delete Entry
			</button>
		</div>
	{/if}

	<BottomSheet
		open={showDeleteSheet}
		onclose={() => {
			showDeleteSheet = false;
		}}
	>
		<div class="pb-4">
			<h3 class="mb-2 text-base font-semibold text-white">Delete Entry</h3>
			<p class="mb-6 text-sm text-gray-400">
				Are you sure you want to delete <span class="font-medium text-white">{entry?.title}</span>?
				This cannot be undone.
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => {
						showDeleteSheet = false;
					}}
					class="min-h-[44px] flex-1 rounded-lg bg-gray-800 text-sm text-gray-300 active:bg-gray-700"
				>
					Cancel
				</button>
				<button
					onclick={handleDelete}
					disabled={isDeleting}
					class="min-h-[44px] flex-1 rounded-lg bg-red-600 text-sm font-medium text-white active:bg-red-700 disabled:opacity-50"
				>
					{isDeleting ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</BottomSheet>
</div>
