import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getWorkspacePath, validatePath, computeHash } from '$lib/server/workspace';

export const GET: RequestHandler = async ({ params }) => {
	const workspaceRoot = getWorkspacePath();
	const filePath = validatePath(params.path, workspaceRoot);

	try {
		const [content, stat] = await Promise.all([fs.readFile(filePath, 'utf-8'), fs.stat(filePath)]);

		return json({
			content,
			hash: computeHash(content),
			mtime: stat.mtime.toISOString()
		});
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error(404, 'File not found');
		}
		throw err;
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const workspaceRoot = getWorkspacePath();
	const filePath = validatePath(params.path, workspaceRoot);
	const { content, baseHash } = (await request.json()) as {
		content: string;
		baseHash?: string;
	};

	if (baseHash) {
		try {
			const existing = await fs.readFile(filePath, 'utf-8');
			const currentHash = computeHash(existing);

			if (currentHash !== baseHash) {
				throw error(409, 'Conflict: file was modified');
			}
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				// File doesn't exist yet, that's ok for create
			} else if ((err as { status?: number }).status === 409) {
				throw err;
			} else {
				throw err;
			}
		}
	} else {
		const dir = path.dirname(filePath);
		await fs.mkdir(dir, { recursive: true });
	}

	await fs.writeFile(filePath, content, 'utf-8');
	const hash = computeHash(content);

	return json({ hash, ok: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const workspaceRoot = getWorkspacePath();
	const filePath = validatePath(params.path, workspaceRoot);

	try {
		await fs.access(filePath);
	} catch {
		throw error(404, 'File not found');
	}

	await fs.unlink(filePath);
	return json({ ok: true });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const workspaceRoot = getWorkspacePath();
	const filePath = validatePath(params.path, workspaceRoot);
	const { newName } = (await request.json()) as { newName: string };

	const dir = path.dirname(filePath);
	const newPath = validatePath(
		path.relative(workspaceRoot, path.join(dir, newName)),
		workspaceRoot
	);

	try {
		await fs.access(newPath);
		throw error(409, 'A file with that name already exists');
	} catch (err) {
		if ((err as { status?: number }).status === 409) {
			throw err;
		}
		// File doesn't exist, which is what we want
	}

	try {
		await fs.access(filePath);
	} catch {
		throw error(404, 'File not found');
	}

	await fs.rename(filePath, newPath);
	return json({ ok: true });
};
