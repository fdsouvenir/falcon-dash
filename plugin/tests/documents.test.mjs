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
