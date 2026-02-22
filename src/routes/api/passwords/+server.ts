import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createSession, clearSession, getSession } from '$lib/server/passwords-config.js';
import { listEntries, vaultExists, keyFileExists, initVault } from '$lib/server/keepassxc.js';

/** GET: List password entries (requires session token) */
export const GET: RequestHandler = async ({ request }) => {
	const exists = await vaultExists();
	if (!exists) {
		return error(404, 'No vault found. Initialize first.');
	}

	const token = request.headers.get('x-session-token') ?? '';
	if (!getSession(token)) {
		return error(401, 'Vault is locked. Unlock first.');
	}

	try {
		const entries = await listEntries();
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
		const exists = await vaultExists();
		if (!exists) return error(404, 'No vault found. Initialize first.');

		const hasKey = await keyFileExists();
		if (!hasKey) return error(400, 'Keyfile not found at ~/.openclaw/vault.key');

		try {
			// Verify keyfile works by listing entries
			await listEntries();
			const token = createSession();
			return json({ token });
		} catch {
			return error(401, 'Failed to unlock vault — keyfile may be invalid');
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

		try {
			await initVault();
			const token = createSession();
			return json({ created: true, token });
		} catch (err) {
			return error(500, (err as Error).message);
		}
	}

	return error(400, `Unknown action: ${action}`);
};
