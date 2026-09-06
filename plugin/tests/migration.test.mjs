import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { snapshotLegacy, convertLegacy } from '../work/migration.mjs';
import { WorkStore } from '../work/store.mjs';
function setup(t) {
	const directory = mkdtempSync(tmpdir() + '/falcon-conversion-');
	t.after(() => rmSync(directory, { recursive: true }));
	const source = directory + '/legacy.db',
		db = new DatabaseSync(source);
	db.exec(
		"CREATE TABLE entities(id TEXT,type TEXT);CREATE TABLE tasks(entity_id TEXT,title TEXT,summary TEXT,completion_condition TEXT,status TEXT,owner TEXT,project_id TEXT,waiting_on TEXT,waiting_resume_condition TEXT,result_summary TEXT);INSERT INTO entities VALUES('old-task','task'),('old-phase','phase');INSERT INTO tasks(entity_id,title,summary,completion_condition,status) VALUES('old-task','Preserve a source Task','Original scope',NULL,'open');"
	);
	db.close();
	return { directory, source };
}
test('Offline snapshot preserves source bytes and reports missing semantics rather than inventing them', async (t) => {
	const { directory, source } = setup(t),
		before = readFileSync(source);
	const report = await snapshotLegacy(source, directory + '/snapshot.db');
	assert.deepEqual(readFileSync(source), before);
	assert.equal(report.requires_resolution, true);
	assert.ok(report.candidates[0].missing.includes('done_when'));
});
test('Explicit conversion preserves original archive, records retired disposition and validates normal Task commands', async (t) => {
	const { directory, source } = setup(t);
	const snapshot = await snapshotLegacy(source, directory + '/snapshot.db');
	const result = convertLegacy({
		snapshot: snapshot.snapshot,
		expected_sha256: snapshot.sha256,
		target: directory + '/converted',
		dispositions: [
			{
				source_id: 'old-task',
				action: 'convert',
				reason: 'Reviewed definition supplied explicitly',
				commands: [
					{
						command: 'create',
						input: {
							type: 'task',
							title: 'Preserve a source Task',
							description: 'Original scope',
							done_when: 'The reviewed conversion checks pass'
						}
					}
				]
			},
			{
				source_id: 'old-phase',
				action: 'archive',
				reason: 'Retired Phase retained in immutable source snapshot'
			}
		]
	});
	const store = new WorkStore(result.target);
	t.after(() => store.close());
	assert.equal(store.detail(result.mapping['old-task']).definition.description, 'Original scope');
	assert.ok(existsSync(snapshot.snapshot));
	assert.equal(result.report[1].action, 'archive');
});
test('Stale or incomplete conversion plans never create the target', async (t) => {
	const { directory, source } = setup(t),
		snapshot = await snapshotLegacy(source, directory + '/snapshot.db');
	assert.throws(
		() =>
			convertLegacy({
				snapshot: snapshot.snapshot,
				expected_sha256: 'stale',
				target: directory + '/bad',
				dispositions: []
			}),
		{ code: 'snapshot_changed' }
	);
	assert.ok(!existsSync(directory + '/bad'));
	assert.throws(
		() =>
			convertLegacy({
				snapshot: snapshot.snapshot,
				expected_sha256: snapshot.sha256,
				target: directory + '/bad',
				dispositions: []
			}),
		{ code: 'incomplete_mapping' }
	);
	assert.ok(!existsSync(directory + '/bad'));
});
test('A live WAL cannot silently change the snapshot under an unchanged main-file digest', async (t) => {
	const { directory, source } = setup(t);
	const snapshot = await snapshotLegacy(source, directory + '/snapshot.db');
	const writer = new DatabaseSync(snapshot.snapshot);
	t.after(() => writer.close());
	writer.exec(
		'PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;PRAGMA wal_checkpoint(TRUNCATE)'
	);
	const before = readFileSync(snapshot.snapshot);
	writer.exec("UPDATE tasks SET title='Changed only in WAL'");
	assert.deepEqual(readFileSync(snapshot.snapshot), before);
	assert.throws(
		() =>
			convertLegacy({
				snapshot: snapshot.snapshot,
				expected_sha256: snapshot.sha256,
				target: directory + '/bad',
				dispositions: []
			}),
		{ code: 'snapshot_changed' }
	);
	assert.equal(existsSync(directory + '/bad'), false);
});
test('Conversion refuses an archive changed while commands are applied and removes only the new target', async (t) => {
	const { directory, source } = setup(t),
		snapshot = await snapshotLegacy(source, directory + '/snapshot.db'),
		execute = WorkStore.prototype.execute;
	let changed = false;
	WorkStore.prototype.execute = function (...args) {
		const result = execute.apply(this, args);
		if (!changed) {
			changed = true;
			const writer = new DatabaseSync(snapshot.snapshot);
			writer.exec("UPDATE tasks SET title='Archive changed during conversion'");
			writer.close();
		}
		return result;
	};
	t.after(() => (WorkStore.prototype.execute = execute));
	assert.throws(
		() =>
			convertLegacy({
				snapshot: snapshot.snapshot,
				expected_sha256: snapshot.sha256,
				target: directory + '/bad',
				dispositions: [
					{
						source_id: 'old-task',
						action: 'convert',
						reason: 'Explicit synthetic conversion',
						commands: [
							{
								command: 'create',
								input: {
									type: 'task',
									title: 'Preserve source Task',
									description: 'Original scope',
									done_when: 'Explicit conversion checks pass'
								}
							}
						]
					},
					{ source_id: 'old-phase', action: 'archive', reason: 'Retired type remains archived' }
				]
			}),
		{ code: 'snapshot_changed' }
	);
	assert.equal(existsSync(directory + '/bad'), false);
	assert.equal(existsSync(snapshot.snapshot), true);
	assert.equal(existsSync(source), true);
});
test('Unmapped legacy references cannot resolve through Object prototype properties', async (t) => {
	const { directory, source } = setup(t),
		snapshot = await snapshotLegacy(source, directory + '/snapshot.db');
	assert.throws(
		() =>
			convertLegacy({
				snapshot: snapshot.snapshot,
				expected_sha256: snapshot.sha256,
				target: directory + '/bad',
				dispositions: [
					{
						source_id: 'old-task',
						action: 'convert',
						reason: 'Explicit synthetic conversion',
						commands: [
							{
								command: 'create',
								input: {
									type: 'task',
									title: 'Preserve source Task',
									description: 'Original scope',
									done_when: 'Explicit conversion checks pass',
									project_id: { legacy_ref: 'constructor' }
								}
							}
						]
					},
					{ source_id: 'old-phase', action: 'archive', reason: 'Retired type remains archived' }
				]
			}),
		{ code: 'unresolved_reference' }
	);
	assert.equal(existsSync(directory + '/bad'), false);
});
