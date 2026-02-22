import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getSession } from '$lib/server/passwords-config.js';
import { addEntry } from '$lib/server/keepassxc.js';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const SECRETS_DIR = join(homedir(), '.openclaw', 'secrets');

interface SecretFile {
	name: string;
	size: number;
	preview: string;
}

/** GET: Preview .secrets/ files */
export const GET: RequestHandler = async ({ request }) => {
	const token = request.headers.get('x-session-token') ?? '';
	if (!getSession(token)) {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		const files: SecretFile[] = [];
		const entries = await readdir(SECRETS_DIR);

		for (const entry of entries) {
			const filePath = join(SECRETS_DIR, entry);
			const stats = await stat(filePath);

			if (stats.isFile()) {
				const content = await readFile(filePath, 'utf-8');
				const preview =
					content.length > 50 ? content.substring(0, 50).replace(/./g, '*') + '...' : '***';
				files.push({
					name: entry,
					size: stats.size,
					preview
				});
			}
		}

		return json({ files });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return json({ files: [] });
		}
		return error(500, (err as Error).message);
	}
};

/** POST: Import .secrets/ files into vault */
export const POST: RequestHandler = async ({ request }) => {
	const token = request.headers.get('x-session-token') ?? '';
	if (!getSession(token)) {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		const entries = await readdir(SECRETS_DIR);
		const errors: string[] = [];
		let imported = 0;

		for (const entry of entries) {
			const filePath = join(SECRETS_DIR, entry);
			const stats = await stat(filePath);

			if (stats.isFile()) {
				try {
					const content = await readFile(filePath, 'utf-8');
					const title = entry.replace(/\.[^/.]+$/, ''); // Remove extension

					await addEntry(title, {
						username: '',
						password: content.trim(),
						url: '',
						notes: `Imported from .secrets/${entry}`
					});
					imported++;
				} catch (err) {
					errors.push(`${entry}: ${(err as Error).message}`);
				}
			}
		}

		return json({ imported, errors });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return json({ imported: 0, errors: ['No .secrets directory found'] });
		}
		return error(500, (err as Error).message);
	}
};
