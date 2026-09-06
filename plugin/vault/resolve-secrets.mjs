#!/usr/bin/env node
// OpenClaw exec-provider protocol v1. stdout is exclusively the protected resolver pipe.
// No HOME/state fallback and no general tool registration. The owner grants exact IDs.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
let input = '';
try {
	for await (const chunk of process.stdin) {
		input += chunk;
		if (Buffer.byteLength(input) > 16384) throw new Error();
	}
	const request = JSON.parse(input);
	if (
		request.protocolVersion !== 1 ||
		!Array.isArray(request.ids) ||
		request.ids.length > 50 ||
		Object.keys(request).some((k) => !['protocolVersion', 'provider', 'ids'].includes(k))
	)
		throw new Error();
	const directory = process.env.FALCON_VAULT_DIRECTORY;
	if (!directory || !path.isAbsolute(directory)) throw new Error();
	const child = spawn(
		'flock',
		[
			'--exclusive',
			'--timeout',
			'10',
			path.join(directory, 'transaction.lock'),
			process.execPath,
			fileURLToPath(new URL('./worker.mjs', import.meta.url)),
			directory
		],
		{ stdio: ['pipe', 'pipe', 'pipe'] }
	);
	let output = '';
	child.stderr.resume();
	child.stdout.on('data', (chunk) => {
		output += chunk;
		if (Buffer.byteLength(output) > 1048576) child.kill('SIGKILL');
	});
	const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
	child.stdin.end(JSON.stringify({ action: 'resolve_refs', ids: request.ids }));
	const code = await new Promise((resolve, reject) => {
		child.on('error', reject);
		child.on('close', resolve);
	});
	clearTimeout(timer);
	const response = JSON.parse(output);
	if (code !== 0 || response.protocolVersion !== 1) throw new Error();
	process.stdout.write(JSON.stringify(response));
} catch {
	process.stdout.write(
		JSON.stringify({ protocolVersion: 1, values: {}, errors: { request: { code: 'NOT_FOUND' } } })
	);
	process.exitCode = 1;
}
