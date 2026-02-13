import type { OpenClawPluginApi, GatewayRequestHandlerOptions } from 'openclaw/plugin-sdk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type OpenClawPluginDefinition = {
	id?: string;
	name?: string;
	description?: string;
	version?: string;
	activate?: (api: OpenClawPluginApi) => void | Promise<void>;
};

// Track virtual nodes: connId → virtualNodeId
const virtualNodes = new Map<string, string>();

// --- Device pairing store helpers ---
function getPairedPath(): string {
	const stateDir =
		process.env.OPENCLAW_STATE_DIR || path.join(process.env.HOME || '~', '.openclaw');
	return path.join(stateDir, 'devices', 'paired.json');
}

async function readPairedStore(): Promise<Record<string, unknown>> {
	try {
		const raw = await fs.readFile(getPairedPath(), 'utf-8');
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return {};
	}
}

async function writePairedStore(store: Record<string, unknown>): Promise<void> {
	const filePath = getPairedPath();
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

const plugin: OpenClawPluginDefinition = {
	id: 'openclaw-canvas-bridge',
	name: 'Canvas Operator Bridge',
	description: 'Routes canvas commands to operator connections with canvas capabilities',
	version: '0.1.0',

	activate(api) {
		// --- Method 1: Register operator as virtual canvas node ---
		api.registerGatewayMethod(
			'canvas.bridge.register',
			async ({ client, respond, context }: GatewayRequestHandlerOptions) => {
				if (!client?.connId) {
					respond(false, undefined, {
						code: 'NO_CLIENT',
						message: 'No client connection'
					});
					return;
				}

				const caps = client.connect?.caps;
				if (!Array.isArray(caps) || !caps.includes('canvas')) {
					respond(false, undefined, {
						code: 'NO_CANVAS_CAP',
						message: 'Client has no canvas capability'
					});
					return;
				}

				// Already registered?
				if (virtualNodes.has(client.connId)) {
					const existingNodeId = virtualNodes.get(client.connId)!;
					respond(true, { nodeId: existingNodeId, alreadyRegistered: true });
					return;
				}

				const instanceId = client.connect?.client?.instanceId || client.connId;
				const virtualNodeId = `virtual-canvas-${instanceId}`;

				// Clean stale mapping if this virtualNodeId exists under a different connId
				for (const [existingConnId, existingNodeId] of virtualNodes.entries()) {
					if (existingNodeId === virtualNodeId && existingConnId !== client.connId) {
						context.nodeRegistry.unregister(existingConnId);
						virtualNodes.delete(existingConnId);
						api.logger.info(
							`Cleaned stale virtual node mapping: ${existingConnId} -> ${existingNodeId}`
						);
					}
				}

				// Broad sweep: remove ALL other virtual nodes — only one canvas dashboard
				// should be active at a time. This cleans up stale nodes with random UUIDs
				// from before the stable-ID fix was applied.
				for (const [existingConnId, existingNodeId] of virtualNodes.entries()) {
					if (existingConnId !== client.connId) {
						context.nodeRegistry.unregister(existingConnId);
						virtualNodes.delete(existingConnId);
						api.logger.info(`Swept stale virtual node: ${existingConnId} -> ${existingNodeId}`);
					}
				}

				// Create synthetic client that looks like a node to the registry
				const syntheticClient = {
					...client,
					connect: {
						...client.connect,
						role: 'node',
						device: { id: virtualNodeId },
						client: {
							...client.connect?.client,
							id: virtualNodeId
						},
						caps: caps.filter((c: string) => c.startsWith('canvas')),
						commands: client.connect?.commands ?? []
					}
				};

				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- synthetic client matches runtime shape
				context.nodeRegistry.register(syntheticClient as any, { remoteIp: undefined });
				virtualNodes.set(client.connId, virtualNodeId);

				// Auto-pair the virtual node so agent discovers it via node.list
				try {
					const store = await readPairedStore();

					// Sweep stale virtual-canvas-* entries from paired store
					const activeNodeIds = new Set(virtualNodes.values());
					for (const key of Object.keys(store)) {
						if (
							key.startsWith('virtual-canvas-') &&
							key !== virtualNodeId &&
							!activeNodeIds.has(key)
						) {
							delete store[key];
							api.logger.info(`Cleaned stale paired entry: ${key}`);
						}
					}

					store[virtualNodeId] = {
						deviceId: virtualNodeId,
						platform: 'virtual',
						clientId: virtualNodeId,
						clientMode: 'node',
						role: 'node',
						roles: ['node'],
						displayName: 'Canvas Bridge',
						caps: caps.filter((c: string) => c.startsWith('canvas')),
						commands: client.connect?.commands ?? [],
						createdAtMs: Date.now(),
						approvedAtMs: Date.now()
					};
					await writePairedStore(store);
					api.logger.info(`Auto-paired virtual canvas node: ${virtualNodeId}`);
				} catch (err) {
					api.logger.warn(`Failed to auto-pair virtual node: ${err}`);
				}

				api.logger.info(
					`Registered virtual canvas node: ${virtualNodeId} for operator ${client.connId}`
				);
				respond(true, { nodeId: virtualNodeId });
			}
		);

		// --- Method 2: Proxy invoke results (bypasses NODE_ROLE_METHODS) ---
		api.registerGatewayMethod(
			'canvas.bridge.invokeResult',
			async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
				if (!client?.connId) {
					respond(false, undefined, {
						code: 'NO_CLIENT',
						message: 'No client connection'
					});
					return;
				}

				const virtualNodeId = virtualNodes.get(client.connId);
				if (!virtualNodeId) {
					respond(false, undefined, {
						code: 'NOT_REGISTERED',
						message: 'No virtual node for this connection'
					});
					return;
				}

				const p = params as {
					id?: string;
					ok?: boolean;
					payload?: unknown;
					error?: unknown;
				};
				if (!p.id) {
					respond(false, undefined, {
						code: 'MISSING_ID',
						message: 'Missing invoke request id'
					});
					return;
				}

				// Normalize error — dashboard may send string or object { code, message }
				const errorValue = p.error;
				const errorObj: { code?: string; message?: string } | null =
					typeof errorValue === 'string'
						? { code: 'CANVAS_ERROR', message: errorValue }
						: errorValue && typeof errorValue === 'object'
							? (errorValue as { code?: string; message?: string })
							: null;

				const handled = context.nodeRegistry.handleInvokeResult({
					id: p.id as string,
					nodeId: virtualNodeId,
					ok: p.ok !== false,
					payload: p.payload,
					payloadJSON: null,
					error: errorObj
				});

				if (handled) {
					respond(true, { handled: true });
				} else {
					// Late result or unknown invoke — not an error, just stale
					respond(true, { handled: false, reason: 'no pending invoke' });
				}
			}
		);

		// --- Method 3: Unregister (explicit cleanup) ---
		api.registerGatewayMethod(
			'canvas.bridge.unregister',
			async ({ client, respond, context }: GatewayRequestHandlerOptions) => {
				if (!client?.connId) {
					respond(false, undefined, {
						code: 'NO_CLIENT',
						message: 'No client connection'
					});
					return;
				}

				const virtualNodeId = virtualNodes.get(client.connId);
				if (!virtualNodeId) {
					respond(true, { wasRegistered: false });
					return;
				}

				context.nodeRegistry.unregister(client.connId);
				virtualNodes.delete(client.connId);

				// Remove from pairing store
				try {
					const store = await readPairedStore();
					if (store[virtualNodeId]) {
						delete store[virtualNodeId];
						await writePairedStore(store);
						api.logger.info(`Removed virtual node from pairing store: ${virtualNodeId}`);
					}
				} catch (err) {
					api.logger.warn(`Failed to remove virtual node from pairing store: ${err}`);
				}

				api.logger.info(`Unregistered virtual canvas node: ${virtualNodeId}`);
				respond(true, { wasRegistered: true, nodeId: virtualNodeId });
			}
		);

		api.logger.info('Canvas operator bridge plugin activated');
	}
};

export default plugin;
