<script lang="ts">
	import type { Task } from '$lib/stores/pm-projects.js';

	interface Block {
		blocker_id: number;
		blocked_id: number;
	}

	interface NodePosition {
		id: number;
		task: Task;
		x: number;
		y: number;
		color: 'blocked' | 'blocking' | 'clear';
	}

	interface Edge {
		from: NodePosition;
		to: NodePosition;
	}

	interface Props {
		tasks: Task[];
		blocks: Block[];
		onTaskClick?: (taskId: number) => void;
	}

	const { tasks, blocks, onTaskClick }: Props = $props();

	const NODE_WIDTH = 160;
	const NODE_HEIGHT = 60;
	const COLUMN_SPACING = 220;
	const ROW_SPACING = 100;
	const MARGIN = 40;

	const layout = $derived.by(() => {
		if (tasks.length === 0) return { nodes: [], edges: [], width: 400, height: 200 };

		// Build adjacency maps
		const blockedBy = new Map<number, number[]>();
		const blocking = new Map<number, number[]>();

		for (const b of blocks) {
			if (!blockedBy.has(b.blocked_id)) blockedBy.set(b.blocked_id, []);
			blockedBy.get(b.blocked_id)!.push(b.blocker_id);
			if (!blocking.has(b.blocker_id)) blocking.set(b.blocker_id, []);
			blocking.get(b.blocker_id)!.push(b.blocked_id);
		}

		// Compute depth (column) based on longest path from roots
		const depth = new Map<number, number>();
		function getDepth(id: number, visited = new Set<number>()): number {
			if (depth.has(id)) return depth.get(id)!;
			if (visited.has(id)) return 0; // cycle protection
			visited.add(id);
			const blockers = blockedBy.get(id) ?? [];
			const d =
				blockers.length === 0 ? 0 : Math.max(...blockers.map((b) => getDepth(b, visited))) + 1;
			depth.set(id, d);
			return d;
		}

		for (const t of tasks) getDepth(t.id);

		// Group by depth
		const columns = new Map<number, Task[]>();
		let maxDepth = 0;
		for (const t of tasks) {
			const d = depth.get(t.id) ?? 0;
			if (!columns.has(d)) columns.set(d, []);
			columns.get(d)!.push(t);
			if (d > maxDepth) maxDepth = d;
		}

		// Assign positions
		const nodes: NodePosition[] = [];
		const taskToNode = new Map<number, NodePosition>();

		for (let col = 0; col <= maxDepth; col++) {
			const colTasks = columns.get(col) ?? [];
			colTasks.forEach((task, idx) => {
				const isBlocked = blockedBy.has(task.id) && blockedBy.get(task.id)!.length > 0;
				const isBlocking = blocking.has(task.id) && blocking.get(task.id)!.length > 0;
				const color = isBlocked ? 'blocked' : isBlocking ? 'blocking' : 'clear';

				const node: NodePosition = {
					id: task.id,
					task,
					x: MARGIN + col * COLUMN_SPACING,
					y: MARGIN + idx * ROW_SPACING,
					color
				};
				nodes.push(node);
				taskToNode.set(task.id, node);
			});
		}

		// Build edges
		const edges: Edge[] = [];
		for (const b of blocks) {
			const from = taskToNode.get(b.blocker_id);
			const to = taskToNode.get(b.blocked_id);
			if (from && to) {
				edges.push({ from, to });
			}
		}

		// Calculate SVG dimensions
		const width = MARGIN * 2 + maxDepth * COLUMN_SPACING + NODE_WIDTH;
		const maxRow = Math.max(...nodes.map((n) => n.y));
		const height = Math.max(maxRow + NODE_HEIGHT + MARGIN, 200);

		return { nodes, edges, width, height };
	});

	function getStatusColor(status: string): string {
		const normalized = status.toLowerCase();
		if (normalized === 'done' || normalized === 'complete') return '#22c55e';
		if (normalized === 'in progress' || normalized === 'in_progress') return '#3b82f6';
		return '#64748b';
	}

	function getPriorityLabel(priority: string | null): string {
		if (!priority) return '';
		const normalized = priority.toLowerCase();
		if (normalized.includes('high') || normalized.includes('urgent')) return 'P1';
		if (normalized.includes('medium')) return 'P2';
		if (normalized.includes('low')) return 'P3';
		return priority.substring(0, 2).toUpperCase();
	}

	function handleNodeClick(taskId: number) {
		if (onTaskClick) {
			onTaskClick(taskId);
		}
	}

	function handleNodeKeydown(event: KeyboardEvent, taskId: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleNodeClick(taskId);
		}
	}

	function getColorStyles(color: 'blocked' | 'blocking' | 'clear'): {
		fill: string;
		stroke: string;
	} {
		switch (color) {
			case 'blocked':
				return { fill: '#fee2e2', stroke: '#ef4444' };
			case 'blocking':
				return { fill: '#fed7aa', stroke: '#f97316' };
			case 'clear':
				return { fill: '#dcfce7', stroke: '#22c55e' };
		}
	}

	function buildEdgePath(from: NodePosition, to: NodePosition): string {
		const x1 = from.x + NODE_WIDTH;
		const y1 = from.y + NODE_HEIGHT / 2;
		const x2 = to.x;
		const y2 = to.y + NODE_HEIGHT / 2;

		const cx = (x1 + x2) / 2;
		return `M ${x1} ${y1} Q ${cx} ${y1}, ${cx} ${(y1 + y2) / 2} T ${x2} ${y2}`;
	}
