import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { Vault } from '../vault/service.mjs';
test('Real KeePassXC synthetic credentials: protected inventory, human access, pair rotation and conflict', async (t) => {
	const directory = fs.mkdtempSync(tmpdir() + '/falcon-vault-');
	t.after(() => fs.rmSync(directory, { recursive: true }));
	const vault = new Vault(directory, { owners: ['human:owner'], executors: ['agent:worker'] });
	await vault.initialize('human:owner');
	await vault.unlock('human:owner');
	await vault.create('operator-added', { password: 'SYNTHETIC-OPERATOR-CANARY' }, 'human:owner');
	await vault.create(
		'agent-added',
		{ access_token: 'SYNTHETIC-ACCESS-1', refresh_token: 'SYNTHETIC-REFRESH-1' },
		'agent:worker'
	);
	const inventory = await vault.inventory('agent:worker');
	assert.ok(!JSON.stringify(inventory).includes('SYNTHETIC'));
	assert.equal(
		(await vault.reveal('operator-added', 'human:owner')).password,
		'SYNTHETIC-OPERATOR-CANARY'
	);
	assert.equal(
		(await vault.reveal('agent-added', 'human:owner')).access_token,
		'SYNTHETIC-ACCESS-1'
	);
	await assert.rejects(() => vault.reveal('agent-added', 'agent:worker'), {
		code: 'access_denied'
	});
	const results = await Promise.allSettled([
		vault.rotate(
			'agent-added',
			{ access_token: 'SYNTHETIC-ACCESS-2', refresh_token: 'SYNTHETIC-REFRESH-2' },
			1,
			'agent:worker'
		),
		vault.rotate('agent-added', { access_token: 'SYNTHETIC-ACCESS-3' }, 1, 'agent:worker')
	]);
	assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
	await vault.resolveForExecution('agent-added', 'agent:worker', (record) => {
		assert.equal(record.version, 2);
		assert.ok(record.material.refresh_token);
	});
	vault.lock();
	await assert.rejects(() => vault.reveal('agent-added', 'human:owner'), { code: 'vault_locked' });
});
