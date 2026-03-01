import { rpc, gatewayEvents } from '$lib/gateway-api.js';

export interface CanvasMessage {
	surfaceId: string;
	type: 'a2ui' | 'html';
	payload: unknown;
}

// Subscribe to canvas delivery events
export function subscribeToCanvasDelivery(onMessage: (msg: CanvasMessage) => void): () => void {
	return gatewayEvents.on('canvas.message', (data: Record<string, unknown>) => {
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
	await rpc('canvas.action', { surfaceId, actionId, payload });
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

// Check if an invoke request is a canvas command
export function isCanvasCommand(command: string): boolean {
	return command.startsWith('canvas.');
}
