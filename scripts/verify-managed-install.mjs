// Synthetic install/ownership proof. No operator state, credentials, or system mutation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(repo, 'artifacts/plugin-v4', `managed-install-${process.pid}`);
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
const entry = fs.realpathSync(path.join(repo, 'node_modules/openclaw/openclaw.mjs'));
if (
	JSON.parse(fs.readFileSync(path.join(path.dirname(entry), 'package.json'))).version !== '2026.9.2'
)
	throw Error('Pinned SDK required');
const runtime = path.join(root, 'runtime');
fs.mkdirSync(runtime, { mode: 0o700 });
const node = path.join(runtime, 'node'),
	systemStat = fs.statSync(process.execPath);
fs.copyFileSync(process.execPath, node, fs.constants.COPYFILE_EXCL);
const hash = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const digest = hash(process.execPath),
	ownedStat = fs.lstatSync(node);
if (
	hash(node) !== digest ||
	ownedStat.uid !== process.getuid() ||
	ownedStat.isSymbolicLink() ||
	ownedStat.mode & 0o022
)
	throw Error('Owned runtime identity/permissions mismatch');
const configFile = path.join(root, 'config.json');
fs.writeFileSync(
	configFile,
	JSON.stringify(
		{
			gateway: { mode: 'local', bind: 'loopback', auth: { mode: 'none' }, port: 28971 },
			agents: { defaults: { workspace: path.join(root, 'workspace') } },
			plugins: {
				allow: ['falcon-dash'],
				entries: { 'falcon-dash': { enabled: true, config: { dataDir: path.join(root, 'data') } } }
			},
			logging: { file: path.join(root, 'runtime.log') }
		},
		null,
		2
	),
	{ mode: 0o600 }
);
const env = {
	PATH: process.env.PATH,
	HOME: root,
	OPENCLAW_STATE_DIR: path.join(root, 'state'),
	OPENCLAW_CONFIG_PATH: configFile
};
async function run(name, command, args) {
	const child = spawn(command, args, { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
	const output = fs.createWriteStream(path.join(root, `${name}.log`), { mode: 0o600 });
	child.stdout.pipe(output, { end: false });
	child.stderr.pipe(output, { end: false });
	const code = await new Promise((resolve, reject) => {
		child.on('error', reject);
		child.on('close', resolve);
	});
	output.end();
	if (code !== 0) throw Error(`${name} failed; inspect its synthetic log`);
}
await run('pack', 'npm', ['pack', '--ignore-scripts', '--pack-destination', root]);
const archives = fs.readdirSync(root).filter((p) => p.endsWith('.tgz'));
if (archives.length !== 1) throw Error('Expected one archive');
await run('install', node, [
	entry,
	'plugins',
	'install',
	path.join(root, archives[0]),
	'--accept-capabilities',
	'--force'
]);
await run('managed-audit', node, [
	path.join(repo, 'scripts/verify-managed-secretref.mjs'),
	entry,
	root
]);
await run('managed-provider', node, [
	path.join(repo, 'scripts/verify-plugin-prompt.mjs'),
	entry,
	root,
	'managed'
]);
if (
	hash(process.execPath) !== digest ||
	fs.statSync(process.execPath).uid !== systemStat.uid ||
	fs.statSync(process.execPath).mode !== systemStat.mode
)
	throw Error('System runtime changed');
const proof = {
	root,
	openclaw: '2026.9.2',
	node: process.version,
	nodeSha256: digest,
	systemRuntimeUnchanged: true,
	preset: JSON.parse(fs.readFileSync(path.join(root, 'managed-preset-proof.json'))),
	provider: JSON.parse(fs.readFileSync(path.join(root, 'provider-bound-proof.json')))
};
fs.writeFileSync(path.join(root, 'combined-proof.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
