import { eventBus, call } from '$lib/stores/gateway.js';

export interface CanvasMessage {
	surfaceId: string;
	type: 'a2ui' | 'html';
	payload: unknown;
}

// Subscribe to canvas delivery events
export function subscribeToCanvasDelivery(onMessage: (msg: CanvasMessage) => void): () => void {
	return eventBus.on('canvas.message', (data: Record<string, unknown>) => {
		onMessage({
			surfaceId: data.surfaceId as string,
			type: (data.type as 'a2ui' | 'html') ?? 'a2ui',
			payload: data.payload
		});
	});
}

// Send action back to agent
export async function sendCanvasAction(
	surfaceId: string,
	actionId: string,
	payload: Record<string, unknown>
): Promise<void> {
	await call('canvas.action', { surfaceId, actionId, payload });
}

// Track active surfaces
const activeSurfaces = new Map<string, CanvasMessage[]>();

export function getSurfaceMessages(surfaceId: string): CanvasMessage[] {
	return activeSurfaces.get(surfaceId) ?? [];
}

export function pushSurfaceMessage(msg: CanvasMessage): void {
	const existing = activeSurfaces.get(msg.surfaceId) ?? [];
	existing.push(msg);
	activeSurfaces.set(msg.surfaceId, existing);
}

export function clearSurface(surfaceId: string): void {
	activeSurfaces.delete(surfaceId);
}
