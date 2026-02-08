import { writable } from 'svelte/store';
import { gateway } from '$lib/gateway';
import type { ModelInfo, ModelsListResponse } from '$lib/gateway/types';

/** Available models from the gateway */
export const models = writable<ModelInfo[]>([]);

/** Whether models have been loaded */
let loaded = false;

/** Fetch models from gateway and populate the store */
export async function loadModels(): Promise<void> {
	if (loaded) return;
	try {
		const res = await gateway.call<ModelsListResponse>('models.list');
		models.set(res.models);
		loaded = true;
	} catch {
		// models.list may not be available — leave empty
		models.set([]);
	}
}

/** Invalidate cache so next loadModels() re-fetches */
export function invalidateModels(): void {
	loaded = false;
}
