import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { Documents } from '../documents/service.mjs';
function setup(t) {
	const path = fs.mkdtempSync(tmpdir() + '/falcon-documents-');
	const service = new Documents([{ id: 'test', path, actors: ['human:test'], writable: true }]);
	t.after(() => {
		service.close();
		fs.rmSync(path, { recursive: true });
	});
	return { path, service, actor: 'human:test', input: { root_id: 'test', path: 'note.md' } };
}
test('Document edit uses versions and preserves stale input', (t) => {
	const { service, actor, input } = setup(t);
	service.write({ ...input, content: 'First version', expected_version: null }, actor);
	const first = service.read(input, actor);
	service.write({ ...input, content: 'Second version', expected_version: first.version }, actor);
	assert.throws(
		() =>
			service.write({ ...input, content: 'Stale edit', expected_version: first.version }, actor),
		{ code: 'version_conflict' }
	);
	assert.equal(service.read(input, actor).content, 'Second version');
});
test('Traversal, credential names, symlinks, hardlinks and other actors are denied', (t) => {
	const { path, service, actor, input } = setup(t);
	fs.writeFileSync(path + '/note.md', 'Synthetic public document');
	fs.symlinkSync('/tmp', path + '/escape');
	fs.linkSync(path + '/note.md', path + '/linked.md');
	for (const name of ['../note.md', '.env', 'vault.json', 'escape/file.md', 'linked.md'])
		assert.throws(() => service.read({ ...input, path: name }, actor));
	assert.throws(() => service.read(input, 'agent:other'), { code: 'access_denied' });
});
test('Malicious markup remains text, never trusted HTML', (t) => {
	const { service, actor, input } = setup(t);
	service.write(
		{ ...input, content: '<script>alert("synthetic")</script>', expected_version: null },
		actor
	);
	assert.equal(service.read(input, actor).render, 'text');
});
test('Authorized text upload/download, no-clobber rename, and targeted trash/restore', (t) => {
	const { service, actor, input } = setup(t);
	service.upload(
		{ ...input, content: 'A recoverable synthetic document', expected_version: null },
		actor
	);
	const download = service.download(input, actor);
	assert.equal(download.trust, 'untrusted-document');
	service.rename(
		{ ...input, destination: 'renamed.md', expected_version: download.version },
		actor
	);
	const renamed = { ...input, path: 'renamed.md' };
	assert.throws(() => service.trash({ ...renamed, expected_version: download.version }, actor), {
		code: 'confirmation_required'
	});
	const removed = service.trash(
		{ ...renamed, expected_version: download.version, confirmed: true },
		actor
	);
	assert.throws(() => service.read(renamed, actor));
	service.restore({ root_id: input.root_id, trash_id: removed.trash_id }, actor);
	assert.equal(service.read(renamed, actor).version, download.version);
});
test('Rename cannot overwrite another document or cross protected paths', (t) => {
	const { service, actor, input } = setup(t);
	const created = service.write({ ...input, content: 'Source', expected_version: null }, actor);
	service.write(
		{ ...input, path: 'destination.md', content: 'Preserve this', expected_version: null },
		actor
	);
	assert.throws(
		() =>
			service.rename(
				{ ...input, destination: 'destination.md', expected_version: created.version },
				actor
			),
		{ code: 'already_exists' }
	);
	assert.throws(() =>
		service.rename(
			{ ...input, destination: '../escape.md', expected_version: created.version },
			actor
		)
	);
	assert.equal(service.read({ ...input, path: 'destination.md' }, actor).content, 'Preserve this');
});
test('Credential-shaped JSON and private keys cannot be exposed under innocuous filenames', (t) => {
	const { path, service, actor, input } = setup(t);
	fs.writeFileSync(
		path + '/settings.json',
		JSON.stringify({ nested: { apiKey: 'SYNTHETIC-CREDENTIAL' } })
	);
	assert.throws(() => service.read({ ...input, path: 'settings.json' }, actor), {
		code: 'protected_content'
	});
	assert.throws(
		() =>
			service.write(
				{
					...input,
					content: '-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----',
					expected_version: null
				},
				actor
			),
		{ code: 'protected_content' }
	);
});
test('A registered workspace below OpenClaw state is usable, but state and credential roots are not', (t) => {
	const { path } = setup(t);
	const state = path + '/.openclaw',
		workspace = state + '/workspace';
	fs.mkdirSync(workspace, { recursive: true });
	fs.mkdirSync(state + '/credentials');
	const options = { forbiddenRoots: [state], protectedRoots: [state + '/credentials'] };
	const docs = new Documents(
		[{ id: 'workspace', path: workspace, actors: ['agent:test'], writable: true }],
		options
	);
	t.after(() => docs.close());
	docs.write(
		{
			root_id: 'workspace',
			path: 'note.md',
			content: 'Allowed workspace note',
			expected_version: null
		},
		'agent:test'
	);
	assert.equal(
		docs.read({ root_id: 'workspace', path: 'note.md' }, 'agent:test').content,
		'Allowed workspace note'
	);
	assert.throws(
		() => new Documents([{ id: 'bad', path: state, actors: ['agent:test'] }], options),
		{ code: 'unsafe_root' }
	);
	assert.throws(
		() =>
			new Documents([{ id: 'bad', path: state + '/credentials', actors: ['agent:test'] }], options),
		{ code: 'unsafe_root' }
	);
});
test('Workspace discovery is actor-scoped, listing is sorted/paged, and copy path is authorized', (t) => {
	const { service, actor, input, path } = setup(t);
	service.write({ ...input, path: 'z.md', content: 'Last', expected_version: null }, actor);
	service.write({ ...input, path: 'a.md', content: 'First', expected_version: null }, actor);
	assert.equal(service.rootsFor(actor).roots.length, 1);
	assert.deepEqual(service.rootsFor('agent:other').roots, []);
	const listing = service.list({ root_id: 'test', limit: 1 }, actor);
	assert.equal(listing.entries[0].name, 'a.md');
	assert.equal(listing.total, 2);
	assert.equal(listing.next_offset, 1);
	assert.equal(service.copyPath({ ...input, path: 'a.md' }, actor).path, path + '/a.md');
});
