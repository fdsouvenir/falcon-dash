#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');

const command = process.argv[2] || 'start';

switch (command) {
	case 'start': {
		const port =
			process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ||
			process.env.FALCON_DASH_PORT ||
			'3000';
		const host =
			process.argv.find((a) => a.startsWith('--host='))?.split('=')[1] ||
			process.env.FALCON_DASH_HOST ||
			'0.0.0.0';

		const child = spawn(process.execPath, [resolve(packageRoot, 'build', 'index.js')], {
			cwd: packageRoot,
			stdio: 'inherit',
			env: { ...process.env, PORT: port, HOST: host }
		});

		process.on('SIGINT', () => child.kill('SIGINT'));
		process.on('SIGTERM', () => child.kill('SIGTERM'));

		child.on('exit', (code) => process.exit(code ?? 1));
		break;
	}

	case 'path': {
		console.log(packageRoot);
		break;
	}

	case 'version': {
		const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf-8'));
		console.log(pkg.version);
		break;
	}

	default:
		console.error(`Unknown command: ${command}`);
		console.error('Usage: falcon-dash [start|path|version]');
		process.exit(1);
}
