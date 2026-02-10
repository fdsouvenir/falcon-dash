import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getSession } from '$lib/server/passwords-config.js';
import { getEntry, addEntry, editEntry, deleteEntry } from '$lib/server/keepassxc.js';

function requireSession(request: Request): string {
	const token = request.headers.get('x-session-token') ?? '';
	const password = getSession(token);
	if (!password) {
		throw new Error('Vault is locked');
	}
	return password;
}

/** GET: Get entry with decrypted password */
export const GET: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';
	if (!path) return error(400, 'Missing path');

	let password: string;
	try {
		password = requireSession(request);
	} catch {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		const entry = await getEntry(password, path);
		return json(entry);
	} catch (err) {
		return error(500, (err as Error).message);
	}
};

/** PUT: Create or update entry */
export const PUT: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';
	if (!path) return error(400, 'Missing path');

	let password: string;
	try {
		password = requireSession(request);
	} catch {
		return error(401, 'Vault is locked. Unlock first.');
	}

	const body = await request.json();
	const fields = {
		username: body.username as string | undefined,
		password: body.password as string | undefined,
		url: body.url as string | undefined,
		notes: body.notes as string | undefined,
		title: body.title as string | undefined
	};

	try {
		// Try edit first, if entry doesn't exist, add it
		try {
			await editEntry(password, path, fields);
		} catch {
			await addEntry(password, path, fields);
		}
		return json({ success: true, path });
	} catch (err) {
		return error(500, (err as Error).message);
	}
};

/** DELETE: Delete entry */
export const DELETE: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';
	if (!path) return error(400, 'Missing path');

	let password: string;
	try {
		password = requireSession(request);
	} catch {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		await deleteEntry(password, path);
		return json({ deleted: true, path });
	} catch (err) {
		return error(500, (err as Error).message);
	}
};
