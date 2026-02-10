import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readdir, readFile, writeFile, mkdir, rm, stat, rename } from 'fs/promises';
import { createHash } from 'crypto';
import { join, basename, extname } from 'path';
import { resolveFilePath, isSecretPath, getDocumentsRoot } from '$lib/server/files-config.js';

function computeHash(content: Buffer): string {
	return createHash('sha256').update(content).digest('hex');
}

/** GET: List directory or return file content */
export const GET: RequestHandler = async ({ params }) => {
	const path = params.path || '';

	if (isSecretPath(path)) {
		return error(403, 'Access denied');
	}

	const resolved = path ? resolveFilePath(path) : getDocumentsRoot();
	if (!resolved) {
		return error(400, 'Invalid path');
	}

	try {
		const stats = await stat(resolved);

		if (stats.isDirectory()) {
			const entries = await readdir(resolved, { withFileTypes: true });
			const items = entries
				.filter((e) => e.name !== '.secrets')
				.map((e) => ({
					name: e.name,
					type: e.isDirectory() ? 'directory' : 'file',
					path: path ? `${path}/${e.name}` : e.name
				}));

			// Get stats for each entry
			const detailed = await Promise.all(
				items.map(async (item) => {
					try {
						const itemPath = join(resolved, item.name);
						const itemStats = await stat(itemPath);
						return {
							...item,
							size: itemStats.size,
							modified: itemStats.mtimeMs,
							extension: item.type === 'file' ? extname(item.name) : undefined
						};
					} catch {
						return { ...item, size: 0, modified: 0 };
					}
				})
			);

			return json({ type: 'directory', path, entries: detailed });
		}

		// File: return content with hash
		const content = await readFile(resolved);
		const hash = computeHash(content);
		const mimeType = getMimeType(basename(resolved));

		return new Response(content, {
			headers: {
				'Content-Type': mimeType,
				'X-File-Hash': hash,
				'X-File-Size': String(stats.size),
				'X-File-Modified': String(stats.mtimeMs)
			}
		});
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return error(404, 'Not found');
		}
		return error(500, 'Internal server error');
	}
};

/** PUT: Write file content (requires baseHash for concurrency) */
export const PUT: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';

	if (!path || isSecretPath(path)) {
		return error(403, 'Access denied');
	}

	const resolved = resolveFilePath(path);
	if (!resolved) {
		return error(400, 'Invalid path');
	}

	const baseHash = request.headers.get('x-base-hash');
	if (!baseHash) {
		return error(400, 'Missing X-Base-Hash header for concurrency control');
	}

	try {
		// Check current hash for concurrency
		const existing = await readFile(resolved);
		const currentHash = computeHash(existing);

		if (currentHash !== baseHash) {
			return error(409, 'Conflict: file has been modified since last read');
		}
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
			return error(500, 'Internal server error');
		}
		// File doesn't exist yet — baseHash should be empty string
		if (baseHash !== '') {
			return error(409, 'Conflict: file does not exist');
		}
	}

	const content = Buffer.from(await request.arrayBuffer());
	await writeFile(resolved, content);
	const newHash = computeHash(content);

	return json({ hash: newHash, size: content.length });
};

/** POST: Create new file or folder */
export const POST: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';

	if (!path || isSecretPath(path)) {
		return error(403, 'Access denied');
	}

	const resolved = resolveFilePath(path);
	if (!resolved) {
		return error(400, 'Invalid path');
	}

	const body = await request.json();
	const type = body.type as string; // 'file' or 'directory'

	try {
		if (type === 'directory') {
			await mkdir(resolved, { recursive: true });
			return json({ type: 'directory', path });
		}

		// Create file
		const content = Buffer.from((body.content as string) || '', 'utf-8');
		await writeFile(resolved, content, { flag: 'wx' }); // wx = fail if exists
		const hash = computeHash(content);
		return json({ type: 'file', path, hash, size: content.length });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
			return error(409, 'Already exists');
		}
		return error(500, 'Internal server error');
	}
};

/** DELETE: Delete file or folder */
export const DELETE: RequestHandler = async ({ params }) => {
	const path = params.path || '';

	if (!path || isSecretPath(path)) {
		return error(403, 'Access denied');
	}

	const resolved = resolveFilePath(path);
	if (!resolved) {
		return error(400, 'Invalid path');
	}

	try {
		await rm(resolved, { recursive: true });
		return json({ deleted: true, path });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return error(404, 'Not found');
		}
		return error(500, 'Internal server error');
	}
};

/** PATCH: Rename file or folder */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';

	if (!path || isSecretPath(path)) {
		return error(403, 'Access denied');
	}

	const resolved = resolveFilePath(path);
	if (!resolved) {
		return error(400, 'Invalid path');
	}

	const body = await request.json();
	const newName = body.newName as string;
	if (!newName || newName.includes('/') || newName.includes('..')) {
		return error(400, 'Invalid new name');
	}

	const parentDir = resolved.substring(0, resolved.lastIndexOf('/'));
	const newPath = join(parentDir, newName);

	try {
		await rename(resolved, newPath);
		const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
		const resultPath = parentPath ? `${parentPath}/${newName}` : newName;
		return json({ renamed: true, oldPath: path, newPath: resultPath });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return error(404, 'Not found');
		}
		return error(500, 'Internal server error');
	}
};

function getMimeType(filename: string): string {
	const ext = extname(filename).toLowerCase();
	const types: Record<string, string> = {
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'text/javascript',
		'.ts': 'text/typescript',
		'.json': 'application/json',
		'.md': 'text/markdown',
		'.txt': 'text/plain',
		'.svg': 'image/svg+xml',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.pdf': 'application/pdf',
		'.xml': 'text/xml',
		'.yaml': 'text/yaml',
		'.yml': 'text/yaml',
		'.toml': 'text/toml',
		'.csv': 'text/csv'
	};
	return types[ext] || 'application/octet-stream';
}
