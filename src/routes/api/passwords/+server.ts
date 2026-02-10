import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createSession, clearSession, getSession } from '$lib/server/passwords-config.js';
import { listEntries, vaultExists, initVault } from '$lib/server/keepassxc.js';

/** GET: List password entries (requires session token) */
export const GET: RequestHandler = async ({ request }) => {
	const token = request.headers.get('x-session-token') ?? '';
	const password = getSession(token);
	if (!password) {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		const entries = await listEntries(password);
		return json({ entries });
	} catch (err) {
		return error(500, (err as Error).message);
	}
};

/** POST: unlock, lock, or init */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const action = body.action as string;

	if (action === 'unlock') {
		const masterPassword = body.password as string;
		if (!masterPassword) return error(400, 'Missing password');

		const exists = await vaultExists();
		if (!exists) return error(404, 'No vault found. Initialize first.');

		try {
			// Verify password by listing (will throw if wrong)
			await listEntries(masterPassword);
			const token = createSession(masterPassword);
			return json({ token });
		} catch {
			return error(401, 'Invalid master password');
		}
	}

	if (action === 'lock') {
		const token = request.headers.get('x-session-token') ?? body.token;
		if (token) clearSession(token);
		return json({ locked: true });
	}

	if (action === 'init') {
		const exists = await vaultExists();
		if (exists) return error(409, 'Vault already exists');

		const masterPassword = body.password as string;
		if (!masterPassword) return error(400, 'Missing password');

		try {
			await initVault(masterPassword);
			const token = createSession(masterPassword);
			return json({ created: true, token });
		} catch (err) {
			return error(500, (err as Error).message);
		}
	}

	return error(400, `Unknown action: ${action}`);
};
