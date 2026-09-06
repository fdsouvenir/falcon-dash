import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function verifyReleaseMetadata(pkg, manifest, lock, tag) {
	const fail = (condition, message) => {
		if (!condition) throw Error(message);
	};
	fail(
		pkg.name === '@fdsouvenir/falcon-dash' && manifest.id === 'falcon-dash',
		'Unexpected package/plugin identity'
	);
	fail(
		typeof pkg.version === 'string' &&
			/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version),
		'Invalid release version'
	);
	fail(
		pkg.version === manifest.version &&
			pkg.version === lock.version &&
			pkg.version === lock.packages?.['']?.version,
		'Package, manifest and lockfile versions must match'
	);
	if (tag !== undefined)
		fail(tag === `v${pkg.version}`, 'Release tag does not match the packaged version');
	fail(
		pkg.publishConfig?.registry === 'https://npm.pkg.github.com',
		'Unexpected publication registry'
	);
	fail(
		pkg.openclaw?.extensions?.length === 1 && pkg.openclaw.extensions[0] === './plugin/index.mjs',
		'Expected one plugin entry'
	);
	fail(!pkg.bin, 'Standalone executables must not ship in the plugin');
	return {
		name: pkg.name,
		version: pkg.version,
		registry: pkg.publishConfig.registry,
		prerelease: pkg.version.includes('-'),
		published: false
	};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const read = (name) => JSON.parse(fs.readFileSync(name, 'utf8'));
	console.log(
		JSON.stringify(
			verifyReleaseMetadata(
				read('package.json'),
				read('openclaw.plugin.json'),
				read('package-lock.json'),
				process.argv[2]
			)
		)
	);
}
