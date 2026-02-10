import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readFile, rm, rename, stat } from 'fs/promises';
import { join, basename } from 'path';
import { resolveFilePath, isSecretPath, getDocumentsRoot } from '$lib/server/files-config.js';

/** POST: Bulk operations */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const action = body.action as string;
	const paths = body.paths as string[];

	if (!action || !paths || !Array.isArray(paths) || paths.length === 0) {
		return error(400, 'Missing action or paths');
	}

	// Validate all paths
	for (const p of paths) {
		if (isSecretPath(p)) return error(403, 'Access denied');
		if (!resolveFilePath(p)) return error(400, `Invalid path: ${p}`);
	}

	if (action === 'delete') {
		const results: Array<{ path: string; success: boolean; error?: string }> = [];
		for (const p of paths) {
			try {
				const resolved = resolveFilePath(p)!;
				await rm(resolved, { recursive: true });
				results.push({ path: p, success: true });
			} catch (err) {
				results.push({ path: p, success: false, error: (err as Error).message });
			}
		}
		return json({ action: 'delete', results });
	}

	if (action === 'move') {
		const destination = body.destination as string;
		if (destination === undefined || destination === null) {
			return error(400, 'Missing destination');
		}

		const destResolved = destination ? resolveFilePath(destination) : getDocumentsRoot();
		if (!destResolved) return error(400, 'Invalid destination');

		// Verify destination is a directory
		try {
			const destStat = await stat(destResolved);
			if (!destStat.isDirectory()) return error(400, 'Destination is not a directory');
		} catch {
			return error(404, 'Destination not found');
		}

		const results: Array<{ path: string; newPath: string; success: boolean; error?: string }> = [];
		for (const p of paths) {
			try {
				const resolved = resolveFilePath(p)!;
				const name = basename(resolved);
				const newResolved = join(destResolved, name);
				await rename(resolved, newResolved);
				const newPath = destination ? `${destination}/${name}` : name;
				results.push({ path: p, newPath, success: true });
			} catch (err) {
				results.push({ path: p, newPath: '', success: false, error: (err as Error).message });
			}
		}
		return json({ action: 'move', results });
	}

	if (action === 'download') {
		// Build a simple collection of file contents
		const files: Array<{ path: string; name: string; content: string }> = [];
		for (const p of paths) {
			try {
				const resolved = resolveFilePath(p)!;
				const s = await stat(resolved);
				if (s.isFile()) {
					const content = await readFile(resolved, 'utf-8');
					files.push({ path: p, name: basename(p), content });
				}
			} catch {
				// skip unreadable files
			}
		}
		return json({ action: 'download', files });
	}

	return error(400, `Unknown action: ${action}`);
};
