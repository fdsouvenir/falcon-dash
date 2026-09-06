import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Vault } from '../vault/service.mjs';
import { importLegacyVault } from '../vault/migration.mjs';
test('Explicit UUID-pinned legacy Vault conversion preserves source and archives unmapped entries without grants', async (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-legacy-vault-'));
	t.after(() => fs.rmSync(root, { recursive: true }));
	const source = new Vault(path.join(root, 'source'), { owners: ['human:old'] });
	await source.initialize('human:old');
	await source.unlock('human:old');
	await source.createGroup('Services', 'human:old');
	await source.lock();
	const database = path.join(source.directory, 'credentials.kdbx'),
		key_file = path.join(source.directory, 'unlock.key'),
		base = ['-q', '--no-password', '--key-file', key_file];
	const cli = (args, input = '') => {
		const result = spawnSync('keepassxc-cli', args, { encoding: 'utf8', input });
		assert.equal(result.status, 0, 'Synthetic CLI operation failed');
		return result.stdout.trim();
	};
	cli(['add', ...base, '-p', database, 'Services/Legacy entry'], 'SYNTHETIC-LEGACY-ONLY\n');
	const source_uuid = cli(['show', ...base, '-a', 'Uuid', database, 'Services/Legacy entry']);
	const bytes = fs.readFileSync(database),
		expected_sha256 = createHash('sha256').update(bytes).digest('hex'),
		target = path.join(root, 'converted');
	const plan = {
		database,
		key_file,
		expected_sha256,
		target,
		owners: ['human:new'],
		entries: [
			{
				source_path: 'Services/Legacy entry',
				source_uuid,
				target_id: 'services/current',
				fields: { api_key: 'Password' }
			}
		],
		quiesced: true,
		archive_unmapped: true
	};
	await assert.rejects(importLegacyVault({ ...plan, quiesced: false }));
	await assert.rejects(
		importLegacyVault({
			...plan,
			target: path.join(root, 'wrong-identity'),
			entries: [{ ...plan.entries[0], source_uuid: '0'.repeat(32) }]
		})
	);
	assert.equal(fs.existsSync(path.join(root, 'wrong-identity')), false);
	const result = await importLegacyVault(plan);
	assert.equal(result.converted, 1);
	assert.equal(result.execution_grants, 0);
	assert.equal(JSON.stringify(result).includes('SYNTHETIC-LEGACY'), false);
	assert.deepEqual(fs.readFileSync(database), bytes);
	const restored = new Vault(target, { owners: ['human:new'] });
	await restored.unlock('human:new');
	assert.equal(
		(await restored.reveal('services/current', 'human:new')).api_key,
		'SYNTHETIC-LEGACY-ONLY'
	);
	await assert.rejects(
		restored.resolveForExecution('services/current', 'agent:ungranted', async () => {})
	);
	await restored.lock();
});
