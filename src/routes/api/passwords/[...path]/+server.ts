import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PasswordVault } from '$lib/server/passwords';

const vault = PasswordVault.getInstance();

function validateToken(request: Request): void {
	const token = request.headers.get('x-vault-token');
	if (!token || !vault.validateSession(token)) {
		throw error(401, 'Vault is locked or session expired');
	}
}

export const GET: RequestHandler = async ({ params, request }) => {
	const available = await vault.isAvailable();
	if (!available) {
		throw error(503, 'keepassxc-cli is not installed');
	}

	validateToken(request);

	try {
		const entry = await vault.getEntry(params.path);
		return json(entry);
	} catch (err) {
		throw error(500, (err as Error).message || 'Failed to get entry');
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const available = await vault.isAvailable();
	if (!available) {
		throw error(503, 'keepassxc-cli is not installed');
	}

	validateToken(request);

	const body = (await request.json()) as {
		username?: string;
		password?: string;
		url?: string;
		notes?: string;
		create?: boolean;
	};

	try {
		if (body.create) {
			await vault.createEntry(params.path, body);
		} else {
			await vault.editEntry(params.path, body);
		}
		return json({ ok: true });
	} catch (err) {
		throw error(500, (err as Error).message || 'Failed to save entry');
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	const available = await vault.isAvailable();
	if (!available) {
		throw error(503, 'keepassxc-cli is not installed');
	}

	validateToken(request);

	try {
		await vault.deleteEntry(params.path);
		return json({ ok: true });
	} catch (err) {
		throw error(500, (err as Error).message || 'Failed to delete entry');
	}
};
