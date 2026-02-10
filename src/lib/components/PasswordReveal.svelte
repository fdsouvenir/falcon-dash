<script lang="ts">
	import { copyWithAutoClear } from '$lib/passwords/clipboard.js';

	interface Props {
		sessionToken: string;
		path: string;
	}

	let { sessionToken, path }: Props = $props();

	let revealed = $state(false);
	let password = $state('');
	let loading = $state(false);
	let copied = $state(false);

	async function reveal() {
		if (revealed) {
			revealed = false;
			password = '';
			return;
		}
		loading = true;
		try {
			const res = await fetch(`/api/passwords/${encodeURIComponent(path)}`, {
				headers: { 'x-session-token': sessionToken }
			});
			if (!res.ok) throw new Error('Failed to fetch');
			const data = await res.json();
			password = data.password ?? '';
			revealed = true;
			// Auto-hide after 30 seconds
			setTimeout(() => {
				revealed = false;
				password = '';
			}, 30000);
		} catch {
			// Session might be expired
			revealed = false;
		} finally {
			loading = false;
		}
	}

	async function copyPassword() {
		if (!password && !revealed) {
			// Fetch first, then copy
			loading = true;
			try {
				const res = await fetch(`/api/passwords/${encodeURIComponent(path)}`, {
					headers: { 'x-session-token': sessionToken }
				});
				if (!res.ok) throw new Error('Failed to fetch');
				const data = await res.json();
				await copyWithAutoClear(data.password ?? '');
				copied = true;
				setTimeout(() => {
					copied = false;
				}, 2000);
			} catch {
				// ignore
			} finally {
				loading = false;
			}
		} else {
			await copyWithAutoClear(password);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		}
	}
</script>

<span class="inline-flex items-center gap-1">
	<span class="font-mono text-xs">
		{#if loading}
			<span class="text-gray-500">...</span>
		{:else if revealed}
			{password}
		{:else}
			••••••••
		{/if}
	</span>
	<button
		onclick={reveal}
		class="rounded px-1 text-[10px] text-gray-500 hover:text-white"
		title={revealed ? 'Hide' : 'Reveal'}
	>
		{revealed ? '🙈' : '👁️'}
	</button>
	<button
		onclick={copyPassword}
		class="rounded px-1 text-[10px] {copied ? 'text-green-400' : 'text-gray-500 hover:text-white'}"
		title={copied ? 'Copied!' : 'Copy (auto-clears in 30s)'}
	>
		{copied ? '✓' : '📋'}
	</button>
</span>
