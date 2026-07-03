import { getWorkItem } from './crud.js';
import { onWorkEvent } from './events.js';
import { RECONCILER_ACTOR, reconcileWorkItem } from './reconciliation.js';

const DEBOUNCE_MS = 2_000;

let started = false;
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
