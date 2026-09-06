import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Integrations } from '../integrations/service.mjs';
import { adapters } from '../integrations/adapters.mjs';
test('Provider fixtures retain omitted refresh tokens and disallow redirects', async () => {
	let options;
	const adapter = adapters(async (url, opts) => {
		options = opts;
		assert.equal(url, 'https://services.leadconnectorhq.com/oauth/token');
		return { ok: true, json: async () => ({ access_token: 'SYNTHETIC-NEXT', expires_in: 3600 }) };
	});
	const out = await adapter.highlevel.refresh({
		client_id: 'synthetic',
		client_secret: 'SYNTHETIC-SECRET',
		refresh_token: 'SYNTHETIC-REFRESH'
	});
	assert.deepEqual(out.material, { access_token: 'SYNTHETIC-NEXT' });
	assert.equal(options.redirect, 'error');
});
test('Refresh concurrency, restart ambiguity, and native owner separation', async (t) => {
	const dir = mkdtempSync(tmpdir() + '/falcon-integrations-');
	t.after(() => rmSync(dir, { recursive: true }));
	let release;
	const wait = new Promise((r) => (release = r));
	let calls = 0;
	const vault = {
		resolveForExecution: async (id, actor, fn) => fn({ version: 1, material: {} }),
		rotate: async () => {}
	};
	const service = new Integrations(dir + '/integrations.db', vault, {
		fixture: {
			refresh: async () => {
				calls++;
				await wait;
				return { material: { access_token: 'SYNTHETIC' } };
			}
		}
	});
	t.after(() => service.close());
	service.create(
		{
			id: 'test',
			provider: 'fixture',
			purpose: 'Synthetic contract test',
			owner: 'falcon',
			vault_handle: 'test',
			actors: ['agent:test']
		},
		'agent:test'
	);
	const running = service.run('test', 'refresh', 'agent:test');
	await assert.rejects(() => service.run('test', 'refresh', 'agent:test'), {
		code: 'maintenance_busy'
	});
	release();
	await running;
	assert.equal(calls, 1);
	const c = service.get('test');
	c.phase = 'refreshing';
	service.save(c);
	service.recover();
	assert.equal(service.get('test').health, 'reauthorization_required');
	service.create(
		{
			id: 'native',
			provider: 'fixture',
			purpose: 'Native owner test',
			owner: 'native',
			actors: ['agent:test']
		},
		'agent:test'
	);
	await assert.rejects(() => service.run('native', 'refresh', 'agent:test'), {
		code: 'native_owner'
	});
});
