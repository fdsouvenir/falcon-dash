import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import path from 'node:path';
import { WorkStore, DomainError, exact, requireValue } from './work/store.mjs';
import { Documents } from './documents/service.mjs';
import { Vault } from './vault/service.mjs';
import { Integrations } from './integrations/service.mjs';
import { adapters } from './integrations/adapters.mjs';
import { tools, buildContract } from './contract.mjs';
import { render } from './ui.mjs';

export default definePluginEntry({
	id: 'falcon-dash',
	name: 'Falcon Dash',
	description: 'Work, Integrations, KeePassXC Vault and Documents implementation preview',
	register(api) {
		const config =
			/** @type {{dataDir?: string, modules?: Record<string, boolean>, vaultOwners?: string[], vaultExecutors?: string[], documentRoots?: Array<{id:string,path:string,actors:string[],writable?:boolean}>}} */ (
				api.pluginConfig ?? {}
			);
		const enabled = ['work', 'integrations', 'vault', 'documents'].filter(
			(m) => config.modules?.[m] !== false
		);
		let work,
			documents,
			vault,
			integrations,
			started = false;
		const ready = () => requireValue(started, 'unavailable', 'Falcon Dash service is not running');
		async function invoke(name, p, actor) {
			ready();
			exact(p, Object.keys(tools[name].parameters.properties));
			if (name === 'falcon_work') {
				if (p.action === 'list') {
					if (p.query) exact(p.query, ['type', 'limit', 'offset', 'agent_id', 'search']);
					return work.list(p.query);
				}
				if (p.action === 'get') return work.detail(p.id, p.full === true);
				if (p.action === 'command') {
					requireValue(actor, 'identity_required', 'A verified actor is required');
					return work.execute(p.request, actor);
				}
			}
			if (name === 'falcon_integrations') {
				requireValue(actor, 'identity_required', 'A verified actor is required');
				return p.action === 'list'
					? { connections: integrations.list(actor) }
					: integrations.run(p.id, p.action, actor);
			}
			if (name === 'falcon_vault') {
				if (p.action === 'status') return { locked: vault.locked, protected_ui: 'unavailable' };
				requireValue(p.action === 'inventory', 'invalid_command', 'Unsupported Vault operation');
				return vault.inventory(actor);
			}
			if (name === 'falcon_documents') {
				requireValue(
					['list', 'read', 'write', 'mkdir'].includes(p.action),
					'invalid_command',
					'Unsupported Documents operation'
				);
				return documents[p.action](p, actor);
			}
			throw new DomainError('invalid_command', 'Unsupported operation');
		}
		api.registerService({
			id: 'falcon-dash',
			start(ctx) {
				const directory = config.dataDir ?? path.join(ctx.stateDir, 'falcon-dash');
				if (enabled.includes('work')) work = new WorkStore(path.join(directory, 'work.db'));
				if (enabled.includes('vault') || enabled.includes('integrations'))
					vault = new Vault(path.join(directory, 'vault'), {
						owners: config.vaultOwners ?? [],
						executors: config.vaultExecutors ?? []
					});
				if (enabled.includes('documents')) documents = new Documents(config.documentRoots ?? []);
				if (enabled.includes('integrations'))
					integrations = new Integrations(
						path.join(directory, 'integrations.db'),
						vault,
						adapters()
					);
				started = true;
			},
			stop() {
				documents?.close();
				integrations?.close();
				vault?.lock();
				work?.close();
				work = undefined;
				started = false;
			}
		});
		for (const [name, definition] of Object.entries(tools).sort(
			([a], [b]) => enabled.indexOf(a.slice(7)) - enabled.indexOf(b.slice(7))
		)) {
			const module = name.slice(7);
			if (!enabled.includes(module)) continue;
			api.registerTool(
				(ctx) => ({
					name,
					label: name,
					description: definition.description,
					parameters: definition.parameters,
					async execute(_id, params) {
						try {
							const result = await invoke(
								name,
								params,
								ctx.agentId ? `agent:${ctx.agentId}` : null
							);
							return { content: [{ type: 'text', text: JSON.stringify(result) }], details: result };
						} catch (error) {
							const result = safeError(error);
							return {
								isError: true,
								content: [{ type: 'text', text: JSON.stringify(result) }],
								details: result
							};
						}
					}
				}),
				{ names: [name], optional: true }
			);
			for (const mode of ['read', 'write']) {
				if (name === 'falcon_vault' && mode === 'write') continue;
				api.registerGatewayMethod(
					`falcon.${module}.${mode}`,
					async ({ params, client, respond }) => {
						try {
							const writes =
								params.action === 'command' ||
								(typeof params.action === 'string' &&
									['test', 'refresh', 'pause', 'resume', 'write', 'mkdir'].includes(params.action));
							requireValue(
								mode === 'write' || !writes,
								'access_denied',
								'Use the scoped write operation'
							);
							requireValue(!client?.invalidated, 'access_denied', 'Connection was revoked');
							const authority = client?.internal?.operatorRoleActor;
							const actor = authority?.kind === 'operator' ? `human:${authority.profileId}` : null;
							const result = await invoke(name, params, actor);
							respond(true, result);
						} catch (error) {
							respond(false, undefined, {
								code: 'INVALID_REQUEST',
								message: 'Falcon operation failed',
								details: safeError(error)
							});
						}
					},
					{ scope: mode === 'read' ? 'operator.read' : 'operator.write' }
				);
			}
			const route = `/plugins/falcon-dash/${module}`;
			api.session.controls.registerControlUiDescriptor({
				id: module,
				surface: 'tab',
				label: module[0].toUpperCase() + module.slice(1),
				path: route,
				requiredScopes: ['operator.read'],
				order: 10 + enabled.indexOf(module)
			});
			api.registerHttpRoute({
				path: route,
				auth: 'gateway',
				match: 'exact',
				async handler(req, res) {
					res.setHeader('Cache-Control', 'no-store');
					res.setHeader('Content-Type', 'text/html; charset=utf-8');
					res.setHeader('X-Content-Type-Options', 'nosniff');
					res.setHeader(
						'Content-Security-Policy',
						"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"
					);
					if (req.method !== 'GET' && req.method !== 'HEAD') {
						res.statusCode = 405;
						res.end();
						return;
					}
					try {
						const { dispatchGatewayMethod } =
							await import('openclaw/plugin-sdk/gateway-method-runtime');
						let data;
						if (module === 'documents')
							data = {
								roots: [],
								error:
									'Use authorized typed Documents operations; browser editing is not yet connected.'
							};
						else {
							const response = await dispatchGatewayMethod(`falcon.${module}.read`, {
								action: module === 'vault' ? 'status' : 'list'
							});
							data = response.ok
								? response.payload
								: { error: 'This view is unavailable or your identity lacks access.' };
						}
						res.end(req.method === 'HEAD' ? '' : render(module, data));
					} catch {
						res.statusCode = 503;
						res.end(
							render(module, { error: 'Module unavailable. Retry after the service is ready.' })
						);
					}
				}
			});
		}
		api.on('before_prompt_build', () => ({ prependSystemContext: buildContract(enabled) }));
	}
});

function safeError(error) {
	return error instanceof DomainError
		? { code: error.code, message: error.message, details: error.details }
		: {
				code: 'unavailable',
				message: 'Operation unavailable; no private diagnostic data returned'
			};
}
