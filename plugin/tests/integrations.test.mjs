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
	c.operation_pid = 2147483647;
	c.operation_start = 'dead-process';
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
test('A disconnect during refresh cannot rotate credentials or resurrect the connection', async (t) => {
	const dir = mkdtempSync(tmpdir() + '/falcon-disconnect-');
	let release, started;
	const barrier = new Promise((r) => (release = r)),
		ready = new Promise((r) => (started = r));
	let rotations = 0;
	const vault = {
		resolveForExecution: async (id, actor, fn) => fn({ version: 1, material: {} }),
		rotate: async () => {
			rotations++;
		}
	};
	const service = new Integrations(dir + '/integrations.db', vault, {
		fixture: {
			refresh: async () => {
				started();
				await barrier;
				return { material: { access_token: 'SYNTHETIC-NEW' } };
			}
		}
	});
	t.after(async () => {
		await service.close();
		rmSync(dir, { recursive: true });
	});
	service.create(
		{
			id: 'race',
			provider: 'fixture',
			purpose: 'Disconnect race',
			owner: 'falcon',
			vault_handle: 'race',
			actors: ['agent:test']
		},
		'agent:test'
	);
	const refresh = service.run('race', 'refresh', 'agent:test');
	await ready;
	await service.run('race', 'disconnect', 'agent:test');
	release();
	await assert.rejects(() => refresh, { code: 'authority_changed' });
	assert.equal(rotations, 0);
	assert.equal(service.get('race').disconnected, true);
	assert.equal(service.get('race').paused, true);
});
test('Another service does not recover an operation whose owning process is alive', async (t) => {
	const dir = mkdtempSync(tmpdir() + '/falcon-active-lease-');
	let release, started;
	const barrier = new Promise((r) => (release = r)),
		ready = new Promise((r) => (started = r));
	const vault = {
		resolveForExecution: async (id, actor, fn) => fn({ version: 1, material: {} }),
		rotate: async () => {}
	};
	const adapters = {
		fixture: {
			refresh: async () => {
				started();
				await barrier;
				return { material: { access_token: 'SYNTHETIC' } };
			}
		}
	};
	const one = new Integrations(dir + '/integrations.db', vault, adapters),
		two = new Integrations(dir + '/integrations.db', vault, adapters);
	t.after(async () => {
		await one.close();
		await two.close();
		rmSync(dir, { recursive: true });
	});
	one.create(
		{
			id: 'active',
			provider: 'fixture',
			purpose: 'Live lease',
			owner: 'falcon',
			vault_handle: 'active',
			actors: ['agent:test']
		},
		'agent:test'
	);
	const refresh = one.run('active', 'refresh', 'agent:test');
	await ready;
	two.recover();
	assert.equal(two.get('active').phase, 'refreshing');
	release();
	await refresh;
});
test('Oversized provider replies are rejected without returning provider content', async () => {
	const adapter = adapters(async () => new Response('X'.repeat(262145)));
	await assert.rejects(
		() =>
			adapter.highlevel.refresh({
				client_id: 'synthetic',
				client_secret: 'SYNTHETIC',
				refresh_token: 'SYNTHETIC'
			}),
		{ code: 'provider_response_invalid' }
	);
});
test('HighLevel readiness validates the documented API version and exact configured sub-account', async () => {
	let version;
	const good = adapters(async (url, options) => {
		assert.equal(url, 'https://services.leadconnectorhq.com/locations/synthetic-location');
		version = options.headers.Version;
		return { ok: true, json: async () => ({ location: { id: 'synthetic-location' } }) };
	});
	assert.equal(
		(await good.highlevel.test({ access_token: 'SYNTHETIC' }, { account_id: 'synthetic-location' }))
			.health,
		'healthy'
	);
	assert.equal(version, 'v3');
	const wrong = adapters(async () => ({
		ok: true,
		json: async () => ({ location: { id: 'another-location' } })
	}));
	await assert.rejects(
		() => wrong.highlevel.test({ access_token: 'SYNTHETIC' }, { account_id: 'synthetic-location' }),
		{ code: 'provider_response_invalid' }
	);
});
