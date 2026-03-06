import type { RequestHandler } from './$types.js';
import fs from 'node:fs';
import { sessionPath, readNewLines } from '$lib/server/ops/parser.js';

export const GET: RequestHandler = async ({ params, request }) => {
	const { sessionId } = params;
	const filepath = sessionPath(sessionId);

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

			// Track current read position (byte offset)
			let byteOffset = 0;
			try {
				if (fs.existsSync(filepath)) {
					byteOffset = fs.statSync(filepath).size;
				}
			} catch {
				// File doesn't exist yet — start at 0 when it does
			}

			// Heartbeat to keep the SSE connection alive
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keepalive\n\n'));
				} catch {
					clearInterval(heartbeat);
				}
			}, 15_000);

			// Watch for file changes
			let watcher: fs.FSWatcher | null = null;

			function startWatcher(): void {
				try {
					watcher = fs.watch(filepath, () => {
						try {
							const { entries, newOffset } = readNewLines(sessionId, byteOffset);
							byteOffset = newOffset;
							for (const entry of entries) {
								send('entry', entry);
							}
						} catch {
							// Ignore read errors during watch
						}
					});

					watcher.on('error', () => {
						// File may have been rotated — try to re-attach
						watcher?.close();
						watcher = null;
						setTimeout(startWatcher, 1000);
					});
				} catch {
					// File may not exist yet — retry shortly
					setTimeout(startWatcher, 2000);
				}
			}

			startWatcher();

			cleanup = () => {
				clearInterval(heartbeat);
				watcher?.close();
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
