<script lang="ts">
	interface SecretFile {
		name: string;
		size: number;
		preview: string;
	}

	interface Props {
		sessionToken: string;
	}

	let { sessionToken }: Props = $props();

	let files = $state<SecretFile[]>([]);
	let isScanning = $state(false);
	let isImporting = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let importResult = $state<{ imported: number; errors: string[] } | null>(null);

	async function scanForSecrets() {
		isScanning = true;
		errorMessage = null;
		successMessage = null;
		importResult = null;

		try {
			const res = await fetch('/api/passwords/import-secrets', {
				headers: { 'x-session-token': sessionToken }
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message ?? 'Failed to scan secrets');
			}

			const data = await res.json();
			files = data.files;

			if (files.length === 0) {
				successMessage = 'No secrets found in ~/.openclaw/secrets/';
			}
		} catch (err) {
			errorMessage = (err as Error).message;
		} finally {
			isScanning = false;
		}
	}

	async function importSecrets() {
		if (
			!confirm(
				`Import ${files.length} secret file(s) into the vault?\n\nThis will create password entries with the file contents.`
			)
		) {
			return;
		}

		isImporting = true;
		errorMessage = null;
		successMessage = null;

		try {
			const res = await fetch('/api/passwords/import-secrets', {
				method: 'POST',
				headers: { 'x-session-token': sessionToken }
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message ?? 'Failed to import secrets');
			}

			const data = await res.json();
			importResult = data;

			if (data.imported > 0) {
				successMessage = `Successfully imported ${data.imported} secret(s)`;
				files = [];
			}

			if (data.errors.length > 0) {
				errorMessage = `${data.errors.length} error(s) occurred during import`;
			}
		} catch (err) {
			errorMessage = (err as Error).message;
		} finally {
			isImporting = false;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<div class="flex h-full flex-col bg-gray-900 p-6">
	<div class="mb-6">
		<h2 class="mb-2 text-lg font-medium text-white">Import Secrets</h2>
		<p class="text-sm text-gray-400">
			Migrate files from ~/.openclaw/secrets/ into the password vault.
		</p>
	</div>

	<div class="mb-6 flex gap-3">
		<button
			onclick={scanForSecrets}
			disabled={isScanning || isImporting}
			class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isScanning ? 'Scanning...' : 'Scan for Secrets'}
		</button>

		{#if files.length > 0}
			<button
				onclick={importSecrets}
				disabled={isImporting}
				class="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isImporting ? 'Importing...' : `Import All (${files.length})`}
			</button>
		{/if}
	</div>

	{#if errorMessage}
		<div class="mb-4 rounded border border-red-700 bg-red-900/20 p-3 text-sm text-red-400">
			{errorMessage}
		</div>
	{/if}

	{#if successMessage}
		<div class="mb-4 rounded border border-green-700 bg-green-900/20 p-3 text-sm text-green-400">
			{successMessage}
		</div>
	{/if}

	{#if importResult && importResult.errors.length > 0}
		<div class="mb-4 rounded border border-yellow-700 bg-yellow-900/20 p-3">
			<div class="mb-2 text-sm font-medium text-yellow-400">Import Errors:</div>
			<ul class="list-inside list-disc space-y-1 text-xs text-yellow-300">
				{#each importResult.errors as error, i (i)}
					<li>{error}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if files.length > 0}
		<div class="flex-1 overflow-y-auto rounded border border-gray-700 bg-gray-800">
			<table class="w-full text-sm">
				<thead class="sticky top-0 bg-gray-700 text-xs text-gray-300">
					<tr>
						<th class="px-4 py-2 text-left">File Name</th>
						<th class="px-4 py-2 text-left">Size</th>
						<th class="px-4 py-2 text-left">Preview</th>
					</tr>
				</thead>
				<tbody class="text-gray-200">
					{#each files as file (file.name)}
						<tr class="border-t border-gray-700">
							<td class="px-4 py-2 font-mono text-xs">{file.name}</td>
							<td class="px-4 py-2 text-xs text-gray-400">{formatBytes(file.size)}</td>
							<td class="px-4 py-2 font-mono text-xs text-gray-500">{file.preview}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
