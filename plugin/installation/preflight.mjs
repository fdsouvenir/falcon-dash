// Read-only offline acceptance. Never installs, stops services, or changes data/configuration.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);
function outsideCheckout(input) {
	if (!path.isAbsolute(input)) throw Error('Deployment paths must be absolute');
	const real = fs.realpathSync(input);
	for (let current = real; ; current = path.dirname(current)) {
		if (fs.existsSync(path.join(current, '.git')))
			throw Error('Deployed artifacts and data must not run from a development checkout');
		if (current === path.dirname(current)) break;
	}
	return real;
}
export function verifyOfflineInstallation(plan) {
	const installed = outsideCheckout(plan.installed_root),
		data = outsideCheckout(plan.data_root),
		rollback = outsideCheckout(plan.rollback_root);
	if (
		inside(data, installed) ||
		inside(installed, data) ||
		inside(rollback, installed) ||
		inside(installed, rollback) ||
		inside(rollback, data) ||
		inside(data, rollback)
	)
		throw Error('Installed code, data and rollback storage must be separate');
	const pkg = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
	const manifest = JSON.parse(
		fs.readFileSync(path.join(installed, 'openclaw.plugin.json'), 'utf8')
	);
	if (
		pkg.name !== '@fdsouvenir/falcon-dash' ||
		manifest.id !== 'falcon-dash' ||
		pkg.version !== plan.version ||
		manifest.version !== plan.version ||
		pkg.bin
	)
		throw Error('Installed artifact identity/version mismatch');
	if (pkg.openclaw?.extensions?.length !== 1 || pkg.openclaw.extensions[0] !== './plugin/index.mjs')
		throw Error('Installed artifact is not the single plugin');
	if (
		!fs.existsSync(path.join(installed, 'plugin/index.mjs')) ||
		!fs.existsSync(path.join(installed, 'dist/control-ui/falcon/index.js'))
	)
		throw Error('Installed native assets missing');
	if (
		!/^[a-f0-9]{64}$/.test(plan.archive_sha256 ?? '') ||
		createHash('sha256').update(fs.readFileSync(plan.archive)).digest('hex') !== plan.archive_sha256
	)
		throw Error('Reviewed archive checksum mismatch');

	if (
		!Array.isArray(plan.backups) ||
		!plan.backups.some((b) => b.kind === 'work') ||
		!plan.backups.some((b) => b.kind === 'vault')
	)
		throw Error('Work and Vault recovery artifacts are required');
	for (const backup of plan.backups) {
		const file = fs.realpathSync(backup.path);
		if (
			!inside(file, rollback) ||
			!fs.lstatSync(backup.path).isFile() ||
			fs.lstatSync(backup.path).isSymbolicLink() ||
			!/^[a-f0-9]{64}$/.test(backup.sha256 ?? '') ||
			createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== backup.sha256
		)
			throw Error('Rollback artifact integrity/path mismatch');
		if (backup.kind === 'work') {
			if (fs.existsSync(file + '-wal') && fs.statSync(file + '-wal').size)
				throw Error('Work recovery snapshot still has live WAL');
			const db = new DatabaseSync(file, { readOnly: true });
			try {
				if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok')
					throw Error('Work snapshot integrity failed');
			} finally {
				db.close();
			}
		}
	}
	if (!plan.backups_verified || !plan.isolated_restore_verified || !plan.mapping_reviewed)
		throw Error('Verified backup, isolated restoration and explicit mapping are required');
	if (plan.legacy_service?.active !== false || plan.legacy_service?.enabled !== false)
		throw Error('Recorded legacy service retirement is incomplete');
	if (!plan.legacy_runtime_version || !fs.existsSync(path.join(rollback, 'rollback.json')))
		throw Error('Versioned rollback evidence missing');
	return {
		offline_preflight: 'passed',
		version: pkg.version,
		installed_artifact_outside_checkout: true,
		production_changed: false,
		assurance:
			'Recorded offline evidence only; re-inspect live services and artifact integrity before an authorized cutover.'
	};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.length !== 3) throw Error('Usage: node preflight.mjs <offline-plan.json>');
	console.log(
		JSON.stringify(verifyOfflineInstallation(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))))
	);
}
