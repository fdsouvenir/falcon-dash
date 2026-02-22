<script lang="ts">
	import MarkdownRenderer from '../MarkdownRenderer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	const FILE_PATH = 'USER.md';

	let content = $state('');
	let isEditing = $state(false);
	let editContent = $state('');
	let saving = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let fileExists = $state(false);

	async function loadFile() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/workspace-file?path=${FILE_PATH}`);
			if (res.status === 404) {
				fileExists = false;
				return;
			}
			if (!res.ok) {
				throw new Error(await res.text());
			}
			const data = await res.json();
			content = data.content;
			fileExists = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function saveFile() {
		saving = true;
		try {
			const res = await fetch('/api/workspace-file', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: FILE_PATH, content: editContent })
			});
			if (!res.ok) {
				throw new Error(await res.text());
			}
			content = editContent;
			isEditing = false;
			await loadFile();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save file';
		} finally {
			saving = false;
		}
	}

	async function createFile() {
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/workspace-file', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: FILE_PATH, content: '# User\n\n' })
			});
			if (!res.ok) {
				throw new Error(await res.text());
			}
			await loadFile();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create file';
		} finally {
			saving = false;
		}
	}

	function startEditing() {
		editContent = content;
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
		editContent = '';
	}

	$effect(() => {
		loadFile();
	});
</script>

<div class="flex h-full flex-col p-4" class:overflow-y-auto={!isEditing}>
	<Card.Root class="w-full {isEditing ? 'flex min-h-0 flex-1 flex-col' : ''}">
		<Card.Header>
			<div class="flex items-center justify-between">
				<div>
					<Card.Title>User Profile</Card.Title>
					<Card.Description>
						Tell your agent about yourself — preferences, context, and communication style
					</Card.Description>
				</div>
				{#if fileExists && !isEditing}
					<Button variant="outline" size="sm" onclick={startEditing}>Edit</Button>
				{/if}
				{#if isEditing}
					<div class="flex items-center gap-2">
						<Button variant="ghost" size="sm" onclick={cancelEditing}>Cancel</Button>
						<Button size="sm" onclick={saveFile} disabled={saving}>
							{saving ? 'Saving...' : 'Save'}
						</Button>
					</div>
				{/if}
			</div>
		</Card.Header>

		{#if error}
			<Card.Content>
				<div
					class="flex items-center justify-between rounded-lg border border-red-800 bg-red-900/50 px-4 py-2 text-sm text-red-300"
				>
					{error}
					<button
						onclick={() => {
							error = null;
						}}
						class="text-xs underline"
					>
						Dismiss
					</button>
				</div>
			</Card.Content>
		{/if}

		<Card.Content class={isEditing ? 'flex min-h-0 flex-1 flex-col' : ''}>
			{#if loading}
				<p class="text-muted-foreground text-center text-sm">Loading...</p>
			{:else if !fileExists}
				<div class="flex flex-col items-center gap-4 py-8">
					<p class="text-muted-foreground text-sm">
						No USER.md file exists yet. Create one to tell your agent about yourself.
					</p>
					<Button onclick={createFile} disabled={saving}>
						{saving ? 'Creating...' : 'Create USER.md'}
					</Button>
				</div>
			{:else if isEditing}
				<textarea
					bind:value={editContent}
					class="bg-muted min-h-0 w-full flex-1 resize-none rounded-lg border p-4 font-mono text-sm focus:outline-none"
					spellcheck="false"
				></textarea>
			{:else}
				<div class="prose prose-invert max-w-none">
					<MarkdownRenderer {content} />
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
