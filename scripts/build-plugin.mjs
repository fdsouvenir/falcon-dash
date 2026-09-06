import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function check(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) check(path);
		else if (path.endsWith('.mjs')) {
			const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
			if (result.status !== 0) process.exit(1);
		}
	}
}
check('plugin');
const manifest = JSON.parse(readFileSync('openclaw.plugin.json'));
const pkg = JSON.parse(readFileSync('package.json'));
if (manifest.id !== 'falcon-dash' || pkg.openclaw.extensions.length !== 1)
	throw new Error('Expected one Falcon Dash plugin');
console.log('Plugin JavaScript and single-entry package validated');
