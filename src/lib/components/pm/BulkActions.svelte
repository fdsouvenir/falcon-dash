<script lang="ts">
	import type { Task } from '$lib/stores/pm-projects.js';
	import { milestones } from '$lib/stores/pm-domains.js';
	import { call } from '$lib/stores/gateway.js';

	interface Props {
		tasks: Task[];
		onRefresh: () => void;
	}

	let { tasks, onRefresh }: Props = $props();

	import { SvelteSet } from 'svelte/reactivity';

	let selectedIds = new SvelteSet<number>();
	let showToolbar = $derived(selectedIds.size > 0);
	let selectedCount = $derived(selectedIds.size);

	let statusValue = $state('');
	let priorityValue = $state('');
	let milestoneValue = $state('');
	let projectIdValue = $state('');

	let errors = $state<Array<{ id: number; error: string }>>([]);
	let successMessage = $state('');
	let isProcessing = $state(false);

	const allSelected = $derived(tasks.length > 0 && selectedIds.size === tasks.length);

	function toggleAll() {
		if (allSelected) {
			selectedIds.clear();
		} else {
			selectedIds = new SvelteSet(tasks.map((t) => t.id));
		}
	}

	function toggleTask(id: number) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
		selectedIds = selectedIds;
	}

	async function applyStatusChange() {
		if (!statusValue || selectedIds.size === 0) return;
		isProcessing = true;
		errors = [];
		successMessage = '';

		try {
			const res = await call<{ updated: number; errors: Array<{ id: number; error: string }> }>(
				'pm.bulk.update',
				{
					targets: Array.from(selectedIds).map((id) => ({ type: 'task', id })),
					fields: { status: statusValue },
					idempotencyKey: `bulk-status-${Date.now()}`
				}
			);
			if (res.errors && res.errors.length > 0) {
				errors = res.errors;
			}
			successMessage = `Updated ${res.updated} task(s)`;
			statusValue = '';
			selectedIds.clear();
			onRefresh();
		} catch (err) {
			errors = [{ id: 0, error: (err as Error).message }];
		} finally {
			isProcessing = false;
		}
	}

	async function applyPriorityChange() {
		if (!priorityValue || selectedIds.size === 0) return;
		isProcessing = true;
		errors = [];
		successMessage = '';

		try {
			const res = await call<{ updated: number; errors: Array<{ id: number; error: string }> }>(
				'pm.bulk.update',
				{
					targets: Array.from(selectedIds).map((id) => ({ type: 'task', id })),
					fields: { priority: priorityValue },
					idempotencyKey: `bulk-priority-${Date.now()}`
				}
			);
			if (res.errors && res.errors.length > 0) {
				errors = res.errors;
			}
			successMessage = `Updated ${res.updated} task(s)`;
			priorityValue = '';
			selectedIds.clear();
			onRefresh();
		} catch (err) {
			errors = [{ id: 0, error: (err as Error).message }];
		} finally {
			isProcessing = false;
		}
	}

	async function applyMilestoneChange() {
		if (!milestoneValue || selectedIds.size === 0) return;
		isProcessing = true;
		errors = [];
		successMessage = '';

		try {
			const milestoneId = milestoneValue === 'null' ? null : parseInt(milestoneValue, 10);
			const res = await call<{ updated: number; errors: Array<{ id: number; error: string }> }>(
				'pm.bulk.update',
				{
					targets: Array.from(selectedIds).map((id) => ({ type: 'task', id })),
					fields: { milestoneId },
					idempotencyKey: `bulk-milestone-${Date.now()}`
				}
			);
			if (res.errors && res.errors.length > 0) {
				errors = res.errors;
			}
			successMessage = `Updated ${res.updated} task(s)`;
			milestoneValue = '';
			selectedIds.clear();
			onRefresh();
		} catch (err) {
			errors = [{ id: 0, error: (err as Error).message }];
		} finally {
			isProcessing = false;
		}
	}

	async function applyMoveToProject() {
		if (!projectIdValue || selectedIds.size === 0) return;
		isProcessing = true;
		errors = [];
		successMessage = '';

		try {
			const projectId = parseInt(projectIdValue, 10);
			const res = await call<{ updated: number; errors: Array<{ id: number; error: string }> }>(
				'pm.bulk.move',
				{
					taskIds: Array.from(selectedIds),
					projectId,
					idempotencyKey: `bulk-move-${Date.now()}`
				}
			);
			if (res.errors && res.errors.length > 0) {
				errors = res.errors;
			}
			successMessage = `Moved ${res.updated} task(s)`;
			projectIdValue = '';
			selectedIds.clear();
			onRefresh();
		} catch (err) {
			errors = [{ id: 0, error: (err as Error).message }];
		} finally {
			isProcessing = false;
		}
	}

	function clearMessages() {
		errors = [];
		successMessage = '';
	}
</script>

