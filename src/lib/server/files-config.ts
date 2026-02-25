import { env } from '$env/dynamic/private';
import { join, resolve, normalize } from 'path';
import { homedir } from 'os';

/** Get the documents root directory */
export function getDocumentsRoot(): string {
	const configured = env.FALCON_DOCUMENTS_PATH;
	if (configured) return resolve(configured);
	return join(homedir(), '.openclaw');
}

/** Resolve a relative path to an absolute path within the documents root.
 * Returns null if the path escapes the root (path traversal attack). */
export function resolveFilePath(relativePath: string): string | null {
	const root = getDocumentsRoot();
	const resolved = resolve(root, normalize(relativePath));
	if (!resolved.startsWith(root)) return null;
	return resolved;
}

/** Check if a path component is the .secrets directory */
export function isSecretPath(path: string): boolean {
	const parts = path.split(/[/\\]/);
	return parts.some((p) => p === '.secrets');
}
