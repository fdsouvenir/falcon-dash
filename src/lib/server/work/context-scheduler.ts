import { onWorkEvent } from './events.js';
import { generateAndWriteContext } from './context-writer.js';

let dirty = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const DEBOUNCE_MS = 5_000;
const MAX_STALENESS_MS = 60_000;

function runGeneration(): void {
	if (!dirty) return;
	dirty = false;
	try {
		const result = generateAndWriteContext();
		console.log(`[work-context] Generated ${result.filesWritten} files`);
	} catch (err) {
		console.error('[work-context] Generation failed:', err);
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

	onWorkEvent(() => {
		dirty = true;
		scheduleGeneration();
	});

	setInterval(() => {
		if (dirty) runGeneration();
	}, MAX_STALENESS_MS);

	dirty = true;
	setTimeout(runGeneration, 1000);
}

export function triggerContextGeneration(): {
	filesWritten: number;
	timestamp: number;
	contextDir: string;
} {
	dirty = false;
	if (debounceTimer) clearTimeout(debounceTimer);
	return generateAndWriteContext();
}
