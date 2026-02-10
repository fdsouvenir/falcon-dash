<script lang="ts">
	import { call, connection } from '$lib/stores/gateway.js';

	type Model = {
		id: string;
		provider: string;
		name?: string;
		contextWindow?: number;
		capabilities?: string[];
	};

	type ModelsListResponse = {
		models: Model[];
	};

	let models = $state<Model[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function loadModels() {
		loading = true;
		error = null;
		try {
			const response = await call<ModelsListResponse>('models.list');
			models = response.models;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load models';
		} finally {
			loading = false;
		}
	}

	const modelsByProvider = $derived(
		models.reduce(
			(acc, model) => {
				if (!acc[model.provider]) {
					acc[model.provider] = [];
				}
				acc[model.provider].push(model);
				return acc;
			},
			{} as Record<string, Model[]>
		)
	);

	const providers = $derived(Object.keys(modelsByProvider).sort());

	let connectionState = $state('DISCONNECTED');
	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState === 'READY') loadModels();
	});
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-900">
	<div class="border-b border-gray-800 px-4 py-3">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-white">Models</h2>
				<p class="text-sm text-gray-400">Available AI models across all providers</p>
			</div>
			<button
				onclick={loadModels}
				disabled={loading}
				class="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
			>
				{loading ? 'Loading...' : 'Refresh'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="border-b border-red-800 bg-red-900/50 px-4 py-2 text-sm text-red-300">
			{error}
			<button
				onclick={() => {
					error = null;
				}}
				class="ml-2 text-xs underline"
			>
				Dismiss
			</button>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto">
		{#if loading && models.length === 0}
			<div class="p-4 text-center text-sm text-gray-500">Loading models...</div>
		{:else if models.length === 0}
			<div class="p-4 text-center text-sm text-gray-500">No models available</div>
		{:else}
			<div class="divide-y divide-gray-800">
				{#each providers as provider}
					<div class="px-4 py-3">
						<h3 class="mb-3 text-sm font-semibold uppercase text-gray-400">{provider}</h3>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-800 text-left text-xs uppercase text-gray-500">
										<th class="pb-2 pr-4">Model ID</th>
										<th class="pb-2 pr-4">Name</th>
										<th class="pb-2 pr-4 text-right">Context Window</th>
										<th class="pb-2">Capabilities</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-800/50">
									{#each modelsByProvider[provider] as model}
										<tr class="text-gray-300">
											<td class="py-2 pr-4 font-mono text-xs">{model.id}</td>
											<td class="py-2 pr-4">{model.name || '-'}</td>
											<td class="py-2 pr-4 text-right">
												{#if model.contextWindow}
													{model.contextWindow.toLocaleString()}
												{:else}
													-
												{/if}
											</td>
											<td class="py-2">
												{#if model.capabilities && model.capabilities.length > 0}
													<div class="flex flex-wrap gap-1">
														{#each model.capabilities as capability}
															<span class="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
																{capability}
															</span>
														{/each}
													</div>
												{:else}
													-
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
