import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getWorkspacePath, validatePath } from '$lib/server/workspace';

export const GET: RequestHandler = async ({ url }) => {
	const dir = url.searchParams.get('dir') || '';
	const workspaceRoot = getWorkspacePath();
	const dirPath = validatePath(dir || '.', workspaceRoot);

	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });
		const files = await Promise.all(
			entries
				.filter((entry) => !entry.name.startsWith('.'))
				.map(async (entry) => {
					const fullPath = path.join(dirPath, entry.name);
					const isDirectory = entry.isDirectory();
					let size = 0;
					let mtime = new Date().toISOString();

					try {
						const stat = await fs.stat(fullPath);
						size = isDirectory ? 0 : stat.size;
						mtime = stat.mtime.toISOString();
					} catch {
						// stat failed, use defaults
					}

					return {
						name: entry.name,
						isDirectory,
						size,
						mtime
					};
				})
		);

		return json({ files });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return json({ files: [] });
		}
		throw err;
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const { dir, name } = (await request.json()) as { dir: string; name: string };
	const workspaceRoot = getWorkspacePath();
	const folderPath = validatePath(dir ? path.join(dir, name) : name, workspaceRoot);

	try {
		await fs.access(folderPath);
		throw error(409, 'A folder with that name already exists');
	} catch (err) {
		if ((err as { status?: number }).status === 409) {
			throw err;
		}
		// Doesn't exist, which is what we want
	}

	await fs.mkdir(folderPath, { recursive: true });
	return json({ ok: true });
};
