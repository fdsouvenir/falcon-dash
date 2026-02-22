import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getSession } from '$lib/server/passwords-config.js';
import {
	getEntry,
	addEntry,
	editEntry,
	deleteEntry,
	removeAttribute
} from '$lib/server/keepassxc.js';

function requireSession(request: Request): void {
	const token = request.headers.get('x-session-token') ?? '';
	if (!getSession(token)) {
		throw new Error('Vault is locked');
	}
}

/** GET: Get entry with decrypted password */
export const GET: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';
	if (!path) return error(400, 'Missing path');

	try {
		requireSession(request);
	} catch {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		const entry = await getEntry(path);
		return json(entry, {
			headers: {
				'X-Secret-Content': 'true'
			}
		});
	} catch (err) {
		return error(500, (err as Error).message);
	}
};

/** PUT: Create or update entry */
export const PUT: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';
	if (!path) return error(400, 'Missing path');

	try {
		requireSession(request);
	} catch {
		return error(401, 'Vault is locked. Unlock first.');
	}

	const body = await request.json();
	const customAttributes = body.customAttributes as Record<string, string> | undefined;
	const removedAttributes = body.removedAttributes as string[] | undefined;
	const fields = {
		username: body.username as string | undefined,
		password: body.password as string | undefined,
		url: body.url as string | undefined,
		notes: body.notes as string | undefined,
		title: body.title as string | undefined,
		customAttributes
	};

	try {
		// Try edit first, if entry doesn't exist, add it
		try {
			await editEntry(path, fields);
		} catch {
			await addEntry(path, fields);
		}

		// Remove deleted custom attributes
		if (removedAttributes?.length) {
			for (const attr of removedAttributes) {
				await removeAttribute(path, attr);
			}
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

	try {
		requireSession(request);
	} catch {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		await deleteEntry(path);
		return json({ deleted: true, path });
	} catch (err) {
		return error(500, (err as Error).message);
	}
};
