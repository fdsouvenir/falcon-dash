<script lang="ts">
	import {
		domains,
		focuses,
		loadDomains,
		loadFocuses,
		reorderDomains,
		reorderFocuses,
		type Domain,
		type Focus
	} from '$lib/stores/pm-domains.js';
	import { projects, type Project } from '$lib/stores/pm-projects.js';

	interface Props {
		selectedDomain?: string | null;
		selectedFocus?: string | null;
		onselect?: (domain: string | null, focus: string | null) => void;
	}

	let { selectedDomain = null, selectedFocus = null, onselect }: Props = $props();

	let domainList = $state<Domain[]>([]);
	let focusList = $state<Focus[]>([]);
	let projectList = $state<Project[]>([]);
	let loading = $state(true);
	let dragOverId = $state<string | null>(null);
	let draggedId = $state<string | null>(null);
	let dragType = $state<'domain' | 'focus' | null>(null);
	let expandedDomains = $state<Set<string>>(new Set());

	$effect(() => {
		const u1 = domains.subscribe((v) => {
			domainList = v;
		});
		const u2 = focuses.subscribe((v) => {
			focusList = v;
		});
		const u3 = projects.subscribe((v) => {
			projectList = v;
		});
		return () => {
			u1();
			u2();
			u3();
		};
	});

	$effect(() => {
		load();
	});

	async function load() {
		loading = true;
		await Promise.all([loadDomains(), loadFocuses()]);
		loading = false;
	}

	function selectAll() {
		onselect?.(null, null);
	}

	function toggleDomain(domainId: string) {
		if (expandedDomains.has(domainId)) {
			expandedDomains.delete(domainId);
		} else {
			expandedDomains.add(domainId);
		}
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- intentional Set recreation to trigger reactivity
		expandedDomains = new Set(expandedDomains);
	}

	function selectDomain(domainId: string) {
		if (selectedDomain === domainId && !selectedFocus) {
			onselect?.(null, null);
		} else {
			onselect?.(domainId, null);
			if (!expandedDomains.has(domainId)) {
				expandedDomains.add(domainId);
				expandedDomains = new Set(expandedDomains);
			}
		}
	}

	function selectFocus(domainId: string, focusId: string) {
		onselect?.(domainId, focusId);
		if (!expandedDomains.has(domainId)) {
			expandedDomains.add(domainId);
			expandedDomains = new Set(expandedDomains);
		}
	}

	function getFocusesForDomain(domainId: string): Focus[] {
		return focusList
			.filter((f) => f.domain_id === domainId)
			.sort((a, b) => a.sort_order - b.sort_order);
	}

	function getProjectCountForDomain(domainId: string): number {
		const domainFocuses = focusList.filter((f) => f.domain_id === domainId).map((f) => f.id);
		return projectList.filter((p) => domainFocuses.includes(p.focus_id)).length;
	}

	function getProjectCountForFocus(focusId: string): number {
		return projectList.filter((p) => p.focus_id === focusId).length;
	}

	// Drag and drop handlers for reordering
	function handleDragStart(e: DragEvent, id: string, type: 'domain' | 'focus') {
		if (!e.dataTransfer) return;
		draggedId = id;
		dragType = type;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', id);
	}

	function handleDragOver(e: DragEvent, id: string) {
		if (!draggedId || !dragType) return;
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverId = id;
	}

	function handleDragLeave() {
		dragOverId = null;
	}

	async function handleDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		if (!draggedId || !dragType || draggedId === targetId) {
			dragOverId = null;
			draggedId = null;
			dragType = null;
			return;
		}

		if (dragType === 'domain') {
			const currentOrder = [...domainList].sort((a, b) => a.sort_order - b.sort_order);
			const draggedIndex = currentOrder.findIndex((d) => d.id === draggedId);
			const targetIndex = currentOrder.findIndex((d) => d.id === targetId);
			if (draggedIndex === -1 || targetIndex === -1) return;

			const reordered = [...currentOrder];
			const [removed] = reordered.splice(draggedIndex, 1);
			reordered.splice(targetIndex, 0, removed);

			await reorderDomains(reordered.map((d) => d.id));
		} else if (dragType === 'focus') {
			const draggedFocus = focusList.find((f) => f.id === draggedId);
			const targetFocus = focusList.find((f) => f.id === targetId);
			if (!draggedFocus || !targetFocus || draggedFocus.domain_id !== targetFocus.domain_id) {
				dragOverId = null;
				draggedId = null;
				dragType = null;
				return;
			}

			const domainFocuses = focusList
				.filter((f) => f.domain_id === draggedFocus.domain_id)
				.sort((a, b) => a.sort_order - b.sort_order);
			const draggedIndex = domainFocuses.findIndex((f) => f.id === draggedId);
			const targetIndex = domainFocuses.findIndex((f) => f.id === targetId);

			const reordered = [...domainFocuses];
			const [removed] = reordered.splice(draggedIndex, 1);
			reordered.splice(targetIndex, 0, removed);

			await reorderFocuses(reordered.map((f) => f.id));
		}

		dragOverId = null;
		draggedId = null;
		dragType = null;
	}

	function handleDragEnd() {
		dragOverId = null;
		draggedId = null;
		dragType = null;
	}
