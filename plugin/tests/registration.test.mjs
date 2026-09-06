import { test } from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../index.mjs';
import { buildContract } from '../contract.mjs';
function register(config = {}) {
	const calls = { tools: [], methods: [], tabs: [], routes: [], hooks: [], services: [] };
	plugin.register({
		id: 'falcon-dash',
		pluginConfig: config,
		registerSessionAction: () => {},
		registerTool: (...a) => calls.tools.push(a),
		registerGatewayMethod: (...a) => calls.methods.push(a),
		session: { controls: { registerControlUiDescriptor: (x) => calls.tabs.push(x) } },
		registerHttpRoute: (x) => calls.routes.push(x),
		registerService: (x) => calls.services.push(x),
		on: (...a) => calls.hooks.push(a)
	});
	return calls;
}
test('One runtime registers four real tabs, scoped methods, four tools and one system hook', () => {
	const c = register();
	assert.deepEqual(
		c.tabs.map((x) => x.id),
		['work', 'integrations', 'vault', 'documents']
	);
	assert.equal(c.tools.length, 4);
	assert.deepEqual(
		c.services.map((x) => x.id),
		['falcon-dash', 'falcon-dash:feature-events']
	);
	assert.equal(c.hooks.length, 1);
	assert.equal(c.hooks[0][0], 'before_prompt_build');
	assert.ok(c.hooks[0][1]().prependSystemContext);
	assert.ok(c.routes.every((x) => x.auth === 'gateway'));
	assert.ok(!c.methods.some(([name]) => /reveal|resolve|password/.test(name)));
});
test('Disabled modules have no tools, routes or advertised static operations', () => {
	const c = register({ modules: { vault: false, integrations: false, documents: false } });
	assert.equal(c.tabs.length, 1);
	const contract = c.hooks[0][1]().prependSystemContext;
	assert.equal(Object.keys(JSON.parse(contract).operations).length, 1);
	assert.equal(JSON.parse(buildContract([])).work, undefined);
	assert.equal(buildContract(['work']), buildContract(['work']));
});
test('Ordinary read Gateway methods reject mutation dispatch', async () => {
	const c = register();
	const method = c.methods.find(([name]) => name === 'falcon.work.read')[1];
	let result;
	await method({ params: { action: 'command' }, client: {}, respond: (...r) => (result = r) });
	assert.equal(result[0], false);
	assert.equal(result[2].details.code, 'access_denied');
});

test('Read-scoped RPCs deny every newly added mutation, including disconnect and file deletion', async () => {
	const c = register();
	for (const [module, actions] of Object.entries({
		integrations: ['disconnect', 'refresh', 'pause'],
		documents: ['rename', 'upload', 'trash', 'restore', 'write', 'mkdir']
	})) {
		const handler = c.methods.find(([name]) => name === `falcon.${module}.read`)[1];
		for (const action of actions) {
			let response;
			await handler({ params: { action }, client: {}, respond: (...r) => (response = r) });
			assert.equal(response[0], false);
			assert.equal(response[2].details.code, 'access_denied');
		}
	}
});
test('Synthetic delegated clients cannot bind a human principal or mint Work authorization', async () => {
	const c = register();
	const client = {
		connId: 'synthetic-connection',
		internal: { syntheticClient: true, operatorRoleActor: { kind: 'operator', profileId: 'owner' } }
	};
	let response;
	await c.methods.find(([name]) => name === 'falcon.identity')[1]({
		client,
		respond: (...r) => (response = r)
	});
	assert.equal(response[0], false);
});
test('Gateway keeps original authority through awaited document preparation', async (t) => {
	const fs = await import('node:fs'),
		{ tmpdir } = await import('node:os'),
		{ Documents } = await import('../documents/service.mjs');
	const directory = fs.mkdtempSync(tmpdir() + '/falcon-gateway-race-'),
		workspace = directory + '/workspace';
	fs.mkdirSync(workspace);
	let release, entered;
	const prepared = new Promise((r) => (entered = r)),
		resume = new Promise((r) => (release = r)),
		original = Documents.prototype.write;
	Documents.prototype.write = async function (input, actor, guard) {
		entered();
		await resume;
		return original.call(this, input, actor, guard);
	};
	const c = register({
		dataDir: directory + '/data',
		modules: { work: false, vault: false, integrations: false },
		documentRoots: [{ id: 'docs', path: workspace, actors: ['human:owner'], writable: true }]
	});
	await c.services[0].start({ stateDir: directory + '/state' });
	t.after(async () => {
		Documents.prototype.write = original;
		await c.services[0].stop();
		fs.rmSync(directory, { recursive: true });
	});
	const client = {
		connId: 'human',
		invalidated: false,
		internal: { operatorRoleActor: { kind: 'operator', profileId: 'owner' } }
	};
	let response;
	const call = c.methods.find(([name]) => name === 'falcon.documents.write')[1]({
		params: {
			action: 'write',
			root_id: 'docs',
			path: 'note.md',
			content: 'not allowed',
			expected_version: null
		},
		client,
		respond: (...r) => (response = r)
	});
	await prepared;
	client.invalidated = true;
	release();
	await call;
	assert.equal(response[0], false);
	assert.equal(fs.existsSync(workspace + '/note.md'), false);
});
