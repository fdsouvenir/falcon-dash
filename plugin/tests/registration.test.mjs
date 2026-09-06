import { test } from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../index.mjs';
import { buildContract } from '../contract.mjs';
function register(config = {}) {
	const calls = { tools: [], methods: [], tabs: [], routes: [], hooks: [], services: [] };
	plugin.register({
		pluginConfig: config,
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
	assert.equal(c.services.length, 1);
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