</script>

<aside class="w-56 border-r border-gray-800 bg-gray-900 overflow-y-auto flex flex-col">
	{#if loading}
		<div class="p-4 space-y-2">
			<div class="h-8 bg-gray-800 rounded animate-pulse"></div>
			<div class="h-6 bg-gray-800 rounded animate-pulse"></div>
			<div class="h-6 bg-gray-800 rounded animate-pulse ml-4"></div>
			<div class="h-6 bg-gray-800 rounded animate-pulse ml-4"></div>
			<div class="h-6 bg-gray-800 rounded animate-pulse"></div>
		</div>
	{:else}
		<button
			onclick={selectAll}
			class="px-3 py-2 text-sm text-white hover:bg-gray-800 cursor-pointer flex items-center justify-between border-b border-gray-800"
			class:bg-gray-800={!selectedDomain && !selectedFocus}
		>
			<span class="font-medium">All Projects</span>
			<span class="text-[10px] text-gray-500 bg-gray-800 rounded px-1.5">{projectList.length}</span>
		</button>

		<div class="flex-1 overflow-y-auto py-2">
			{#each domainList.sort((a, b) => a.sort_order - b.sort_order) as domain (domain.id)}
				{@const isExpanded = expandedDomains.has(domain.id)}
				{@const isSelected = selectedDomain === domain.id && !selectedFocus}
				{@const domainFocuses = getFocusesForDomain(domain.id)}
				{@const projectCount = getProjectCountForDomain(domain.id)}

				<div
					class="border-t-2 transition-colors"
					class:border-blue-500={dragOverId === domain.id && dragType === 'domain'}
					class:border-transparent={dragOverId !== domain.id || dragType !== 'domain'}
				>
					<div
						draggable="true"
						ondragstart={(e) => handleDragStart(e, domain.id, 'domain')}
						ondragover={(e) => handleDragOver(e, domain.id)}
						ondragleave={handleDragLeave}
						ondrop={(e) => handleDrop(e, domain.id)}
						ondragend={handleDragEnd}
						class="px-3 py-2 text-sm text-white hover:bg-gray-800 cursor-pointer flex items-center justify-between"
						class:bg-gray-800={isSelected}
					>
						<div
							class="flex items-center gap-2 flex-1 min-w-0"
							onclick={() => toggleDomain(domain.id)}
						>
							<span class="text-gray-500 text-xs">{isExpanded ? '▼' : '▶'}</span>
							<span class="truncate">{domain.name}</span>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<span class="text-[10px] text-gray-500 bg-gray-800 rounded px-1.5"
								>{projectCount}</span
							>
							<button
								onclick={(e) => {
									e.stopPropagation();
									selectDomain(domain.id);
								}}
								class="text-xs text-gray-600 hover:text-gray-400"
								title="Filter by domain"
							>
								⊙
							</button>
						</div>
					</div>

					{#if isExpanded}
						{#each domainFocuses as focus (focus.id)}
							{@const isFocusSelected = selectedDomain === domain.id && selectedFocus === focus.id}
							{@const focusProjectCount = getProjectCountForFocus(focus.id)}

							<div
								class="border-t-2 transition-colors"
								class:border-blue-500={dragOverId === focus.id && dragType === 'focus'}
								class:border-transparent={dragOverId !== focus.id || dragType !== 'focus'}
							>
								<button
									draggable="true"
									ondragstart={(e) => handleDragStart(e, focus.id, 'focus')}
									ondragover={(e) => handleDragOver(e, focus.id)}
									ondragleave={handleDragLeave}
									ondrop={(e) => handleDrop(e, focus.id)}
									ondragend={handleDragEnd}
									onclick={() => selectFocus(domain.id, focus.id)}
									class="w-full pl-6 pr-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 cursor-pointer flex items-center justify-between"
									class:bg-gray-800={isFocusSelected}
									class:text-white={isFocusSelected}
								>
									<span class="truncate">{focus.name}</span>
									<span class="text-[10px] text-gray-500 bg-gray-800 rounded px-1.5 shrink-0">
										{focusProjectCount}
									</span>
								</button>
							</div>
						{/each}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</aside>
