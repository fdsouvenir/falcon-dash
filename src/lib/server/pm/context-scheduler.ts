import { onPMEvent } from './events.js';
import { generateAndWriteContext } from './context-generator.js';

let dirty = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

const DEBOUNCE_MS = 5_000;
const MAX_STALENESS_MS = 60_000;

function runGeneration(): void {
	if (!dirty) return;
	dirty = false;
	try {
		const result = generateAndWriteContext();
		console.log(`[pm-context] Generated ${result.filesWritten} files`);
	} catch (err) {
		console.error('[pm-context] Generation failed:', err);
		// Mark dirty again so next interval retries
		dirty = true;
	}
}

function scheduleGeneration(): void {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(runGeneration, DEBOUNCE_MS);
}

export function startContextScheduler(): void {
	if (started) return;
	started = true;

	// Subscribe to PM events
	onPMEvent(() => {
		dirty = true;
		scheduleGeneration();
	});

	// Max staleness interval
	intervalTimer = setInterval(() => {
		if (dirty) runGeneration();
	}, MAX_STALENESS_MS);

	// Initial generation
	dirty = true;
	// Delay initial generation slightly to let DB initialize
	setTimeout(runGeneration, 1000);
}

export function triggerContextGeneration(): { filesWritten: number; timestamp: number } {
	dirty = false;
	if (debounceTimer) clearTimeout(debounceTimer);
	return generateAndWriteContext();
}
