import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { discoverAgentWorkspaces } from '$lib/server/pm/workspace-discovery.js';

const ALLOWED_FILES = new Set(['SOUL.md', 'AGENTS.md', 'IDENTITY.md', 'MEMORY.md']);

function computeHash(content: string): string {
	return createHash('sha256').update(content).digest('hex');
}

/** GET — list files (no path) or read a single file (?path=USER.md) */
export const GET: RequestHandler = async ({ url }) => {
	const path = url.searchParams.get('path');

	const workspaces = discoverAgentWorkspaces();
	if (workspaces.length === 0) {
		return error(500, 'No agent workspaces found');
	}

	// List mode: return all existing known files
	if (!path) {
		const files: { path: string; size: number; hash: string }[] = [];
		for (const name of ALLOWED_FILES) {
			try {
				const content = await readFile(join(workspaces[0].workspace, name), 'utf-8');
				files.push({ path: name, size: Buffer.byteLength(content), hash: computeHash(content) });
			} catch {
				// File doesn't exist, skip
			}
		}
		return json({ files });
	}

	// Single file mode
	if (!ALLOWED_FILES.has(path)) {
		return error(400, 'Invalid or disallowed file path');
	}

	const filePath = join(workspaces[0].workspace, path);
	try {
		const content = await readFile(filePath, 'utf-8');
		const hash = computeHash(content);
		return json({ content, hash });
	} catch (e: unknown) {
		if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
			return error(404, 'File not found');
		}
		throw e;
	}
};

/** PUT { path, content } — write file to all agent workspaces */
export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { path, content } = body;

	if (!path || !ALLOWED_FILES.has(path)) {
		return error(400, 'Invalid or disallowed file path');
	}
	if (typeof content !== 'string') {
		return error(400, 'Content must be a string');
	}

	const workspaces = discoverAgentWorkspaces();
	if (workspaces.length === 0) {
		return error(500, 'No agent workspaces found');
	}

	for (const ws of workspaces) {
		const filePath = join(ws.workspace, path);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, content, 'utf-8');
	}

	return json({ ok: true });
};
