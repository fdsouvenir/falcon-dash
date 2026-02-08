import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PasswordVault } from '$lib/server/passwords';

const vault = PasswordVault.getInstance();

export const GET: RequestHandler = async ({ request }) => {
	const available = await vault.isAvailable();
	if (!available) {
		return json({ available: false });
	}

	const token = request.headers.get('x-vault-token');
	const unlocked = token ? vault.validateSession(token) : false;

	if (!unlocked) {
		return json({ available: true, unlocked: false });
	}

	try {
		const entries = await vault.listEntries();
		return json({ available: true, unlocked: true, entries });
	} catch (err) {
		throw error(500, (err as Error).message || 'Failed to list entries');
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		action: 'unlock' | 'lock' | 'init';
		masterPassword?: string;
	};

	const available = await vault.isAvailable();

	if (body.action === 'unlock') {
		if (!available) {
			throw error(503, 'keepassxc-cli is not installed');
		}
		if (!body.masterPassword) {
			throw error(400, 'Master password is required');
		}

		try {
			const token = await vault.unlock(body.masterPassword);
			const entries = await vault.listEntries();
			return json({ ok: true, token, entries });
		} catch (err) {
			throw error(401, (err as Error).message || 'Failed to unlock vault');
		}
	}

	if (body.action === 'lock') {
		vault.lock();
		return json({ ok: true });
	}

	if (body.action === 'init') {
		if (!available) {
			throw error(503, 'keepassxc-cli is not installed');
		}
		if (!body.masterPassword) {
			throw error(400, 'Master password is required');
		}

		try {
			await vault.initVault(body.masterPassword);
			const token = await vault.unlock(body.masterPassword);
			return json({ ok: true, token });
		} catch (err) {
			throw error(500, (err as Error).message || 'Failed to initialize vault');
		}
	}

	throw error(400, `Unknown action: ${body.action}`);
};
