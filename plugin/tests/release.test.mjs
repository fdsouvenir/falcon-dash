import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { verifyReleaseMetadata } from '../../scripts/verify-release-metadata.mjs';
import { domainContract } from '../contract.mjs';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const pkg = read('package.json'),
	manifest = read('openclaw.plugin.json'),
	lock = read('package-lock.json');
test('Release tag, package, manifest, lockfile and generated contract versions agree', () => {
	assert.equal(verifyReleaseMetadata(pkg, manifest, lock, `v${pkg.version}`).published, false);
	assert.equal(domainContract([]).version, pkg.version);
	for (const [p, m, l, tag] of [
		[pkg, manifest, lock, 'v0.0.0'],
		[pkg, { ...manifest, version: '0.0.0' }, lock, undefined],
		[pkg, manifest, { ...lock, version: '0.0.0' }, undefined],
		[{ ...pkg, bin: { server: 'build/server.js' } }, manifest, lock, undefined],
		[{ ...pkg, publishConfig: { registry: 'https://example.invalid' } }, manifest, lock, undefined]
	])
		assert.throws(() => verifyReleaseMetadata(p, m, l, tag));
});
test('Packed registry metadata contains native plugin/recovery assets and no standalone runtime', () => {
	const [packed] = JSON.parse(
		execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		})
	);
	assert.equal(packed.name, pkg.name);
	assert.equal(packed.version, pkg.version);
	const names = packed.files.map((x) => x.path);
	for (const file of [
		'plugin/index.mjs',
		'plugin/vault/recovery.mjs',
		'openclaw.plugin.json',
		'dist/control-ui/falcon/index.js',
		'dist/control-ui/falcon/index.css',
		// Documentation written for the person installing this, not the engineering record.
		'docs/End User/work.md',
		'docs/End User/passwords.md',
		'docs/End User/documents.md',
		'README.md',
		'LICENSE'
	])
		assert.ok(names.includes(file), file);
	assert.equal(
		names.some((name) =>
			/^(src|build|gateway-plugin|artifacts|\.openclaw|node_modules)\//.test(name)
		),
		false
	);
	// Internal engineering documentation is not part of the product. It names issues, CI runners
	// and open gaps that mean nothing to someone installing the plugin.
	assert.deepEqual(
		names.filter((name) => name.startsWith('docs/Technical/')),
		[]
	);
	// The suite is not part of the product either. `files` ships `plugin/` wholesale, so the test
	// directory rides along unless it is excluded explicitly.
	assert.deepEqual(
		names.filter((name) => name.startsWith('plugin/tests/')),
		[]
	);
});
