import type { RequestHandler } from './$types.js';
import { getGatewayClient } from '$lib/server/gateway-client.js';

export const GET: RequestHandler = async ({ request }) => {
	const client = getGatewayClient();
	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function send(event: string, data: unknown): void {
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					// Stream closed
				}
			}

			// Send initial snapshot if available
			if (client.snapshot) {
				send('snapshot', client.snapshot);
			}

			// Send current connection state
			send('gateway-status', { state: client.state });

			// Forward gateway events to SSE
			const unsubEvent = client.onEvent((event) => {
				send('gateway', {
					event: event.event,
					payload: event.payload,
					seq: event.seq,
					stateVersion: event.stateVersion
				});
			});

			// Forward state changes
			const unsubState = client.onStateChange((state) => {
				send('gateway-status', { state });
				// If we just reconnected, send the new snapshot
				if (state === 'ready' && client.snapshot) {
					send('snapshot', client.snapshot);
				}
			});

			// Heartbeat to keep connection alive
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keepalive\n\n'));
				} catch {
					clearInterval(heartbeat);
				}
			}, 15_000);

			cleanup = () => {
				unsubEvent();
				unsubState();
				clearInterval(heartbeat);
			};

			// If the request was already aborted, clean up immediately
			if (request.signal.aborted) {
				cleanup();
				controller.close();
			} else {
				request.signal.addEventListener('abort', () => {
					cleanup?.();
					try {
						controller.close();
					} catch {
						/* already closed */
					}
				});
			}
		},
		cancel() {
			cleanup?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
