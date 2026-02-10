import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/** GET: Read gateway token and URL from ~/.openclaw/openclaw.json */
export const GET: RequestHandler = async () => {
	try {
		const configPath = join(homedir(), '.openclaw', 'openclaw.json');
		const raw = readFileSync(configPath, 'utf-8');
		const config = JSON.parse(raw);

		const token = config?.gateway?.auth?.token;
		if (!token || typeof token !== 'string') {
			return json({ error: 'No gateway token found in config' }, { status: 404 });
		}

		const port = config?.gateway?.port ?? 18789;
		const bind = config?.gateway?.bind ?? 'loopback';
		const host = bind === 'loopback' ? '127.0.0.1' : bind;
		const url = `ws://${host}:${port}`;

		return json({ token, url });
	} catch {
		return json({ error: 'Could not read gateway config' }, { status: 404 });
	}
};
