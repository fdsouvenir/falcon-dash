import type { RequestHandler } from './$types.js';
import { onPMEvent, getRecentEvents, getStateVersion } from '$lib/server/pm/events.js';

export const GET: RequestHandler = async ({ request, url }) => {
	const sinceParam = url.searchParams.get('since');
	const since = sinceParam !== null ? parseInt(sinceParam, 10) : undefined;

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

			// Replay missed events if ?since= was provided
			const missed = getRecentEvents(since);
			for (const evt of missed) {
				send('pm-event', evt);
			}

			// Send current state version so client can track
			send('state-version', { stateVersion: getStateVersion() });

			// Subscribe to future events
			const unsub = onPMEvent((event) => {
				send('pm-event', event);
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
				unsub();
				clearInterval(heartbeat);
			};

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
