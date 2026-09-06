import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { WorkStore } from '../work/store.mjs';
import { verifyOfflineInstallation } from '../installation/preflight.mjs';
test('Offline retirement gate requires installed versioned artifacts outside checkout and verified recovery evidence', (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-offline-install-'));
	t.after(() => fs.rmSync(root, { recursive: true }));
	const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
	const installed = path.join(root, 'installed', version),
		data = path.join(root, 'data'),
		rollback = path.join(root, 'rollback');
	for (const dir of [
		installed,
		data,
		rollback,
		path.join(installed, 'plugin'),
		path.join(installed, 'dist/control-ui/falcon')
	])
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	for (const file of [
		'package.json',
		'openclaw.plugin.json',
		'plugin/index.mjs',
		'dist/control-ui/falcon/index.js'
	])
		fs.copyFileSync(file, path.join(installed, file));
	const archive = path.join(root, 'reviewed.tgz');
	fs.writeFileSync(archive, 'Synthetic archived-artifact checksum fixture');
	const dbfile = path.join(rollback, 'work.db'),
		work = new WorkStore(dbfile);
	work.execute(
		{
			command: 'create',
			idempotency_key: 'offline-fixture',
			input: {
				type: 'task',
				title: 'Verify restored installation',
				description: 'Use isolated artifacts, never the live service',
				done_when: 'Offline guards reject unsafe paths'
			}
		},
		'agent:fixture'
	);
	work.close();
	const vault = path.join(rollback, 'vault-fixture.kdbx');
	fs.writeFileSync(
		vault,
		'Synthetic checksum-only Vault artifact; real restore is covered by recovery.test.mjs'
	);
	fs.writeFileSync(path.join(rollback, 'rollback.json'), '{}');
	const hash = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
	const plan = {
		installed_root: installed,
		data_root: data,
		rollback_root: rollback,
		version,
		archive,
		archive_sha256: hash(archive),
		backups: [
			{ kind: 'work', path: dbfile, sha256: hash(dbfile) },
			{ kind: 'vault', path: vault, sha256: hash(vault) }
		],
		backups_verified: true,
		isolated_restore_verified: true,
		mapping_reviewed: true,
		legacy_service: { active: false, enabled: false },
		legacy_runtime_version: 'synthetic-old'
	};
	assert.equal(verifyOfflineInstallation(plan).production_changed, false);
	for (const patch of [
		{ legacy_service: { active: true, enabled: false } },
		{ legacy_service: { active: false, enabled: true } },
		{ mapping_reviewed: false },
		{ isolated_restore_verified: false },
		{ version: 'wrong' },
		{ archive_sha256: '0'.repeat(64) },
		{ backups: [] },
		{ data_root: installed }
	])
		assert.throws(() => verifyOfflineInstallation({ ...plan, ...patch }));
	fs.mkdirSync(path.join(installed, '.git'));
	assert.throws(() => verifyOfflineInstallation(plan), /development checkout/);
});