<div class="space-y-4">
	{#if successMessage}
		<div
			class="bg-green-900/20 border border-green-700 text-green-400 px-4 py-2 rounded flex items-center justify-between"
		>
			<span>{successMessage}</span>
			<button onclick={clearMessages} class="text-green-400 hover:text-green-300">×</button>
		</div>
	{/if}

	{#if errors.length > 0}
		<div class="bg-red-900/20 border border-red-700 text-red-400 px-4 py-2 rounded space-y-1">
			<div class="flex items-center justify-between">
				<span class="font-semibold">Errors occurred:</span>
				<button onclick={clearMessages} class="text-red-400 hover:text-red-300">×</button>
			</div>
			{#each errors as err (err.id)}
				<div class="text-sm">
					{#if err.id > 0}
						Task #{err.id}: {err.error}
					{:else}
						{err.error}
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if showToolbar}
		<div class="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-sm font-semibold text-gray-300">{selectedCount} task(s) selected</span>
				<button
					onclick={() => selectedIds.clear()}
					class="text-xs text-gray-400 hover:text-gray-300"
				>
					Clear selection
				</button>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
				<!-- Status -->
				<div class="flex gap-2">
					<select
						bind:value={statusValue}
						class="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
						disabled={isProcessing}
					>
						<option value="">Change status...</option>
						<option value="todo">Todo</option>
						<option value="in_progress">In Progress</option>
						<option value="review">Review</option>
						<option value="done">Done</option>
					</select>
					<button
						onclick={applyStatusChange}
						disabled={!statusValue || isProcessing}
						class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded"
					>
						Apply
					</button>
				</div>

				<!-- Priority -->
				<div class="flex gap-2">
					<select
						bind:value={priorityValue}
						class="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
						disabled={isProcessing}
					>
						<option value="">Change priority...</option>
						<option value="low">Low</option>
						<option value="normal">Normal</option>
						<option value="high">High</option>
						<option value="urgent">Urgent</option>
					</select>
					<button
						onclick={applyPriorityChange}
						disabled={!priorityValue || isProcessing}
						class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded"
					>
						Apply
					</button>
				</div>

				<!-- Milestone -->
				<div class="flex gap-2">
					<select
						bind:value={milestoneValue}
						class="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
						disabled={isProcessing}
					>
						<option value="">Change milestone...</option>
						<option value="null">Clear milestone</option>
						{#each $milestones as milestone (milestone.id)}
							<option value={String(milestone.id)}>{milestone.name}</option>
						{/each}
					</select>
					<button
						onclick={applyMilestoneChange}
						disabled={!milestoneValue || isProcessing}
						class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded"
					>
						Apply
					</button>
				</div>

				<!-- Move to project -->
				<div class="flex gap-2">
					<input
						type="number"
						bind:value={projectIdValue}
						placeholder="Project ID..."
						class="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
						disabled={isProcessing}
					/>
					<button
						onclick={applyMoveToProject}
						disabled={!projectIdValue || isProcessing}
						class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded"
					>
						Move
					</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
		<table class="w-full text-sm">
			<thead class="bg-gray-800 border-b border-gray-700">
				<tr>
					<th class="text-left p-3 w-12">
						<input
							type="checkbox"
							checked={allSelected}
							onchange={toggleAll}
							class="rounded bg-gray-900 border-gray-700"
						/>
					</th>
					<th class="text-left p-3 text-gray-300">ID</th>
					<th class="text-left p-3 text-gray-300">Title</th>
					<th class="text-left p-3 text-gray-300">Status</th>
					<th class="text-left p-3 text-gray-300">Priority</th>
				</tr>
			</thead>
			<tbody>
				{#each tasks as task (task.id)}
					<tr class="border-b border-gray-800 hover:bg-gray-800/50">
						<td class="p-3">
							<input
								type="checkbox"
								checked={selectedIds.has(task.id)}
								onchange={() => toggleTask(task.id)}
								class="rounded bg-gray-900 border-gray-700"
							/>
						</td>
						<td class="p-3 text-gray-400">{task.id}</td>
						<td class="p-3 text-gray-200">{task.title}</td>
						<td class="p-3">
							<span
								class="px-2 py-1 rounded text-xs {task.status === 'done'
									? 'bg-green-900/30 text-green-400'
									: task.status === 'in_progress'
										? 'bg-blue-900/30 text-blue-400'
										: 'bg-gray-700 text-gray-300'}"
							>
								{task.status}
							</span>
						</td>
						<td class="p-3">
							<span
								class="px-2 py-1 rounded text-xs {task.priority === 'urgent'
									? 'bg-red-900/30 text-red-400'
									: task.priority === 'high'
										? 'bg-orange-900/30 text-orange-400'
										: task.priority === 'normal'
											? 'bg-yellow-900/30 text-yellow-400'
											: 'bg-gray-700 text-gray-300'}"
							>
								{task.priority || 'none'}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if tasks.length === 0}
			<div class="p-8 text-center text-gray-500">No tasks available</div>
		{/if}
	</div>
</div>
