import type { RequestHandler } from './$types.js';
import { onWork3Event, startWork3 } from '$lib/server/work3/index.js';

/**
 * Browser live updates for the v3 Work module: streams post-commit domain
 * events from the in-process bus (doc 06). Durable history is served from the
 * Event Log, not this stream.
 */
export const GET: RequestHandler = async ({ request }) => {
	startWork3();
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

			send('work3-status', { connected: true });

			const unsubscribe = onWork3Event((event) => {
				send('work3', event);
			});

			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keepalive\n\n'));
				} catch {
					clearInterval(heartbeat);
				}
			}, 15_000);

			cleanup = () => {
				unsubscribe();
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
