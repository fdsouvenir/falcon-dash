import { getWorkItem, listWorkItems } from './crud.js';
import { getWorkDb } from './database.js';
import { onWorkEvent } from './events.js';
import { hasStaleRiskForProject, RECONCILER_ACTOR, reconcileWorkItem } from './reconciliation.js';

const DEBOUNCE_MS = 2_000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1_000;
const SWEEP_COOLDOWN_SECONDS = 30 * 60;
const SWEEP_MAX_PROJECTS = 10;
const COOLDOWN_STATUSES = ['needs_agent', 'agent_running', 'needs_review', 'failed'];

let started = false;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function startReconciliationScheduler(): void {
	if (started) return;
	started = true;

	onWorkEvent((event) => {
		if (event.actor === RECONCILER_ACTOR) return;
		if (!['item', 'evidence', 'relationship'].includes(event.entity ?? '')) return;
		const itemId = typeof event.id === 'number' ? event.id : Number(event.id);
		if (!Number.isFinite(itemId)) return;
		scheduleWorkReconciliation(itemId, event.entity ?? 'item', event.id ?? itemId);
	});

	if (!sweepTimer) {
		sweepTimer = setInterval(() => {
			runReconciliationSweep().catch((err) => {
				console.error('[work-reconciler] Sweep failed:', err);
			});
		}, SWEEP_INTERVAL_MS);
		sweepTimer.unref?.();
	}
}

export function scheduleWorkReconciliation(
	itemId: number,
	triggerEntity = 'item',
	triggerId: string | number = itemId
): void {
	const root = rootIdFor(itemId);
	if (!root) return;
	const existing = timers.get(root);
	if (existing) clearTimeout(existing);
	timers.set(
		root,
		setTimeout(() => {
			timers.delete(root);
			reconcileWorkItem(itemId, { triggerEntity, triggerId }).catch((err) => {
				console.error('[work-reconciler] Reconciliation failed:', err);
			});
		}, DEBOUNCE_MS)
	);
}

export async function runReconciliationSweep(
	options: { maxProjects?: number; cooldownSeconds?: number; now?: number } = {}
): Promise<{ checked: number; queued: number; skippedCooldown: number }> {
	const maxProjects = options.maxProjects ?? SWEEP_MAX_PROJECTS;
	const cooldownSeconds = options.cooldownSeconds ?? SWEEP_COOLDOWN_SECONDS;
	const nowSeconds = options.now ?? now();
	const projects = listWorkItems({ type: 'project', limit: 500 });
	let checked = 0;
	let queued = 0;
	let skippedCooldown = 0;

	for (const project of projects) {
		if (queued >= maxProjects) break;
		checked += 1;
		if (hasRecentRun(project.id, nowSeconds - cooldownSeconds)) {
			skippedCooldown += 1;
			continue;
		}
		if (!hasStaleRiskForProject(project.id)) continue;
		queued += 1;
		await reconcileWorkItem(project.id, {
			forceAgent: true,
			triggerEntity: 'sweep',
			triggerId: project.id
		});
	}

	return { checked, queued, skippedCooldown };
}

function rootIdFor(itemId: number): number | null {
	let item = getWorkItem(itemId);
	if (!item) return null;
	const seen = new Set<number>();
	while (item.parent_item_id && !seen.has(item.id)) {
		seen.add(item.id);
		const parent = getWorkItem(item.parent_item_id);
		if (!parent) break;
		item = parent;
	}
	return item.id;
}

function hasRecentRun(rootItemId: number, since: number): boolean {
	const db = getWorkDb();
	const placeholders = COOLDOWN_STATUSES.map(() => '?').join(',');
	const row = db
		.prepare(
			`SELECT id FROM work_reconciliation_runs
			 WHERE root_item_id = ?
			   AND status IN (${placeholders})
			   AND updated_at >= ?
			 ORDER BY updated_at DESC, id DESC
			 LIMIT 1`
		)
		.get(rootItemId, ...COOLDOWN_STATUSES, since);
	return Boolean(row);
}

function now(): number {
	return Math.floor(Date.now() / 1000);
}