</script>

<div class="dependency-graph">
	{#if tasks.length === 0}
		<div class="empty-state">
			<p class="text-gray-500 dark:text-gray-400">No tasks in this project</p>
		</div>
	{:else if blocks.length === 0}
		<div class="empty-state">
			<p class="text-gray-500 dark:text-gray-400">No blocking relationships</p>
		</div>
	{:else}
		<div class="graph-container">
			<svg width={layout.width} height={layout.height} class="graph-svg">
				<!-- Edges (arrows) -->
				<defs>
					<marker
						id="arrowhead"
						markerWidth="10"
						markerHeight="10"
						refX="9"
						refY="3"
						orient="auto"
						markerUnits="strokeWidth"
					>
						<path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
					</marker>
				</defs>

				{#each layout.edges as edge}
					<path
						d={buildEdgePath(edge.from, edge.to)}
						fill="none"
						stroke="#64748b"
						stroke-width="2"
						marker-end="url(#arrowhead)"
					/>
				{/each}

				<!-- Nodes -->
				{#each layout.nodes as node}
					{@const styles = getColorStyles(node.color)}
					<g
						class="node"
						tabindex="0"
						role="button"
						aria-label={`Task ${node.task.title}`}
						onclick={() => handleNodeClick(node.id)}
						onkeydown={(e) => handleNodeKeydown(e, node.id)}
					>
						<rect
							x={node.x}
							y={node.y}
							width={NODE_WIDTH}
							height={NODE_HEIGHT}
							rx="8"
							fill={styles.fill}
							stroke={styles.stroke}
							stroke-width="2"
							class="node-rect"
						/>
						<foreignObject x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT}>
							<div class="node-content">
								<div class="node-header">
									<span class="task-number">#{node.task.id}</span>
									{#if node.task.priority}
										<span class="priority-badge">{getPriorityLabel(node.task.priority)}</span>
									{/if}
								</div>
								<div class="task-title">{node.task.title}</div>
								<div class="node-footer">
									<div
										class="status-dot"
										style="background-color: {getStatusColor(node.task.status)}"
									></div>
									<span class="status-text">{node.task.status}</span>
								</div>
							</div>
						</foreignObject>
					</g>
				{/each}
			</svg>
		</div>

		<!-- Legend -->
		<div class="legend">
			<div class="legend-item">
				<div class="legend-box blocked"></div>
				<span>Blocked</span>
			</div>
			<div class="legend-item">
				<div class="legend-box blocking"></div>
				<span>Blocking</span>
			</div>
			<div class="legend-item">
				<div class="legend-box clear"></div>
				<span>Clear</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.dependency-graph {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		text-align: center;
	}

	.graph-container {
		flex: 1;
		overflow: auto;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		background: #ffffff;
	}

	:global(.dark) .graph-container {
		border-color: #374151;
		background: #1f2937;
	}

	.graph-svg {
		display: block;
	}

	.node {
		cursor: pointer;
		outline: none;
	}

	.node:hover .node-rect {
		filter: brightness(0.95);
	}

	.node:focus .node-rect {
		stroke-width: 3;
	}

	.node-content {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		height: 100%;
		font-size: 0.75rem;
		pointer-events: none;
	}

	.node-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.task-number {
		font-weight: 600;
		color: #374151;
	}

	:global(.dark) .task-number {
		color: #f9fafb;
	}

	.priority-badge {
		background: #3b82f6;
		color: white;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.625rem;
		font-weight: 700;
	}

	.task-title {
		flex: 1;
		font-weight: 500;
		color: #111827;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		line-height: 1.2;
	}

	:global(.dark) .task-title {
		color: #f3f4f6;
	}

	.node-footer {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.status-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
	}

	.status-text {
		font-size: 0.625rem;
		color: #6b7280;
	}

	:global(.dark) .status-text {
		color: #9ca3af;
	}

	.legend {
		display: flex;
		gap: 1.5rem;
		padding: 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		background: #f9fafb;
		font-size: 0.875rem;
	}

	:global(.dark) .legend {
		border-color: #374151;
		background: #1f2937;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-box {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.25rem;
		border: 2px solid;
	}

	.legend-box.blocked {
		background: #fee2e2;
		border-color: #ef4444;
	}

	.legend-box.blocking {
		background: #fed7aa;
		border-color: #f97316;
	}

	.legend-box.clear {
		background: #dcfce7;
		border-color: #22c55e;
	}
</style>
