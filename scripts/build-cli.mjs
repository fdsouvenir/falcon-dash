import { build } from 'esbuild';
import { chmodSync } from 'node:fs';

// Bundles the falcon CLI (src/cli) separately from the SvelteKit build.
// Self-contained: axi-sdk-js, @toon-format/toon, and work3-shared are inlined.
await build({
	entryPoints: ['src/cli/main.ts'],
	outfile: 'bin/falcon.js',
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node20',
	banner: { js: '#!/usr/bin/env node' },
	logLevel: 'info'
});

chmodSync('bin/falcon.js', 0o755);
