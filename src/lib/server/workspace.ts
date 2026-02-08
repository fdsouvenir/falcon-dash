import { error } from '@sveltejs/kit';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';

export function getWorkspacePath(): string {
	return process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw/workspace');
}

export function computeHash(content: string): string {
	return createHash('sha256').update(content).digest('hex');
}

export function validatePath(requestedPath: string, workspaceRoot: string): string {
	const resolved = path.resolve(workspaceRoot, requestedPath);

	if (!resolved.startsWith(workspaceRoot)) {
		throw error(403, 'Access denied: path outside workspace');
	}

	if (requestedPath.includes('.secrets') || resolved.includes('.secrets')) {
		throw error(403, 'Access denied: protected path');
	}

	return resolved;
}
