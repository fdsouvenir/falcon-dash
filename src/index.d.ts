/**
 * Type stub for the SvelteKit adapter-node build output (build/index.js).
 *
 * src/entry.js is the production WebSocket entry point that wraps the adapter-node
 * server. It is copied into the build directory alongside this generated index.js.
 * This declaration lets `tsc` type-check entry.js without requiring the build to
 * exist first.
 */
import type { Server as HttpServer } from 'http';

export declare const server: {
	/** The underlying Node.js HTTP server created by adapter-node. */
	server: HttpServer;
};
