import type { OpenClawPluginApi, GatewayRequestHandlerOptions } from 'openclaw/plugin-sdk';

type OpenClawPluginDefinition = {
	id?: string;
	name?: string;
	description?: string;
	version?: string;
	activate?: (api: OpenClawPluginApi) => void | Promise<void>;
};

// Track virtual nodes: connId → virtualNodeId
const virtualNodes = new Map<string, string>();

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

				context.nodeRegistry.register(syntheticClient as any, { remoteIp: undefined });
				virtualNodes.set(client.connId, virtualNodeId);

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

				const handled = context.nodeRegistry.handleInvokeResult({
					id: p.id as string,
					nodeId: virtualNodeId,
					ok: p.ok !== false,
					payload: p.payload,
					payloadJSON: null,
					error: (p.error as any) ?? null
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
				api.logger.info(`Unregistered virtual canvas node: ${virtualNodeId}`);
				respond(true, { wasRegistered: true, nodeId: virtualNodeId });
			}
		);

		api.logger.info('Canvas operator bridge plugin activated');
	}
};

export default plugin;
